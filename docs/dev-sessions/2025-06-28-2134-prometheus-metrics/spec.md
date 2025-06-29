# Prometheus Metrics Implementation

## Overview

Check out this issue: https://github.com/lmorchard/pebbling-club/issues/7

We should build a /metrics endpoint exposing top-level metrics for the major systems and features of this app.

Assume we want this to be scraped by Prometheus or something similar. Let's think through what major metrics would work initially and ensure we can expand to additional metrics in the future.

## Goals

- Establish foundational metrics collection infrastructure using django-prometheus
- Expose standard Django application metrics (HTTP requests, database queries, model operations)
- Add custom metrics for core business functionality (feed updates, bookmark management)
- Create extensible foundation for future metrics expansion
- Enable monitoring and observability of application health and usage patterns

## Requirements

### Technical Requirements
- Use `django-prometheus` library for automatic Django instrumentation
- Expose metrics at `/metrics` endpoint (publicly accessible, production auth handled by nginx)
- Enable all automatic instrumentation that django-prometheus easily supports:
  - HTTP request metrics (response codes, duration, request count by view)
  - Database query metrics (query count, duration)
  - Model-level metrics (instance creation/deletion counts)
  - Cache metrics (if Django cache framework is in use)

### Custom Metrics (Foundation Phase)
- Feed update metrics: Track new items from feeds over time
- Bookmark management metrics: Creation, updates, deletions
- Content creation and manipulation metrics
- Import/export activity tracking
- Basic active user metrics (if easily implementable)

### Implementation Approach
- Use simplest, most conventional approach for custom metrics
- Add metric collection directly into existing model methods/views where appropriate
- Avoid over-engineering - prioritize working foundation over perfect architecture
- Focus on 1-2 core features for custom metrics in this session

## Success Criteria

### Phase 1 (This Session)
- [ ] django-prometheus installed and configured
- [ ] /metrics endpoint accessible and returning data
- [ ] All automatic Django instrumentation working
- [ ] Custom metrics implemented for 1-2 core features (feed updates, bookmark creation)
- [ ] Basic testing to confirm metrics collection works
- [ ] Foundation ready for expansion

### Future Expansion
- Comprehensive custom metrics for all major features
- Advanced business intelligence metrics
- Performance optimization based on collected data
- Integration with production Prometheus setup

## Technical Notes
- Leave endpoint public in Django - production authentication handled at nginx level
- Prioritize foundation and extensibility over comprehensive coverage
- Validate basics work before expanding scope
