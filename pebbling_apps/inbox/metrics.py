"""
Prometheus metrics for inbox operations.
"""

from prometheus_client import Counter, Histogram, Gauge
from pebbling_apps.common.metrics_config import (
    is_metrics_enabled,
    safe_metrics_operation,
)
import logging

logger = logging.getLogger(__name__)

# Inbox delivery metrics
INBOX_ITEMS_DELIVERED_TOTAL = Counter(
    "inbox_items_delivered_total",
    "Total number of items delivered to user inboxes",
    ["user_id", "source_type"],
)

INBOX_DELIVERY_DURATION = Histogram(
    "inbox_delivery_duration_seconds",
    "Time spent delivering items to user inboxes",
    ["stage"],  # stage1 or stage2
)

INBOX_USERS_FOUND = Gauge(
    "inbox_users_found_total",
    "Number of users found for feed delivery in last lookup",
    ["feed_url"],
)

INBOX_BULK_OPERATIONS_TOTAL = Counter(
    "inbox_bulk_operations_total",
    "Total number of bulk operations performed",
    [
        "operation",
        "status",
    ],  # operation: mark_read, archive, etc. status: success, error
)

INBOX_ITEMS_COUNT = Gauge(
    "inbox_items_count",
    "Current number of inbox items by status",
    ["user_id", "status"],  # status: unread, read, archived
)


@safe_metrics_operation
def increment_inbox_delivery_total(user_id: int, source_type: str):
    """Increment the inbox delivery counter."""
    if not is_metrics_enabled():
        return
    INBOX_ITEMS_DELIVERED_TOTAL.labels(
        user_id=str(user_id), source_type=source_type
    ).inc()


@safe_metrics_operation
def observe_inbox_delivery_duration(stage: str, duration: float):
    """Record inbox delivery duration."""
    if not is_metrics_enabled():
        return
    INBOX_DELIVERY_DURATION.labels(stage=stage).observe(duration)


@safe_metrics_operation
def set_inbox_users_found(feed_url: str, count: int):
    """Set the number of users found for feed delivery."""
    if not is_metrics_enabled():
        return
    # Hash the feed URL to avoid high cardinality
    import hashlib

    feed_hash = hashlib.md5(feed_url.encode()).hexdigest()[:8]
    INBOX_USERS_FOUND.labels(feed_url=feed_hash).set(count)


@safe_metrics_operation
def increment_bulk_operation(operation: str, status: str):
    """Increment bulk operation counter."""
    if not is_metrics_enabled():
        return
    INBOX_BULK_OPERATIONS_TOTAL.labels(operation=operation, status=status).inc()


@safe_metrics_operation
def update_inbox_items_count(user_id: int, status: str, count: int):
    """Update the count of inbox items by status."""
    if not is_metrics_enabled():
        return
    INBOX_ITEMS_COUNT.labels(user_id=str(user_id), status=status).set(count)
