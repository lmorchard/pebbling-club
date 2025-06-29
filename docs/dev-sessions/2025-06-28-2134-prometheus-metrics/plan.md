# Implementation Plan: Prometheus Metrics

## Project Context

This Django application (`pebbling-club`) is a bookmarking and feed aggregation system with:

- Multiple Django apps: `bookmarks`, `feeds`, `users`, `profiles`, `unfurl`, `home`, `common`
- Single database setup (PostgreSQL in production, SQLite for development/testing)
- Celery task queue for background processing
- Import/export functionality for bookmarks
- RSS/Atom feed polling system

## Phase 1: Foundation Setup

### Step 1: Install and Configure django-prometheus

**Context**: Add django-prometheus to the project dependencies and configure basic settings.

**Implementation Prompt**:

```
Add django-prometheus to this Django project for metrics collection:

1. Add `django-prometheus==2.3.1` to pyproject.toml dependencies
2. Add 'django_prometheus' to INSTALLED_APPS in pebbling/settings/base.py
3. Add django_prometheus middleware to MIDDLEWARE in the correct positions:
   - 'django_prometheus.middleware.PrometheusBeforeMiddleware' at the TOP
   - 'django_prometheus.middleware.PrometheusAfterMiddleware' at the BOTTOM
4. Update requirements if needed for production deployment

The project uses uv for dependency management and has base/local/production settings structure.
```

### Step 2: Add Metrics URL Endpoint

**Context**: Create the /metrics endpoint following Django URL patterns.

**Implementation Prompt**:

```
Add a /metrics endpoint to expose Prometheus metrics:

1. In pebbling/urls.py, add the django_prometheus URL include
2. Map it to the /metrics path (should be publicly accessible)
3. Test that the endpoint returns metrics data

The project has existing URL patterns for /admin/, /auth/, /feeds/, etc. Follow the same pattern.
Make sure the endpoint works with the existing URL configuration.
```

### Step 3: Configure Database Metrics

**Context**: Enable automatic database query instrumentation for the single database setup.

**Implementation Prompt**:

```
Configure django-prometheus database instrumentation for this Django project:

1. The project uses a single database configuration:
   - PostgreSQL in production
   - SQLite for development/testing

2. Update the DATABASES configuration in pebbling/settings/base.py to use prometheus database backends
3. Replace the ENGINE with the appropriate django_prometheus wrapper:
   - For PostgreSQL: 'django_prometheus.db.backends.postgresql'
   - For SQLite: 'django_prometheus.db.backends.sqlite3'

4. Ensure the configuration works for both production and development environments

Reference the existing database configuration patterns in the settings files.
```

### Step 4: Enable Model-Level Metrics

**Context**: Add automatic model instrumentation for key business models.

**Implementation Prompt**:

```
Enable django-prometheus model metrics for key business models:

1. Focus on these core models for automatic instrumentation:
   - pebbling_apps.bookmarks.models.Bookmark
   - pebbling_apps.bookmarks.models.Tag
   - pebbling_apps.feeds.models.Feed
   - pebbling_apps.feeds.models.FeedItem
   - pebbling_apps.users.models.User

2. Add the PrometheusModelMixin to these models
3. Test that model creation/deletion metrics are being collected

Follow Django model inheritance patterns used in the existing codebase.
```

## Phase 2: Custom Business Metrics

### Step 5: Feed Update Metrics

**Context**: Track feed polling activity and success rates.

**Implementation Prompt**:

```
Add custom Prometheus metrics for feed update activity:

1. Create a metrics module: pebbling_apps/feeds/metrics.py
2. Add these custom metrics:
   - Counter: feed_polls_total (labels: feed_id, status)
   - Histogram: feed_poll_duration_seconds
   - Gauge: feed_items_discovered_total
   - Gauge: active_feeds_count

3. Integrate metrics into the existing feed polling logic:
   - Look for Celery tasks in pebbling_apps/feeds/tasks.py
   - Add metrics collection to feed update functions
   - Track both successful and failed feed polls

4. Follow the existing patterns for feed processing in the codebase.
```

### Step 6: Bookmark Management Metrics

**Context**: Track bookmark creation, updates, and import activities.

**Implementation Prompt**:

```
Add custom Prometheus metrics for bookmark management:

1. Create a metrics module: pebbling_apps/bookmarks/metrics.py
2. Add these custom metrics:
   - Counter: bookmarks_created_total (labels: user_id, source)
   - Counter: bookmarks_updated_total (labels: user_id, operation)
   - Counter: bookmarks_deleted_total (labels: user_id)
   - Counter: bookmark_imports_total (labels: user_id, format, status)
   - Histogram: bookmark_import_duration_seconds
   - Gauge: bookmark_import_items_processed

3. Integrate metrics into:
   - Bookmark model save/delete methods
   - Import job processing (look for ImportJob model and related tasks)
   - Bookmark service operations

4. Use existing patterns from the bookmarks app for integration points.
```

### Step 7: Basic Testing and Validation

**Context**: Verify that metrics collection is working correctly.

**Implementation Prompt**:

```
Create basic tests and validation for the Prometheus metrics implementation:

1. Add a test in pebbling_apps/common/tests/ to verify:
   - /metrics endpoint is accessible and returns valid Prometheus format
   - Basic Django metrics are being collected (requests, database queries)
   - Custom metrics are registered and collecting data

2. Create a simple management command to test metrics:
   - pebbling_apps/common/management/commands/test_metrics.py
   - Command should trigger some activity and verify metrics are updated
   - Include bookmark creation, feed polling simulation

3. Add basic documentation in the session notes about:
   - How to access metrics
   - What metrics are available
   - How to test locally

Follow existing test patterns and management command structure in the codebase.
```

## Phase 3: Integration and Polish

### Step 8: Error Handling and Edge Cases

**Context**: Ensure metrics collection doesn't break application functionality.

**Implementation Prompt**:

```
Add robust error handling for metrics collection:

1. Wrap all custom metrics calls in try/except blocks
2. Add logging for metrics collection failures
3. Ensure metrics failures don't impact core application functionality
4. Add graceful degradation if prometheus client has issues

5. Test edge cases:
   - High-volume operations (bulk imports)
   - Database connection issues
   - Celery task failures

Use the existing logging configuration and error handling patterns.
```

### Step 9: Documentation and Configuration

**Context**: Document the implementation for future maintenance and expansion.

**Implementation Prompt**:

```
Complete the metrics implementation with documentation and configuration:

1. Update project documentation with:
   - Available metrics list
   - How to add new custom metrics
   - Local testing instructions
   - Production deployment notes

2. Add environment variable configuration for:
   - Enabling/disabling metrics collection
   - Metrics endpoint path customization
   - Performance tuning options

3. Update the development Makefile with metrics-related commands:
   - Command to view metrics locally
   - Command to run metrics tests

4. Document the implementation in the dev session notes
```

## Implementation Sequence

Each step builds on the previous:

1. Steps 1-4: Basic infrastructure setup
2. Steps 5-6: Custom business metrics
3. Steps 7-9: Testing, validation, and documentation

## Success Validation

After each phase:

- Verify /metrics endpoint works
- Check that new metrics appear in output
- Test that application functionality is unaffected
- Validate metrics accuracy with sample operations

## Rollback Strategy

- Each step is isolated and can be individually reverted
- Database changes are additive only (no schema changes)
- Settings changes are clearly documented
- Custom metrics modules can be easily disabled
