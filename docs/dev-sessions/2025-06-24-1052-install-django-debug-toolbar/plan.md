# Django Debug Toolbar Implementation Plan

## Overview
This plan outlines the step-by-step implementation of django-debug-toolbar in the Pebbling Club project. The project uses Django 5.1.6 with uv for dependency management and already has proper DEBUG mode configuration.

## Implementation Steps

### Step 1: Add django-debug-toolbar to dependencies
**Goal**: Install the package using the project's dependency management system (uv/pyproject.toml)

**Tasks**:
1. Add django-debug-toolbar to pyproject.toml dependencies
2. Run uv sync to install the package
3. Verify installation

**Verification**: Package appears in uv.lock and can be imported

---

### Step 2: Configure INSTALLED_APPS for debug mode
**Goal**: Add debug_toolbar to INSTALLED_APPS only when DEBUG=True

**Tasks**:
1. Modify pebbling/settings.py to conditionally add 'debug_toolbar' to INSTALLED_APPS
2. Ensure it's added after Django's staticfiles app
3. Use the existing DEBUG variable check pattern

**Verification**: debug_toolbar appears in INSTALLED_APPS when DEBUG=True

---

### Step 3: Add debug toolbar middleware
**Goal**: Insert debug toolbar middleware in the correct position

**Tasks**:
1. Add 'debug_toolbar.middleware.DebugToolbarMiddleware' to MIDDLEWARE
2. Position it early in the middleware stack (after SecurityMiddleware)
3. Only add when DEBUG=True

**Verification**: Middleware is present in correct order when DEBUG=True

---

### Step 4: Configure debug toolbar URLs
**Goal**: Include debug toolbar URL patterns in the main URL configuration

**Tasks**:
1. Import debug_toolbar in pebbling/urls.py
2. Add conditional URL pattern for __debug__/ path
3. Only include when settings.DEBUG is True

**Verification**: Debug toolbar URLs are accessible at /__debug__/

---

### Step 5: Verify INTERNAL_IPS configuration
**Goal**: Ensure INTERNAL_IPS is properly set for local development

**Tasks**:
1. Confirm INTERNAL_IPS includes '127.0.0.1'
2. Verify it's only set when DEBUG=True (already implemented)

**Verification**: INTERNAL_IPS is correctly configured

---

### Step 6: Test the installation
**Goal**: Verify django-debug-toolbar is working correctly

**Tasks**:
1. Start the development server
2. Navigate to any page in the application
3. Verify the debug toolbar appears on the right side
4. Click through panels, especially the SQL panel
5. Make a database query and verify it appears in the SQL panel

**Verification**: All panels load and SQL queries are visible

---

## Implementation Prompts for Code Generation

### Prompt 1: Add django-debug-toolbar dependency

```
Add django-debug-toolbar to the project dependencies in pyproject.toml. The project uses uv for dependency management and currently has Django 5.1.6. Add the latest compatible version of django-debug-toolbar to the dependencies section. After adding it, run 'uv sync' to install the package.
```

---

### Prompt 2: Update INSTALLED_APPS in settings.py

```
In pebbling/settings.py, modify the INSTALLED_APPS configuration to conditionally include 'debug_toolbar' when DEBUG is True. The current INSTALLED_APPS is defined on lines 45-62. Add the conditional logic after the main INSTALLED_APPS definition, following the existing pattern where DEBUG-specific configurations are added around line 33-34. Make sure 'debug_toolbar' is added to the list only in debug mode.
```

---

### Prompt 3: Add debug toolbar middleware

```
In pebbling/settings.py, add the debug toolbar middleware to the MIDDLEWARE list (currently defined on lines 64-73). The middleware 'debug_toolbar.middleware.DebugToolbarMiddleware' should be added early in the stack, right after 'django.middleware.security.SecurityMiddleware' but before WhiteNoise. Only add this middleware when DEBUG is True, similar to how INTERNAL_IPS is conditionally set.
```

---

### Prompt 4: Configure debug toolbar URLs

```
In pebbling/urls.py, add the debug toolbar URL configuration. Import debug_toolbar at the top of the file, then add a conditional check that includes debug_toolbar.urls when settings.DEBUG is True. The URL pattern should use the path '__debug__/' as the prefix. Follow Django's URL configuration best practices and ensure the import and URL inclusion only happen in debug mode.
```

---

### Prompt 5: Verify and test the installation

```
Create a simple test to verify django-debug-toolbar is working:
1. First, verify INTERNAL_IPS is already set to ['127.0.0.1'] when DEBUG=True in settings.py (around lines 33-34)
2. Start the development server with DEBUG=True
3. Document the steps to test the toolbar:
   - Visit any page (like the home page or admin)
   - Look for the debug toolbar on the right side of the page
   - Click to expand it and verify panels are accessible
   - Special attention to the SQL panel for viewing database queries
4. If any issues arise, check the browser console for JavaScript errors and the Django console for any configuration warnings
```

---

## Success Criteria Checklist

- [ ] django-debug-toolbar is added to pyproject.toml
- [ ] Package is installed via uv sync
- [ ] INSTALLED_APPS includes 'debug_toolbar' only when DEBUG=True
- [ ] Middleware includes DebugToolbarMiddleware in correct position when DEBUG=True
- [ ] URLs include debug toolbar patterns at __debug__/ when DEBUG=True
- [ ] INTERNAL_IPS is configured (already done)
- [ ] Toolbar appears on all pages in development
- [ ] SQL panel shows database queries
- [ ] No errors in console or server logs
- [ ] No impact when DEBUG=False

## Notes

- The project already has proper DEBUG mode detection using django-environ
- INTERNAL_IPS is already configured when DEBUG=True
- All debug toolbar features should be isolated to DEBUG mode only
- The toolbar should have zero impact on production deployments