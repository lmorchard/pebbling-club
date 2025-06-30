# Inbox Feature Implementation Plan - Phase 1 (MVP)

## Overview

This plan implements the foundational inbox feature as a separate Django app that integrates with the existing bookmark system. The inbox allows users to collect potential bookmarks, review them, and perform actions (read, archive, trash, add to collection).

## Architecture Decisions

### App Structure
- Create new `pebbling_apps.inbox` Django app
- Follow existing app patterns in the codebase
- Reuse existing tag infrastructure from bookmarks
- Integrate with existing URL patterns and navigation

### Database Design
- New `InboxItem` model based on `Bookmark` model structure
- Add `is_system` flag to existing `Tag` model
- System tags use `inbox:` prefix for organization
- Optimize for read-heavy workloads with appropriate indexes

## Implementation Phases

### Phase 1A: Foundation (Database & Models)
1. Create inbox Django app structure
2. Implement database models and migrations
3. Add system tag support to existing Tag model
4. Create basic admin interface for testing

### Phase 1B: Core Views & Templates
5. Implement inbox list view with filtering/sorting
6. Create inbox templates based on bookmark templates
7. Add individual item actions (read, archive, trash)
8. Integrate inbox navigation into main site

### Phase 1C: Collection Integration
9. Implement "add to collection" functionality
10. Handle duplicate detection during collection addition
11. Add manual inbox item creation for testing
12. Testing and refinement

## Detailed Step-by-Step Implementation

---

## Step 1: Create Inbox App Structure

**Objective**: Set up the basic Django app structure for the inbox feature.

**Context**: Following the existing pattern of other apps in `pebbling_apps/`, create a new inbox app with standard Django structure.

**Implementation Prompt**:
```
Create a new Django app called `inbox` within the `pebbling_apps` directory. The app should follow the same structure as existing apps like `bookmarks`. 

Requirements:
1. Create the app directory: `pebbling_apps/inbox/`
2. Include standard Django app files: `__init__.py`, `apps.py`, `models.py`, `views.py`, `urls.py`, `admin.py`
3. Create subdirectories: `templates/inbox/`, `migrations/`, `tests/`
4. Add the app to `INSTALLED_APPS` in `pebbling/settings.py` as `pebbling_apps.inbox`
5. Create basic `InboxConfig` in `apps.py` with name `pebbling_apps.inbox`
6. Create empty `urls.py` with `app_name = "inbox"` and empty `urlpatterns`
7. Include inbox URLs in main `pebbling/urls.py` with path `"inbox/"` 

Don't implement any models or views yet - just the basic app structure.
```

---

## Step 2: Implement InboxItem Model

**Objective**: Create the core InboxItem model based on the Bookmark model structure.

**Context**: The InboxItem should mirror the Bookmark model but be in a separate table. It needs a source field for tracking origin and should use the existing tag infrastructure.

**Implementation Prompt**:
```
Implement the InboxItem model in `pebbling_apps/inbox/models.py`.

Requirements:
1. Import necessary dependencies from Django and existing apps
2. Create `InboxItem` model with these fields (based on Bookmark model):
   - `url` (URLField, max_length=10240)
   - `owner` (ForeignKey to User with CASCADE delete)
   - `unique_hash` (CharField, max_length=255)
   - `title` (CharField, max_length=255)
   - `description` (TextField, blank=True, null=True)
   - `tags` (ManyToManyField to bookmarks.Tag, related_name="inbox_items", blank=True)
   - `unfurl_metadata` (UnfurlMetadataField, blank=True, null=True)
   - `feed_url` (URLField, blank=True, null=True)
   - `source` (CharField, max_length=255, help_text="Source of this inbox item")
3. Inherit from `TimestampedModel` and `ExportModelOperationsMixin("inbox_item")`
4. Add Meta class with `unique_together = ["owner", "unique_hash"]`
5. Add `__str__` method returning the title
6. Add method `generate_unique_hash()` similar to Bookmark model
7. Override `save()` method to auto-generate unique_hash
8. Add `host_name` property similar to Bookmark model
9. Include appropriate indexes for performance (owner, created_at, source)

Use the same patterns and imports as the Bookmark model. Don't create the migration yet.
```

---

## Step 3: Add System Tag Support

**Objective**: Extend the existing Tag model to support system tags with `is_system` flag.

**Context**: We need to distinguish between user-created tags and system tags (like `inbox:read`). This requires a database migration to add the field to the existing Tag model.

**Implementation Prompt**:
```
Add system tag support to the existing Tag model in `pebbling_apps/bookmarks/models.py`.

Requirements:
1. Add `is_system` field to the Tag model:
   - `is_system = models.BooleanField(default=False, help_text="Whether this is a system-managed tag")`
2. Add a class method `get_or_create_system_tag(cls, name, owner)` to TagManager:
   - Check if system tag exists for the owner
   - Create it if it doesn't exist with `is_system=True`
   - Return the tag instance
3. Add a method `is_system_tag(self)` to Tag model that returns `self.is_system`
4. Update the Tag model's `__str__` method to show system tags differently (prefix with "🔧" or similar indicator)

Don't create the migration yet - we'll handle all migrations together.
```

---

## Step 4: Create Database Migrations

**Objective**: Generate and apply database migrations for the new models and Tag model changes.

**Context**: Create migrations for both the new InboxItem model and the updated Tag model, then apply them to set up the database schema.

**Implementation Prompt**:
```
Create and apply database migrations for the inbox feature.

Requirements:
1. Generate migration for the updated Tag model in bookmarks app:
   - Run: `python manage.py makemigrations bookmarks --name add_system_tag_support`
2. Generate migration for the new InboxItem model in inbox app:
   - Run: `python manage.py makemigrations inbox --name initial_inbox_models`
3. Apply both migrations:
   - Run: `python manage.py migrate`
4. Verify the migrations were applied successfully
5. Check that the database tables were created correctly

After migration, test that:
- The Tag model has the new `is_system` field
- The new `inbox_inboxitem` table exists with all expected fields
- The relationship between InboxItem and Tag works correctly
```

---

## Step 5: Create Inbox Admin Interface

**Objective**: Set up Django admin interface for InboxItem to enable manual testing and management.

**Context**: Following the pattern of the existing Bookmark admin interface, create a similar admin for InboxItem with appropriate field display and filtering.

**Implementation Prompt**:
```
Implement Django admin interface for InboxItem in `pebbling_apps/inbox/admin.py`.

Requirements:
1. Import necessary Django admin components and the InboxItem model
2. Create `InboxItemAdmin` class with:
   - `list_display = ['title', 'owner', 'source', 'created_at', 'updated_at']`
   - `list_filter = ['owner', 'source', 'created_at', 'tags']`
   - `search_fields = ['title', 'url', 'description']`
   - `readonly_fields = ['unique_hash', 'created_at', 'updated_at']`
   - `filter_horizontal = ['tags']` for better tag management
   - `ordering = ['-created_at']`
3. Register the InboxItem model with the admin
4. Add method `get_queryset()` to optimize queries with `select_related('owner')` and `prefetch_related('tags')`

Follow the same patterns as the existing Bookmark admin interface but adapted for InboxItem fields.
```

---

## Step 6: Create Inbox Manager and Queryset

**Objective**: Implement manager and queryset methods for InboxItem to handle filtering, sorting, and querying operations.

**Context**: Similar to BookmarkManager, create an InboxItemManager with methods for common operations like filtering by system tags, source, and search functionality.

**Implementation Prompt**:
```
Implement InboxItemManager and queryset methods in `pebbling_apps/inbox/models.py`.

Requirements:
1. Create `InboxItemManager` class that extends `models.Manager`:
   - Add method `generate_unique_hash_for_url(self, url)` using the same logic as BookmarkManager
   - Add method `unread_for_user(self, user)` that returns items without `inbox:read` tag
   - Add method `archived_for_user(self, user)` that returns items with `inbox:archived` tag
   - Add method `by_source(self, source)` that filters by source field
2. Add query method `query(self, owner=None, tags=None, search=None, source=None, since=None, sort='date')`:
   - Filter by owner if provided
   - Filter by tags if provided (including system tags)
   - Apply search across title, url, description if provided
   - Filter by source if provided
   - Filter by date if since provided
   - Support sorting by date (default), title, source
   - Return optimized queryset with select_related and prefetch_related
3. Add the manager to InboxItem model: `objects = InboxItemManager()`
4. Add helper methods to InboxItem model:
   - `is_read(self)` - check if has `inbox:read` tag
   - `is_archived(self)` - check if has `inbox:archived` tag
   - `mark_read(self)` - add `inbox:read` system tag
   - `mark_archived(self)` - add `inbox:archived` system tag

Use similar patterns to the BookmarkManager but simplified for inbox-specific needs.
```

---

## Step 7: Create Inbox List View

**Objective**: Implement the main inbox list view with filtering, sorting, and pagination.

**Context**: Create a view similar to BookmarkListView but customized for inbox items, with support for system tag filtering and inbox-specific sorting options.

**Implementation Prompt**:
```
Implement the inbox list view in `pebbling_apps/inbox/views.py`.

Requirements:
1. Import necessary Django components, forms, and models
2. Create `InboxListView` class-based view extending `ListView`:
   - `model = InboxItem`
   - `template_name = 'inbox/inbox_list.html'`
   - `context_object_name = 'inbox_items'`
   - `paginate_by = 20`
3. Override `get_queryset()` to:
   - Filter items by current user (`owner=self.request.user`)
   - Apply default filter: show unread items (exclude `inbox:archived` and `inbox:trashed`)
   - Handle query parameters: `q` (search), `source`, `tags`, `sort`
   - Use InboxItemManager.query() method
   - Optimize with select_related('owner') and prefetch_related('tags')
4. Override `get_context_data()` to add:
   - Search query from request
   - Available sources for filtering
   - Current filter parameters
   - Count of unread items
5. Add `@login_required` decorator to require authentication
6. Add proper error handling for invalid query parameters

Follow similar patterns to BookmarkListView but adapted for inbox functionality.
```

---

## Step 8: Create Inbox Templates

**Objective**: Create HTML templates for the inbox interface based on existing bookmark templates.

**Context**: Create inbox templates that follow the same design patterns as bookmark templates but with inbox-specific actions and layout.

**Implementation Prompt**:
```
Create inbox HTML templates in `pebbling_apps/inbox/templates/inbox/`.

Requirements:
1. Create `inbox_list.html` template:
   - Extend `base.html`
   - Include page title "Inbox"
   - Add search form similar to bookmarks
   - Add filter options (source, system tags)
   - Include pagination
   - Show inbox item count and status
   - Add bulk action placeholder (for future phases)
2. Create `_inbox_item.html` partial template:
   - Display item title, URL, description
   - Show source information
   - Display tags (highlight system tags differently)
   - Add individual action buttons: Read/Unread, Archive, Trash, Add to Collection
   - Show creation date and metadata
   - Use similar styling to `_bookmark.html`
3. Create `_inbox_item_list.html` partial template:
   - Loop through inbox items
   - Include each item using `_inbox_item.html`
   - Handle empty state with helpful message
   - Add loading states placeholder
4. Update navigation in `base.html` to include "Inbox" link
5. Use existing CSS classes and styling patterns from bookmark templates
6. Ensure responsive design works on mobile devices

Base the templates on the existing bookmark templates but customize for inbox-specific functionality.
```

---

## Step 9: Implement Individual Item Actions

**Objective**: Create view functions to handle individual inbox item actions (mark read, archive, trash).

**Context**: Create simple view functions that handle POST requests to perform actions on individual inbox items, then redirect back to the inbox list.

**Implementation Prompt**:
```
Implement individual item action views in `pebbling_apps/inbox/views.py`.

Requirements:
1. Create `mark_item_read` view function:
   - Accept POST request with item ID
   - Get InboxItem by ID and verify ownership
   - Add `inbox:read` system tag using Tag.objects.get_or_create_system_tag()
   - Return JsonResponse for AJAX or redirect for form submission
   - Handle errors gracefully
2. Create `mark_item_unread` view function:
   - Remove `inbox:read` system tag if present
   - Similar structure to mark_read
3. Create `archive_item` view function:
   - Add `inbox:archived` system tag
   - Similar structure to other actions
4. Create `trash_item` view function:
   - Delete the InboxItem permanently (no soft delete)
   - Confirm user ownership before deletion
   - Return success response
5. Create `unarchive_item` view function:
   - Remove `inbox:archived` system tag
6. All views should:
   - Require login with `@login_required`
   - Verify user owns the item
   - Handle GET requests by redirecting to inbox list
   - Return appropriate HTTP status codes
   - Include CSRF protection

Use Django's get_object_or_404 for item retrieval and proper error handling.
```

---

## Step 10: Create Add to Collection View

**Objective**: Implement the functionality to add inbox items to the user's bookmark collection.

**Context**: Create a view that takes an inbox item and creates a new bookmark from it, with duplicate handling based on unique hash.

**Implementation Prompt**:
```
Implement add to collection functionality in `pebbling_apps/inbox/views.py`.

Requirements:
1. Create `add_to_collection` view function:
   - Accept POST request with inbox item ID
   - Get InboxItem by ID and verify ownership
   - Check for existing bookmark with same unique_hash
   - If duplicate exists: update existing bookmark with inbox item data
   - If no duplicate: create new bookmark with inbox item data
   - Copy all relevant fields: url, title, description, unfurl_metadata, feed_url
   - Copy user tags (exclude system tags starting with 'inbox:')
   - Optionally archive the inbox item after successful addition
   - Return JsonResponse with success/error status
2. Create `add_to_collection_form` view function:
   - GET request that renders a form pre-populated with inbox item data
   - Use existing BookmarkForm from bookmarks app
   - Pass inbox item data as initial form data
   - Template should allow user to modify before saving
3. Handle duplicate detection:
   - Compare unique_hash values
   - Show user a confirmation dialog if duplicate found
   - Allow user to choose: update existing, create duplicate, or cancel
4. Add proper error handling:
   - Invalid inbox item ID
   - Permission errors
   - Database errors during bookmark creation
5. Add success messages using Django messages framework

Import and use the Bookmark model and BookmarkForm from the bookmarks app.
```

---

## Step 11: Add URL Patterns

**Objective**: Configure URL routing for all inbox views and integrate with main site navigation.

**Context**: Set up URL patterns for the inbox app and ensure proper integration with the main site URL structure.

**Implementation Prompt**:
```
Configure URL patterns for the inbox app in `pebbling_apps/inbox/urls.py`.

Requirements:
1. Import all view functions and classes from views.py
2. Define urlpatterns with these paths:
   - `""` -> InboxListView.as_view(), name="list"
   - `"item/<int:item_id>/read/"` -> mark_item_read, name="mark_read"
   - `"item/<int:item_id>/unread/"` -> mark_item_unread, name="mark_unread"
   - `"item/<int:item_id>/archive/"` -> archive_item, name="archive"
   - `"item/<int:item_id>/unarchive/"` -> unarchive_item, name="unarchive"
   - `"item/<int:item_id>/trash/"` -> trash_item, name="trash"
   - `"item/<int:item_id>/add-to-collection/"` -> add_to_collection, name="add_to_collection"
   - `"item/<int:item_id>/add-form/"` -> add_to_collection_form, name="add_to_collection_form"
3. Verify that `pebbling/urls.py` includes inbox URLs with path `"inbox/"`
4. Update main navigation:
   - Add "Inbox" link to main navigation in base template
   - Show inbox unread count badge if > 0
   - Position inbox link appropriately in navigation menu
5. Test all URL patterns resolve correctly:
   - Run `python manage.py show_urls` to verify
   - Test each URL pattern manually

Ensure URL names follow Django conventions and are consistent with existing bookmark URL patterns.
```

---

## Step 12: Create Manual Inbox Item Creation

**Objective**: Add functionality to manually create inbox items for testing purposes.

**Context**: Create a simple form and view to manually add items to the inbox, useful for testing the interface before implementing feed integration.

**Implementation Prompt**:
```
Implement manual inbox item creation for testing in `pebbling_apps/inbox/`.

Requirements:
1. Create `forms.py` with `InboxItemForm`:
   - Fields: url, title, description, source
   - Use Django ModelForm based on InboxItem
   - Add form validation for URL format
   - Include help text for source field
   - Add clean_url method to validate URL accessibility
2. Create `InboxItemCreateView` in views.py:
   - Extend CreateView
   - Use InboxItemForm
   - Set owner to current user in form_valid()
   - Generate unique_hash on save
   - Redirect to inbox list on success
   - Require login
3. Create `inbox_item_form.html` template:
   - Extend base.html
   - Display form with proper styling
   - Include form validation error display
   - Add cancel button linking back to inbox
   - Use similar styling to bookmark form
4. Add URL pattern:
   - `"create/"` -> InboxItemCreateView.as_view(), name="create"
5. Add "Add Item" button to inbox list template
6. Test the complete flow:
   - Create inbox item via form
   - View it in inbox list
   - Test all individual actions work
   - Verify add to collection functionality

This provides a way to test the inbox functionality without needing feed integration.
```

---

## Step 13: Add Filtering and Sorting UI

**Objective**: Enhance the inbox list template with interactive filtering and sorting controls.

**Context**: Add dropdown menus, filter buttons, and sorting options to make the inbox list more functional and user-friendly.

**Implementation Prompt**:
```
Enhance inbox list template with filtering and sorting UI in `inbox_list.html`.

Requirements:
1. Add filter sidebar or dropdown:
   - Filter by source (show available sources)
   - Filter by system tags (Read, Unread, Archived)
   - Filter by date ranges (Today, This week, This month)
   - Clear all filters button
2. Add sort dropdown:
   - Sort by date (newest first, oldest first)
   - Sort by title (A-Z, Z-A)
   - Sort by source
   - Remember selected sort in URL parameters
3. Add search functionality:
   - Search box for title, description, URL
   - Search within filtered results
   - Clear search button
4. Show active filters:
   - Display current filter tags
   - Allow removing individual filters
   - Show result count with active filters
5. Add bulk selection UI (prepare for Phase 2):
   - "Select all" checkbox in header
   - Individual checkboxes for each item
   - Bulk action dropdown (disabled for now)
6. Improve responsive design:
   - Collapsible filters on mobile
   - Touch-friendly controls
   - Proper mobile layout
7. Add JavaScript for:
   - Filter form submission
   - Sort changes
   - Search as-you-type (debounced)
   - Checkbox interactions

Use existing CSS classes and JavaScript patterns from the bookmark templates.
```

---

## Step 14: Testing and Refinement

**Objective**: Comprehensive testing of the inbox functionality and bug fixes.

**Context**: Test all implemented features, fix bugs, optimize performance, and ensure proper integration with existing systems.

**Implementation Prompt**:
```
Perform comprehensive testing and refinement of the inbox feature.

Requirements:
1. Create test data:
   - Create multiple inbox items with different sources
   - Add various tags including system tags
   - Test with items from different users
2. Test all functionality:
   - Inbox list view with different filters/sorts
   - Individual item actions (read, archive, trash)
   - Add to collection (both individual form and direct)
   - Manual item creation
   - Duplicate handling during collection addition
   - URL routing and navigation
3. Performance testing:
   - Test with large number of inbox items (100+)
   - Verify database queries are optimized
   - Check page load times
   - Test pagination performance
4. UI/UX testing:
   - Test responsive design on different screen sizes
   - Verify accessibility (keyboard navigation, screen readers)  
   - Test JavaScript functionality
   - Cross-browser compatibility
5. Integration testing:
   - Verify no conflicts with existing bookmark functionality
   - Test tag system integration
   - Confirm navigation and links work correctly
6. Fix identified issues:
   - Performance optimizations
   - Bug fixes
   - UI improvements
   - Error handling enhancements
7. Documentation:
   - Add docstrings to all functions/classes
   - Update any relevant documentation
   - Create basic usage notes

After testing, ensure the inbox feature is fully functional and ready for end users.
```

---

## Success Criteria

### Phase 1 Complete When:
1. ✅ InboxItem model created and migrated
2. ✅ System tag support added to Tag model  
3. ✅ Inbox list view working with filtering/sorting
4. ✅ Individual item actions functional (read, archive, trash)
5. ✅ Add to collection working with duplicate handling
6. ✅ Manual item creation for testing
7. ✅ Admin interface for management
8. ✅ Proper URL routing and navigation
9. ✅ Responsive templates with good UX
10. ✅ Comprehensive testing completed

### Technical Requirements Met:
- Database schema optimized for performance
- Proper error handling and user feedback
- Security: user authentication and authorization
- Integration: no conflicts with existing functionality
- Code quality: follows existing patterns and standards

### Ready for Phase 2:
- Solid foundation for bulk operations
- Clear extension points for feed integration
- Well-tested core functionality
- User feedback incorporated

This completes the Phase 1 MVP implementation, providing a fully functional inbox system that users can interact with manually while setting up the foundation for automated feed integration in Phase 2.