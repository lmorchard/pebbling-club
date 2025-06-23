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
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force unfurling even for bookmarks that already have unfurl_metadata",
        )

    def handle(self, *args, **options):
        username = options["username"]
        limit = options.get("limit")  # Get the limit from options
        tag = options.get("tag")  # Get the tag from options
        force = options.get("force", False)  # Get the force flag from options
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
        processed_count = 0
        skipped_count = 0

        for bookmark in bookmarks.iterator():
            if bookmark.unfurl_metadata and not force:
                skipped_count += 1
                logger.debug(
                    f"Skipping bookmark ID: {bookmark.id} (already has unfurl_metadata)"
                )
                continue

            unfurl_bookmark_metadata.apply_async(args=[bookmark.id], priority=9)
            processed_count += 1

            if bookmark.unfurl_metadata and force:
                logger.info(
                    f"Force deferred unfurling for bookmark ID: {bookmark.id} (overwriting existing metadata)"
                )
            else:
                logger.info(f"Deferred unfurling for bookmark ID: {bookmark.id}")

        logger.info(
            f"Successfully completed unfurling for user '{username}': "
            f"{processed_count} bookmarks processed, {skipped_count} skipped."
        )
