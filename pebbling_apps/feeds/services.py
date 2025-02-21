import feedparser
import time
from datetime import datetime
from django.utils import timezone
from .models import Feed, FeedItem


class FeedService:
    def fetch_feed(self, feed: Feed) -> bool:

        parsed = feedparser.parse(feed.url, etag=feed.etag, modified=feed.modified)

        feed.title = parsed.feed.get("title", "")
        feed.save()

        for entry in parsed.entries:
            # Handle date conversion
            published = None
            if "published_parsed" in entry:
                try:
                    # Convert struct_time to datetime
                    published = datetime.fromtimestamp(
                        time.mktime(entry.published_parsed)
                    )
                    # Make timezone-aware
                    published = timezone.make_aware(published)
                except Exception as e:
                    logger.warning(
                        f"Failed to parse date for entry: {entry.get('id', 'unknown')}: {e}"
                    )

            feed_item, created = FeedItem.objects.update_or_create(
                feed=feed,
                guid=entry.get("id", entry.get("link")),
                defaults={
                    "last_seen_at": timezone.now(),
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "description": entry.get("description", ""),
                    "summary": entry.get("summary", ""),
                    "date": published or timezone.now(),
                },
            )

        return True
