import logging
import feedparser
from .models import Feed, FeedItem

logger = logging.getLogger(__name__)


class FeedService:
    def fetch_feed(self, feed: Feed) -> bool:
        parsed = feedparser.parse(feed.url, etag=feed.etag, modified=feed.modified)

        feed.update_from_parsed(parsed.feed)

        for entry in parsed.entries:
            FeedItem.objects.update_or_create_from_parsed(feed, entry)

        return True
