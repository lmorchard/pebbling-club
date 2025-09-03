"""Export bookmarks in OPML 2.0 format."""

import logging
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

from pebbling_apps.common.utils import parse_since
from ...models import Bookmark, Tag
from ...exporters import OPMLBookmarkExporter

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = "Export bookmarks in OPML 2.0 format"

    def add_arguments(self, parser):
        parser.add_argument(
            "username", type=str, help="Username whose bookmarks to export"
        )
        parser.add_argument(
            "-o", "--output", type=str, help="Output file path (default: stdout)"
        )
        parser.add_argument(
            "-t",
            "--tag",
            action="append",
            dest="tags",
            help="Filter by tag (can be specified multiple times for AND filtering)",
        )
        parser.add_argument(
            "--since",
            type=str,
            help="Export only bookmarks created since this date (ISO format or relative like '7d', '1w', '1m')",
        )
        parser.add_argument(
            "--limit", type=int, help="Maximum number of bookmarks to export"
        )
        parser.add_argument(
            "--verbose", action="store_true", help="Enable verbose output"
        )

    def handle(self, **options):
        username = options["username"]
        output_file = options.get("output")
        tags = options.get("tags", [])
        since = options.get("since")
        limit = options.get("limit")
        verbose = options.get("verbose")

        # Get the user
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' does not exist")

        # Validate tags
        if tags:
            for tag_name in tags:
                if not Tag.objects.filter(name=tag_name).exists():
                    raise CommandError(f"Tag '{tag_name}' does not exist")

        # Parse since parameter
        since_date = None
        if since:
            try:
                since_date = parse_since(since)
            except Exception as e:
                raise CommandError(f"Invalid 'since' parameter: {str(e)}")

        # Get bookmarks query
        bookmarks = Bookmark.objects.query(owner=user).prefetch_related("tags")

        # Apply tag filtering
        if tags:
            for tag_name in tags:
                bookmarks = bookmarks.filter(tags__name=tag_name)
            bookmarks = bookmarks.distinct()

        # Apply date filtering
        if since_date:
            bookmarks = bookmarks.filter(created_at__gte=since_date)

        # Get count before limit
        total_count = bookmarks.count()

        # Apply limit
        if limit:
            bookmarks = bookmarks[:limit]

        # Create exporter
        exporter = OPMLBookmarkExporter()

        # Generate export
        try:
            if output_file:
                output_path = Path(output_file)
                with open(output_path, "w", encoding="utf-8") as f:
                    # Write header
                    f.write(exporter.generate_header(user=user))

                    # Write bookmarks
                    exported_count = 0
                    for bookmark_content in exporter.generate_bookmarks(
                        bookmarks.iterator(chunk_size=100)
                    ):
                        f.write(bookmark_content)
                        exported_count += 1
                        if verbose and exported_count % 100 == 0:
                            self.stdout.write(f"Exported {exported_count} bookmarks...")

                    # Write footer
                    f.write(exporter.generate_footer())

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Successfully exported {exported_count} of {total_count} bookmarks to {output_path}"
                    )
                )
            else:
                # Output to stdout
                self.stdout.write(exporter.generate_header(user=user))

                exported_count = 0
                for bookmark_content in exporter.generate_bookmarks(
                    bookmarks.iterator(chunk_size=100)
                ):
                    self.stdout.write(bookmark_content)
                    exported_count += 1

                self.stdout.write(exporter.generate_footer())

                if verbose:
                    self.stderr.write(
                        self.style.SUCCESS(
                            f"Exported {exported_count} of {total_count} bookmarks"
                        )
                    )

        except Exception as e:
            logger.error(f"Error during OPML bookmark export: {str(e)}", exc_info=True)
            raise CommandError(f"Export failed: {str(e)}")
