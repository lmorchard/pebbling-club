# Plan - Markdown Bookmark View Implementation

## Overview
This plan implements the markdown format feature for bookmark views in pebbling-club. The implementation will follow Django best practices by creating a dedicated markdown serializer, updating existing views to handle format parameters, and ensuring consistent behavior across all bookmark endpoints.

## Architecture Decision
Based on the existing codebase structure:
- The app already has export functionality (NetscapeBookmarkExporter, ActivityStreamSerializer)
- Views use Django CBVs with good separation of concerns
- There's a pattern of format-specific responses (HTML, JSON, streaming)
- We'll follow the same pattern by creating a MarkdownBookmarkSerializer

## Implementation Phases

### Phase 1: Core Markdown Serializer
Create the foundation for markdown formatting with proper escaping and date grouping.

### Phase 2: Format Parameter Handling
Add format parameter detection and response routing to the base query view.

### Phase 3: Integration with Bookmark Views
Wire up the markdown serializer to all bookmark listing views.

### Phase 4: Testing and Validation
Add comprehensive tests and validate behavior across all endpoints.

---

## Step-by-Step Implementation

### Step 1: Create Markdown Serializer Foundation

**Prompt for LLM:**
Create a new file `pebbling_apps/bookmarks/serializers.py` (or add to existing) with a `MarkdownBookmarkSerializer` class. This class should:

1. Take a queryset of bookmarks and convert them to markdown format
2. Group bookmarks by date (created_at field, formatted as YYYY-MM-DD)
3. Sort dates chronologically (oldest to newest)
4. Format each bookmark as:
   - Bullet point with title as inline link: `- [Title](URL)`
   - Description as indented blockquote: `  > Description` (only if description exists)
5. Properly escape markdown special characters in titles and descriptions
6. Handle empty results with `<!-- No bookmarks found -->`

Requirements:
- Method signature: `def serialize_to_markdown(self, bookmarks_queryset)`
- Return type: string (the complete markdown text)
- Use Django's timezone utilities for date formatting
- Efficient grouping (don't iterate multiple times)
- Consider memory usage for large querysets

Look at the existing `ActivityStreamSerializer` in the same file for patterns and conventions.

### Step 2: Add Format Parameter Detection

**Prompt for LLM:**
Update the `BookmarkQueryListView` class in `pebbling_apps/bookmarks/views.py` to:

1. Add a method `get_format_parameter()` that extracts the format parameter from request.GET
2. Add a method `should_render_markdown()` that returns True if format=markdown
3. Ensure backward compatibility - any invalid format values should default to HTML
4. Follow the existing code style and patterns in the view

The view already has good query handling and context building. We just need to add format detection without breaking existing functionality.

### Step 3: Add Markdown Response Method

**Prompt for LLM:**
Add a `render_markdown_response()` method to `BookmarkQueryListView` that:

1. Uses the `MarkdownBookmarkSerializer` to convert the bookmark queryset to markdown
2. Returns an HttpResponse with:
   - Content-Type: text/plain
   - Character encoding: UTF-8
   - The markdown content as the response body
3. Handles the empty results case properly
4. Maintains all existing pagination behavior (uses same queryset as HTML view)

The method should integrate cleanly with the existing `get()` method flow.

### Step 4: Integrate Format Routing in Main View

**Prompt for LLM:**
Update the `get()` method in `BookmarkQueryListView` to:

1. Check if markdown format is requested using `should_render_markdown()`
2. If markdown: call `render_markdown_response()` and return early
3. If not markdown: continue with existing HTML rendering logic
4. Ensure no changes to existing HTML functionality
5. Maintain all existing context and pagination behavior

This should be a minimal change that adds the format routing without disrupting existing code.

### Step 5: Extend to Tag Detail View

**Prompt for LLM:**
Update the `TagDetailView` class to support markdown format by:

1. Adding the same format detection methods as `BookmarkQueryListView`
2. Adding the same markdown response method
3. Updating the `get()` method to route based on format
4. Ensuring tag filtering works correctly with markdown output
5. Testing that URLs like `/t/python?format=markdown` work properly

Follow the same pattern established in the previous steps.

### Step 6: Add Comprehensive Tests

**Prompt for LLM:**
Create comprehensive tests in `pebbling_apps/bookmarks/tests/` for the markdown functionality:

1. Test markdown serializer with various bookmark combinations:
   - Single bookmark with description
   - Single bookmark without description  
   - Multiple bookmarks on same date
   - Multiple bookmarks across different dates
   - Empty queryset
   - Bookmarks with special markdown characters in title/description

2. Test format parameter handling:
   - Valid format=markdown parameter
   - Invalid format values (should default to HTML)
   - No format parameter (should default to HTML)
   - Case sensitivity

3. Test view integration:
   - BookmarkListView with format=markdown
   - TagDetailView with format=markdown
   - Pagination with markdown format
   - Query parameters combined with format=markdown

4. Test response format:
   - Correct Content-Type header
   - Proper character encoding
   - Response body contains expected markdown

Follow the existing test patterns and use Django's test framework properly.

### Step 7: Add Error Handling and Edge Cases

**Prompt for LLM:**
Add robust error handling to the markdown functionality:

1. Handle bookmark objects with None/null values gracefully
2. Handle very long titles or descriptions
3. Handle special characters and unicode properly
4. Add logging for debugging if needed
5. Ensure proper exception handling doesn't break the HTML views

Test edge cases:
- Bookmarks with extremely long URLs
- Titles with newlines or special characters
- Descriptions with markdown syntax
- Unicode characters in titles/descriptions

### Step 8: Performance Optimization

**Prompt for LLM:**
Optimize the markdown rendering for performance:

1. Use `select_related()` and `prefetch_related()` appropriately in querysets
2. Minimize database queries (the same optimization that exists for HTML views)
3. Consider using Django's streaming response for very large result sets
4. Add basic caching headers if appropriate
5. Profile the markdown serialization for large datasets

Look at the existing `StreamingJSONResponse` implementation for patterns.

### Step 9: Documentation and Final Integration

**Prompt for LLM:**
Complete the implementation:

1. Add docstrings to all new methods following the existing code style
2. Update any relevant comments or documentation
3. Ensure all bookmark listing endpoints support the format parameter
4. Verify backward compatibility with all existing functionality
5. Add any missing type hints if the codebase uses them

Test the complete feature end-to-end:
- `/bookmarks?format=markdown`
- `/bookmarks?since=24h&format=markdown`
- `/t/python?format=markdown`
- All query parameters work with markdown format
- Pagination works correctly
- Empty results are handled properly

---

## Integration Notes

### View Hierarchy
The implementation targets these views:
- `BookmarkQueryListView` (base class with query logic)
- `BookmarkListView` (inherits from BookmarkQueryListView)
- `TagDetailView` (has similar bookmark listing logic)

### Existing Patterns to Follow
- Use the same queryset optimization as HTML views
- Follow the serializer pattern from `ActivityStreamSerializer`
- Use similar response handling as `BookmarkExportNetscapeView`
- Maintain the same pagination behavior as existing views

### Key Files to Modify
1. `pebbling_apps/bookmarks/serializers.py` - Add MarkdownBookmarkSerializer
2. `pebbling_apps/bookmarks/views.py` - Update BookmarkQueryListView and TagDetailView
3. `pebbling_apps/bookmarks/tests/` - Add comprehensive test coverage

### Validation Checklist
- [ ] All existing functionality works unchanged
- [ ] Markdown output matches spec requirements
- [ ] All bookmark endpoints support format=markdown
- [ ] Pagination works correctly with markdown
- [ ] Empty results handled properly
- [ ] Special characters escaped correctly
- [ ] Performance acceptable for large result sets
- [ ] Tests cover all functionality and edge cases