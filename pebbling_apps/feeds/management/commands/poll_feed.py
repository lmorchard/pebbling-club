import logging
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from pebbling_apps.feeds.models import Feed
from pebbling_apps.feeds.tasks import poll_feed  # Import the task

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Poll an RSS feed and schedule the fetch_feed task"

    def add_arguments(self, parser):
        parser.add_argument("url", type=str, help="The URL of the RSS feed")

    def handle(self, *args, **options):
        url = options["url"]
        create = options.get("create", False)

        # Validate URL format
        url_validator = URLValidator()
        try:
            url_validator(url)
        except ValidationError:
            logger.error(f"Invalid URL format: {url}")
            raise CommandError(f"Invalid URL format: {url}")

        # Get or create feed
        try:
            try:
                feed = Feed.objects.get(url=url)
                logger.info(f"Found feed: {feed}")
            except Feed.DoesNotExist:
                feed = Feed.objects.create(url=url)
                logger.info(f"Created new feed: {feed}")

            # Schedule the fetch_feed task
            poll_feed.delay(feed.id)  # Schedule the task
            logger.info(f"Scheduled fetch_feed task for feed: {feed}")

        except Exception as e:
            logger.error(f"Error processing feed: {str(e)}")
            raise CommandError(f"Error processing feed: {str(e)}")
