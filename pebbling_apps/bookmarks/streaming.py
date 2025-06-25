import json
import logging
from typing import Dict, Any, Iterator, Generator
from django.http import StreamingHttpResponse

logger = logging.getLogger("pebbling_apps.bookmarks.streaming")


class StreamingJSONResponse(StreamingHttpResponse):
    """
    A StreamingHttpResponse subclass for streaming large JSON responses.

    Handles proper JSON formatting and content-type headers for streaming
    JSON responses without loading all data into memory at once.
    """

    def __init__(
        self,
        streaming_content: Generator[str, None, None],
        content_type: str = "application/ld+json; charset=utf-8",
        **kwargs,
    ):
        """
        Initialize streaming JSON response.

        Args:
            streaming_content: Generator that yields JSON chunks
            content_type: Content type header (defaults to JSON-LD)
            **kwargs: Additional arguments for StreamingHttpResponse
        """
        super().__init__(streaming_content, content_type=content_type, **kwargs)


def stream_json_collection(
    collection_metadata: Dict[str, Any], items_iterator: Iterator[Dict[str, Any]]
) -> Generator[str, None, None]:
    """
    Stream a JSON collection by yielding properly formatted chunks.

    Yields JSON in chunks: opening metadata, items array (with proper commas), and closing.
    This allows streaming large collections without loading everything into memory.

    Args:
        collection_metadata: Dictionary with collection metadata (type, published, etc.)
        items_iterator: Iterator that yields individual item dictionaries

    Yields:
        String chunks that form valid JSON when concatenated
    """
    try:
        logger.debug("Starting JSON collection streaming")

        # Start the collection object
        collection_start = {
            "@context": collection_metadata.get(
                "@context", "https://www.w3.org/ns/activitystreams"
            ),
            "type": collection_metadata.get("type", "Collection"),
            "published": collection_metadata.get("published"),
        }

        # Add totalItems if provided
        if "totalItems" in collection_metadata:
            collection_start["totalItems"] = collection_metadata["totalItems"]

        # Yield opening part of collection with items array start
        opening = json.dumps(collection_start)[:-1]  # Remove closing brace
        yield opening + ', "items": ['

        # Stream items with proper comma separation
        first_item = True
        item_count = 0

        for item in items_iterator:
            try:
                if not first_item:
                    yield ", "

                yield json.dumps(item)
                first_item = False
                item_count += 1

                # Log progress for large collections
                if item_count % 100 == 0:
                    logger.debug(f"Streamed {item_count} items")

            except Exception as e:
                logger.error(f"Error streaming item {item_count}: {str(e)}")
                # Yield error placeholder to maintain valid JSON
                if not first_item:
                    yield ", "
                error_item = {
                    "type": "Note",
                    "content": f"Error processing item: {str(e)}",
                }
                yield json.dumps(error_item)
                first_item = False

        # Close the items array and collection object
        yield "]}"

        logger.info(f"Successfully streamed collection with {item_count} items")

    except Exception as e:
        logger.error(f"Critical error during JSON streaming: {str(e)}", exc_info=True)

        # Try to yield a valid minimal collection on critical error
        try:
            error_collection: Dict[str, Any] = {
                "@context": "https://www.w3.org/ns/activitystreams",
                "type": "Collection",
                "published": collection_metadata.get("published"),
                "totalItems": 0,
                "items": [],
                "error": f"Streaming failed: {str(e)}",
            }
            yield json.dumps(error_collection)
        except Exception as nested_error:
            logger.error(f"Failed to yield error collection: {str(nested_error)}")
            # Last resort - yield minimal valid JSON
            yield '{"error": "Collection streaming failed"}'


def stream_bookmark_collection(
    collection_metadata: Dict[str, Any], bookmarks_iterator: Iterator, serializer
) -> Generator[str, None, None]:
    """
    Stream a collection of bookmarks as ActivityStream JSON.

    Specialized version of stream_json_collection for bookmark collections.
    Handles bookmark serialization within the streaming process.

    Args:
        collection_metadata: Collection metadata dictionary
        bookmarks_iterator: Iterator yielding Bookmark model instances
        serializer: ActivityStreamSerializer instance for bookmark conversion

    Yields:
        String chunks forming valid ActivityStream Collection JSON
    """
    try:
        # Convert bookmark iterator to Link object iterator
        def link_iterator():
            for bookmark in bookmarks_iterator:
                try:
                    yield serializer.bookmark_to_link(bookmark)
                except Exception as e:
                    logger.error(
                        f"Error converting bookmark {getattr(bookmark, 'id', 'unknown')}: {str(e)}"
                    )
                    # Yield minimal Link object on error
                    yield {
                        "type": "Link",
                        "url": getattr(bookmark, "url", ""),
                        "name": getattr(bookmark, "title", "Error processing bookmark"),
                        "error": str(e),
                    }

        # Stream using the generic collection streamer
        yield from stream_json_collection(collection_metadata, link_iterator())

    except Exception as e:
        logger.error(f"Error in bookmark collection streaming: {str(e)}", exc_info=True)

        # Fallback to error collection
        error_collection: Dict[str, Any] = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "published": collection_metadata.get("published"),
            "totalItems": 0,
            "items": [],
            "error": f"Bookmark streaming failed: {str(e)}",
        }
        yield json.dumps(error_collection)
