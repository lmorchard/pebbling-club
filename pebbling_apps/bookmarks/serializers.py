import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Iterator

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
