# Mastodon Integration Implementation Plan

## Overview

This plan implements Mastodon integration for the inbox feature in 4 phases, with each phase broken down into small, incremental steps that build on each other. Each step is designed to be implemented safely while making meaningful progress.

## Phase 1: Foundation & Dependencies

### Step 1.1: Add Dependencies and Settings
**Objective**: Set up the basic infrastructure for Mastodon integration

**Implementation Prompt**:
```
Add Mastodon.py library dependency and configure system settings for the Mastodon integration feature.

Tasks:
1. Add `Mastodon.py>=1.8.1` to requirements.txt
2. Add new Django settings to settings.py with environment variable support:
   - MASTODON_POLL_FREQUENCY (default: 60 seconds)
   - MASTODON_EXCERPT_LENGTH (default: 100 characters)
   - MASTODON_MAX_CONSECUTIVE_FAILURES (default: 3)
3. Update .env.example with these new environment variables
4. Run pip install to verify dependency installation

Ensure all settings follow the existing project patterns for environment variable configuration.
```

### Step 1.2: Create Mastodon Django App
**Objective**: Create the foundational Django app structure

**Implementation Prompt**:
```
Create a new Django app for Mastodon functionality following the existing project patterns.

Tasks:
1. Create `pebbling_apps/mastodon/` Django app using `python manage.py startapp mastodon pebbling_apps/mastodon`
2. Add the app to INSTALLED_APPS in settings.py as 'pebbling_apps.mastodon'
3. Create basic app structure with empty __init__.py files
4. Add URL routing in main urls.py to include mastodon URLs: `path('mastodon/', include('pebbling_apps.mastodon.urls'))`
5. Create basic pebbling_apps/mastodon/urls.py with empty urlpatterns for now

Follow the same patterns used in the existing pebbling_apps/inbox app.
```

### Step 1.3: Database Models
**Objective**: Create the database schema for Mastodon accounts and timelines

**Implementation Prompt**:
```
Create Django models for MastodonAccount and MastodonTimeline following the specification.

Create pebbling_apps/mastodon/models.py with:

1. MastodonAccount model:
   - ForeignKey to User model
   - server_url (URLField)
   - server_name (CharField, max_length=255, blank=True)
   - server_description (TextField, blank=True)
   - access_token (TextField) # Will be encrypted later
   - account_id (CharField, max_length=50)
   - username (CharField, max_length=255)
   - display_name (CharField, max_length=255, blank=True)
   - is_active (BooleanField, default=True)
   - created_at, updated_at (auto timestamps)
   - Proper Meta class with ordering and str method

2. MastodonTimeline model:
   - ForeignKey to MastodonAccount
   - timeline_type (CharField with choices: HOME, LOCAL, PUBLIC, HASHTAG, LIST)
   - config (JSONField, default=dict)
   - is_active (BooleanField, default=True)
   - last_status_id (CharField, max_length=50, blank=True, null=True)
   - last_poll_attempt (DateTimeField, null=True, blank=True)
   - last_successful_poll (DateTimeField, null=True, blank=True)
   - consecutive_failures (IntegerField, default=0)
   - created_at, updated_at
   - Proper Meta class and str method

Include proper model managers with useful query methods. Follow the patterns from the existing inbox models.
```

### Step 1.4: Database Migration
**Objective**: Apply the database schema changes

**Implementation Prompt**:
```
Create and apply Django migrations for the new Mastodon models.

Tasks:
1. Generate migration: `python manage.py makemigrations mastodon`
2. Review the generated migration file for correctness
3. Apply migration: `python manage.py migrate`
4. Verify models work by creating a simple test instance in Django shell
5. Add the models to Django admin in pebbling_apps/mastodon/admin.py with basic admin classes

Ensure the migration follows Django best practices and doesn't conflict with existing migrations.
```

## Phase 2: Basic OAuth Integration

### Step 2.1: Mastodon API Utilities
**Objective**: Create utility functions for Mastodon API interactions

**Implementation Prompt**:
```
Create utility functions for Mastodon API operations in pebbling_apps/mastodon/utils.py.

Functions to implement:
1. `validate_mastodon_server(server_url)`:
   - Makes GET request to server_url/api/v1/instance
   - Returns dict with server info (title, description) or None if invalid
   - Handle exceptions gracefully

2. `create_mastodon_app(server_url)`:
   - Uses Mastodon.create_app() to register our application
   - Returns client_id, client_secret
   - Store app credentials securely (consider using Django settings for now)

3. `get_oauth_url(server_url, client_id, redirect_uri)`:
   - Generate OAuth authorization URL
   - Request 'read' scope
   - Return authorization URL

Include proper error handling, logging, and type hints. Follow existing project patterns for API utilities.
```

### Step 2.2: OAuth Views - Part 1 (Server Validation)
**Objective**: Create the initial OAuth flow views for server validation

**Implementation Prompt**:
```
Create initial OAuth views in pebbling_apps/mastodon/views.py for server validation.

Views to implement:
1. `MastodonConnectView` (TemplateView):
   - Renders form for entering Mastodon server URL
   - GET: Display server input form
   - Template: mastodon/connect.html (create simple form)

2. `validate_server` (AJAX view):
   - POST endpoint that accepts server_url
   - Uses validate_mastodon_server() utility
   - Returns JSON response with server info or error
   - Include CSRF protection

Create basic templates:
- mastodon/connect.html with server URL input form
- Include basic JavaScript for AJAX server validation

Add URL patterns to pebbling_apps/mastodon/urls.py. Follow existing project patterns for views and AJAX endpoints.
```

### Step 2.3: OAuth Views - Part 2 (Complete Flow)
**Objective**: Complete the OAuth authorization flow

**Implementation Prompt**:
```
Complete the OAuth flow by adding authorization and callback views.

Add to pebbling_apps/mastodon/views.py:

1. `initiate_oauth` view:
   - Validates server, creates app registration
   - Stores temporary OAuth state in session
   - Redirects user to Mastodon for authorization
   - Handles errors gracefully

2. `oauth_callback` view:
   - Handles OAuth callback from Mastodon
   - Exchanges authorization code for access token
   - Creates MastodonAccount instance
   - Fetches and stores user account details
   - Redirects to success page or timeline configuration

3. Update connect template with server confirmation dialog
4. Add success/error message handling using Django messages framework

Implement proper session management for OAuth state and security. Include comprehensive error handling for all OAuth steps.
```

### Step 2.4: Settings Page Integration
**Objective**: Create the Mastodon settings page accessible from user settings

**Implementation Prompt**:
```
Create the main Mastodon settings page and integrate it with the user settings navigation.

Tasks:
1. Create `MastodonSettingsView` in views.py:
   - List user's connected Mastodon accounts
   - Show connection status and last poll times
   - Provide links to connect new accounts
   - Include disconnect functionality

2. Create template mastodon/settings.html:
   - Display connected accounts in a table/list
   - Show account details (username, server, status)
   - Add/remove account buttons
   - Follow existing settings page styling

3. Add disconnect functionality:
   - `disconnect_account` view with confirmation
   - Cascade delete associated timelines
   - Include proper success/error messages

4. Integrate with main settings navigation:
   - Add "Mastodon Connections" link to existing user settings menu
   - Follow existing settings page patterns

Test the complete OAuth flow end-to-end.
```

## Phase 3: Timeline Management

### Step 3.1: Timeline Configuration Views
**Objective**: Create views for managing timeline subscriptions per account

**Implementation Prompt**:
```
Create timeline management functionality for each connected Mastodon account.

Add to views.py:

1. `AccountTimelineView`:
   - Display all timelines for a specific MastodonAccount
   - Show timeline type, status, and last poll info
   - Provide add/remove timeline functionality

2. `AddTimelineView`:
   - Form to add new timeline to an account
   - Handle different timeline types (home, local, public, hashtag, list)
   - For hashtag: text input for hashtag name
   - For list: fetch and display user's Mastodon lists using API

3. Timeline enable/disable functionality:
   - Toggle timeline active status without deletion
   - Update via AJAX with immediate feedback

Create forms in forms.py:
- TimelineForm with timeline_type field and dynamic config fields
- Proper validation for hashtag format and list selection

Templates:
- mastodon/account_timelines.html
- mastodon/add_timeline.html

Include proper error handling and user feedback.
```

### Step 3.2: Timeline List Fetching
**Objective**: Add functionality to fetch Mastodon lists for timeline configuration

**Implementation Prompt**:
```
Add Mastodon list fetching capability to support list timeline configuration.

Add to utils.py:

1. `get_mastodon_lists(mastodon_account)`:
   - Create Mastodon API client using stored access token
   - Fetch user's lists via API
   - Return list of dicts with id, title for template use
   - Handle API errors gracefully

2. `test_timeline_access(mastodon_account, timeline_type, config)`:
   - Test if timeline is accessible with current permissions
   - Validate hashtags exist, lists are accessible, etc.
   - Return success/error status

Update AddTimelineView:
- Pre-populate list choices when timeline_type is LIST
- Add AJAX endpoint to fetch lists when account is selected
- Include timeline access validation before saving

Add JavaScript for dynamic form updates based on timeline type selection.
```

### Step 3.3: Timeline Status Display
**Objective**: Add detailed status information for each timeline

**Implementation Prompt**:
```
Enhance timeline display with detailed status and polling information.

Extend MastodonTimeline model with methods:
1. `get_status_display()` - Human readable status
2. `get_last_poll_summary()` - Summary of last poll attempt
3. `is_healthy()` - Boolean indicating if timeline is working

Update AccountTimelineView template:
- Display detailed timeline status (active/inactive, last success, failure count)
- Show last poll attempt details (timestamp, item count, errors)
- Color-code timeline health status
- Add manual refresh button per timeline

Create partial template:
- mastodon/_timeline_status.html for reusable status display
- Include polling history (last 5 attempts) with expand/collapse

Add CSS for status indicators:
- Green: healthy and active
- Yellow: active but with recent failures
- Red: disabled due to failures
- Gray: manually disabled

Follow existing inbox styling patterns.
```

## Phase 4: Content Processing & Polling

### Step 4.1: Content Processing Utilities
**Objective**: Create utilities for processing Mastodon statuses into inbox items

**Implementation Prompt**:
```
Create content processing utilities for converting Mastodon statuses to inbox items.

Add to utils.py:

1. `extract_links_from_content(html_content)`:
   - Parse HTML content using BeautifulSoup or similar
   - Extract all HTTP/HTTPS links
   - Return list of URLs
   - Handle malformed HTML gracefully

2. `create_title_from_status(status, excerpt_length)`:
   - Format: "user@server.com: spoiler_text or content_excerpt"
   - Use spoiler_text if available, otherwise create excerpt
   - Strip HTML from excerpt, respect sentence boundaries
   - Truncate to excerpt_length characters
   - Handle edge cases (empty content, very short content)

3. `extract_hashtags_from_status(status)`:
   - Extract hashtags from status.tags if available
   - Return list of hashtag strings (without # prefix)
   - Handle case variations consistently

4. `should_process_status(status)`:
   - Check if status contains links
   - Handle boost/reblog attribution logic
   - Return (should_process: bool, original_status: status)

Include comprehensive tests for edge cases and malformed content.
```

### Step 4.2: Inbox Item Creation
**Objective**: Create the logic to convert processed statuses into inbox items

**Implementation Prompt**:
```
Create the main function to convert Mastodon statuses into inbox items.

Add to utils.py:

1. `create_inbox_items_from_status(user, status, source_info)`:
   - Use should_process_status() to validate
   - Extract links using extract_links_from_content()
   - Create separate InboxItem for each link found
   - Set title using create_title_from_status()
   - Use full status content as description (HTML preserved)
   - Set source string from status.account.acct
   - Add hashtags as regular user tags
   - Handle boost attribution correctly
   - Return list of created InboxItem instances

2. Error handling:
   - Log errors without breaking the polling flow
   - Handle duplicate URLs gracefully
   - Manage tag creation/retrieval
   - Validate all required fields

3. `get_timeline_content(mastodon_account, timeline_config, since_id=None)`:
   - Create Mastodon client from account
   - Fetch timeline content based on type and config
   - Handle pagination with since_id parameter
   - Return list of statuses and next since_id
   - Include error handling for API failures

Test thoroughly with various status types and edge cases.
```

### Step 4.3: Celery Tasks
**Objective**: Create the Celery task structure for polling timelines

**Implementation Prompt**:
```
Create Celery tasks for polling Mastodon timelines following the two-stage architecture.

Create pebbling_apps/mastodon/tasks.py:

1. `poll_all_mastodon_timelines`:
   - Scheduled task that runs every MASTODON_POLL_FREQUENCY seconds
   - Find all users with active MastodonTimeline entries
   - Queue individual timeline polling tasks
   - Log overall polling statistics

2. `poll_mastodon_timeline(timeline_id)`:
   - Process single MastodonTimeline
   - Update last_poll_attempt timestamp
   - Call get_timeline_content() with proper since_id
   - Process each status via create_inbox_items_from_status()
   - Update timeline status (last_successful_poll, consecutive_failures)
   - Auto-disable timeline after MAX_CONSECUTIVE_FAILURES
   - Log detailed results and errors

3. Error handling:
   - Increment consecutive_failures on API errors
   - Reset consecutive_failures on success
   - Log all errors with context
   - Continue processing other timelines if one fails

Add proper logging, metrics, and task retry logic. Follow existing Celery task patterns from the inbox app.
```

### Step 4.4: Celery Beat Integration
**Objective**: Schedule the polling tasks to run automatically

**Implementation Prompt**:
```
Configure Celery Beat to automatically schedule Mastodon timeline polling.

Tasks:
1. Add Celery Beat schedule to settings.py:
   - Schedule poll_all_mastodon_timelines to run every MASTODON_POLL_FREQUENCY seconds
   - Use proper task naming and routing
   - Follow existing beat schedule patterns

2. Update Celery configuration:
   - Ensure mastodon tasks are properly routed
   - Add any necessary task settings (retries, timeouts)

3. Create management command in management/commands/poll_mastodon.py:
   - Manually trigger poll_all_mastodon_timelines
   - Allow optional timeline_id parameter for single timeline polling
   - Include verbose output for debugging
   - Follow existing management command patterns

4. Test the complete polling flow:
   - Verify scheduled tasks run correctly
   - Test manual polling command
   - Confirm inbox items are created properly
   - Validate error handling and timeline status updates

Add comprehensive logging to track polling performance and debug issues.
```

### Step 4.5: Final Integration & Testing
**Objective**: Complete integration and comprehensive testing

**Implementation Prompt**:
```
Complete the Mastodon integration with final touches and comprehensive testing.

Final integration tasks:

1. Update main settings navigation:
   - Add Mastodon settings link to user settings menu
   - Ensure proper permissions and authentication
   - Follow existing navigation patterns

2. Add comprehensive error handling:
   - Handle expired OAuth tokens gracefully
   - Provide clear error messages to users
   - Log all errors appropriately for debugging

3. Create comprehensive test data:
   - Add sample MastodonAccount and MastodonTimeline instances
   - Test with various timeline types and configurations
   - Verify polling creates inbox items correctly

4. Documentation updates:
   - Update README with Mastodon integration information
   - Document new environment variables
   - Add troubleshooting section for common issues

5. Security review:
   - Ensure access tokens are handled securely
   - Validate all user inputs properly
   - Review OAuth implementation for security issues
   - Test permission boundaries

6. Performance testing:
   - Test with multiple accounts and timelines
   - Verify database query performance
   - Check memory usage during polling
   - Validate Celery task performance

Run full test suite and ensure all existing functionality remains intact.
```

## Implementation Guidelines

### Best Practices
- Follow existing project patterns and conventions
- Write comprehensive error handling for all external API calls
- Include proper logging at appropriate levels
- Use type hints where possible
- Follow Django security best practices
- Write tests for critical functionality

### Testing Strategy
- Test OAuth flow with real Mastodon instances
- Validate content processing with various status types
- Test error handling and failure scenarios
- Verify polling performance and reliability
- Confirm UI/UX matches existing patterns

### Security Considerations
- Store access tokens securely (consider encryption)
- Validate all user inputs
- Implement proper CSRF protection
- Handle OAuth state securely
- Sanitize content from external sources

### Performance Considerations
- Optimize database queries for polling operations
- Consider impact of multiple timeline polling
- Monitor Celery task performance
- Plan for scaling with more users and timelines

## Phase Dependencies

- **Phase 1** must be completed before Phase 2
- **Phase 2** must be completed before Phase 3
- **Phase 3** must be completed before Phase 4
- Each step within a phase builds on the previous step
- Steps should not be skipped or reordered without careful consideration

## Success Criteria

After completing all phases:
- Users can connect multiple Mastodon accounts via OAuth
- Users can configure multiple timeline types per account
- System automatically polls timelines and creates inbox items
- All error scenarios are handled gracefully
- Integration follows existing UI/UX patterns
- Performance is acceptable with realistic user loads