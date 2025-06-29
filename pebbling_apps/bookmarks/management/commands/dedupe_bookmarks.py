import json
import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.bookmarks.services import URLNormalizer


class Command(BaseCommand):
    help = "Find and remove duplicate bookmarks based on normalized URL hashes"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )
        parser.add_argument(
            "--user",
            type=int,
            help="Only process bookmarks for a specific user ID",
        )
        parser.add_argument(
            "--keep-newer",
            action="store_true",
            default=True,
            help="Keep newer bookmarks when duplicates found (default)",
        )
        parser.add_argument(
            "--keep-older",
            action="store_false",
            dest="keep_newer",
            help="Keep older bookmarks when duplicates found",
        )
        parser.add_argument(
            "--log-level",
            choices=["DEBUG", "INFO", "WARNING", "ERROR"],
            default="INFO",
            help="Set logging level",
        )

    def handle(self, *args, **options):
        # Set up logging
        log_level = getattr(logging, options["log_level"])
        logging.basicConfig(
            level=log_level, format="%(asctime)s - %(levelname)s - %(message)s"
        )
        logger = logging.getLogger("bookmarks.dedupe")

        dry_run = options["dry_run"]
        user_id = options["user"]
        keep_newer = options["keep_newer"]

        # Initialize normalizer
        normalizer = URLNormalizer()

        # Build initial queryset
        queryset = Bookmark.objects.all()
        if user_id:
            queryset = queryset.filter(owner_id=user_id)
            logger.info(f"Processing bookmarks for user ID: {user_id}")

        # Get total count
        total_bookmarks = queryset.count()
        logger.info(f"Starting deduplication for {total_bookmarks} bookmarks")
        if dry_run:
            logger.info("DRY RUN MODE - No changes will be made")

        # Initialize counters
        processed = 0
        duplicates_found = 0
        bookmarks_deleted = 0

        # Track processed hashes to find duplicates
        hash_map = {}  # hash -> list of bookmark ids

        # First pass: build hash map
        logger.info("Building hash map...")
        for bookmark in queryset.iterator():
            try:
                # Calculate normalized hash
                new_hash = normalizer.generate_hash(bookmark.url)

                # Create composite key for user-specific duplicates
                hash_key = f"{bookmark.owner_id}:{new_hash}"

                if hash_key not in hash_map:
                    hash_map[hash_key] = []
                hash_map[hash_key].append(bookmark.id)

                processed += 1
                if processed % 100 == 0:
                    logger.info(f"Processed {processed}/{total_bookmarks} bookmarks")

            except Exception as e:
                logger.error(f"Error processing bookmark {bookmark.id}: {e}")

        # Second pass: handle duplicates
        logger.info("Processing duplicates...")
        for hash_key, bookmark_ids in hash_map.items():
            if len(bookmark_ids) > 1:
                duplicates_found += len(bookmark_ids) - 1

                # Get all bookmarks with this hash
                bookmarks = list(
                    Bookmark.objects.filter(id__in=bookmark_ids).order_by("created_at")
                )

                # Determine which to keep
                if keep_newer:
                    # Keep the last one (newest)
                    to_keep = bookmarks[-1]
                    to_delete = bookmarks[:-1]
                else:
                    # Keep the first one (oldest)
                    to_keep = bookmarks[0]
                    to_delete = bookmarks[1:]

                # Process deletions
                for bookmark in to_delete:
                    deletion_log = {
                        "action": "would_delete" if dry_run else "deleted",
                        "duplicate_bookmark": {
                            "id": bookmark.id,
                            "url": bookmark.url,
                            "title": bookmark.title,
                            "owner_id": bookmark.owner_id,
                            "created_at": bookmark.created_at.isoformat(),
                            "updated_at": bookmark.updated_at.isoformat(),
                            "unique_hash": bookmark.unique_hash,
                            "tags": list(bookmark.tags.values_list("name", flat=True)),
                        },
                        "kept_bookmark_id": to_keep.id,
                        "kept_bookmark_url": to_keep.url,
                    }

                    logger.info(f"Duplicate: {json.dumps(deletion_log, indent=2)}")

                    if not dry_run:
                        try:
                            with transaction.atomic():
                                bookmark.delete()
                                bookmarks_deleted += 1
                        except Exception as e:
                            logger.error(f"Error deleting bookmark {bookmark.id}: {e}")

        # Log final statistics
        self.stdout.write(self.style.SUCCESS("\nDeduplication completed:"))
        self.stdout.write(f"  Total bookmarks processed: {processed}")
        self.stdout.write(
            f"  Duplicate groups found: {len([ids for ids in hash_map.values() if len(ids) > 1])}"
        )
        self.stdout.write(f"  Total duplicates found: {duplicates_found}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"  Bookmarks that would be deleted: {duplicates_found}"
                )
            )
        else:
            self.stdout.write(f"  Bookmarks deleted: {bookmarks_deleted}")
            final_count = Bookmark.objects.count()
            if user_id:
                final_count = Bookmark.objects.filter(owner_id=user_id).count()
            self.stdout.write(f"  Final bookmark count: {final_count}")
