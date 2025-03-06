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

    def handle(self, *args, **options):
        url = options["url"]
        try:
            service = FeedService()
            feed, created = service.get_or_create_feed(url)

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
