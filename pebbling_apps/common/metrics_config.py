"""
Configuration for Prometheus metrics collection.
"""

from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# Allow disabling metrics collection via environment variable
METRICS_ENABLED = getattr(settings, "PROMETHEUS_METRICS_ENABLED", True)

# Configuration for different metric types
COLLECT_FEED_METRICS = getattr(settings, "COLLECT_FEED_METRICS", True)
COLLECT_BOOKMARK_METRICS = getattr(settings, "COLLECT_BOOKMARK_METRICS", True)
COLLECT_USER_METRICS = getattr(settings, "COLLECT_USER_METRICS", True)

# Rate limiting for high-frequency metrics
MAX_METRICS_PER_MINUTE = getattr(settings, "MAX_METRICS_PER_MINUTE", 1000)


def is_metrics_enabled():
    """Check if metrics collection is enabled."""
    return METRICS_ENABLED


def is_feed_metrics_enabled():
    """Check if feed metrics collection is enabled."""
    return METRICS_ENABLED and COLLECT_FEED_METRICS


def is_bookmark_metrics_enabled():
    """Check if bookmark metrics collection is enabled."""
    return METRICS_ENABLED and COLLECT_BOOKMARK_METRICS


def is_user_metrics_enabled():
    """Check if user metrics collection is enabled."""
    return METRICS_ENABLED and COLLECT_USER_METRICS


def safe_metrics_operation(func):
    """Decorator to safely execute metrics operations."""

    def wrapper(*args, **kwargs):
        if not is_metrics_enabled():
            return

        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.warning(f"Metrics operation failed: {e}")

    return wrapper
