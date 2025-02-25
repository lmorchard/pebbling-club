import logging
from django.core.management.base import BaseCommand, CommandError
from pebbling_apps.bookmarks.services import BookmarksService

# Set up logging
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Unfurl metadata for a specific bookmark by ID"

    def add_arguments(self, parser):
        parser.add_argument(
            "bookmark_id", type=int, help="The ID of the bookmark to unfurl"
        )

    def handle(self, *args, **options):
        bookmark_id = options["bookmark_id"]
        service = BookmarksService()

        logger.info(f"Starting to unfurl metadata for bookmark ID {bookmark_id}")

        try:
            service.unfurl_bookmark_metadata(bookmark_id)
            logger.info(f"Successfully unfurled metadata for bookmark ID {bookmark_id}")
        except Exception as e:
            logger.error(
                f"Error unfurling bookmark metadata for ID {bookmark_id}: {str(e)}"
            )
            raise CommandError(f"Error unfurling bookmark metadata: {str(e)}")
