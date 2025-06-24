# pebbling_apps/bookmarks/service.py

from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from pebbling_apps.feeds.services import FeedService
import logging


class BookmarksService:
    def unfurl_bookmark_metadata(self, bookmark_id):
        """Fetches metadata for a bookmark and saves it to the unfurl_metadata property."""
        # Configure logging
        logging.basicConfig(level=logging.DEBUG)
        logger = logging.getLogger(__name__)

        logger.debug(f"Starting to unfurl metadata for bookmark ID: {bookmark_id}")

        # Look up the bookmark by ID
        bookmark = Bookmark.objects.get(id=bookmark_id)
        logger.debug(f"Bookmark found: {bookmark}")

        # Instantiate UnfurlMetadata
        unfurl_metadata = UnfurlMetadata(url=bookmark.url)
        logger.debug(f"UnfurlMetadata instantiated with URL: {bookmark.url}")

        # Fetch the metadata (assuming a method exists for this)
        unfurl_metadata.unfurl()  # This method should be defined in UnfurlMetadata
        logger.debug(f"Metadata unfurled successfully. {unfurl_metadata.image}")

        # Save the fetched metadata to the bookmark's unfurl_metadata property
        bookmark.unfurl_metadata = unfurl_metadata
        bookmark.save()
        logger.debug("Bookmark's unfurl_metadata saved successfully.")

        # If the metadata contains a feed URL, create or fetch the Feed object
        if unfurl_metadata.feed:
            logger.debug(f"Feed URL found in metadata: {unfurl_metadata.feed}")
            try:
                feed_service = FeedService()
                feed, created = feed_service.get_or_create_feed(unfurl_metadata.feed)
                bookmark.feed_url = unfurl_metadata.feed
                bookmark.save()

                if created:
                    logger.debug(f"New feed created: {feed.url}")
                else:
                    logger.debug(f"Existing feed found: {feed.url}")

                # Optionally, you could fetch the feed content immediately
                # feed_service.fetch_feed(feed)
            except Exception as e:
                logger.error(f"Error creating feed: {str(e)}")
