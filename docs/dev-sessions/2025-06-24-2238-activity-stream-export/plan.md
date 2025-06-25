# Activity Stream Export - Development Plan

## Overview
This plan breaks down the implementation of ActivityStream import/export functionality into small, iterative steps that build on each other. Each step is designed to be implementable safely while moving the project forward incrementally.

## Phase 1: Core ActivityStream Export Foundation

### Step 1: Create ActivityStream Serialization Utilities
**Goal**: Build the core data transformation utilities without any web layer dependencies.

**Prompt for Implementation**:
```
Create a new file `pebbling_apps/bookmarks/serializers.py` that contains utilities for converting Bookmark model instances to ActivityStream Link objects.

Requirements:
1. Create a class `ActivityStreamSerializer` with methods:
   - `bookmark_to_link(bookmark)` - converts a single Bookmark to ActivityStream Link dict
   - `bookmarks_to_collection(bookmarks_iterator, total_count=None)` - converts an iterator of bookmarks to a Collection dict
   - `_serialize_unfurl_metadata(unfurl_metadata)` - helper to extract ActivityStream properties from unfurl data

2. Follow the field mapping from the spec:
   - url → url
   - title → name  
   - description → summary
   - created_at → published (ISO 8601)
   - updated_at → updated (ISO 8601)
   - tags → tag (array of tag names)
   - feed_url → feedUrl (custom property)

3. Include proper JSON-LD context:
   - Base context: "https://www.w3.org/ns/activitystreams"
   - Custom context for feedUrl: {"pebbling": "https://pebbling.club/ns/", "feedUrl": "pebbling:feedUrl"}

4. Handle unfurl_metadata by extracting appropriate ActivityStream properties (image, etc.)

5. Add proper error handling and logging

The serializer should be pure data transformation - no database queries or web requests.
```

### Step 2: Create Streaming JSON Response Utility  
**Goal**: Build a reusable utility for streaming large JSON responses incrementally.

**Prompt for Implementation**:
```
Create a new file `pebbling_apps/bookmarks/streaming.py` that provides utilities for streaming JSON responses without loading everything into memory.

Requirements:
1. Create a class `StreamingJSONResponse` that:
   - Inherits from Django's StreamingHttpResponse
   - Takes a generator function that yields JSON-serializable chunks
   - Properly formats the response as valid JSON
   - Sets appropriate content-type headers

2. Create a helper function `stream_json_collection()` that:
   - Takes a collection metadata dict (type, published, totalItems, etc.)
   - Takes an iterator that yields individual Link objects
   - Yields properly formatted JSON chunks: opening, items (with commas), closing
   - Handles the "items" array streaming properly

3. Include proper error handling:
   - Catch exceptions during streaming
   - Yield error information in a structured way
   - Ensure valid JSON output even on errors

4. Add logging for performance monitoring

The utility should handle JSON formatting edge cases like trailing commas and proper array bracketing.
```

### Step 3: Implement Basic Export View (No Filtering)
**Goal**: Create the core export endpoint that works with simple cases first.

**Prompt for Implementation**:
```
Create the ActivityStream export view in `pebbling_apps/bookmarks/views.py`.

Requirements:
1. Create `BookmarkExportActivityStreamView(LoginRequiredMixin, View)` class with:
   - get() method that exports user's bookmarks as ActivityStream Collection
   - Uses the ActivityStreamSerializer from Step 1
   - Uses the StreamingJSONResponse from Step 2
   - Follows the same authentication pattern as BookmarkExportNetscapeView

2. Basic implementation should:
   - Query bookmarks for the logged-in user only: `Bookmark.objects.query(owner=request.user)`
   - Use `prefetch_related("tags")` for performance
   - Use `iterator(chunk_size=100)` for memory efficiency
   - Generate timestamped collection with current datetime
   - Set proper Content-Disposition header for download

3. Response format:
   - Content-Type: "application/ld+json; charset=utf-8"
   - Download filename: "pebbling_club_bookmarks_activitystream_{timestamp}.json"

4. Include comprehensive logging following the same pattern as NetscapeExport

5. For now, ignore query parameters - implement basic export only

6. Add proper error handling with try/catch around the streaming generator

This should create a working export endpoint that handles the happy path before adding filtering complexity.
```

### Step 4: Add URL Routing for Export
**Goal**: Wire up the export endpoint so it can be tested.

**Prompt for Implementation**:
```
Add the ActivityStream export URL to the bookmarks URL configuration.

Requirements:
1. In `pebbling_apps/bookmarks/urls.py`:
   - Import the new BookmarkExportActivityStreamView
   - Add URL pattern: `path("bookmarks/export/activitystream.json", BookmarkExportActivityStreamView.as_view(), name="export_activitystream")`

2. Ensure the URL follows the same pattern as the existing Netscape export

3. Test that the basic endpoint is accessible and returns valid JSON-LD

The goal is to have a working endpoint that can be manually tested before adding filtering features.
```

## Phase 2: Export Filtering and Parameter Validation

### Step 5: Add Parameter Validation Utilities
**Goal**: Create reusable parameter validation that mirrors the Netscape export.

**Prompt for Implementation**:
```
Add parameter validation methods to the BookmarkExportActivityStreamView.

Requirements:
1. Add these validation methods to BookmarkExportActivityStreamView:
   - `validate_tags(self, request)` - validates tag parameters exist, returns (tags_list, error_response)
   - `validate_since(self, request)` - validates and parses since parameter, returns (since_date, error_response)  
   - `validate_limit(self, request)` - validates limit parameter, returns (limit_value, error_response)

2. Follow the exact same validation logic as BookmarkExportNetscapeView:
   - Tag validation: check each tag exists in database, return 400 if not
   - Since validation: use parse_since() utility, return 400 for invalid dates
   - Limit validation: ensure positive integer, return 400 if invalid

3. Return tuple format: (validated_value, error_response) where error_response is None on success

4. Use HttpResponseBadRequest with descriptive error messages matching Netscape export

This creates the validation foundation before integrating it into the main export flow.
```

### Step 6: Integrate Parameter Filtering
**Goal**: Add query parameter support to the export view.

**Prompt for Implementation**:
```
Integrate parameter validation and filtering into BookmarkExportActivityStreamView.get() method.

Requirements:
1. Update the get() method to:
   - Call all validation methods from Step 5
   - Return early with error response if any validation fails
   - Apply filtering to the bookmark queryset based on validated parameters

2. Follow the exact same filtering logic as BookmarkExportNetscapeView:
   - Tag filtering: filter for bookmarks that have ALL specified tags, use distinct()
   - Since filtering: filter created_at__gte=since_date  
   - Limit filtering: use queryset slicing [:limit_value]

3. Update logging to include parameter information:
   - Log tags, since, and limit parameters
   - Match the logging structure of NetscapeExportView

4. Ensure the parameter filtering is applied before the iterator() call for memory efficiency

5. Test with various parameter combinations to ensure behavior matches Netscape export

This completes the export functionality with full filtering parity.
```

## Phase 3: ActivityStream Import Foundation

### Step 7: Create ActivityStream Deserializer
**Goal**: Build utilities to parse ActivityStream data back into Bookmark model fields.

**Prompt for Implementation**:
```
Add import/deserialization methods to `pebbling_apps/bookmarks/serializers.py`.

Requirements:
1. Add these methods to ActivityStreamSerializer class:
   - `parse_collection(json_data)` - validates and extracts Collection structure
   - `link_to_bookmark_data(link_dict, owner)` - converts ActivityStream Link to Bookmark field dict
   - `validate_activitystream_format(json_data)` - validates JSON-LD structure

2. Implement reverse field mapping:
   - url ← url (required)
   - name ← title (required)
   - summary ← description (optional)
   - published ← created_at (parse ISO 8601)
   - updated ← updated_at (parse ISO 8601)  
   - tag ← tags (array to ManyToMany relationship)
   - feedUrl ← feed_url (custom property)

3. Validation requirements:
   - Ensure required ActivityStream fields are present
   - Validate @context includes ActivityStreams
   - Validate Collection type and structure
   - Validate Link objects have required fields
   - Return structured validation errors

4. Handle tag processing:
   - Create tags that don't exist
   - Return tag objects for linking to bookmark

5. Add comprehensive error handling and logging for import parsing

This creates the foundation for converting ActivityStream data back to Django models.
```

### Step 8: Implement Core Import View (No Conflict Options)
**Goal**: Create the basic import endpoint with default conflict resolution.

**Prompt for Implementation**:
```
Create the ActivityStream import view in `pebbling_apps/bookmarks/views.py`.

Requirements:
1. Create `BookmarkImportActivityStreamView(LoginRequiredMixin, View)` class with:
   - post() method that accepts JSON-LD ActivityStream data
   - Uses ActivityStreamSerializer for parsing
   - Implements default conflict resolution (update existing bookmarks)

2. Core import logic:
   - Parse request body as JSON
   - Validate ActivityStream format using serializer
   - Extract Link objects from Collection
   - Process each Link using Bookmark.objects.update_or_create()
   - Associate owner with imported bookmarks

3. Response format:
   - Return JSON with import summary: {"imported": count, "updated": count, "errors": []}
   - Use appropriate HTTP status codes (200 for success, 400 for validation errors)

4. Error handling:
   - Catch JSON parsing errors
   - Catch validation errors from serializer
   - Catch database errors during bookmark creation
   - Return structured error information

5. Security:
   - Ensure all imported bookmarks are owned by the logged-in user
   - Validate request content-type is JSON

6. Logging:
   - Log import activity with user, counts, and timestamp
   - Log errors with appropriate detail level

Start with basic import functionality before adding skip-duplicates option.
```

### Step 9: Add Import URL Routing
**Goal**: Wire up the import endpoint for testing.

**Prompt for Implementation**:
```
Add the ActivityStream import URL to the bookmarks URL configuration.

Requirements:
1. In `pebbling_apps/bookmarks/urls.py`:
   - Import the new BookmarkImportActivityStreamView  
   - Add URL pattern: `path("bookmarks/import/activitystream/", BookmarkImportActivityStreamView.as_view(), name="import_activitystream")`

2. Follow Django URL naming conventions

3. Ensure the URL accepts POST requests for the import data

This creates a testable import endpoint for the basic import functionality.
```

## Phase 4: Import Options and Roundtrip Testing

### Step 10: Add Skip-Duplicates Import Option
**Goal**: Add optional conflict resolution behavior for imports.

**Prompt for Implementation**:
```
Add skip-duplicates functionality to BookmarkImportActivityStreamView.

Requirements:
1. Add support for `skip_duplicates` parameter:
   - Accept as JSON body parameter: {"skip_duplicates": true, "data": {...}}
   - Accept as query parameter: ?skip_duplicates=true
   - Default to false (update existing bookmarks)

2. Modify import logic:
   - When skip_duplicates=true, use get_or_create() instead of update_or_create()
   - Track skipped vs created vs updated counts separately
   - Update response format: {"imported": count, "updated": count, "skipped": count, "errors": []}

3. Update validation to handle the new parameter structure

4. Update logging to include skip_duplicates setting and results

5. Add comprehensive error handling for the new logic paths

This completes the import functionality with user choice for conflict resolution.
```

### Step 11: Create Roundtrip Integration Tests
**Goal**: Ensure perfect roundtrip fidelity for user-created data.

**Prompt for Implementation**:
```
Create integration tests in `pebbling_apps/bookmarks/tests/test_activitystream.py` to validate roundtrip functionality.

Requirements:
1. Create test cases that:
   - Create bookmarks with all field types (url, title, description, tags, timestamps)
   - Export via ActivityStream endpoint
   - Import the exported data
   - Verify all user-created data is preserved exactly

2. Test scenarios:
   - Single bookmark roundtrip
   - Multiple bookmarks with various tag combinations
   - Bookmarks with and without descriptions
   - Unicode content in titles and descriptions
   - Empty collections

3. Test filtering roundtrips:
   - Export with tag filters, import, verify correct subset
   - Export with date filters, import, verify correct subset
   - Export with limit, import, verify correct count

4. Test conflict resolution:
   - Import same data twice with update mode
   - Import same data twice with skip_duplicates mode
   - Verify counts and behavior

5. Test error cases:
   - Invalid JSON input
   - Malformed ActivityStream structure
   - Missing required fields

Focus on data integrity and ensuring no user data is lost during export/import cycles.
```

### Step 12: Performance and Error Handling Polish
**Goal**: Ensure production-ready performance and error handling.

**Prompt for Implementation**:
```
Add performance optimizations and comprehensive error handling to both import and export views.

Requirements:
1. Export performance improvements:
   - Add memory usage monitoring
   - Optimize queryset with select_related() where appropriate
   - Add progress logging for large exports
   - Add timeout protection for streaming responses

2. Import performance improvements:
   - Process imports in batches to avoid memory issues
   - Use bulk operations where possible
   - Add progress logging for large imports
   - Add transaction management for data consistency

3. Enhanced error handling:
   - Add proper HTTP status codes for all error scenarios
   - Implement rate limiting protection
   - Add file size limits for imports
   - Improve error messages with actionable guidance

4. Monitoring and observability:
   - Add structured logging for metrics
   - Add performance timing logs
   - Log unusual activity patterns

5. Input validation hardening:
   - Validate file upload sizes
   - Sanitize error messages to prevent information leakage
   - Add request validation middleware

This ensures the feature is ready for production use with proper monitoring and protection.
```

## Implementation Guidelines

### Development Best Practices
1. **Incremental Testing**: Test each step independently before moving to the next
2. **Error-First Development**: Implement error handling alongside core functionality  
3. **Performance Awareness**: Use database iterators and streaming responses from the start
4. **Security Focus**: Validate all inputs and ensure proper user isolation
5. **Logging Strategy**: Add comprehensive logging for debugging and monitoring

### Testing Strategy
- Unit tests for serializers and utilities
- Integration tests for full roundtrip scenarios  
- Performance tests with large datasets
- Security tests for authentication and authorization
- Error handling tests for edge cases

### Deployment Considerations
- Feature flags for gradual rollout
- Database migration planning (none required for this feature)
- Monitoring and alerting setup
- Documentation for end users

## Success Validation
Each phase should be validated before proceeding:
1. **Phase 1**: Basic export works and produces valid JSON-LD
2. **Phase 2**: Export filtering matches Netscape export behavior exactly
3. **Phase 3**: Basic import creates bookmarks correctly
4. **Phase 4**: Perfect roundtrip fidelity and robust error handling