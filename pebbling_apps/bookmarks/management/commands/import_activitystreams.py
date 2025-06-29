import json
import logging
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone

from ...services import ImportService
from ...models import ImportJob

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Import bookmarks from ActivityStreams JSON file"

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path", type=str, help="Path to ActivityStreams JSON file to import"
        )
        parser.add_argument(
            "username", type=str, help="Username to assign bookmarks to"
        )
        parser.add_argument(
            "--duplicate-handling",
            choices=["skip", "overwrite"],
            default="skip",
            help="How to handle duplicate bookmarks (default: skip)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate the file without importing",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Enable verbose output with detailed progress",
        )
        parser.add_argument(
            "--create-import-job",
            action="store_true",
            help="Create an ImportJob record to track this import",
        )

    def handle(self, **options):
        file_path = options["file_path"]
        username = options["username"]
        duplicate_handling = options["duplicate_handling"]
        dry_run = options["dry_run"]
        verbose = options["verbose"]
        create_import_job = options["create_import_job"]

        # Validate file exists
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            raise CommandError(f"File not found: {file_path}")

        if not file_path_obj.is_file():
            raise CommandError(f"Path is not a file: {file_path}")

        # Get user
        try:
            user = get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist:
            raise CommandError(f"User with username '{username}' not found")

        # Set up logging level based on verbosity
        if verbose:
            logging.basicConfig(level=logging.INFO)
            logger.setLevel(logging.INFO)

        self.stdout.write(f"Starting ActivityStreams import from: {file_path}")
        self.stdout.write(f"Target user: {username}")
        self.stdout.write(f"Duplicate handling: {duplicate_handling}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No data will be imported")
            )

        # Initialize import service
        import_service = ImportService()

        try:
            # Load and validate JSON file
            self.stdout.write("Loading and validating JSON file...")

            with open(file_path, "r", encoding="utf-8") as f:
                json_data = json.load(f)

            # Validate ActivityStreams format
            from ...serializers import ActivityStreamSerializer

            serializer = ActivityStreamSerializer()

            validation_result = serializer.validate_activitystream_format(json_data)
            if not validation_result["valid"]:
                raise CommandError(
                    f"Invalid ActivityStreams format: {', '.join(validation_result['errors'])}"
                )

            # Parse collection
            collection_data = serializer.parse_collection(json_data)
            bookmarks_data = collection_data.get("items", [])
            total_bookmarks = len(bookmarks_data)

            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Valid ActivityStreams file with {total_bookmarks} bookmarks"
                )
            )

            if dry_run:
                self.stdout.write("Dry run validation completed successfully.")
                return

            # Create import job if requested
            import_job = None
            if create_import_job:
                import_job = ImportJob.objects.create(
                    user=user,
                    file_path=str(file_path),
                    file_size=file_path_obj.stat().st_size,
                    total_bookmarks=total_bookmarks,
                    import_options={"duplicate_handling": duplicate_handling},
                    status="processing",
                    started_at=timezone.now(),
                )
                self.stdout.write(f"Created ImportJob #{import_job.id}")

            # Process the import using the same service code as Celery tasks
            self.stdout.write(f"Processing {total_bookmarks} bookmarks...")

            # Create a temporary import job for processing if none exists
            temp_import_job = import_job or ImportJob(
                user=user,
                file_path=str(file_path),
                file_size=file_path_obj.stat().st_size,
                total_bookmarks=total_bookmarks,
                import_options={"duplicate_handling": duplicate_handling},
            )

            # Use the same processing logic as the Celery task
            results = import_service.process_import_data(temp_import_job, json_data)

            processed = results["processed"]
            failed = results["failed"]
            failed_details = results["failed_details"]

            # Update the real import job if it exists
            if import_job:
                import_job.processed_bookmarks = processed
                import_job.failed_bookmarks = failed
                import_job.failed_bookmark_details = failed_details
                import_job.status = "completed"
                import_job.completed_at = timezone.now()
                import_job.save()

            # Report results
            self.stdout.write(self.style.SUCCESS(f"\nImport completed!"))
            self.stdout.write(f"  Successfully processed: {processed}")

            if failed > 0:
                self.stdout.write(self.style.ERROR(f"  Failed: {failed}"))

                # Show first few failures
                if failed_details and not verbose:
                    self.stdout.write("  First few failures:")
                    for detail in failed_details[:3]:
                        self.stdout.write(
                            f"    {detail['index']}: {detail['url']} - {detail['error']}"
                        )

                    if len(failed_details) > 3:
                        self.stdout.write(f"    ... and {len(failed_details) - 3} more")

            if import_job:
                self.stdout.write(f"  ImportJob #{import_job.id} completed")

        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON file: {str(e)}")
        except Exception as e:
            if create_import_job and import_job:
                import_job.status = "failed"
                import_job.error_message = str(e)
                import_job.completed_at = timezone.now()
                import_job.save()

            logger.error(f"Import failed: {str(e)}", exc_info=True)
            raise CommandError(f"Import failed: {str(e)}")
