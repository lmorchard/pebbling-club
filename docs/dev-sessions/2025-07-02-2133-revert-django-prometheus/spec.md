# Session Spec: Revert Django Prometheus

## Overview

In @../docs/dev-sessions/2025-06-28-2134-prometheus-metrics, we added django-prometheus to support a new /metrics endpoint.

We also added middleware and instrumentation across the project, committing to git here: https://github.com/lmorchard/pebbling-club/commit/7099531e620b20c0b1eb8be3826ee4c7ea7c0c4c

However, it has turned out that django-prometheus is not compatible with our serverless and docker deployment targets. We found that django-prometheus relies on in-process storage for metrics, but we use stateless processes to run Django.

So, we need to go through and remove django-prometheus integration from the project - essentially reverting that previous dev effort and wherever else we have introduced instrumentation for this package.

## Goals

1. **Complete removal of django-prometheus integration** - Eliminate all traces of django-prometheus from the codebase
2. **Restore clean application state** - Return to a state where the application runs without any metrics collection dependencies
3. **Comprehensive discovery** - Find all integration points that may have been added since the initial commit
4. **Incremental cleanup** - Remove integration in stages while keeping the application functional after each stage
5. **Documentation** - Record the removal process and lessons learned for future reference

## Success Criteria

- [ ] No django-prometheus dependency remains in requirements files
- [ ] All django-prometheus imports and references are removed from codebase
- [ ] The /metrics endpoint is completely removed/disabled
- [ ] Application runs without errors after cleanup
- [ ] All existing tests continue to pass
- [ ] All linting and type checking passes
- [ ] No broken imports or references remain
- [ ] Clean git history with logical commit stages

## Approach

**Phase 1: Analysis**
- Examine original commit (7099531e620b20c0b1eb8be3826ee4c7ea7c0c4c) to understand integration patterns
- Search codebase for all django-prometheus references

**Phase 2: Staged Removal**
1. Models/Database integrations - Remove instrumentation from models and database queries
2. Views/Business logic - Remove instrumentation from views and application logic
3. Middleware - Remove django-prometheus middleware from request/response pipeline
4. URLs/Routing - Remove /metrics endpoint and related URL patterns
5. Settings/Configuration - Remove django-prometheus from Django settings
6. Dependencies - Remove django-prometheus from requirements files

**Phase 3: Verification**
- Run application and verify no errors
- Execute full test suite
- Run linting and type checking
- Verify /metrics endpoint is gone

## Documentation Requirements

- Document all changes made in session notes
- Record lessons learned about django-prometheus compatibility issues
- Note patterns and gotchas for future metrics implementations
- Keep detailed record of what was found and removed
- Preserve dev-session docs for historical record

## Out of Scope

- **Implementing new metrics solution** - This session focuses only on removal/cleanup
- **Performance analysis** - Not evaluating impact of removing metrics
- **Deployment coordination** - No special deployment considerations needed
- **Architectural decisions** - Not designing the replacement metrics approach
