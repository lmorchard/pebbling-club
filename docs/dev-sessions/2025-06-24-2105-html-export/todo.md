# Session TODO: Netscape HTML Export Implementation

## Phase 1: Foundation
- [ ] Create BookmarkExportNetscapeView class with basic placeholder response
- [ ] Add URL pattern for /bookmarks/export/netscape.html
- [ ] Create NetscapeBookmarkExporter class with header/footer methods

## Phase 2: Basic Export
- [ ] Implement streaming response with proper headers
- [ ] Query and iterate through user's bookmarks
- [ ] Format individual bookmarks with core attributes (URL, title, timestamps, ID)

## Phase 3: Enhanced Data
- [ ] Add tags support to bookmark formatting
- [ ] Add description support with <DD> tags
- [ ] Extract and include feed URLs from unfurl metadata

## Phase 4: Query Parameters
- [ ] Implement tag filtering with multiple tag support
- [ ] Add date range filtering using parse_since
- [ ] Add limit parameter support

## Phase 5: Performance & Polish
- [ ] Optimize database queries with prefetch_related
- [ ] Implement memory-efficient iteration
- [ ] Add export activity logging

## Phase 6: Testing
- [ ] Create basic export view tests (auth, headers, streaming)
- [ ] Test Netscape format correctness
- [ ] Test query parameter filtering
- [ ] Test performance optimizations