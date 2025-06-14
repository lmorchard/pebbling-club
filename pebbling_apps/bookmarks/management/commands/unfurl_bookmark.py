import logging
from django.core.management.base import BaseCommand, CommandError
from pebbling_apps.bookmarks.services import BookmarksService
from pebbling_apps.bookmarks.models import Bookmark
import json

# Set up logging
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Unfurl metadata for a specific bookmark by URL and username"

    def add_arguments(self, parser):
        parser.add_argument(
            "username", type=str, help="The username associated with the bookmark"
        )
        parser.add_argument("url", type=str, help="The URL of the bookmark to unfurl")

    def handle(self, *args, **options):
        url = options["url"]
        username = options["username"]
        service = BookmarksService()

        logger.info(
            f"Starting to unfurl metadata for bookmark URL {url} and username {username}"
        )

        try:
            bookmark = Bookmark.objects.get(url=url, owner__username=username)
            service.unfurl_bookmark_metadata(bookmark.id)
            # Refetch the bookmark and pretty print the unfurled metadata for debugging
            bookmark.refresh_from_db()
            unfurled_metadata_pretty = json.dumps(
                bookmark.unfurl_metadata.to_dict(), indent=4
            )
            logger.debug(f"Unfurled metadata: {unfurled_metadata_pretty}")
            logger.info(
                f"Successfully unfurled metadata for bookmark URL {url} and username {username}"
            )
        except Bookmark.DoesNotExist:
            logger.error(
                f"Bookmark with URL {url} and username {username} does not exist"
            )
            raise CommandError(
                f"Bookmark with URL {url} and username {username} does not exist"
            )
        except Exception as e:
            logger.error(
                f"Error unfurling bookmark metadata for URL {url} and username {username}: {str(e)}"
            )
            raise CommandError(f"Error unfurling bookmark metadata: {str(e)}")
