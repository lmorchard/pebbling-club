import logging
import json
from django.core.management.base import BaseCommand
import sqlite3
from django.contrib.auth import get_user_model
from ...models import Bookmark, Tag
from datetime import datetime
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def ms_timestamp_to_datetime(ms_timestamp):
    """Convert millisecond timestamp to datetime"""
    if not ms_timestamp:
        return datetime.now()
    return datetime.fromtimestamp(ms_timestamp / 1000.0)


class Command(BaseCommand):
    help = "Import bookmarks from legacy SQLite database"

    def add_arguments(self, parser):
        parser.add_argument("db_path", type=str, help="Path to SQLite database file")
        parser.add_argument(
            "username", type=str, help="Username to assign bookmarks to"
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Number of bookmarks to process in each batch (default: 100)",
        )

    def handle(self, *args, **options):
        db_path = options["db_path"]
        username = options["username"]
        batch_size = options["batch_size"]

        try:
            owner = get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist:
            logger.error(f"User with username '{username}' not found")
            return

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM bookmarks")
        imported = 0
        skipped = 0
        batch = []

        for row in cursor.fetchall():
            try:
                data = dict(row)
                batch.append(data)

                # Process batch when it reaches batch_size
                if len(batch) >= batch_size:
                    imported += self.process_batch(batch, owner)
                    batch = []
                    logger.info(f"Progress: imported {imported} bookmarks so far...")

            except Exception as e:
                skipped += 1
                logger.error(f"Error importing bookmark: {str(e)}", exc_info=True)

        # Process remaining bookmarks
        if batch:
            imported += self.process_batch(batch, owner)

        conn.close()
        logger.info(f"Import completed. Imported: {imported}, Skipped: {skipped}")

    @transaction.atomic
    def process_batch(self, batch, owner):
        processed = 0
        for data in batch:
            # Convert timestamps and ensure they're timezone-aware
            created_date = timezone.make_aware(
                ms_timestamp_to_datetime(data["created"])
            )
            modified_date = timezone.make_aware(
                ms_timestamp_to_datetime(data["modified"])
            )

            bookmark, created = Bookmark.objects.update_or_create(
                owner=owner,
                url=data["href"],
                defaults={
                    "title": data["title"] or "",
                    "description": data["extended"] or "",
                    "meta": data["meta"] or {},
                    "created_at": created_date,
                    "updated_at": modified_date,
                },
            )

            if data["tags"]:
                try:
                    tags_data = json.loads(data["tags"])
                    tag_names = [
                        tag["name"].strip() for tag in tags_data if tag["name"].strip()
                    ]
                    for tag_name in tag_names:
                        tag, _ = Tag.objects.get_or_create(name=tag_name, owner=owner)
                        bookmark.tags.add(tag)
                except json.JSONDecodeError as e:
                    logger.warning(
                        f"Failed to parse tags JSON for bookmark {bookmark.url}: {e}"
                    )

            processed += 1
        return processed
