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
        logger.info(f"Successfully polled feed {feed_id}")
    except Feed.DoesNotExist:
        logger.warning(f"Feed with id {feed_id} does not exist.")
    except Exception as e:
        logger.error(f"Error fetching feed with id {feed_id}: {e}")


@shared_task(name="poll_all_feeds")
def poll_all_feeds() -> None:
    """Defer poll_feed tasks for every existing Feed model object."""
    try:
        # Use iterator to avoid loading all feeds into memory at once
        active_count = 0
        for feed in Feed.objects.all().iterator():
            # Call the poll_feed task for each feed with high priority
            poll_feed.apply_async(args=[feed.id], priority=3)
            logger.info(f"Deferred poll_feed task for feed_id {feed.id}.")
            if not feed.disabled:
                active_count += 1

        logger.info(f"Polled {active_count} active feeds")
    except Exception as e:
        logger.error(f"Error deferring poll_feed tasks: {e}")
