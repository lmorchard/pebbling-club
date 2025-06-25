# Activity Stream Export - Session Spec

## Overview
Implement import/export functionality for user bookmarks using the JSON-LD ActivityStreams format. This provides a standardized, interoperable format for bookmark data while supporting perfect roundtrip fidelity for user-created content.

## Requirements

### Export Functionality
- **Endpoint**: `/bookmarks/export/activitystream.json`
- **Authentication**: Requires login, exports only logged-in user's bookmarks
- **Format**: JSON-LD ActivityStreams Collection containing Link objects
- **Performance**: Streaming response using database iterator (no full RAM load)

### Import Functionality  
- **Endpoint**: `/bookmarks/import/activitystream` (POST)
- **Authentication**: Requires login, imports to logged-in user's account
- **Conflict Resolution**: Update existing bookmarks by default, optional skip-duplicates mode
- **Format**: Accept JSON-LD ActivityStreams Collection

### Filtering Support (Export)
Mirror existing Netscape export filtering with these query parameters:
- **`tag`**: Filter by tags (multiple values supported, AND logic)
- **`since`**: Filter by creation date (flexible date parsing via `parse_since()`)
- **`limit`**: Limit number of results
- **Validation**: Return 400 errors for invalid parameters (non-existent tags, invalid dates, etc.)

## Data Model Mapping

### Collection Structure
```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    {
      "pebbling": "https://pebbling.club/ns/",
      "feedUrl": "pebbling:feedUrl"
    }
  ],
  "type": "Collection",
  "published": "[export timestamp]",
  "totalItems": "[count]",
  "items": [...]
}
```

### Bookmark → Link Object Mapping
- **`url`** → `url` (string)
- **`title`** → `name` (string) 
- **`description`** → `summary` (string, optional)
- **`created_at`** → `published` (ISO 8601 timestamp)
- **`updated_at`** → `updated` (ISO 8601 timestamp)
- **`tags`** → `tag` (array of strings)
- **`feed_url`** → `feedUrl` (custom property, optional)
- **`unfurl_metadata`** → ActivityStreams properties:
  - Images → `image` property
  - Descriptions → enhance `summary`
  - Other metadata → appropriate AS properties where available

### Sample Link Object
```json
{
  "type": "Link",
  "url": "https://example.com/article",
  "name": "Example Article Title",
  "summary": "Article description from user or unfurl",
  "published": "2024-01-15T10:30:00Z",
  "updated": "2024-01-16T09:15:00Z",
  "tag": ["python", "web-dev", "tutorial"],
  "feedUrl": "https://example.com/feed.xml",
  "image": "https://example.com/preview.jpg"
}
```

## Technical Implementation Details

### Export Implementation
- Use `Bookmark.objects.query()` with user filtering
- Apply same filtering logic as Netscape export
- Use `prefetch_related("tags")` for performance
- Stream response with `iterator(chunk_size=100)`
- Generate JSON-LD incrementally to avoid memory issues

### Import Implementation  
- Parse and validate JSON-LD structure
- Extract Link objects from Collection
- Use `Bookmark.objects.update_or_create()` for conflict resolution
- Map ActivityStreams properties back to Django model fields
- Handle tag creation/lookup automatically
- Optional `skip_duplicates` parameter

### URL Patterns
```python
# In bookmarks/urls.py
path('export/activitystream.json', views.BookmarkExportActivityStreamView.as_view()),
path('import/activitystream/', views.BookmarkImportActivityStreamView.as_view()),
```

## Success Criteria
1. **Perfect Roundtrip**: Export then import preserves all user-created bookmark data (url, title, description, tags, timestamps)
2. **Performance**: Handle large bookmark collections (1000+) without memory issues
3. **Filtering Parity**: Support same query parameters as Netscape export
4. **Standard Compliance**: Valid JSON-LD ActivityStreams format
5. **Error Handling**: Graceful validation and error reporting
6. **Security**: Proper authentication and user isolation

## Constraints
- Must preserve existing Bookmark model structure
- Should not impact existing export/import functionality
- Unfurl metadata is derived data (regeneration acceptable)
- Feed URLs are derived data (regeneration acceptable)
- User-created data (url, title, description, tags) must roundtrip perfectly