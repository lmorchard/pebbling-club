from celery import shared_task
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from django.db import models
from .models import MastodonAccount, MastodonTimeline
from .utils import (
    fetch_timeline_statuses,
    create_inbox_items_from_status,
    test_mastodon_connection,
)
import logging
import time

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(name="poll_mastodon_timeline")
def poll_mastodon_timeline(timeline_id: int) -> None:
    """
    Poll a specific Mastodon timeline for new statuses and create inbox items.

    Args:
        timeline_id: ID of the MastodonTimeline to poll
    """
    start_time = time.time()

    try:
        # Get the timeline configuration
        try:
            timeline = MastodonTimeline.objects.select_related("account").get(
                id=timeline_id
            )
        except MastodonTimeline.DoesNotExist:
            logger.warning(f"Mastodon timeline {timeline_id} does not exist")
            return

        # Skip if timeline or account is inactive
        if not timeline.is_active or not timeline.account.is_active:
            logger.debug(f"Skipping inactive timeline {timeline_id}")
            return

        logger.info(f"Polling Mastodon timeline: {timeline}")

        # Test connection first
        if not test_mastodon_connection(
            timeline.account.server_url, timeline.account.access_token
        ):
            logger.warning(f"Mastodon connection failed for timeline {timeline_id}")
            # Don't mark as failed - this could just be a temporary network issue
            # The account will naturally become inactive if there are real auth issues
            return

        # Fetch statuses since last poll
        since_id = timeline.last_status_id
        statuses = fetch_timeline_statuses(
            timeline.account,
            timeline.timeline_type,
            timeline.config,
            since_id=since_id,
            limit=getattr(settings, "MASTODON_POLL_LIMIT", 250),
        )

        if statuses is None:
            logger.error(f"Failed to fetch statuses for timeline {timeline_id}")
            timeline.mark_poll_failed("Failed to fetch statuses")
            return

        # Batch deduplication: filter out statuses that already have inbox items
        from .utils import filter_duplicate_statuses

        new_statuses = filter_duplicate_statuses(timeline.account.user, statuses)

        # Process each new status
        total_created_items = 0
        latest_status_id = since_id

        for status in new_statuses:
            try:
                # Update latest status ID (check all statuses, not just new ones)
                status_id = str(status.get("id", ""))
                if status_id and (not latest_status_id or status_id > latest_status_id):
                    latest_status_id = status_id

                # Create inbox items from status links
                created_items = create_inbox_items_from_status(
                    timeline.account, status, timeline, skip_deduplication=True
                )
                total_created_items += len(created_items)

                if created_items:
                    logger.debug(
                        f"Created {len(created_items)} inbox items from status {status_id}"
                    )

            except Exception as e:
                logger.warning(
                    f"Error processing status for timeline {timeline_id}: {e}"
                )
                continue

        # Also update latest_status_id from all statuses (including duplicates)
        for status in statuses:
            status_id = str(status.get("id", ""))
            if status_id and (not latest_status_id or status_id > latest_status_id):
                latest_status_id = status_id

        # Update timeline poll status
        timeline.mark_poll_successful(latest_status_id)

        logger.info(
            f"Completed polling timeline {timeline_id}: "
            f"processed {len(statuses)} statuses, created {total_created_items} inbox items"
        )

    except Exception as e:
        logger.error(
            f"Error polling Mastodon timeline {timeline_id}: {e}", exc_info=True
        )
        # Mark as failed if we can still access the timeline object
        try:
            timeline = MastodonTimeline.objects.get(id=timeline_id)
            timeline.mark_poll_failed(str(e))
        except Exception:
            pass

    finally:
        duration = time.time() - start_time
        logger.debug(f"Timeline {timeline_id} poll completed in {duration:.2f} seconds")


@shared_task(name="poll_all_mastodon_timelines")
def poll_all_mastodon_timelines() -> None:
    """
    Schedule polling tasks for all active Mastodon timelines.
    """
    try:
        # Get all active timelines with active accounts
        timelines = MastodonTimeline.objects.filter(
            is_active=True, account__is_active=True
        ).select_related("account")

        total_timelines = timelines.count()
        logger.info(
            f"Scheduling polling for {total_timelines} active Mastodon timelines"
        )

        if total_timelines == 0:
            logger.info("No active Mastodon timelines found to poll")
            return

        # Schedule individual timeline polling tasks
        scheduled_count = 0
        for timeline in timelines:
            try:
                # Use apply_async with priority for better queue management
                poll_mastodon_timeline.apply_async(
                    args=[timeline.id],
                    priority=5,  # Medium priority (lower than critical tasks)
                )
                scheduled_count += 1
                logger.debug(f"Scheduled polling task for timeline {timeline.id}")

            except Exception as e:
                logger.error(
                    f"Failed to schedule polling for timeline {timeline.id}: {e}"
                )
                continue

        logger.info(
            f"Successfully scheduled {scheduled_count}/{total_timelines} Mastodon timeline polls"
        )

    except Exception as e:
        logger.error(f"Error scheduling Mastodon timeline polls: {e}", exc_info=True)


@shared_task(name="cleanup_failed_mastodon_timelines")
def cleanup_failed_mastodon_timelines() -> None:
    """
    Disable timelines that haven't had a successful connection in over a week.
    """
    try:
        from datetime import timedelta

        # Check for timelines that haven't succeeded in a week
        one_week_ago = timezone.now() - timedelta(days=7)

        # Find active timelines that either:
        # 1. Have never had a successful poll, but were created over a week ago
        # 2. Haven't had a successful poll in over a week
        failed_timelines = (
            MastodonTimeline.objects.filter(is_active=True)
            .filter(
                models.Q(last_successful_poll__lt=one_week_ago)
                | models.Q(
                    last_successful_poll__isnull=True, created_at__lt=one_week_ago
                )
            )
            .select_related("account")
        )

        disabled_count = 0
        for timeline in failed_timelines:
            try:
                timeline.is_active = False
                timeline.save()
                disabled_count += 1

                days_since = "never succeeded"
                if timeline.last_successful_poll:
                    days_since = f"{(timezone.now() - timeline.last_successful_poll).days} days ago"

                logger.warning(
                    f"Disabled timeline {timeline.id} - last successful poll: {days_since}"
                )
            except Exception as e:
                logger.error(f"Failed to disable timeline {timeline.id}: {e}")
                continue

        if disabled_count > 0:
            logger.info(
                f"Disabled {disabled_count} Mastodon timelines (inactive > 1 week)"
            )
        else:
            logger.debug("No long-inactive Mastodon timelines to disable")

    except Exception as e:
        logger.error(f"Error during Mastodon timeline cleanup: {e}", exc_info=True)


@shared_task(name="test_mastodon_connections")
def test_mastodon_connections() -> None:
    """
    Test Mastodon account connections and disable only those that have been
    failing for over a week. This is much more forgiving than immediate disabling.
    """
    try:
        from datetime import timedelta

        # Get all active Mastodon accounts
        accounts = MastodonAccount.objects.filter(is_active=True)

        total_accounts = accounts.count()
        logger.info(f"Testing {total_accounts} active Mastodon account connections")

        if total_accounts == 0:
            logger.info("No active Mastodon accounts found to test")
            return

        # Check for accounts with timelines that haven't succeeded in a week
        one_week_ago = timezone.now() - timedelta(days=7)

        disabled_count = 0
        for account in accounts:
            try:
                # Check if any of this account's timelines have succeeded recently
                recent_success = account.timelines.filter(
                    last_successful_poll__gte=one_week_ago
                ).exists()

                if not recent_success:
                    # No timeline has succeeded in a week, test the connection
                    if not test_mastodon_connection(
                        account.server_url, account.access_token
                    ):
                        # Connection failed AND no recent successes
                        account.is_active = False
                        account.save()
                        disabled_count += 1
                        logger.warning(
                            f"Disabled Mastodon account {account.id} "
                            f"({account.username}@{account.server_url}) - "
                            f"connection failed and no successful polls in past week"
                        )
                    else:
                        logger.debug(
                            f"Connection test passed for account {account.id}, keeping active"
                        )
                else:
                    logger.debug(
                        f"Account {account.id} has recent successful polls, skipping test"
                    )

            except Exception as e:
                logger.error(f"Error testing connection for account {account.id}: {e}")
                continue

        if disabled_count > 0:
            logger.info(
                f"Disabled {disabled_count}/{total_accounts} Mastodon accounts "
                f"(no successful activity > 1 week)"
            )
        else:
            logger.info(
                "All Mastodon accounts have recent activity or passed connection test"
            )

    except Exception as e:
        logger.error(f"Error during Mastodon connection testing: {e}", exc_info=True)
