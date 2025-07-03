import logging
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from typing import Tuple
import feedparser
import time
from .models import Feed, FeedItem

logger = logging.getLogger(__name__)


class FeedService:
    def get_or_create_feed(self, url: str) -> Tuple[Feed, bool]:
        """
        Get or create a Feed object for a given URL.
        Returns a tuple of (feed, created) where created is a boolean.
        """
        # Validate URL format
        url_validator = URLValidator()
        try:
            url_validator(url)
        except ValidationError:
            logger.error(f"Invalid URL format: {url}")
            raise ValidationError(f"Invalid URL format: {url}")

        try:
            feed = Feed.objects.get(url=url)
            created = False
        except Feed.DoesNotExist:
            feed = Feed.objects.create(url=url)
            created = True

        return feed, created

    def fetch_feed(self, feed: Feed) -> bool:
        start_time = time.time()
        try:
            parsed = feedparser.parse(feed.url, etag=feed.etag, modified=feed.modified)
            feed.update_from_parsed(parsed.feed)

            # Track new items discovered and collect them for inbox delivery
            new_items_count = 0
            new_feed_items = []

            for entry in parsed.entries:
                _, created = FeedItem.objects.update_or_create_from_parsed(feed, entry)
                if created:
                    new_items_count += 1
                    # Collect new items for inbox delivery
                    new_feed_items.append(
                        {
                            "url": entry.get("link", ""),
                            "title": entry.get("title", ""),
                            "description": entry.get("description", ""),
                            "summary": entry.get("summary", ""),
                        }
                    )

            # Trigger inbox delivery for new items (if any)
            if new_feed_items and self._is_inbox_delivery_enabled():
                try:
                    self._trigger_inbox_delivery(feed.url, new_feed_items)
                except Exception as e:
                    # Don't let inbox delivery errors break feed polling
                    logger.error(
                        f"Error triggering inbox delivery for feed {feed.url}: {e}"
                    )

            return True
        except Exception as e:
            # Error handling for feed fetch failures
            raise e

    def _is_inbox_delivery_enabled(self) -> bool:
        """Check if inbox delivery is enabled."""
        from django.conf import settings

        return getattr(settings, "INBOX_DELIVERY_ENABLED", True)

    def _trigger_inbox_delivery(self, feed_url: str, new_feed_items: list) -> None:
        """Trigger inbox delivery for new feed items."""
        from pebbling_apps.inbox.tasks import lookup_users_for_feed_items

        logger.info(
            f"Triggering inbox delivery for {len(new_feed_items)} new items from {feed_url}"
        )

        # Trigger Stage 1 task asynchronously
        lookup_users_for_feed_items.delay(feed_url, new_feed_items)
