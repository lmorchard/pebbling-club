import logging
from typing import List, Dict, Any, Optional, Callable
from django.db import IntegrityError
from .models import InboxItem

logger = logging.getLogger(__name__)


class InboxItemCreationService:
    """
    Shared service for creating inbox items across different source integrations.
    Handles duplicate detection and graceful error handling consistently.
    """

    @classmethod
    def create_inbox_items(
        cls,
        owner,
        items_data: List[Dict[str, Any]],
        source: str,
        tag_processor: Optional[Callable[[InboxItem, Dict[str, Any]], None]] = None,
        use_bulk_create: bool = True,
    ) -> List[InboxItem]:
        """
        Create inbox items with consistent duplicate handling.

        Args:
            owner: The user who owns these inbox items
            items_data: List of dicts containing item data (url, title, description, etc.)
            source: Source identifier for these items
            tag_processor: Optional function to process tags for each item
            use_bulk_create: Whether to use bulk creation or individual creation

        Returns:
            List of successfully created InboxItem objects
        """
        if not items_data:
            return []

        if use_bulk_create and tag_processor is None:
            return cls._bulk_create_items(owner, items_data, source)
        else:
            return cls._individual_create_items(
                owner, items_data, source, tag_processor
            )

    @classmethod
    def _bulk_create_items(
        cls, owner, items_data: List[Dict[str, Any]], source: str
    ) -> List[InboxItem]:
        """
        Create inbox items using bulk creation for better performance.
        Best for simple items without complex tag processing.
        """
        inbox_items = []

        for item_data in items_data:
            try:
                inbox_item = InboxItem(
                    url=item_data["url"],
                    title=item_data.get("title", ""),
                    description=item_data.get("description", ""),
                    owner=owner,
                    source=source,
                    source_type=item_data.get("source_type", ""),
                    metadata=item_data.get("metadata", {}),
                )
                # Generate unique_hash without saving
                inbox_item.unique_hash = inbox_item.generate_unique_hash()
                inbox_items.append(inbox_item)

            except Exception as e:
                logger.warning(
                    f"Failed to prepare inbox item for {item_data.get('url')}: {e}"
                )
                continue

        if not inbox_items:
            return []

        try:
            # Bulk create with ignore_conflicts to handle duplicates
            created_items = InboxItem.objects.bulk_create(
                inbox_items, ignore_conflicts=True
            )

            logger.info(
                f"Bulk created {len(created_items)} inbox items from {len(items_data)} "
                f"attempts for source: {source}"
            )
            return created_items

        except Exception as e:
            logger.error(f"Failed to bulk create inbox items for source {source}: {e}")
            return []

    @classmethod
    def _individual_create_items(
        cls,
        owner,
        items_data: List[Dict[str, Any]],
        source: str,
        tag_processor: Optional[Callable[[InboxItem, Dict[str, Any]], None]] = None,
    ) -> List[InboxItem]:
        """
        Create inbox items individually with detailed error handling.
        Best for items that need complex tag processing or detailed logging.
        """
        created_items = []

        for item_data in items_data:
            try:
                # Create the inbox item
                inbox_item = InboxItem.objects.create(
                    url=item_data["url"],
                    title=item_data.get("title", ""),
                    description=item_data.get("description", ""),
                    owner=owner,
                    source=source,
                    source_type=item_data.get("source_type", ""),
                    metadata=item_data.get("metadata", {}),
                )

                # Process tags if processor is provided
                if tag_processor:
                    try:
                        tag_processor(inbox_item, item_data)
                    except Exception as e:
                        logger.warning(
                            f"Failed to process tags for inbox item {inbox_item.id}: {e}"
                        )

                created_items.append(inbox_item)
                logger.debug(
                    f"Created inbox item for {item_data['url']} from source {source}"
                )

            except IntegrityError:
                # Item already exists for this user/source combination - skip gracefully
                logger.debug(
                    f"Inbox item already exists for {item_data.get('url')} from source {source}"
                )
                continue
            except Exception as e:
                logger.error(
                    f"Failed to create inbox item for {item_data.get('url')}: {e}"
                )
                continue

        logger.info(
            f"Created {len(created_items)} inbox items from {len(items_data)} "
            f"attempts for source: {source}"
        )
        return created_items

    @classmethod
    def create_single_inbox_item(
        cls,
        owner,
        url: str,
        title: str,
        description: str,
        source: str,
        tag_processor: Optional[Callable[[InboxItem, Dict[str, Any]], None]] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[InboxItem]:
        """
        Convenience method for creating a single inbox item.

        Returns:
            Created InboxItem or None if creation failed
        """
        item_data = {
            "url": url,
            "title": title,
            "description": description,
            **(extra_data or {}),
        }

        created_items = cls._individual_create_items(
            owner, [item_data], source, tag_processor
        )

        return created_items[0] if created_items else None
