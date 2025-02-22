from celery import shared_task
from .services import FeedService
from .models import Feed
import logging

logger = logging.getLogger(__name__)


@shared_task(name="poll_feed")
def poll_feed(feed_id: int) -> None:
    """Fetch a feed in the background."""
    try:
        feed = Feed.objects.get(id=feed_id)
        service = FeedService()
        service.fetch_feed(feed)
    except Feed.DoesNotExist:
        logger.warning(f"Feed with id {feed_id} does not exist.")
    except Exception as e:
        logger.error(f"Error fetching feed with id {feed_id}: {e}")


@shared_task(name="poll_all_feeds")
def poll_all_feeds() -> None:
    """Defer poll_feed tasks for every existing Feed model object."""
    try:
        # Use iterator to avoid loading all feeds into memory at once
        for feed in Feed.objects.all().iterator():
            # Call the poll_feed task for each feed
            poll_feed.delay(feed.id)
            logger.info(f"Deferred poll_feed task for feed_id {feed.id}.")
    except Exception as e:
        logger.error(f"Error deferring poll_feed tasks: {e}")
