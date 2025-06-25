# Session Specification: Export to Netscape HTML Bookmark Format

## Overview
Implement bookmark export functionality in Netscape HTML Bookmark format, allowing users to export their bookmarks in a widely-compatible format that can be imported by browsers and bookmark services.

## Endpoint
- **URL**: `/bookmarks/export/netscape.html`
- **Method**: GET
- **Authentication**: Required (users can only export their own bookmarks)
- **Response**: Streamed HTML file with `Content-Disposition` header for download

## Query Parameters
- **`tag`**: Filter by tags (multiple values supported, e.g., `?tag=python&tag=django`)
  - Bookmarks must match ALL specified tags
  - Validate tag existence, return 400 if invalid
- **`since`**: Filter by date range using relative format (e.g., "7d", "30d")
  - Use `pebbling_apps.common.utils.parse_since` for parsing
  - Return 400 with explanation if invalid format
- **`limit`**: Optional limit on number of bookmarks to export

## Data Mapping
Map bookmark fields to Netscape format attributes:
- `url` → `HREF`
- `title` → `<A>` tag text content (use "Untitled" if missing)
- `feed` URL from `unfurl_metadata` → `FEED` attribute (if present)
- `created_at` → `ADD_DATE` attribute
- `updated_at` → `LAST_MODIFIED` attribute
- `unique_hash` → `ID` attribute
- `tags` → `TAGS` attribute (comma-separated)
- `description` → `<DD>` tag content

## File Format
Use exact Netscape bookmark format:
```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <!--This is an automatically generated file.
    It will be read and overwritten.
    Do Not Edit! -->
    <Title>Bookmarks</Title>
    <H1>Bookmarks</H1>
    <DL><p>
        <DT><A HREF="url" ADD_DATE="timestamp" LAST_MODIFIED="timestamp" ID="hash" TAGS="tag1,tag2">Title</A>
        <DD>Description text
        <!-- Repeat for each bookmark -->
    </DL><p>
```

## Implementation Details
- **Encoding**: UTF-8
- **Organization**: Flat list (no folder hierarchy)
- **Streaming**: Use Django streaming response with database iterator to handle large exports
- **Filename**: Include timestamp, e.g., `pebbling_club_bookmarks_2024-06-24.html`
- **Missing data handling**:
  - Skip bookmarks with missing URLs
  - Use "Untitled" for missing titles
  - HTML-escape special characters in all text fields
- **Logging**: Log export activity for security/audit purposes

## Error Handling
- Return 400 Bad Request for:
  - Invalid tag parameters
  - Invalid date format in `since` parameter
- Include short explanatory message with errors
- Authentication required - return 401 for unauthenticated requests

## Testing Requirements
- Unit tests to verify:
  - Correct Netscape format structure
  - Field mapping accuracy
  - Query parameter filtering
  - Streaming functionality
  - Error responses
  - Authentication requirements

## Out of Scope
- Public/shareable exports
- Browser compatibility testing
- Performance benchmarks
- Per-bookmark privacy settings
- Hierarchical tag organization