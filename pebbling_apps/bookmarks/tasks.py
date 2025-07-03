from celery import shared_task
from .services import BookmarksService
from .models import ImportJob
from django.utils import timezone
import json
import logging
import time


@shared_task(name="unfurl_bookmark_metadata")
def unfurl_bookmark_metadata(bookmark_id: int):
    """Celery task to unfurl metadata for a bookmark by ID."""
    service = BookmarksService()
    service.unfurl_bookmark_metadata(bookmark_id)


def _fail_import_job(import_job, error_message, logger, import_job_id):
    """Helper function to consistently handle import job failures."""
    import_job.status = "failed"
    import_job.error_message = error_message
    import_job.completed_at = timezone.now()
    import_job.save()
    logger.error(f"Import job {import_job_id}: {error_message}")


@shared_task(name="process_import_job")
def process_import_job(import_job_id: int):
    """Celery task to process an import job asynchronously."""
    from .services import ImportService

    logger = logging.getLogger(__name__)
    import_service = ImportService()
    import_job = None
    start_time = time.time()

    try:
        # Fetch the import job
        import_job = ImportJob.objects.get(id=import_job_id)

        job_format = getattr(import_job, "format", "unknown")

        # Update status to processing
        import_job.status = "processing"
        import_job.started_at = timezone.now()
        import_job.save()

        logger.info(
            f"Starting import job {import_job_id} for user {import_job.user.username}"
        )

        # Load and parse the JSON file
        json_data = import_service.load_json_file(import_job.file_path)

        # Process the import data
        results = import_service.process_import_data(import_job, json_data)

        # Complete the import job
        import_job.processed_bookmarks = results["processed"]
        import_job.failed_bookmarks = results["failed"]
        import_job.failed_bookmark_details = results["failed_details"]
        import_job.status = "completed"
        import_job.completed_at = timezone.now()
        import_job.save()

        # Delete the uploaded file on success
        import_service.cleanup_import_file(import_job.file_path)

        logger.info(
            f"Import job {import_job_id}: Completed. Processed: {results['processed']}, Failed: {results['failed']}"
        )

    except ImportJob.DoesNotExist:
        logger.error(f"Import job {import_job_id} not found")

    except (FileNotFoundError, json.JSONDecodeError, MemoryError) as e:
        if import_job:
            _fail_import_job(import_job, str(e), logger, import_job_id)

    except Exception as e:
        error_message = f"Import processing failed: {str(e)}"
        logger.error(f"Import job {import_job_id}: {error_message}", exc_info=True)

        if import_job:
            _fail_import_job(import_job, error_message, logger, import_job_id)
        else:
            # Try to update job status even if we couldn't fetch it initially
            try:
                import_job = ImportJob.objects.get(id=import_job_id)
                _fail_import_job(
                    import_job, f"Unexpected error: {str(e)}", logger, import_job_id
                )
            except Exception:
                pass  # Can't do much if we can't even update the job
