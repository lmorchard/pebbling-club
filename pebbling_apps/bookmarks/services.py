# pebbling_apps/bookmarks/service.py

from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
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
