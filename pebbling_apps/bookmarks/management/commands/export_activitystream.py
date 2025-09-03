"""Export bookmarks in ActivityStream JSON-LD format."""

import json
import logging
import datetime
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

from pebbling_apps.common.utils import parse_since
from ...models import Bookmark, Tag
from ...serializers import ActivityStreamSerializer
from ...streaming import stream_bookmark_collection

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = "Export bookmarks in ActivityStream JSON-LD format"

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
            "--pretty",
            action="store_true",
            help="Pretty-print the JSON output with indentation",
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
        pretty = options.get("pretty")
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

        # Get bookmarks query with optimized prefetching
        bookmarks = (
            Bookmark.objects.query(owner=user)
            .prefetch_related("tags")
            .select_related("owner")
        )

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

        # Create serializer
        serializer = ActivityStreamSerializer()

        # Create collection metadata
        collection_metadata = {
            "@context": [
                serializer.ACTIVITY_STREAMS_CONTEXT,
                serializer.PEBBLING_CONTEXT,
            ],
            "type": "Collection",
            "published": datetime.datetime.now().isoformat(),
            "totalItems": total_count,
        }

        # Generate export
        try:
            if pretty:
                # For pretty printing, we need to collect all items in memory
                items = []
                exported_count = 0

                for bookmark in bookmarks.iterator(chunk_size=100):
                    activity = serializer.serialize_bookmark_activity(bookmark, user)
                    items.append(activity)
                    exported_count += 1
                    if verbose and exported_count % 100 == 0:
                        self.stderr.write(f"Processing {exported_count} bookmarks...")

                collection_metadata["items"] = items

                if output_file:
                    output_path = Path(output_file)
                    with open(output_path, "w", encoding="utf-8") as f:
                        json.dump(collection_metadata, f, indent=2, ensure_ascii=False)

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Successfully exported {exported_count} of {total_count} bookmarks to {output_path}"
                        )
                    )
                else:
                    # Output to stdout
                    self.stdout.write(
                        json.dumps(collection_metadata, indent=2, ensure_ascii=False)
                    )

                    if verbose:
                        self.stderr.write(
                            self.style.SUCCESS(
                                f"Exported {exported_count} of {total_count} bookmarks"
                            )
                        )
            else:
                # Use streaming for non-pretty output
                chunk_size = (
                    min(50, max(10, total_count // 10)) if total_count > 0 else 50
                )

                if output_file:
                    output_path = Path(output_file)
                    exported_count = 0

                    with open(output_path, "w", encoding="utf-8") as f:
                        for chunk in stream_bookmark_collection(
                            collection_metadata,
                            bookmarks.iterator(chunk_size=chunk_size),
                            serializer,
                        ):
                            f.write(chunk)
                            # Count items based on commas in the items array
                            if (
                                chunk.strip()
                                and chunk.strip() != ',"items":['
                                and chunk.strip() != "]}"
                            ):
                                exported_count += chunk.count('"type":')
                                if (
                                    verbose
                                    and exported_count > 0
                                    and exported_count % 100 == 0
                                ):
                                    self.stderr.write(
                                        f"Exported {exported_count} bookmarks..."
                                    )

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Successfully exported bookmarks to {output_path}"
                        )
                    )
                else:
                    # Stream to stdout
                    for chunk in stream_bookmark_collection(
                        collection_metadata,
                        bookmarks.iterator(chunk_size=chunk_size),
                        serializer,
                    ):
                        self.stdout.write(chunk)

                    if verbose:
                        self.stderr.write(
                            self.style.SUCCESS(f"Exported {total_count} bookmarks")
                        )

        except Exception as e:
            logger.error(
                f"Error during ActivityStream bookmark export: {str(e)}", exc_info=True
            )
            raise CommandError(f"Export failed: {str(e)}")
