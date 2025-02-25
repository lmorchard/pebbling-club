from celery import shared_task
from .services import BookmarksService


@shared_task(name="unfurl_bookmark_metadata")
def unfurl_bookmark_metadata(bookmark_id: int):
    """Celery task to unfurl metadata for a bookmark by ID."""
    service = BookmarksService()
    service.unfurl_bookmark_metadata(bookmark_id)
