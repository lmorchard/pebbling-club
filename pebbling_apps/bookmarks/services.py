# pebbling_apps/bookmarks/service.py

from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from pebbling_apps.feeds.services import FeedService
import logging
import hashlib
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode


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


class URLNormalizer:
    """Normalizes URLs for consistent hashing and deduplication."""

    # Tracking parameters to remove (case-insensitive)
    TRACKING_PARAMS = {"fbclid", "gclid", "msclkid", "twclid", "ref", "referrer"}

    def __init__(self):
        """Initialize URLNormalizer instance for future configurability."""
        self.logger = logging.getLogger(__name__)

    def normalize_url(self, url: str) -> str:
        """Normalize URL for consistent hashing.

        Args:
            url: The URL to normalize

        Returns:
            The normalized URL string
        """
        try:
            # Parse the URL
            parsed = urlparse(url)

            # Normalize hostname (lowercase) and handle default ports
            hostname = parsed.hostname.lower() if parsed.hostname else ""
            port = parsed.port

            # Remove default ports
            if (parsed.scheme == "http" and port == 80) or (
                parsed.scheme == "https" and port == 443
            ):
                netloc = hostname
            else:
                netloc = f"{hostname}:{port}" if port else hostname

            # Normalize path (remove trailing slash unless it's the root path)
            path = parsed.path
            if path != "/" and path.endswith("/"):
                path = path[:-1]

            # Parse and sort query parameters
            query_params = parse_qsl(parsed.query, keep_blank_values=True)
            # Filter out empty parameters (but keep "0", "false", etc.)
            query_params = [(k, v) for k, v in query_params if v != ""]
            # Filter out tracking parameters (case-insensitive)
            filtered_params = []
            for key, value in query_params:
                key_lower = key.lower()
                # Skip utm_ parameters
                if key_lower.startswith("utm_"):
                    continue
                # Skip other tracking parameters
                if key_lower in self.TRACKING_PARAMS:
                    continue
                filtered_params.append((key, value))
            # Sort by key
            filtered_params.sort(key=lambda x: x[0])
            # Reconstruct query string
            query = urlencode(filtered_params)

            # Reconstruct the URL with normalized components
            normalized = urlunparse(
                (parsed.scheme, netloc, path, parsed.params, query, parsed.fragment)
            )

            return normalized
        except Exception as e:
            # Log warning and return original URL if parsing fails
            self.logger.warning(f"Failed to normalize URL: {url}, error: {e}")
            return url

    def generate_hash(self, url: str) -> str:
        """Generate SHA-256 hash of normalized URL.

        Args:
            url: The URL to hash

        Returns:
            The SHA-256 hash hex digest
        """
        try:
            # Normalize the URL first
            normalized_url = self.normalize_url(url)

            # Encode as UTF-8 and generate SHA-256 hash
            url_bytes = normalized_url.encode("utf-8")
            hash_obj = hashlib.sha256(url_bytes)

            return hash_obj.hexdigest()
        except Exception as e:
            # Log error and generate hash from original URL as fallback
            self.logger.error(f"Error generating hash for URL: {url}, error: {e}")
            # Fallback to hashing the original URL
            return hashlib.sha256(url.encode("utf-8")).hexdigest()
