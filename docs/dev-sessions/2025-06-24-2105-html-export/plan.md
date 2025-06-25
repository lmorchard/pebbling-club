# Implementation Plan: Netscape HTML Bookmark Export

## Overview
This plan breaks down the implementation of the Netscape HTML bookmark export feature into small, iterative steps that build upon each other. Each step is designed to be independently testable and integrates with the previous work.

## Phase 1: Foundation - Basic Export Structure

### Step 1: Create the Export View Class
**Prompt 1: Create Basic Export View**
```
Create a new Django view class called `BookmarkExportNetscapeView` in pebbling_apps/bookmarks/views.py that:
- Inherits from Django's View class
- Requires login using LoginRequiredMixin
- Implements a get() method that returns a simple HttpResponse with "Export placeholder" text
- Add appropriate imports at the top of the file
```

### Step 2: Wire the URL
**Prompt 2: Add URL Pattern**
```
Add a new URL pattern to pebbling_apps/bookmarks/urls.py that:
- Maps the path "bookmarks/export/netscape.html" to BookmarkExportNetscapeView
- Names it "export_netscape"
- Import the new view class
```

### Step 3: Create Netscape Format Generator
**Prompt 3: Create Format Generator Class**
```
Create a new file pebbling_apps/bookmarks/exporters.py with a NetscapeBookmarkExporter class that:
- Has a method generate_header() that returns the Netscape format header as a string:
  <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <!--This is an automatically generated file.
      It will be read and overwritten.
      Do Not Edit! -->
      <Title>Bookmarks</Title>
      <H1>Bookmarks</H1>
      <DL><p>
- Has a method generate_footer() that returns:
      </DL><p>
- Has a method format_bookmark(bookmark) that takes a bookmark object and returns a placeholder string for now
```

## Phase 2: Basic Export Functionality

### Step 4: Implement Basic Streaming Response
**Prompt 4: Add Streaming Response**
```
Update BookmarkExportNetscapeView to:
- Import StreamingHttpResponse from django.http
- Import the NetscapeBookmarkExporter
- Create a generator method that yields the header, placeholder content, and footer
- Return a StreamingHttpResponse with content_type='text/html; charset=utf-8'
- Add Content-Disposition header with filename including timestamp
```

### Step 5: Query User's Bookmarks
**Prompt 5: Add Bookmark Queryset**
```
Update BookmarkExportNetscapeView to:
- Get the current user's bookmarks using Bookmark.objects.for_user(self.request.user)
- Pass the queryset to a new generate_bookmarks() generator method in NetscapeBookmarkExporter
- The generator should yield a simple string for each bookmark (we'll format properly next)
```

### Step 6: Format Individual Bookmarks
**Prompt 6: Implement Bookmark Formatting**
```
Update NetscapeBookmarkExporter.format_bookmark() to:
- Extract bookmark attributes (url, title, created_at, updated_at, unique_hash)
- Convert timestamps to Unix epoch format
- Build the <DT><A> tag with HREF, ADD_DATE, LAST_MODIFIED, and ID attributes
- Use "Untitled" if title is None or empty
- HTML-escape the title using django.utils.html.escape
- Skip bookmarks without URLs (return empty string)
```

## Phase 3: Add Tags and Descriptions

### Step 7: Add Tags Support
**Prompt 7: Include Tags in Export**
```
Update NetscapeBookmarkExporter.format_bookmark() to:
- Get all tags for the bookmark using bookmark.tags.all()
- Join tag names with commas
- Add TAGS attribute to the <A> tag if tags exist
- Ensure proper formatting and escaping
```

### Step 8: Add Description Support
**Prompt 8: Include Descriptions**
```
Update NetscapeBookmarkExporter.format_bookmark() to:
- Check if bookmark has a description
- If so, add a <DD> tag after the </DT> with the escaped description
- Ensure proper indentation for readability
```

### Step 9: Add Feed URL Support
**Prompt 9: Extract Feed URLs**
```
Update NetscapeBookmarkExporter.format_bookmark() to:
- Check if bookmark has unfurl_metadata
- Extract feed URL from unfurl_metadata if it exists
- Add FEED attribute to the <A> tag if feed URL is found
- Handle JSON parsing safely
```

## Phase 4: Query Parameter Support

### Step 10: Add Tag Filtering
**Prompt 10: Implement Tag Filter**
```
Update BookmarkExportNetscapeView to:
- Get 'tag' query parameters using request.GET.getlist('tag')
- If tags are provided, filter bookmarks using .filter(tags__name__in=tags).distinct()
- For "ALL tags" behavior, chain filters for each tag
- Return 400 Bad Request if any tag doesn't exist
```

### Step 11: Add Date Range Filtering
**Prompt 11: Implement Since Filter**
```
Update BookmarkExportNetscapeView to:
- Get 'since' query parameter
- Use parse_since from pebbling_apps.common.utils to parse the value
- Filter bookmarks with created_at__gte=since_date if provided
- Return 400 Bad Request with message if parse_since raises an exception
```

### Step 12: Add Limit Support
**Prompt 12: Implement Limit Parameter**
```
Update BookmarkExportNetscapeView to:
- Get 'limit' query parameter
- Convert to integer and apply [:limit] slice to queryset if provided
- Handle invalid limit values (non-numeric, negative) with 400 response
```

## Phase 5: Performance and Polish

### Step 13: Optimize Database Queries
**Prompt 13: Add Query Optimization**
```
Update BookmarkExportNetscapeView to:
- Use .prefetch_related('tags') on the queryset to avoid N+1 queries
- Use .iterator() on the queryset for memory efficiency
- Update NetscapeBookmarkExporter.generate_bookmarks() to work with iterator
```

### Step 14: Add Logging
**Prompt 14: Implement Export Logging**
```
Update BookmarkExportNetscapeView to:
- Import logging module
- Create logger for the bookmarks app
- Log export activity including user, timestamp, and filter parameters
- Log any errors that occur during export
```

## Phase 6: Testing

### Step 15: Create Basic Export Tests
**Prompt 15: Add Export View Tests**
```
Create pebbling_apps/bookmarks/tests/test_export.py with tests for:
- Authentication required (returns 401 for anonymous users)
- Basic export returns correct content type and headers
- Filename includes timestamp
- Response is streaming
```

### Step 16: Test Format Correctness
**Prompt 16: Add Format Tests**
```
Add tests to verify:
- Correct DOCTYPE and header structure
- Bookmark formatting with all attributes
- Proper HTML escaping
- Missing data handling (no title, no URL)
- Tags and description formatting
```

### Step 17: Test Query Parameters
**Prompt 17: Add Filter Tests**
```
Add tests for:
- Tag filtering (single tag, multiple tags, non-existent tag)
- Date range filtering (valid and invalid formats)
- Limit parameter (valid, invalid, edge cases)
- Combined filters
```

### Step 18: Test Performance Features
**Prompt 18: Add Performance Tests**
```
Add tests to verify:
- Database queries are optimized (use assertNumQueries)
- Streaming response works correctly
- Large exports don't load all data into memory
```

## Integration Points
- The view integrates with existing authentication system
- Uses existing Bookmark model and queryset methods
- Leverages existing parse_since utility
- Follows existing URL patterns and naming conventions
- Compatible with existing logging infrastructure

## Dependencies
- Django's StreamingHttpResponse for efficient large exports
- Existing BookmarkQuerySet methods
- parse_since utility from common.utils
- Django's HTML escaping utilities
- Python's datetime for timestamp conversion