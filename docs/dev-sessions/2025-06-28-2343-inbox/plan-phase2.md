# Inbox Feature Implementation Plan - Phase 2 (Streamlined)

## Overview

Phase 2 builds upon Phase 1 to add **basic bulk operations** and **essential feed integration**. This streamlined approach focuses on core functionality without sophisticated UI or complex features.

## Phase 2 Scope (Streamlined)

1. **Basic Bulk Operations**: Multi-item selection and core actions
2. **Essential Feed Integration**: Two-stage Celery tasks for automated delivery
3. **Simple Monitoring**: Basic metrics using existing Prometheus infrastructure

## Architecture Decisions

### Bulk Operations
- Simple checkbox selection with basic JavaScript
- Browser confirm() dialogs for confirmation
- RESTful endpoints for bulk actions
- Basic error handling and feedback

### Feed Integration
- Two-stage Celery task architecture as specified
- Simple source attribution (just feed URL)
- Leverage existing monitoring (Flower, Prometheus)
- No complex lifecycle management or user preferences

## Implementation Phases

### Phase 2A: Basic Bulk Operations
1. Activate bulk selection UI
2. Add basic JavaScript for selection management  
3. Implement core bulk operations (read, archive, trash)
4. Add basic bulk add-to-collection

### Phase 2B: Essential Feed Integration
5. Create basic Celery task infrastructure
6. Implement Stage 1: User lookup task
7. Implement Stage 2: Inbox delivery task
8. Add feed polling integration hooks
9. Add basic source attribution and metrics

## Detailed Step-by-Step Implementation

---

## Step 1: Activate Basic Bulk Selection UI

**Objective**: Enable simple bulk selection functionality that was hidden in Phase 1.

**Implementation Prompt**:
```
Activate basic bulk selection for inbox items.

Requirements:
1. Update `frontend/src/css/inbox.css`:
   - Remove `.item-checkbox { display: none; }` rule
   - Remove `.bulk-actions { display: none; }` rule
   - Add basic visible styling for checkboxes and bulk actions
2. Verify `inbox_list.html` has:
   - Bulk actions dropdown with these options:
     * Mark as Read
     * Mark as Unread
     * Archive
     * Trash (Delete)
     * Add to Collection
   - CSRF token for bulk operations
   - "Select All" checkbox
3. Verify `_inbox_item.html` has:
   - Individual checkboxes with item IDs as values
4. Test that checkboxes appear and bulk actions section is visible
5. Don't worry about functionality yet - just make UI visible

Keep styling simple and functional.
```

---

## Step 2: Add Basic Selection JavaScript with Custom Elements

**Objective**: Add minimal JavaScript to handle checkbox selection using the existing Custom Element pattern.

**Implementation Prompt**:
```
Add basic JavaScript for bulk selection management using Custom Elements pattern.

Requirements:
1. Create `frontend/src/components/pc-inbox-item.ts` and `pc-inbox-item.css`:
   - Follow existing `pc-bookmark.ts` pattern using Lit
   - Handle individual item checkbox interactions
   - Emit custom events for selection changes
2. Create `frontend/src/components/pc-inbox-list.ts` and `pc-inbox-list.css`:
   - Handle "Select All" checkbox (check/uncheck all items)
   - Listen for item selection events
   - Enable bulk action dropdown when items are selected
   - Show selected count (e.g., "3 items selected")
   - Track selected items in simple array
3. Add inbox components to `frontend/src/index.ts`:
   - Import the new pc-inbox-item and pc-inbox-list components
4. Verify static files are properly configured:
   - Ensure TypeScript compilation includes inbox components
   - Test JS files load in browser
5. Basic functionality only:
   - No keyboard shortcuts or advanced features
   - Simple vanilla TypeScript/Lit patterns

Follow existing Custom Element patterns from pc-bookmark components.
```

---

## Step 3: Implement Core Bulk Operations

**Objective**: Add backend endpoints and basic functionality for mark read, archive, and trash.

**Implementation Prompt**:
```
Implement basic bulk operation endpoints.

Requirements:
1. Add bulk operation views in `inbox/views.py`:
   - `bulk_mark_read` - add inbox:read tag to selected items
   - `bulk_mark_unread` - remove inbox:read tag from selected items  
   - `bulk_archive` - add inbox:archived tag to selected items
   - `bulk_trash` - permanently delete selected items
2. Basic implementation:
   - Accept POST with list of item IDs
   - Verify user owns all items
   - Perform operation on all items
   - Return simple JSON success/error response
3. Add URL patterns:
   - `bulk/mark-read/`, `bulk/mark-unread/`
   - `bulk/archive/`, `bulk/trash/`
4. Add simple JavaScript to:
   - Submit to appropriate endpoint based on dropdown selection
   - Use browser `confirm()` for confirmation (especially trash)
   - Refresh page after successful operation
5. Basic error handling - show alert() on errors

Focus on getting it working, not sophisticated UX.
```

---

## Step 4: Add Basic Bulk Add-to-Collection

**Objective**: Implement simple bulk add to bookmark collection.

**Implementation Prompt**:
```
Add basic bulk add-to-collection functionality.

Requirements:
1. Create `bulk_add_to_collection` view:
   - Accept list of item IDs
   - Convert each to bookmark (similar to individual add-to-collection)
   - Handle duplicates by updating existing bookmarks
   - Optionally archive inbox items after adding
2. Simple implementation:
   - No tag dialog - just copy existing tags from inbox items
   - Use browser confirm() for confirmation
   - Basic success/error feedback
3. Add URL pattern and JavaScript handling
4. Test with multiple item selection

Keep it simple - advanced tag management can come later.
```

---

## Step 5: Create Basic Celery Task Infrastructure  

**Objective**: Set up fundamental two-stage Celery tasks for feed delivery.

**Implementation Prompt**:
```
Create basic Celery task structure for feed integration.

Requirements:
1. Verify Celery setup:
   - Confirm Celery is configured and running in the project
   - Check existing task routing configuration  
   - Test basic task execution works
2. Create `inbox/tasks.py` with:
   - `lookup_users_for_feed_items(feed_url, feed_items)` 
   - `deliver_items_to_user_inbox(user_id, feed_items, source)`
3. Basic Stage 1 implementation:
   - Query bookmarks for users with matching feed_url
   - Return list of user IDs who should receive items
   - Basic error handling and logging
4. Basic Stage 2 implementation:
   - Create InboxItem for each feed item for the user
   - Set source to simple format like "feed: {feed_url}"
   - Use bulk_create for efficiency
   - Handle errors gracefully
5. Basic task chaining:
   - Stage 1 calls Stage 2 for each user
   - Simple retry logic for failures
6. Test tasks work independently

Focus on basic functionality and reliability.
```

---

## Step 6: Implement Stage 1 - User Lookup Task

**Objective**: Complete the user lookup task with basic functionality.

**Implementation Prompt**:
```
Complete basic user lookup task implementation.

Requirements:
1. Finish `lookup_users_for_feed_items` task:
   - Query `Bookmark.objects.filter(feed_url=feed_url).select_related('owner')`
   - Extract unique user IDs  
   - Handle basic database errors
   - Return user list for Stage 2
2. Basic feed item processing:
   - Extract title, url, description from feed items
   - Handle missing fields with defaults
   - Convert to format suitable for InboxItem creation
3. Simple error handling:
   - Log errors with basic context
   - Return empty list if major errors
   - Don't crash the feed polling system
4. Test with sample feed data

Keep it simple and robust.
```

---

## Step 7: Implement Stage 2 - Inbox Delivery Task

**Objective**: Complete basic inbox delivery for individual users.

**Implementation Prompt**:
```
Complete basic inbox delivery task implementation.

Requirements:
1. Finish `deliver_items_to_user_inbox` task:
   - Create InboxItem instances for user
   - Set basic fields: url, title, description, owner
   - Generate unique_hash appropriately
   - Set source field to "feed: {feed_url}"
2. Use bulk operations:
   - Prepare all items then bulk_create
   - Handle database errors gracefully
   - Log basic success/failure metrics
3. Simple duplicate handling:
   - Allow duplicates as per original spec
   - Handle unique constraint violations gracefully
4. Basic user validation:
   - Verify user exists and is active
   - Skip delivery if user not found
5. Test delivery works end-to-end

Focus on reliability over sophisticated features.
```

---

## Step 8: Add Feed Polling Integration

**Objective**: Hook into existing feed polling to trigger inbox delivery.

**Implementation Prompt**:
```
Integrate inbox delivery with existing feed polling system.

Requirements:
1. Research existing feed polling implementation:
   - Locate existing feed polling tasks/code in the codebase
   - Understand current feed processing workflow
   - Document how new feed items are currently detected and processed
   - Identify appropriate integration points
2. Find feed polling integration points:
   - Locate where new feed items are processed
   - Identify appropriate hook to call inbox delivery
   - Understand existing error handling patterns
3. Add simple integration:
   - Call `lookup_users_for_feed_items.delay()` when new items found
   - Pass feed URL and new item data
   - Don't block feed polling if inbox delivery fails
4. Basic configuration:
   - Add simple on/off setting for inbox delivery
   - Default to enabled
5. Handle integration errors:
   - Log errors but don't break feed polling
   - Simple retry mechanism if needed
6. Test integration doesn't break existing feed functionality

Minimal integration that doesn't risk existing functionality.
```

---

## Step 9: Add Basic Source Attribution and Metrics

**Objective**: Add simple source tracking and leverage existing monitoring infrastructure.

**Implementation Prompt**:
```
Add basic source attribution and metrics collection.

Requirements:
1. Enhance source attribution:
   - Use format "feed: {feed_url}" consistently
   - Show source in inbox item UI
   - Allow filtering by source type (feed vs manual)
2. Add basic metrics using existing Prometheus infrastructure:
   - Count inbox items delivered per feed
   - Track delivery success/failure rates
   - Monitor task execution times
   - Use existing metrics patterns from codebase
3. Basic monitoring integration:
   - Log important events for existing log aggregation
   - Use existing error reporting patterns
   - Leverage Flower for Celery task monitoring
4. Simple dashboard integration:
   - Add inbox metrics to existing `/metrics` endpoint
   - Use existing Prometheus label patterns
   - Don't create new dashboard - feed existing systems

Focus on observability using existing infrastructure.
```

---

## Success Criteria (Streamlined)

### Phase 2 Complete When:
1. ✅ Basic bulk selection UI working
2. ✅ Core bulk operations functional (read, archive, trash, add-to-collection)
3. ✅ Two-stage Celery task system implemented 
4. ✅ Feed polling integration delivering items to inbox
5. ✅ Basic source attribution and metrics collection
6. ✅ No regressions in existing functionality

### Technical Requirements Met:
- Bulk operations handle reasonable loads (20-50 items)
- Automated feed delivery works reliably
- Basic monitoring and error handling
- Simple, functional user interface
- Integration doesn't break existing systems

### Ready for Future Enhancement:
- Foundation for more sophisticated bulk operations
- Framework for advanced feed preferences
- Structure for enhanced UI/UX improvements

## Implementation Notes

### Keep It Simple:
- Use browser confirm() dialogs instead of custom modals
- Basic JavaScript without advanced features
- Simple error messages and feedback
- Leverage existing infrastructure over custom solutions

### Focus Areas:
- **Reliability**: Basic functionality that works consistently
- **Integration**: Smooth integration with existing systems
- **Observability**: Basic metrics using existing tools
- **Foundation**: Structure that can be enhanced later

### Defer to Later:
- Advanced confirmation dialogs
- Sophisticated error handling
- Complex user preferences  
- Advanced UI features
- Performance optimizations (until needed)

This streamlined approach delivers the core Phase 2 functionality without getting lost in nice-to-have features. The focus is on getting basic bulk operations and automated feed delivery working reliably.