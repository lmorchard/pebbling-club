# pebbling_apps/bookmarks/service.py

from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.unfurl.unfurl import UnfurlMetadata


class BookmarksService:
    def unfurl_bookmark_metadata(self, bookmark_id):
        """Fetches metadata for a bookmark and saves it to the unfurl_metadata property."""
        # Look up the bookmark by ID
        bookmark = Bookmark.objects.get(id=bookmark_id)

        # Instantiate UnfurlMetadata
        unfurl_metadata = UnfurlMetadata(url=bookmark.url)

        # Fetch the metadata (assuming a method exists for this)
        unfurl_metadata.unfurl()  # This method should be defined in UnfurlMetadata

        # Save the fetched metadata to the bookmark's unfurl_metadata property
        bookmark.unfurl_metadata = unfurl_metadata
        bookmark.save()
