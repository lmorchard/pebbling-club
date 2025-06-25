# URL Hash Normalization Implementation Plan

## Overview

This plan breaks down the implementation of URL normalization for bookmark deduplication into small, incremental steps. Each step builds upon the previous one, ensuring safe progress without large complexity jumps.

## Phase 1: Create URLNormalizer Class Structure

### Step 1.1: Basic URLNormalizer Class Setup

**Context**: We need to add a new URLNormalizer class to the existing `pebbling_apps/bookmarks/services.py` file. This class will handle URL normalization and hash generation.

**Prompt**:
```
Add a URLNormalizer class to pebbling_apps/bookmarks/services.py with the following structure:

1. Create an instance-based URLNormalizer class
2. Add __init__ method (empty for now, for future configurability)
3. Add two method stubs:
   - normalize_url(self, url: str) -> str  (returns the input url unchanged for now)
   - generate_hash(self, url: str) -> str  (returns empty string for now)
4. Add necessary imports at the top of the file (hashlib for future use)
5. Add a logger setup for the class

The class should be added after the existing BookmarksService class.
```

### Step 1.2: Implement Basic URL Parsing with Error Handling

**Context**: We need to implement URL parsing with proper error handling that logs warnings and falls back to the original URL on parsing errors.

**Prompt**:
```
Update the URLNormalizer.normalize_url method to:

1. Import urllib.parse at the top of the file
2. Try to parse the URL using urllib.parse.urlparse and urlunparse
3. If parsing fails, log a warning and return the original URL
4. For now, just parse and reconstruct the URL without modifications
5. Add proper logging using the class logger

Example structure:
- Try to parse the URL
- If successful, reconstruct it using urlunparse
- If parsing fails, log warning with the URL and error, then return original URL
```

## Phase 2: Implement URL Normalization Rules

### Step 2.1: Implement Basic Normalization (Hostname and Ports)

**Context**: Start implementing normalization rules, beginning with hostname lowercasing and default port removal.

**Prompt**:
```
Update the URLNormalizer.normalize_url method to implement these normalization rules:

1. Lowercase the hostname
2. Remove default ports:
   - Remove :80 for http scheme
   - Remove :443 for https scheme
3. Handle cases where netloc might include port numbers

The method should still handle parsing errors gracefully.
```

### Step 2.2: Implement Path Normalization

**Context**: Add path normalization to remove trailing slashes.

**Prompt**:
```
Update the URLNormalizer.normalize_url method to:

1. Remove trailing slashes from the path component
2. Handle edge cases:
   - Don't remove slash if path is just "/" 
   - Preserve the path structure otherwise

This should be added after hostname normalization but before URL reconstruction.
```

### Step 2.3: Implement Query Parameter Sorting

**Context**: Query parameters need to be sorted alphabetically for consistent hashing.

**Prompt**:
```
Update the URLNormalizer.normalize_url method to:

1. Parse query parameters using parse_qs or parse_qsl
2. Sort parameters alphabetically by key
3. Reconstruct the query string with sorted parameters
4. Handle special cases:
   - Empty values
   - Multiple values for same key
   - Preserve parameter structure
```

### Step 2.4: Remove Empty Query Parameters

**Context**: Empty query parameters should be removed from the normalized URL.

**Prompt**:
```
Update the URLNormalizer.normalize_url method to:

1. Filter out query parameters with empty values
2. Handle various empty cases:
   - key= (empty string value)
   - key (no = sign)
3. Keep parameters with actual values including "0" or "false"
```

### Step 2.5: Implement Tracking Parameter Removal

**Context**: Remove common tracking parameters from URLs.

**Prompt**:
```
Update the URLNormalizer class to:

1. Add a class constant TRACKING_PARAMS with these parameters:
   - All parameters starting with 'utm_'
   - fbclid, gclid, msclkid, twclid
   - ref, referrer
2. Update normalize_url to remove these parameters (case-insensitive)
3. For utm_ parameters, check if the key starts with 'utm_' (case-insensitive)
4. For other tracking params, do exact matches (case-insensitive)
```

## Phase 3: Implement Hash Generation

### Step 3.1: Implement SHA-256 Hash Generation

**Context**: Add the hash generation method using SHA-256.

**Prompt**:
```
Implement the URLNormalizer.generate_hash method:

1. Call normalize_url to get the normalized URL
2. Encode the normalized URL as UTF-8
3. Generate SHA-256 hash using hashlib
4. Return the hexdigest of the hash
5. Handle any encoding errors gracefully
```

## Phase 4: Create Comprehensive Unit Tests

### Step 4.1: Create Test File Structure

**Context**: We need comprehensive tests for the URLNormalizer class.

**Prompt**:
```
Create a test file at pebbling_apps/bookmarks/tests/test_url_normalizer.py with:

1. Import necessary testing modules (django.test.TestCase)
2. Import URLNormalizer from services
3. Create a TestURLNormalizer class
4. Add setUp method to create URLNormalizer instance
5. Add test method stubs for:
   - test_basic_normalization
   - test_tracking_parameter_removal
   - test_query_parameter_sorting
   - test_error_handling
```

### Step 4.2: Implement Normalization Tests

**Context**: Implement tests using the test URLs from the spec.

**Prompt**:
```
Implement the test methods in TestURLNormalizer:

1. Use the TEST_INITIAL_URLS and TEST_LATER_URLS from the spec
2. For each pair, verify they produce the same hash
3. Test specific normalization rules:
   - Lowercase hostname
   - Default port removal
   - Trailing slash removal
   - Query parameter sorting
   - Empty parameter removal
   - Tracking parameter removal
4. Test error cases with malformed URLs
```

## Phase 5: Update BookmarkManager

### Step 5.1: Update BookmarkManager to Use URLNormalizer

**Context**: Replace the current simple hash generation with URLNormalizer.

**Prompt**:
```
Update BookmarkManager.generate_unique_hash_for_url in models.py:

1. Import URLNormalizer from .services
2. Replace the current implementation with:
   - Create URLNormalizer instance
   - Call generate_hash method
   - Return the result
3. Keep the method signature the same for backward compatibility
```

## Phase 6: Create Database Migration

### Step 6.1: Create Data Migration File

**Context**: Create a Django data migration to update existing bookmarks.

**Prompt**:
```
Create a Django data migration for the bookmarks app:

1. Use manage.py makemigrations --empty bookmarks
2. Name it "normalize_bookmark_hashes"
3. Set up the basic migration structure with:
   - Forward migration function
   - Reverse migration (can be noop)
   - atomic = False to allow individual transactions
```

### Step 6.2: Implement Migration Logic

**Context**: Implement the migration logic to process bookmarks and handle duplicates.

**Prompt**:
```
Implement the forward migration function:

1. Import necessary modules (transaction, IntegrityError, logging, json)
2. Import Bookmark model and URLNormalizer
3. Set up logging
4. Iterate through all bookmarks
5. For each bookmark:
   - Wrap in transaction.atomic() block
   - Calculate new hash using URLNormalizer
   - Try to save with new hash
   - Catch IntegrityError (indicates duplicate)
   - On duplicate:
     - Find existing bookmark with same hash and owner
     - Compare created_at timestamps
     - Keep newer, delete older
     - Log deletion as JSON with all key fields
6. Log progress periodically (every 100 bookmarks)
```

### Step 6.3: Add Migration Testing

**Context**: Add safety checks and dry-run capability to the migration.

**Prompt**:
```
Enhance the migration with safety features:

1. Add a count of total bookmarks at the start
2. Track statistics:
   - Bookmarks processed
   - Duplicates found
   - Bookmarks deleted
3. Log summary statistics at the end
4. Add proper error handling for unexpected cases
5. Ensure tags are listed properly in deletion logs
```

## Phase 7: Integration Testing

### Step 7.1: Create Integration Tests

**Context**: Test the complete flow including model integration.

**Prompt**:
```
Create integration tests in pebbling_apps/bookmarks/tests/test_integration.py:

1. Test bookmark creation with normalized hash
2. Test that duplicate URLs are prevented
3. Test that update_or_create works correctly
4. Test various URL variations create same hash
5. Verify original URLs are preserved
```

### Step 7.2: Test Migration Behavior

**Context**: Create tests to verify migration behavior.

**Prompt**:
```
Add migration tests to verify:

1. Existing bookmarks get new hashes
2. Duplicates are properly merged
3. Newer bookmarks are kept
4. Deletion logging works correctly
5. Transaction handling works as expected
```

## Final Phase: Documentation and Cleanup

### Step 8.1: Add Documentation

**Context**: Document the new functionality.

**Prompt**:
```
Add documentation:

1. Add docstrings to URLNormalizer class and methods
2. Document the normalization rules
3. Add comments explaining non-obvious logic
4. Update any existing documentation about bookmark deduplication
```

### Step 8.2: Final Review and Cleanup

**Context**: Final cleanup and verification.

**Prompt**:
```
Perform final cleanup:

1. Run all tests to ensure everything works
2. Run linting and fix any issues
3. Verify the migration works on test data
4. Check that all success criteria from the spec are met
```