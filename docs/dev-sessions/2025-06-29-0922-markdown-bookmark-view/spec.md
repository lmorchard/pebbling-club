# Spec - Markdown Bookmark View

## Overview
Add a markdown format option to all bookmark views in pebbling-club, allowing users to get bookmark lists as plain text markdown suitable for copying into blog posts or processing with other tools.

## Requirements

### Query Parameter
- Add support for `?format=markdown` query parameter to all bookmark endpoints
- When this parameter is present, return markdown-formatted plain text instead of HTML
- Parameter should work on:
  - Main bookmarks list (`/bookmarks?format=markdown`)
  - Tag-filtered views (`/bookmarks/tag/python?format=markdown`)
  - Search results (`/bookmarks/search?q=django&format=markdown`)
  - User bookmark lists (`/users/username/bookmarks?format=markdown`)
  - Any other bookmark listing endpoint

### Response Format
- Content-Type: `text/plain`
- Character encoding: UTF-8
- No HTML wrapper, just raw markdown text

### Markdown Structure
- Group bookmarks by date
- Dates as level 1 headings in YYYY-MM-DD format
- Multiple days appear as separate sections
- Days ordered chronologically (oldest to newest)
- Within each day, maintain the same ordering as the HTML view

Example structure:
```markdown
# 2025-06-27

- [First bookmark title](https://example.com/first)
  > Description of the first bookmark

- [Second bookmark title](https://example.com/second)
  > Description of the second bookmark

# 2025-06-28

- [Third bookmark title](https://example.com/third)
  > Description of the third bookmark
```

### Bookmark Format
Each bookmark should be formatted as:
- Bullet point with title as inline link: `- [Title](URL)`
- Description on next line, indented, as blockquote: `  > Description`
- If no description exists, omit the blockquote line entirely

### Empty Results
- When query returns no bookmarks, output: `<!-- No bookmarks found -->`
- This provides feedback that the query executed successfully but returned no results

### Pagination
- Respect the same pagination settings as the HTML view
- The markdown output should contain exactly the same bookmarks that would appear in the HTML view
- If pagination is active, only show bookmarks from the current page
- No pagination controls in the markdown output itself

### Compatibility
- All existing query parameters should continue to work alongside `format=markdown`
- Examples:
  - `?since=24h&format=markdown`
  - `?before=2024-01-01&format=markdown`
  - `?page=2&format=markdown`
  - `/bookmarks/tag/python?since=7d&format=markdown`

### Error Handling
- Invalid format values should be ignored and default to HTML view
- All other error handling remains the same as HTML views

## Implementation Notes
- Consider creating a dedicated markdown renderer/serializer
- Ensure proper escaping of markdown special characters in titles and descriptions
- Date grouping logic should be efficient for large result sets
- Consider caching markdown output if performance becomes an issue

## Future Considerations
- Could add more format options later (JSON, RSS, etc.)
- Might want to add options for customizing the markdown format
- Could consider adding metadata like tags or bookmark count per day