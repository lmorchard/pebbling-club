import logging
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from pebbling_apps.feeds.models import Feed
from pebbling_apps.feeds.services import FeedService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fetch items from an RSS feed"

    def add_arguments(self, parser):
        parser.add_argument("url", type=str, help="The URL of the RSS feed")
        parser.add_argument(
            "--create", action="store_true", help="Create feed if it doesn't exist"
        )

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
                if not create:
                    logger.error(f"Feed not found: {url}")
                    raise CommandError(
                        f"Feed not found: {url}. Use --create to add it."
                    )
                feed = Feed.objects.create(url=url)
                logger.info(f"Created new feed: {feed}")

            # Fetch feed content
            service = FeedService()
            if service.fetch_feed(feed):
                message = f"Successfully fetched feed: {feed}"
                logger.info(message)
            else:
                message = f"Failed to fetch feed: {feed}"
                logger.error(message)
                raise CommandError(message)

        except Exception as e:
            logger.error(f"Error processing feed: {str(e)}")
            raise CommandError(f"Error processing feed: {str(e)}")
