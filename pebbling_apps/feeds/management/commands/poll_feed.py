import logging
from django.core.management.base import BaseCommand, CommandError
from pebbling_apps.feeds.models import Feed
from pebbling_apps.feeds.tasks import poll_feed
from pebbling_apps.feeds.services import FeedService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Poll an RSS feed and schedule the fetch_feed task"

    def add_arguments(self, parser):
        parser.add_argument("url", type=str, help="The URL of the RSS feed")

    def handle(self, *args, **options):
        url = options["url"]
        service = FeedService()

        try:
            feed, created = service.get_or_create_feed(url)
            poll_feed.delay(feed.id)  # Schedule the task
            logger.info(f"Scheduled fetch_feed task for feed: {feed}")

        except Exception as e:
            logger.error(f"Error processing feed: {str(e)}")
            raise CommandError(f"Error processing feed: {str(e)}")
