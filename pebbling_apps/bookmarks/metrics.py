"""
Prometheus metrics for bookmark operations.
"""

from prometheus_client import Counter, Histogram, Gauge
from pebbling_apps.common.metrics_config import (
    is_bookmark_metrics_enabled,
    safe_metrics_operation,
)
import logging

logger = logging.getLogger(__name__)

# Bookmark CRUD metrics
BOOKMARK_OPERATIONS_TOTAL = Counter(
    "bookmark_operations_total",
    "Total bookmark operations",
    ["operation", "user_id", "source"],
)

BOOKMARK_COUNT_BY_USER = Gauge(
    "bookmark_count_by_user", "Number of bookmarks per user", ["user_id"]
)

# Import/Export metrics
IMPORT_JOBS_TOTAL = Counter(
    "import_jobs_total", "Total import jobs", ["status", "user_id", "format"]
)

IMPORT_JOB_DURATION = Histogram(
    "import_job_duration_seconds",
    "Import job processing duration",
    ["user_id", "format"],
)

IMPORT_ITEMS_PROCESSED = Counter(
    "import_items_processed_total",
    "Number of items processed during imports",
    ["status", "user_id", "format"],
)

EXPORT_OPERATIONS_TOTAL = Counter(
    "export_operations_total", "Total export operations", ["format", "user_id"]
)

EXPORT_DURATION = Histogram(
    "export_duration_seconds", "Export operation duration", ["format"]
)

# Unfurl/metadata metrics
UNFURL_OPERATIONS_TOTAL = Counter(
    "unfurl_operations_total", "Total unfurl operations", ["status"]
)

UNFURL_DURATION = Histogram("unfurl_duration_seconds", "Time spent unfurling metadata")


@safe_metrics_operation
def increment_bookmark_operation(operation: str, user_id: int, source: str = "manual"):
    """Record a bookmark operation."""
    if not is_bookmark_metrics_enabled():
        return
    BOOKMARK_OPERATIONS_TOTAL.labels(
        operation=operation, user_id=str(user_id), source=source
    ).inc()


@safe_metrics_operation
def update_bookmark_count_for_user(user_id: int, count: int):
    """Update bookmark count for a specific user."""
    if not is_bookmark_metrics_enabled():
        return
    BOOKMARK_COUNT_BY_USER.labels(user_id=str(user_id)).set(count)


@safe_metrics_operation
def record_import_job_start(user_id: int, job_format: str):
    """Record the start of an import job."""
    if not is_bookmark_metrics_enabled():
        return
    IMPORT_JOBS_TOTAL.labels(
        status="started", user_id=str(user_id), format=job_format
    ).inc()


@safe_metrics_operation
def record_import_job_completion(
    user_id: int,
    job_format: str,
    duration: float,
    status: str,
    items_processed: int = 0,
    items_failed: int = 0,
):
    """Record import job completion with duration and item counts."""
    if not is_bookmark_metrics_enabled():
        return
    IMPORT_JOB_DURATION.labels(user_id=str(user_id), format=job_format).observe(
        duration
    )
    IMPORT_JOBS_TOTAL.labels(
        status=status, user_id=str(user_id), format=job_format
    ).inc()

    if items_processed > 0:
        IMPORT_ITEMS_PROCESSED.labels(
            status="processed", user_id=str(user_id), format=job_format
        ).inc(items_processed)
    if items_failed > 0:
        IMPORT_ITEMS_PROCESSED.labels(
            status="failed", user_id=str(user_id), format=job_format
        ).inc(items_failed)


@safe_metrics_operation
def record_export_operation(user_id: int, export_format: str, duration: float):
    """Record an export operation."""
    if not is_bookmark_metrics_enabled():
        return
    EXPORT_OPERATIONS_TOTAL.labels(format=export_format, user_id=str(user_id)).inc()
    EXPORT_DURATION.labels(format=export_format).observe(duration)


@safe_metrics_operation
def record_unfurl_operation(status: str, duration: float):
    """Record an unfurl metadata operation."""
    if not is_bookmark_metrics_enabled():
        return
    UNFURL_OPERATIONS_TOTAL.labels(status=status).inc()
    UNFURL_DURATION.observe(duration)
