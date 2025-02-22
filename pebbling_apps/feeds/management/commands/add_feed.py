import logging
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from pebbling_apps.feeds.models import Feed

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Add or update an RSS feed to monitor"

    def add_arguments(self, parser):
        parser.add_argument("url", type=str, help="The URL of the RSS feed")
        parser.add_argument("--title", type=str, help="Optional title for the feed")
        parser.add_argument(
            "--disabled", action="store_true", help="Create feed in disabled state"
        )

    def handle(self, *args, **options):
        url = options["url"]
        title = options.get("title", "")
        disabled = options.get("disabled", False)

        # Validate URL format
        url_validator = URLValidator()
        try:
            url_validator(url)
        except ValidationError:
            logger.error(f"Invalid URL format: {url}")
            raise CommandError(f"Invalid URL format: {url}")

        try:
            feed, created = Feed.objects.update_or_create(
                url=url,  # lookup field
                defaults={
                    "title": title,
                    "disabled": disabled,
                },
            )

            action = "created" if created else "updated"
            message = f"Successfully {action} feed: {feed}"
            logger.info(message)

        except Exception as e:
            logger.error(f"Failed to save feed: {str(e)}")
            raise CommandError(f"Failed to save feed: {str(e)}")
