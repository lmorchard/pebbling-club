from celery import shared_task
from .models import InboxItem
from django.contrib.auth import get_user_model
import logging
import time

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(name="lookup_users_for_feed_items")
def lookup_users_for_feed_items(feed_url: str, feed_items: list) -> None:
    """
    Stage 1: Look up users who have bookmarks matching the feed URL,
    then trigger Stage 2 for each user.
    """
    start_time = time.time()

    try:
        from pebbling_apps.bookmarks.models import Bookmark

        logger.info(f"Looking up users for feed: {feed_url}")

        # Find all users with bookmarks matching this feed URL
        user_ids = (
            Bookmark.objects.filter(feed_url=feed_url)
            .select_related("owner")
            .values_list("owner_id", flat=True)
            .distinct()
        )

        user_count = len(user_ids)
        logger.info(f"Found {user_count} users subscribed to feed: {feed_url}")

        if user_count == 0:
            logger.info(f"No users found for feed: {feed_url}")
            return

        # Trigger Stage 2 for each user
        for user_id in user_ids:
            deliver_items_to_user_inbox.delay(user_id, feed_items, f"feed: {feed_url}")
            logger.debug(f"Triggered inbox delivery for user {user_id}")

        logger.info(f"Triggered inbox delivery for {user_count} users")

    except Exception as e:
        logger.error(f"Error in user lookup for feed {feed_url}: {e}", exc_info=True)


@shared_task(name="deliver_items_to_user_inbox")
def deliver_items_to_user_inbox(user_id: int, feed_items: list, source: str) -> None:
    """
    Stage 2: Deliver feed items to a specific user's inbox.
    """
    start_time = time.time()

    try:
        # Verify user exists and is active
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            logger.warning(f"User {user_id} not found or inactive, skipping delivery")
            return

        logger.info(f"Delivering {len(feed_items)} items to user {user.username} inbox")

        # Prepare items data for shared service
        items_data = []

        for feed_item in feed_items:
            try:
                # Extract required fields from feed item
                url = feed_item.get("url", feed_item.get("link", ""))
                title = feed_item.get("title", "Untitled")
                description = feed_item.get("description", feed_item.get("summary", ""))

                if not url:
                    logger.warning(f"Skipping feed item without URL for user {user_id}")
                    continue

                items_data.append(
                    {
                        "url": url,
                        "title": title[:255],  # Truncate to fit field limit
                        "description": description,
                    }
                )

            except Exception as e:
                logger.warning(f"Error processing feed item for user {user_id}: {e}")
                continue

        # Create items using shared service
        if items_data:
            from .services import InboxItemCreationService

            created_items = InboxItemCreationService.create_inbox_items(
                owner=user,
                items_data=items_data,
                source=source,
                use_bulk_create=True,  # Use bulk creation for better performance
            )
            created_count = len(created_items)
            logger.info(f"Created {created_count} inbox items for user {user.username}")

        else:
            logger.warning(f"No valid items to create for user {user_id}")

    except Exception as e:
        logger.error(f"Error delivering items to user {user_id}: {e}", exc_info=True)
