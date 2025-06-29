# pebbling_apps/bookmarks/service.py

from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from pebbling_apps.feeds.services import FeedService
import logging
import hashlib
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
import random
import string
from datetime import datetime


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


def save_import_file(file, user):
    """Save an uploaded file with a unique filename using chunked writing.

    Args:
        file: The uploaded file object
        user: The user uploading the file

    Returns:
        The relative file path where the file was saved
    """
    # Generate timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M")

    # Generate random string (8 chars of letters and digits)
    random_string = "".join(random.choices(string.ascii_letters + string.digits, k=8))

    # Create filename
    filename = f"{timestamp}-{random_string}.json"

    # Create full path
    relative_path = os.path.join("imports", str(user.id), filename)

    # Save the file in chunks to avoid loading entire file into memory
    with default_storage.open(relative_path, "wb") as destination:
        for chunk in file.chunks():
            destination.write(chunk)

    return relative_path


class ImportService:
    """Service for handling bookmark imports."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def load_json_file(self, file_path):
        """Load and parse JSON from a file path.

        Args:
            file_path: Path to the JSON file

        Returns:
            Parsed JSON data

        Raises:
            FileNotFoundError: If file doesn't exist
            json.JSONDecodeError: If JSON is invalid
            MemoryError: If file is too large
        """
        import json

        try:
            with default_storage.open(file_path, "r") as file:
                return json.load(file)
        except FileNotFoundError:
            raise FileNotFoundError("Upload file not found. It may have been deleted.")
        except json.JSONDecodeError as e:
            raise json.JSONDecodeError(
                f"Invalid JSON format. Please ensure the file is valid JSON exported from ActivityStreams. Error: {str(e)}",
                e.doc,
                e.pos,
            )
        except MemoryError:
            raise MemoryError(
                "File too large to process in memory. Try splitting into smaller files."
            )

    def process_bookmark_item(self, link_item, user, duplicate_handling="skip"):
        """Process a single bookmark item from ActivityStreams format.

        Args:
            link_item: The ActivityStreams link item dict
            user: The user importing the bookmark
            duplicate_handling: "skip" or "overwrite"

        Returns:
            tuple: (bookmark, created, error_message)

        Raises:
            Exception: If processing fails
        """
        from .serializers import ActivityStreamSerializer
        from .models import Bookmark

        serializer = ActivityStreamSerializer()

        # Convert Link to bookmark data
        bookmark_data = serializer.link_to_bookmark_data(link_item, user)

        # Extract and process tags
        tag_names = bookmark_data.pop("_tags", [])
        tags_data = serializer.process_bookmark_tags({"_tags": tag_names}, user)

        # Remove timestamps for update_or_create
        bookmark_data.pop("created_at", None)
        bookmark_data.pop("updated_at", None)

        # Handle duplicates based on import options
        if duplicate_handling == "skip":
            # Use get_or_create to skip existing bookmarks
            bookmark, created = Bookmark.objects.get_or_create(
                url=bookmark_data["url"],
                owner=user,
                defaults=bookmark_data,
            )
            if created and tags_data:
                bookmark.tags.set(tags_data)
        else:  # overwrite
            # Use update_or_create to update existing bookmarks
            bookmark, created = Bookmark.objects.update_or_create(
                url=bookmark_data["url"],
                owner=user,
                defaults=bookmark_data,
            )
            if tags_data:
                bookmark.tags.set(tags_data)

        return bookmark, created, None

    def process_import_data(self, import_job, json_data):
        """Process import data for an ImportJob.

        Args:
            import_job: The ImportJob instance
            json_data: The parsed JSON data

        Returns:
            dict: Processing results with counts and failed details
        """
        from .serializers import ActivityStreamSerializer

        serializer = ActivityStreamSerializer()

        # Parse the collection
        collection_data = serializer.parse_collection(json_data)
        bookmarks_data = collection_data.get("items", [])

        # Update total bookmarks count
        import_job.total_bookmarks = len(bookmarks_data)
        import_job.save()

        self.logger.info(
            f"Import job {import_job.id}: Processing {len(bookmarks_data)} bookmarks"
        )

        # Process bookmarks
        duplicate_handling = import_job.import_options.get("duplicate_handling", "skip")
        processed = 0
        failed = 0
        failed_details = []

        for i, link_item in enumerate(bookmarks_data):
            try:
                bookmark, created, error = self.process_bookmark_item(
                    link_item, import_job.user, duplicate_handling
                )

                if error:
                    raise Exception(error)

                processed += 1

                # Update progress every 10 bookmarks
                if processed % 10 == 0:
                    import_job.update_progress(processed, failed)

                # Log progress every 100 bookmarks for large imports
                if processed % 100 == 0 and import_job.total_bookmarks > 500:
                    self.logger.info(
                        f"Import job {import_job.id}: Processed {processed}/{import_job.total_bookmarks} bookmarks ({processed/import_job.total_bookmarks*100:.1f}%)"
                    )

            except Exception as e:
                failed += 1
                # Try to get meaningful information about the failed bookmark
                bookmark_url = "Unknown URL"
                bookmark_title = "Unknown Title"

                if isinstance(link_item, dict):
                    bookmark_url = link_item.get("url", bookmark_url)
                    bookmark_title = link_item.get("name", bookmark_title)

                error_detail = {
                    "index": i + 1,  # 1-based indexing for user display
                    "error": str(e),
                    "url": bookmark_url,
                    "title": bookmark_title,
                }
                failed_details.append(error_detail)
                self.logger.warning(
                    f"Import job {import_job.id}: Failed to import bookmark {i + 1} ({bookmark_url}): {str(e)}"
                )

                # Continue processing remaining bookmarks
                continue

        return {
            "processed": processed,
            "failed": failed,
            "failed_details": failed_details,
        }

    def cleanup_import_file(self, file_path):
        """Delete the imported file after successful processing.

        Args:
            file_path: Path to the file to delete
        """
        try:
            default_storage.delete(file_path)
            self.logger.info(f"Deleted import file: {file_path}")
        except Exception as e:
            self.logger.warning(f"Failed to delete import file {file_path}: {str(e)}")
