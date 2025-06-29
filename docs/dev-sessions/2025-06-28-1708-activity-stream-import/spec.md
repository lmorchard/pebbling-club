# Activity Stream Import

## Overview

Previously, in @../docs/dev-sessions/2025-06-24-2238-activity-stream-export/, we built a feature to export a user's bookmarks in ActivityStreams format. We also built parsing code to import that same format to ensure data was preserved in roundtrip export / import cycles.

Now, we'd like to further develop the import feature. In particular, we want:

- A page linked from the site nav for a logged in user with import options - eventually we will want to support multiple import format

- A form on that import options page to accept a file upload of an ActivityStreams JSON file that matches our export format.

- We should create a new Django model to track import jobs per user

- When submitted, the JSON file should be accepted into a file on the filesystem and a new import job should be created for the user which points at the accepted file upload

- The page with the import form should have a section beneath it listing the import jobs accepted for the user, indicating details like time of upload and status of the import process

- The import process itself should be done asynchronously in a deferred Celery task, which takes the import job in the database and performs the ActivityStream import of bookmarks in the background

We also recently implemented a new unique hash normalization feature in @../docs/dev-sessions/2025-06-25-1430-unique-hash-normalization - we should keep this in mind as a way to handle potentially duplicate records in the import. Look for an existing record by unique hash before inserting a new row - if found, just update the existing row.

If possible, we'd also like to track progress in the import job and show progress to the user - i.e. record 10 of 1000 done and percentage. As a bonus, it would be cool calculate an estimated completion time.

## Detailed Specifications

### Navigation
- Add "Import" link to the logged-in user header navigation alongside New, Profile, Settings, etc.

### Import Job Model
The Django model for tracking import jobs should include:
- User (ForeignKey)
- File path (using Django media storage)
- Status (choices: pending, processing, completed, failed, cancelled)
- File size
- Total bookmarks count (nullable, populated when processing starts)
- Processed bookmarks count
- Failed bookmarks count
- Error message (TextField, nullable)
- Failed bookmark details (JSONField to store array of failures)
- Created timestamp
- Started timestamp (nullable)
- Completed timestamp (nullable)
- Import options (JSONField):
  - duplicate_handling: "skip" or "overwrite"

### File Storage
- Use Django's media storage
- File naming pattern: `imports/{user_id}/{date}-{time}-{random_string[:8]}.json`
  - Example: `imports/123/2025-06-28-1430-a7b3c9d2.json`
- Delete files after successful import completion
- Keep files for failed/cancelled imports for potential retry

### Import Page Features
1. **File Upload Form**
   - Accept JSON file upload
   - Option to select duplicate handling: "Skip duplicates" or "Overwrite duplicates"
   - File size validation (define reasonable max size)

2. **Import Jobs List**
   - Display below the upload form
   - Show for each job:
     - Upload date/time
     - File size
     - Status (with appropriate styling)
     - Bookmarks count (once processing starts)
     - Progress: "X of Y processed (Z%)" for in-progress jobs
     - Error message for failed jobs
     - Action buttons based on status:
       - Retry (for failed jobs only)
       - Cancel (for pending/processing jobs)
       - No actions for completed jobs

### Import Process Workflow
1. User uploads file → Create import job with "pending" status
2. Celery task picks up job → Update to "processing" status
3. Parse JSON and count bookmarks → Update total_bookmarks_count
4. Process each bookmark:
   - Use unique hash to check for existing bookmark
   - Based on duplicate_handling option:
     - "skip": Skip if exists
     - "overwrite": Update existing bookmark
   - Track progress every N bookmarks (e.g., every 10 or 100)
   - Continue on individual bookmark failures, track in failed_bookmark_details
5. On completion:
   - Update status to "completed" or "failed"
   - Delete uploaded file if successful
   - Store summary of any failed bookmarks

### Error Handling
- Invalid JSON: Fail entire import with clear error message
- Individual bookmark failures: Continue import, track failures
- Partial imports: Keep successfully imported bookmarks
- Failed imports should preserve the uploaded file for retry

### Progress Tracking
- Update processed_bookmarks_count periodically during import
- Calculate percentage: (processed / total) * 100
- Optional: Calculate estimated completion time based on processing rate

### Celery Task Considerations
- Should handle graceful cancellation
- Update progress in database periodically (not on every bookmark)
- Use appropriate task timeout settings
- Consider rate limiting for very large imports
