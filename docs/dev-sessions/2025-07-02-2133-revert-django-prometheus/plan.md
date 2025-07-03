# Session Plan: Revert Django Prometheus

## Overview

This plan outlines the systematic removal of django-prometheus integration from the pebbling-club project. The approach is designed to be incremental and safe, ensuring the application remains functional after each step.

## Phase 1: Discovery and Analysis

### Step 1.1: Examine Original Integration Commit
**Context**: Understand what was originally added to establish removal patterns.

**Prompt for Implementation**:
```
Examine the original django-prometheus integration commit (7099531e620b20c0b1eb8be3826ee4c7ea7c0c4c) to understand:
1. What files were modified
2. What types of changes were made (imports, middleware, settings, etc.)
3. What patterns were used for instrumentation
4. Document findings in session notes for reference

Use git show or git diff to examine the commit and create a comprehensive inventory of changes.
```

### Step 1.2: Search Current Codebase for All References
**Context**: Find all current django-prometheus usage, including additions made after the original commit.

**Prompt for Implementation**:
```
Search the entire codebase for django-prometheus references using multiple search strategies:
1. Search for "django_prometheus" (package name)
2. Search for "prometheus" (general references)
3. Search for "metrics" (related functionality)
4. Check requirements files for prometheus dependencies
5. Look for imports from django_prometheus
6. Check for middleware references
7. Look for URL patterns containing "metrics"

Document all findings with file paths and line numbers in session notes. This will be our removal checklist.
```

### Step 1.3: Create Removal Inventory
**Context**: Organize findings into a structured plan for removal.

**Prompt for Implementation**:
```
Based on the search results, create a comprehensive inventory categorized by:
1. **Models/Database**: Any model instrumentation or database query monitoring
2. **Views/Business Logic**: View decorators, function instrumentation, custom metrics
3. **Middleware**: Django middleware configuration and custom middleware
4. **URLs/Routing**: Metrics endpoints and URL patterns
5. **Settings/Configuration**: Django settings, app registration, middleware lists
6. **Dependencies**: Requirements files, package references

For each category, list specific files and changes needed. This becomes our removal roadmap.
```

## Phase 2: Staged Removal

### Step 2.1: Remove Model/Database Instrumentation
**Context**: Start with the data layer to avoid breaking higher-level functionality.

**Prompt for Implementation**:
```
Remove django-prometheus instrumentation from models and database queries:
1. Remove any model field instrumentation or custom metrics
2. Remove database query monitoring decorators
3. Remove any prometheus-related imports from model files
4. Keep all business logic intact - only remove metrics collection

Test after changes:
- Run the application locally
- Verify models still work correctly
- Run any model-related tests
- Commit changes with message "Remove django-prometheus model instrumentation"
```

### Step 2.2: Remove View/Business Logic Instrumentation
**Context**: Remove metrics from views while preserving all application functionality.

**Prompt for Implementation**:
```
Remove django-prometheus instrumentation from views and business logic:
1. Remove any view decorators for metrics collection
2. Remove custom metrics creation in view functions
3. Remove prometheus-related imports from view files
4. Remove any manual timing or counting code
5. Keep all business logic and return values unchanged

Test after changes:
- Run the application locally
- Test key user workflows
- Verify all views still work correctly
- Run view-related tests
- Commit changes with message "Remove django-prometheus view instrumentation"
```

### Step 2.3: Remove Middleware Configuration
**Context**: Remove middleware from the request/response pipeline.

**Prompt for Implementation**:
```
Remove django-prometheus middleware from Django configuration:
1. Remove middleware entries from MIDDLEWARE setting in settings files
2. Remove any custom middleware classes that use prometheus
3. Remove middleware-related imports
4. Ensure middleware list is still valid and properly ordered

Test after changes:
- Run the application locally
- Test request/response cycle works normally
- Verify no middleware errors in logs
- Run full test suite
- Commit changes with message "Remove django-prometheus middleware"
```

### Step 2.4: Remove URL/Routing Configuration
**Context**: Remove metrics endpoints and related URL patterns.

**Prompt for Implementation**:
```
Remove django-prometheus URL patterns and endpoints:
1. Remove /metrics endpoint from URL configuration
2. Remove any prometheus-related URL includes
3. Remove imports for prometheus URL patterns
4. Ensure remaining URL patterns are still valid

Test after changes:
- Run the application locally
- Verify /metrics endpoint returns 404 (or doesn't exist)
- Test that other URLs still work correctly
- Run URL-related tests
- Commit changes with message "Remove django-prometheus URL patterns"
```

### Step 2.5: Remove Settings/Configuration
**Context**: Remove django-prometheus from Django settings and app configuration.

**Prompt for Implementation**:
```
Remove django-prometheus from Django settings:
1. Remove 'django_prometheus' from INSTALLED_APPS
2. Remove any prometheus-related settings/configuration
3. Remove prometheus-related imports from settings files
4. Clean up any prometheus-specific environment variables or config

Test after changes:
- Run the application locally
- Verify Django starts without errors
- Check that settings are still valid
- Run full test suite
- Commit changes with message "Remove django-prometheus from Django settings"
```

### Step 2.6: Remove Dependencies
**Context**: Remove django-prometheus from package dependencies.

**Prompt for Implementation**:
```
Remove django-prometheus from project dependencies:
1. Remove django-prometheus from requirements.txt (and any other requirements files)
2. Remove any other prometheus-related dependencies if not used elsewhere
3. Update any dependency documentation
4. Consider running pip freeze to verify clean state

Test after changes:
- Create fresh virtual environment
- Install dependencies from requirements.txt
- Run the application
- Run full test suite
- Commit changes with message "Remove django-prometheus dependencies"
```

## Phase 3: Verification and Cleanup

### Step 3.1: Final Verification
**Context**: Ensure complete removal and application functionality.

**Prompt for Implementation**:
```
Perform comprehensive verification of django-prometheus removal:
1. Run full test suite and ensure all tests pass
2. Run linting and type checking
3. Search codebase again for any remaining prometheus references
4. Test application startup and basic functionality
5. Verify /metrics endpoint is completely gone
6. Check for any broken imports or references

Document any issues found and resolve them before proceeding.
```

### Step 3.2: Documentation and Cleanup
**Context**: Complete session documentation and final cleanup.

**Prompt for Implementation**:
```
Complete session documentation:
1. Update session notes with:
   - Summary of all changes made
   - Lessons learned about django-prometheus compatibility
   - Patterns found that future developers should be aware of
   - Any gotchas or challenges encountered
2. Update todo.md to mark all tasks as completed
3. Add final summary to notes.md
4. Ensure all changes are properly committed with clear messages

The project should now be in a clean state with no django-prometheus integration remaining.
```

## Risk Mitigation

### Rollback Strategy
- Each step is committed separately, allowing easy rollback if issues arise
- Keep detailed notes of changes for reference
- Test application functionality after each major step

### Testing Strategy
- Run application locally after each step
- Execute relevant tests after each change
- Perform full test suite at major milestones
- Manual testing of key workflows

### Dependencies
- Ensure no other packages depend on django-prometheus
- Verify no custom code depends on prometheus metrics
- Check that removal doesn't break any monitoring or alerting systems

## Success Metrics

- [ ] Application runs without errors
- [ ] All tests pass
- [ ] No django-prometheus references remain in codebase
- [ ] /metrics endpoint is completely removed
- [ ] Clean git history with logical commits
- [ ] Comprehensive documentation of changes