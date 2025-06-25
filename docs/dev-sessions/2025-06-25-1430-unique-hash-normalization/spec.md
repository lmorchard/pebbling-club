# Unique Hash Normalization Specification

## Overview

Improve bookmark deduplication by normalizing URLs before generating unique hashes. This prevents duplicate bookmarks that differ only by tracking parameters and other URL variations.

## Purpose

Replace the current simple SHA-1 hash of raw URLs with a normalized URL hash system that:

- Strips tracking parameters and URL cruft
- Normalizes URL structure for consistent hashing
- Uses SHA-256 for better security
- Handles duplicate detection and merging during migration

## Requirements

### 1. URLNormalizer Class

Add a `URLNormalizer` class to `pebbling_apps/bookmarks/services.py`:

**Class Structure:**

```python
class URLNormalizer:
    def __init__(self):
        # Instance-based for future configurability
        pass

    def normalize_url(self, url: str) -> str:
        # Returns normalized URL string

    def generate_hash(self, url: str) -> str:
        # Returns SHA-256 hash of normalized URL
```

**URL Normalization Rules (applied in order):**

1. Parse URL (fallback to original if parsing fails)
2. Lowercase hostname
3. Remove default ports (:80 for HTTP, :443 for HTTPS)
4. Remove trailing slash from pathname
5. Sort query parameters alphabetically
6. Remove empty query parameters
7. Strip tracking parameters (case-insensitive):
   - `utm_*` (all UTM parameters)
   - `fbclid` (Facebook Click ID)
   - `gclid` (Google Click ID)
   - `msclkid` (Microsoft/Bing Click ID)
   - `twclid` (Twitter Click ID)
   - `ref`, `referrer` (referrer tracking)
8. Reconstruct URL string
9. Generate SHA-256 hash

**Error Handling:**

- Log warnings using Django's built-in logging for malformed URLs
- Fall back to original URL if parsing fails
- Preserve URL fragments/anchors (they can be important)

**Important:** The normalized URL is ONLY used for hash generation - the original user-entered URL remains unchanged in the bookmark record.

### 2. BookmarkManager Updates

Update `BookmarkManager.generate_unique_hash_for_url()` to use `URLNormalizer`:

```python
def generate_unique_hash_for_url(self, url):
    normalizer = URLNormalizer()
    return normalizer.generate_hash(url)
```

### 3. Database Migration

Create a data migration to update existing bookmarks with new hash algorithm:

**Migration Strategy:**

- Process bookmarks one-by-one (not in batches due to duplicate detection complexity)
- Wrap individual bookmark processing in `transaction.atomic()` blocks
- Calculate new hash for each bookmark
- Handle `IntegrityError` when saving (indicates duplicate found)
- On duplicate detection:
  - Query existing bookmark with same hash
  - Compare timestamps, keep the newer bookmark
  - Delete the older bookmark after logging
- Migration should be `atomic = False` to allow individual transactions

**Duplicate Handling:**

- Keep newest bookmark (based on `created_at` timestamp)
- Delete older duplicate bookmark
- Preserve original timestamps on kept bookmark
- Log deletion of older bookmark with key fields as JSON:
  ```json
  {
    "action": "deleted_duplicate",
    "deleted_bookmark": {
      "id": 123,
      "url": "https://example.com",
      "title": "Example Title",
      "owner_id": 456,
      "created_at": "2025-01-01T12:00:00Z",
      "updated_at": "2025-01-01T12:00:00Z",
      "unique_hash": "old_hash_value",
      "tags": ["tag1", "tag2"]
    },
    "kept_bookmark_id": 789
  }
  ```

## Test Cases

Use test URLs from the original Node.js implementation to validate normalization behavior:

```python
TEST_URLS = {
    "http://abcnews.go.com/US/wireStory?id=201062&CMP=OTC-RSSFeeds0312": {
        "expected_normalized": "http://abcnews.go.com/US/wireStory?CMP=OTC-RSSFeeds0312&id=201062"
    },
    # Additional test cases for:
    # - Query parameter sorting
    # - UTM parameter stripping
    # - Trailing slash removal
    # - Case-insensitive tracking parameter matching
    # - Default port removal
    # - Empty parameter removal
}

# Consider these URLs as bookmarks first...
TEST_INITIAL_URLS = [
  "http://abcnews.go.com/US/wireStory?id=201062&CMP=OTC-RSSFeeds0312",
  "http://an9.org/devdev/why_frameworks_suck?sxip-homesite=&checked=1",
  "http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0%2C0",
  "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project/",
  "http://annearchy.com/blog/?p=3661",
  "http://mashable.com/2013/08/11/teens-facebook/?utm_cid=mash-prod-email-topstories",
  "http://bash.org/?564283",
]

# The hashes should be equivalent to these
TEST_LATER_URLS = [
  "http://abcnews.go.com/US/wireStory?CMP=OTC-RSSFeeds0312&id=201062",
  "http://an9.org/devdev/why_frameworks_suck?checked=1&sxip-homesite=",
  "http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0,0",
  "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project",
  "http://annearchy.com/blog?p=3661",
  "http://mashable.com/2013/08/11/teens-facebook",
  "http://bash.org/?564283=",
]
```

These test URLs should be used to create unit tests for the `URLNormalizer` class to ensure consistent behavior with the original Node.js implementation.

## Success Criteria

1. `URLNormalizer` class created with both `normalize_url()` and `generate_hash()` methods
2. All existing bookmarks migrated to new hash algorithm
3. Duplicate bookmarks identified and merged (newer kept, older deleted)
4. All deletions logged with complete bookmark data for recovery
5. New bookmarks use normalized hash algorithm
6. No change to user-visible URLs (original URLs preserved)
7. Tracking parameters effectively stripped from hash generation:
   - `https://example.com?utm_source=twitter&utm_campaign=test` and `https://example.com` generate same hash
   - `https://example.com/` and `https://example.com` generate same hash (trailing slash)
   - `https://example.com:443` and `https://example.com` generate same hash (default HTTPS port)

## Implementation Notes

- URL normalization rules are hardcoded initially but class structure allows future configurability
- SHA-256 chosen over SHA-1 for better security
- Fragment/anchor preservation maintains bookmark functionality for single-page applications
- Case-insensitive tracking parameter matching catches variations like `UTM_source`
- One-time migration ensures all future bookmarks use consistent hashing
