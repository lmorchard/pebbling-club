import json
import logging
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Any, Iterator

from django.utils import timezone

logger = logging.getLogger("pebbling_apps.bookmarks.serializers")


class ActivityStreamSerializer:
    """
    Serializer for converting Bookmark model instances to ActivityStreams format.

    Handles conversion between Django Bookmark objects and JSON-LD ActivityStreams
    Collection and Link objects, following the W3C ActivityStreams specification.
    """

    ACTIVITY_STREAMS_CONTEXT = "https://www.w3.org/ns/activitystreams"
    PEBBLING_CONTEXT = {
        "pebbling": "https://pebbling.club/ns/",
        "feedUrl": "pebbling:feedUrl",
    }

    def bookmark_to_link(self, bookmark) -> Dict[str, Any]:
        """
        Convert a single Bookmark instance to an ActivityStream Link object.

        Args:
            bookmark: Django Bookmark model instance

        Returns:
            Dictionary representing an ActivityStream Link object
        """
        try:
            link_obj = {
                "type": "Link",
                "url": bookmark.url,
                "name": bookmark.title,
            }

            # Add optional published timestamp
            if bookmark.created_at:
                link_obj["published"] = bookmark.created_at.isoformat()

            # Add optional updated timestamp
            if bookmark.updated_at:
                link_obj["updated"] = bookmark.updated_at.isoformat()

            # Add optional description/summary
            if bookmark.description is not None:
                link_obj["summary"] = bookmark.description

            # Add tags as array of strings
            tags = [tag.name for tag in bookmark.tags.all()]
            if tags:
                link_obj["tag"] = tags

            # Add custom feedUrl property if present
            if bookmark.feed_url is not None:
                link_obj["feedUrl"] = bookmark.feed_url

            # Extract properties from unfurl_metadata
            if bookmark.unfurl_metadata:
                unfurl_props = self._serialize_unfurl_metadata(bookmark.unfurl_metadata)
                link_obj.update(unfurl_props)

            return link_obj

        except Exception as e:
            logger.error(
                f"Error serializing bookmark {getattr(bookmark, 'id', 'unknown')}: {str(e)}",
                exc_info=True,
            )
            # Return minimal valid Link object on error
            return {
                "type": "Link",
                "url": getattr(bookmark, "url", ""),
                "name": getattr(bookmark, "title", "Untitled"),
            }

    def bookmarks_to_collection(
        self, bookmarks_iterator: Iterator, total_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Convert an iterator of bookmarks to an ActivityStream Collection.

        Args:
            bookmarks_iterator: Iterator that yields Bookmark instances
            total_count: Optional total count for the collection

        Returns:
            Dictionary representing an ActivityStream Collection
        """
        try:
            collection: Dict[str, Any] = {
                "@context": [self.ACTIVITY_STREAMS_CONTEXT, self.PEBBLING_CONTEXT],
                "type": "Collection",
                "published": datetime.now().isoformat(),
            }

            # Add total count if provided
            if total_count is not None:
                collection["totalItems"] = total_count

            # Convert bookmarks to Link objects
            items: List[Dict[str, Any]] = []
            for bookmark in bookmarks_iterator:
                link_obj = self.bookmark_to_link(bookmark)
                items.append(link_obj)

            collection["items"] = items

            # If we didn't have a total count, use the actual count
            if total_count is None:
                collection["totalItems"] = len(items)

            return collection

        except Exception as e:
            logger.error(
                f"Error creating ActivityStream collection: {str(e)}", exc_info=True
            )
            # Return minimal valid collection on error
            return {
                "@context": [self.ACTIVITY_STREAMS_CONTEXT, self.PEBBLING_CONTEXT],
                "type": "Collection",
                "published": datetime.now().isoformat(),
                "totalItems": 0,
                "items": [],
            }

    def _serialize_unfurl_metadata(self, unfurl_metadata) -> Dict[str, Any]:
        """
        Extract ActivityStream properties from unfurl metadata.

        Args:
            unfurl_metadata: UnfurlMetadata instance

        Returns:
            Dictionary of ActivityStream properties extracted from metadata
        """
        props = {}

        try:
            # Handle image property
            if hasattr(unfurl_metadata, "image") and unfurl_metadata.image:
                props["image"] = unfurl_metadata.image

            # Enhance summary with unfurl description if available and no user description
            if hasattr(unfurl_metadata, "description") and unfurl_metadata.description:
                # Note: This will be used to enhance summary, but bookmark_to_link
                # should prioritize user-provided description over unfurl description
                props["_unfurl_description"] = unfurl_metadata.description

            # Add other common unfurl properties that map to ActivityStream
            if hasattr(unfurl_metadata, "site_name") and unfurl_metadata.site_name:
                props["attributedTo"] = unfurl_metadata.site_name

            # Add author if available
            if hasattr(unfurl_metadata, "author") and unfurl_metadata.author:
                props["author"] = unfurl_metadata.author

        except Exception as e:
            logger.warning(f"Error extracting unfurl metadata: {str(e)}")
            # Return empty dict on error - this is non-critical

        return props

    # Import/Deserialization methods

    def validate_activitystream_format(
        self, json_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate that JSON data is a properly formatted ActivityStream Collection.

        Args:
            json_data: Parsed JSON data to validate

        Returns:
            Dictionary of validation results with any errors

        Raises:
            ValueError: If validation fails with description of the error
        """
        errors = []

        try:
            # Check for @context
            context = json_data.get("@context")
            if not context:
                errors.append("Missing @context field")
            elif isinstance(context, list):
                if self.ACTIVITY_STREAMS_CONTEXT not in context:
                    errors.append("@context must include ActivityStreams namespace")
            elif context != self.ACTIVITY_STREAMS_CONTEXT:
                errors.append("@context must include ActivityStreams namespace")

            # Check type
            if json_data.get("type") != "Collection":
                errors.append("Root object must be of type 'Collection'")

            # Check for items
            if "items" not in json_data:
                errors.append("Collection must contain 'items' array")
            elif not isinstance(json_data["items"], list):
                errors.append("'items' must be an array")

            if errors:
                raise ValueError("; ".join(errors))

            return {"valid": True, "errors": []}

        except Exception as e:
            logger.error(f"ActivityStream validation error: {str(e)}")
            return {"valid": False, "errors": [str(e)]}

    def parse_collection(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse and validate ActivityStream Collection structure.

        Args:
            json_data: Parsed JSON data representing an ActivityStream Collection

        Returns:
            Dictionary with parsed collection data and items

        Raises:
            ValueError: If collection format is invalid
        """
        # Validate format first
        validation = self.validate_activitystream_format(json_data)
        if not validation["valid"]:
            raise ValueError(
                f"Invalid ActivityStream format: {', '.join(validation['errors'])}"
            )

        try:
            collection_data = {
                "type": json_data.get("type"),
                "published": json_data.get("published"),
                "totalItems": json_data.get("totalItems"),
                "items": json_data.get("items", []),
            }

            # Basic validation of items array structure
            for i, item in enumerate(collection_data["items"]):
                if not isinstance(item, dict):
                    raise ValueError(f"Item {i} is not a valid object")
                if item.get("type") != "Link":
                    logger.warning(
                        f"Item {i} is not a Link object, type: {item.get('type')}"
                    )
                # Don't validate required fields here - let individual processing handle that

            return collection_data

        except Exception as e:
            logger.error(f"Error parsing ActivityStream collection: {str(e)}")
            raise ValueError(f"Failed to parse collection: {str(e)}")

    def link_to_bookmark_data(self, link_dict: Dict[str, Any], owner) -> Dict[str, Any]:
        """
        Convert ActivityStream Link object to Bookmark field dictionary.

        Args:
            link_dict: Dictionary representing an ActivityStream Link object
            owner: User instance who will own the bookmark

        Returns:
            Dictionary with fields suitable for Bookmark.objects.update_or_create()
        """
        try:
            # Validate required fields
            if not link_dict.get("url"):
                raise ValueError("Link object missing required 'url' field")
            if not link_dict.get("name"):
                raise ValueError("Link object missing required 'name' field")

            bookmark_data = {
                "url": link_dict["url"],
                "title": link_dict["name"],
                "owner": owner,
            }

            # Add optional description
            if "summary" in link_dict:
                bookmark_data["description"] = link_dict["summary"]

            # Handle custom feedUrl property
            if "feedUrl" in link_dict:
                bookmark_data["feed_url"] = link_dict["feedUrl"]

            # Parse timestamps if present
            if link_dict.get("published"):
                try:
                    from datetime import datetime
                    import dateutil.parser  # type: ignore

                    bookmark_data["created_at"] = dateutil.parser.isoparse(
                        link_dict["published"]
                    )
                except Exception as e:
                    logger.warning(f"Could not parse published timestamp: {str(e)}")

            if link_dict.get("updated"):
                try:
                    from datetime import datetime
                    import dateutil.parser  # type: ignore

                    bookmark_data["updated_at"] = dateutil.parser.isoparse(
                        link_dict["updated"]
                    )
                except Exception as e:
                    logger.warning(f"Could not parse updated timestamp: {str(e)}")

            # Handle tags separately (will be processed after bookmark creation)
            bookmark_data["_tags"] = link_dict.get("tag", [])

            return bookmark_data

        except Exception as e:
            logger.error(f"Error converting Link to bookmark data: {str(e)}")
            raise ValueError(f"Invalid Link object: {str(e)}")

    def process_bookmark_tags(self, bookmark_data: Dict[str, Any], owner) -> List:
        """
        Process tags from bookmark data, creating tags that don't exist.

        Args:
            bookmark_data: Dictionary containing _tags field
            owner: User instance who will own the tags

        Returns:
            List of Tag objects ready to be associated with bookmark
        """
        from .models import Tag

        tags: List[Any] = []
        tag_names = bookmark_data.get("_tags", [])

        if not isinstance(tag_names, list):
            logger.warning(f"Tags field is not a list: {type(tag_names)}")
            return tags

        for tag_name in tag_names:
            try:
                if isinstance(tag_name, str) and tag_name.strip():
                    tag_name = tag_name.strip()
                    tag, created = Tag.objects.get_or_create(name=tag_name, owner=owner)
                    tags.append(tag)
                    if created:
                        logger.debug(f"Created new tag: {tag_name}")
            except Exception as e:
                logger.warning(f"Error processing tag '{tag_name}': {str(e)}")

        return tags


class MarkdownBookmarkSerializer:
    """
    Serializer for converting Bookmark querysets to markdown format.

    Handles conversion of Django Bookmark objects to markdown text suitable
    for copying into blog posts or processing by other tools.
    """

    def serialize_to_markdown(self, bookmarks_collection) -> str:
        """
        Convert a collection of bookmarks to markdown format.

        Groups bookmarks by date (created_at), formats each bookmark as a
        bullet point with title as inline link and description as blockquote.

        Args:
            bookmarks_collection: Django queryset or list of Bookmark instances

        Returns:
            String containing complete markdown text
        """
        try:
            # Group bookmarks by date (this will iterate once)
            grouped_bookmarks = self._group_bookmarks_by_date(bookmarks_collection)

            # Check if we have any bookmarks after grouping (avoids extra query)
            if not grouped_bookmarks:
                return "<!-- No bookmarks found -->"

            # Build markdown output
            markdown_sections = []

            # Sort dates chronologically (oldest to newest)
            sorted_dates = sorted(grouped_bookmarks.keys())

            for date_str in sorted_dates:
                bookmarks = grouped_bookmarks[date_str]

                # Add date heading
                markdown_sections.append(f"# {date_str}")
                markdown_sections.append("")  # Empty line after heading

                # Add bookmarks for this date
                for bookmark in bookmarks:
                    bookmark_md = self._format_bookmark(bookmark)
                    markdown_sections.append(bookmark_md)
                    markdown_sections.append("")  # Empty line between bookmarks

            # Join all sections and clean up trailing whitespace
            result = "\n".join(markdown_sections).rstrip() + "\n"
            return result

        except Exception as e:
            logger.error(
                f"Error serializing bookmarks to markdown: {str(e)}", exc_info=True
            )
            return "<!-- Error generating markdown -->"

    def _group_bookmarks_by_date(self, bookmarks_collection) -> Dict[str, List]:
        """
        Group bookmarks by their creation date.

        Args:
            bookmarks_collection: Django queryset or list of Bookmark instances

        Returns:
            Dictionary mapping date strings (YYYY-MM-DD) to lists of bookmarks
        """
        grouped = defaultdict(list)

        for bookmark in bookmarks_collection:
            # Convert timestamp to date string in YYYY-MM-DD format
            if bookmark.created_at:
                # Use timezone-aware date formatting
                local_dt = timezone.localtime(bookmark.created_at)
                date_str = local_dt.strftime("%Y-%m-%d")
            else:
                # Fallback for bookmarks without creation date
                date_str = "Unknown Date"

            grouped[date_str].append(bookmark)

        return dict(grouped)

    def _format_bookmark(self, bookmark) -> str:
        """
        Format a single bookmark as markdown.

        Args:
            bookmark: Single Bookmark model instance

        Returns:
            String containing markdown for this bookmark
        """
        try:
            # Build the basic bullet point with link
            title = self._escape_markdown(bookmark.title or "Untitled")
            url = bookmark.url or ""

            markdown_lines = [f"- [{title}]({url})"]

            # Add description as blockquote if it exists
            if bookmark.description and bookmark.description.strip():
                description = self._escape_markdown(bookmark.description.strip())
                # Handle multi-line descriptions
                description_lines = description.split("\n")
                for line in description_lines:
                    if line.strip():  # Skip empty lines
                        markdown_lines.append(f"  > {line.strip()}")
                    else:
                        markdown_lines.append("  >")

            return "\n".join(markdown_lines)

        except Exception as e:
            logger.warning(
                f"Error formatting bookmark {getattr(bookmark, 'id', 'unknown')}: {str(e)}"
            )
            # Return minimal markdown on error
            url = getattr(bookmark, "url", "")
            return f"- [Untitled]({url})"

    def _escape_markdown(self, text: str) -> str:
        """
        Escape special markdown characters in text.

        Args:
            text: Text to escape

        Returns:
            Text with markdown special characters escaped
        """
        if not text:
            return ""

        # List of characters that need escaping in markdown
        # Focus on characters that would break link formatting or structure
        # Note: Backslash must be escaped first to avoid double-escaping

        result = text

        # Escape backslash first
        result = result.replace("\\", r"\\")

        # Then escape other characters
        escape_chars = [
            ("[", r"\["),
            ("]", r"\]"),
            ("(", r"\("),
            (")", r"\)"),
            ("`", r"\`"),
            ("*", r"\*"),
            ("_", r"\_"),
            ("#", r"\#"),
            ("|", r"\|"),
        ]

        for char, escaped in escape_chars:
            result = result.replace(char, escaped)

        return result

    def stream_to_markdown(self, bookmarks_queryset):
        """
        Generator function to stream markdown content for large datasets.

        Yields markdown content in chunks to reduce memory usage for
        very large bookmark collections.

        Args:
            bookmarks_queryset: Django queryset of Bookmark instances

        Yields:
            String chunks of markdown content
        """
        try:
            # We'll check for empty results during iteration to avoid extra query
            has_bookmarks = False

            # Group bookmarks by date using iterator to save memory
            grouped_bookmarks = defaultdict(list)

            # Use iterator() to avoid loading all bookmarks into memory at once
            # Handle both querysets and lists
            if hasattr(bookmarks_queryset, "iterator"):
                bookmark_iter = bookmarks_queryset.iterator(chunk_size=100)
            else:
                bookmark_iter = iter(bookmarks_queryset)

            for bookmark in bookmark_iter:
                has_bookmarks = True
                if bookmark.created_at:
                    local_dt = timezone.localtime(bookmark.created_at)
                    date_str = local_dt.strftime("%Y-%m-%d")
                else:
                    date_str = "Unknown Date"

                grouped_bookmarks[date_str].append(bookmark)

                # Yield completed date sections when they get large
                if len(grouped_bookmarks[date_str]) >= 50:
                    # Yield this date section
                    yield f"# {date_str}\n\n"
                    for bookmark in grouped_bookmarks[date_str]:
                        bookmark_md = self._format_bookmark(bookmark)
                        yield bookmark_md + "\n\n"
                    # Clear this date section from memory
                    grouped_bookmarks[date_str] = []

            # Check if we processed any bookmarks
            if not has_bookmarks:
                yield "<!-- No bookmarks found -->"
                return

            # Yield remaining bookmarks
            sorted_dates = sorted(grouped_bookmarks.keys())
            for date_str in sorted_dates:
                bookmarks = grouped_bookmarks[date_str]
                if bookmarks:  # Only yield if there are bookmarks
                    yield f"# {date_str}\n\n"
                    for bookmark in bookmarks:
                        bookmark_md = self._format_bookmark(bookmark)
                        yield bookmark_md + "\n\n"

        except Exception as e:
            logger.error(
                f"Error streaming bookmarks to markdown: {str(e)}", exc_info=True
            )
            yield "<!-- Error generating markdown -->"
