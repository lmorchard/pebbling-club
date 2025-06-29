"""
Prometheus metrics for feed operations.
"""

from prometheus_client import Counter, Histogram, Gauge
from pebbling_apps.common.metrics_config import (
    is_feed_metrics_enabled,
    safe_metrics_operation,
)
import logging

logger = logging.getLogger(__name__)

# Feed polling metrics
FEED_POLLS_TOTAL = Counter(
    "feed_polls_total", "Total number of feed polls", ["feed_id", "status"]
)

FEED_POLL_DURATION = Histogram(
    "feed_poll_duration_seconds", "Time spent polling feeds", ["feed_id"]
)

FEED_ITEMS_DISCOVERED = Gauge(
    "feed_items_discovered_total",
    "Number of new items discovered in last feed poll",
    ["feed_id"],
)

ACTIVE_FEEDS_COUNT = Gauge(
    "active_feeds_count", "Number of active (non-disabled) feeds"
)


@safe_metrics_operation
def increment_feed_poll_total(feed_id: int, status: str):
    """Increment the feed poll counter."""
    if not is_feed_metrics_enabled():
        return
    FEED_POLLS_TOTAL.labels(feed_id=str(feed_id), status=status).inc()


@safe_metrics_operation
def observe_feed_poll_duration(feed_id: int, duration: float):
    """Record feed poll duration."""
    if not is_feed_metrics_enabled():
        return
    FEED_POLL_DURATION.labels(feed_id=str(feed_id)).observe(duration)


@safe_metrics_operation
def set_feed_items_discovered(feed_id: int, count: int):
    """Set the number of items discovered in the last poll."""
    if not is_feed_metrics_enabled():
        return
    FEED_ITEMS_DISCOVERED.labels(feed_id=str(feed_id)).set(count)


@safe_metrics_operation
def update_active_feeds_count(count: int):
    """Update the count of active feeds."""
    if not is_feed_metrics_enabled():
        return
    ACTIVE_FEEDS_COUNT.set(count)
