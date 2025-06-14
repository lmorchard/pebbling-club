from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.bookmarks.tasks import unfurl_bookmark_metadata
import logging  # Import logging module


class Command(BaseCommand):
    help = "Defer unfurl_bookmark_metadata for all bookmarks of a specified user"

    def add_arguments(self, parser):
        parser.add_argument(
            "username", type=str, help="Username of the user whose bookmarks to unfurl"
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit the number of bookmarks to unfurl",
        )
        parser.add_argument(
            "--tag",
            type=str,
            default=None,
            help="Filter bookmarks by a specified tag",
        )

    def handle(self, *args, **options):
        username = options["username"]
        limit = options.get("limit")  # Get the limit from options
        tag = options.get("tag")  # Get the tag from options
        User = get_user_model()

        logger = logging.getLogger(__name__)  # Set up a logger

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            logger.error(f"User '{username}' does not exist.")  # Use logger for error
            return

        bookmarks = Bookmark.objects.filter(owner=user).order_by("-created_at")

        if tag:
            bookmarks = bookmarks.filter(tags__name=tag)  # Filter by tag

        if limit is not None:
            bookmarks = bookmarks[:limit]  # Apply limit in the database query

        if not bookmarks.exists():
            logger.warning(
                f"No bookmarks found for user '{username}'."
            )  # Use logger for warning
            return

        # Use iterator to avoid loading all bookmarks into memory at once
        for bookmark in bookmarks.iterator():
            if bookmark.unfurl_metadata:
                continue
            unfurl_bookmark_metadata.apply_async(args=[bookmark.id], priority=9)
            logger.info(
                f"Deferred unfurling for bookmark ID: {bookmark.id}"
            )  # Use logger for info

        logger.info(
            f"Successfully deferred unfurling for all bookmarks of user '{username}'."
        )  # Use logger for info
