# Inbox Feature Specification

## Overview

Implement an inbox feature for users where each inbox item is conceptually a "potential bookmark" - identical in structure to bookmarks but not part of the user's collection. Users can review inbox items and decide to add them to their collection, archive them, trash them, or mark them as read.

## Core Concepts

### Inbox Items
- **Data Structure**: Copies of source data (not references), mapped to inbox item schema
- **Privacy**: Always private to the user
- **Source Tracking**: String field to track item source (e.g., "feed {url}")
- **Relationship to Bookmarks**: Structurally identical but separate from user's bookmark collection

### System Labels
- Use system tags with `inbox:` prefix for status management
- Core labels: `inbox:read`, `inbox:archived`, `inbox:trashed`
- Labels can be combined (e.g., unread + archived)
- `inbox:trashed` means permanently deleted
- `inbox:archived` serves as soft delete (hidden from default view)

## Database Schema

### Inbox Items Table
- Copy all fields from bookmark model
- Add `source` field (string) to track origin
- Use existing tag infrastructure
- Add `is_system` flag to tags table to distinguish system tags from user tags

### Indexes
- Optimize for inbox view performance
- Support filtering by item source
- Support sorting by date and read status

## User Interface

### Inbox View
- Similar to current bookmarks page layout
- Additional action buttons and checkboxes for inbox-specific operations
- Default view: Show unread items from all sources in reverse-chronological order

### Individual Item Actions
- Mark read/unread
- Archive
- Trash (permanent delete)
- Add to collection (opens bookmark form, prepopulated with item data)

### Bulk Operations
- Mark multiple items as read
- Archive multiple items
- Trash multiple items
- Add multiple items to collection with dialog for:
  - Adding tags to all items
  - Checkbox to mark items read + archived (default: true)

### Filtering and Sorting
- **Filters**: System tags, source, date ranges, search
- **Sorting**: Date added, publication date, read status, source
- **Default**: Unread items, reverse-chronological order

## Feed Integration

### Automatic Population
- **Trigger**: When feeds are polled and new items found
- **User Matching**: Find users with bookmarks matching exact feed URL
- **Delivery**: All new feed items go to all matching users' inboxes

### Architecture
Two-stage Celery task approach:
1. **Stage 1**: Lookup task identifies which users should receive items
2. **Stage 2**: Delivery task adds items to individual user inboxes

### Feed Lifecycle Management
- **Bookmark Deletion**: Stop delivering new items on next poll; existing inbox items remain
- **Feed URL Changes**: Handle naturally on next poll; no special processing
- **No Notifications**: No user notifications for feed changes

## Duplicate Handling

### In Inbox
- Allow duplicate inbox items (no deduplication for now)

### Adding to Collection
- **Individual Items**: No special duplicate handling
- **Bulk Operations**: If duplicate found (by unique hash), update existing bookmark with inbox item data

## System Tags Management

### Creation
- Create system tags on-the-fly when first used
- Naming convention: `inbox:` prefix (e.g., `inbox:read`, `inbox:archived`)

### UI Treatment
- System tags visible but non-editable
- Defer improved UI for system tag management

## Implementation Phases

### Phase 1 (MVP)
- Database schema and models (inbox_items table, system tag flag)
- Basic inbox view with filtering/sorting
- Manual inbox item creation (for testing)
- Individual item actions (read, archive, trash, add to collection)

### Phase 2
- Bulk operations with dialog UI
- Feed polling integration with two-stage Celery tasks
- System tag auto-creation

### Phase 3
- Advanced filtering/search capabilities
- Performance optimizations
- UI/UX improvements

## Future Considerations

### Deferred Features
- Explicit feed subscription management
- User preference to opt-out of automatic population
- Automatic inbox cleanup/item expiry
- Enhanced system tag management UI
- Inbox item deduplication
- Privacy settings integration

### Extensibility
- Source field designed to support future integrations (Mastodon, Bluesky, etc.)
- Tag infrastructure ready for expansion
- Phased approach allows for iterative improvements

## Technical Notes

- No cascading deletes when bookmarks are removed
- Source tracking via flexible string field
- Shared tag infrastructure between bookmarks and inbox
- Background job processing for scalability