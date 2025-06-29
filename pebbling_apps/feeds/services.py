import logging
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from typing import Tuple
import feedparser
import time
from .models import Feed, FeedItem
from .metrics import observe_feed_poll_duration, set_feed_items_discovered

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

            # Track new items discovered
            new_items_count = 0
            for entry in parsed.entries:
                _, created = FeedItem.objects.update_or_create_from_parsed(feed, entry)
                if created:
                    new_items_count += 1

            # Record metrics
            duration = time.time() - start_time
            observe_feed_poll_duration(feed.id, duration)
            set_feed_items_discovered(feed.id, new_items_count)

            return True
        except Exception as e:
            # Still record duration even on failure
            duration = time.time() - start_time
            observe_feed_poll_duration(feed.id, duration)
            raise e
