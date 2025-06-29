# Activity Stream Import Implementation Plan

## Overview

This plan builds upon the existing ActivityStream import functionality to add asynchronous processing, job tracking, and a dedicated import page with file uploads. The implementation will be broken down into small, iterative steps that build on each other.

## Phase 1: Data Model Foundation

### Step 1.1: Create ImportJob Model

**Context**: We need a Django model to track import jobs with all the fields specified in the spec.

**Prompt**:
```
Create a Django model called ImportJob in the bookmarks app's models.py file. The model should:

1. Inherit from TimestampedModel (which provides created/updated timestamps)
2. Include these fields:
   - user (ForeignKey to User, with CASCADE delete)
   - file_path (CharField max_length=500)
   - status (CharField with choices: pending, processing, completed, failed, cancelled)
   - file_size (BigIntegerField)
   - total_bookmarks (IntegerField, null=True, blank=True)
   - processed_bookmarks (IntegerField, default=0)
   - failed_bookmarks (IntegerField, default=0)
   - error_message (TextField, null=True, blank=True)
   - failed_bookmark_details (JSONField, default=list, blank=True)
   - started_at (DateTimeField, null=True, blank=True)
   - completed_at (DateTimeField, null=True, blank=True)
   - import_options (JSONField, default=dict)

3. Add a Meta class with ordering by created descending
4. Add a __str__ method that shows user and status
5. Add a property method 'progress_percentage' that calculates the percentage if total_bookmarks is set
6. Import any necessary Django modules at the top

Place this after the existing Bookmark model in the file.
```

### Step 1.2: Create and Run Migration

**Context**: After creating the model, we need to generate and apply the database migration.

**Prompt**:
```
Generate a Django migration for the new ImportJob model by running:
python manage.py makemigrations bookmarks

Then apply the migration with:
python manage.py migrate bookmarks

Verify the migration was created successfully and the database table exists.
```

## Phase 2: File Upload Infrastructure

### Step 2.1: Create Import Form

**Context**: We need a form to handle file uploads with validation and options.

**Prompt**:
```
Create a Django form for handling import file uploads in bookmarks/forms.py:

1. Create a form class called ImportJobForm that:
   - Has a file field (FileField) with label "ActivityStreams JSON file"
   - Has a duplicate_handling choice field with options: ('skip', 'Skip duplicates'), ('overwrite', 'Overwrite duplicates')
   - Sets the file field to accept only .json files using accept attribute
   - Validates file size doesn't exceed 50MB in clean_file method
   - Validates the file has .json extension
   - Returns appropriate validation errors

2. Add necessary imports at the top (forms, ValidationError, etc.)

The form should be placed after the existing BookmarkForm in the file.
```

### Step 2.2: Create File Upload Utility

**Context**: We need a utility function to handle saving uploaded files with the specified naming pattern.

**Prompt**:
```
In bookmarks/services.py, add a utility function to handle file uploads:

1. Create a function called save_import_file(file, user) that:
   - Generates a unique filename using the pattern: imports/{user_id}/{date}-{time}-{random[:8]}.json
   - Uses Django's default_storage to save the file
   - Creates the directory structure if it doesn't exist
   - Returns the relative file path
   
2. Import necessary modules:
   - from django.core.files.storage import default_storage
   - from django.core.files.base import ContentFile
   - import os, random, string
   - from datetime import datetime

3. The random string should use letters and digits

Place this function after the existing utility functions in the file.
```

## Phase 3: Views and Templates

### Step 3.1: Create Import List View

**Context**: We need a view to display the import page with form and job list.

**Prompt**:
```
Create a Django view in bookmarks/views.py for the import page:

1. Create a class-based view called BookmarkImportView that:
   - Inherits from LoginRequiredMixin and TemplateView
   - Sets template_name to 'bookmarks/import.html'
   - In get_context_data:
     - Adds the ImportJobForm to context
     - Queries ImportJob objects for the current user
     - Orders them by created descending
     - Passes them as 'import_jobs' to context

2. Import the ImportJobForm at the top
3. Import the ImportJob model

Place this view after the existing import/export views in the file.
```

### Step 3.2: Create Import Form Processing View

**Context**: We need a view to handle the form submission and create import jobs.

**Prompt**:
```
Create a form processing view in bookmarks/views.py:

1. Create a class-based view called BookmarkImportSubmitView that:
   - Inherits from LoginRequiredMixin and View
   - Has a post method that:
     - Creates an ImportJobForm with request.POST and request.FILES
     - Validates the form
     - If valid:
       - Saves the file using save_import_file utility
       - Creates an ImportJob with status='pending'
       - Stores file size from uploaded file
       - Stores import_options from form data
       - Redirects back to import page with success message
     - If invalid:
       - Redirects back with form errors in messages

2. Import necessary modules (redirect, messages, View)
3. Import save_import_file from services

Place this after BookmarkImportView.
```

### Step 3.3: Create Import Page Template

**Context**: We need a template that displays the upload form and lists import jobs.

**Prompt**:
```
Create a template at bookmarks/templates/bookmarks/import.html:

1. Extend from 'base.html'
2. Set the title block to "Import Bookmarks"
3. In the content block:
   - Add a heading "Import Bookmarks"
   - Create a form section with:
     - Form with method="POST" and enctype="multipart/form-data"
     - CSRF token
     - Render the form fields
     - Submit button labeled "Upload and Import"
   - Create an import jobs section with:
     - Heading "Import History"
     - Table with columns: Date, File Size, Status, Bookmarks, Progress, Actions
     - Loop through import_jobs and display each job
     - Format file size in human-readable format (KB/MB)
     - Show status with appropriate styling (pending=gray, processing=blue, completed=green, failed=red, cancelled=orange)
     - Show progress as "X of Y (Z%)" for processing jobs
     - Show action buttons based on status:
       - Retry button for failed jobs
       - Cancel button for pending/processing jobs
     - Show error message for failed jobs

4. Add JavaScript to auto-refresh the page every 5 seconds if any jobs are pending/processing

Use Bootstrap classes for styling consistency with the rest of the site.
```

### Step 3.4: Add URL Routes

**Context**: We need to wire up the URLs for the import views.

**Prompt**:
```
Update bookmarks/urls.py to add routes for the import functionality:

1. Add these URL patterns:
   - path('import/', BookmarkImportView.as_view(), name='bookmarks:import')
   - path('import/submit/', BookmarkImportSubmitView.as_view(), name='bookmarks:import_submit')

2. Import the new views at the top

Place these after the existing import/export URLs to keep them grouped together.
```

### Step 3.5: Add Navigation Link

**Context**: We need to add the Import link to the logged-in user navigation.

**Prompt**:
```
Update the base template at common/templates/base.html:

1. Find the dropdown menu for logged-in users (look for the dropdown with "New", "Profile", "Settings")
2. Add a new dropdown item for Import:
   - Add after the "New" link
   - Use the URL tag to link to 'bookmarks:import'
   - Label it "Import"
   - Keep the same styling as other dropdown items

The link should only appear for authenticated users, which the dropdown already handles.
```

## Phase 4: Asynchronous Processing

### Step 4.1: Create Celery Task

**Context**: We need a Celery task to process imports asynchronously.

**Prompt**:
```
Create a Celery task in bookmarks/tasks.py for processing imports:

1. Create a task called process_import_job(import_job_id) that:
   - Fetches the ImportJob by ID
   - Updates status to 'processing' and sets started_at
   - Opens and reads the JSON file from file_path
   - Parses the JSON and extracts the bookmarks array
   - Updates total_bookmarks count
   - For each bookmark:
     - Deserializes using ActivityStreamSerializer
     - Checks for existing bookmark by unique_hash
     - Based on import_options['duplicate_handling']:
       - 'skip': Skip if exists
       - 'overwrite': Update existing
     - Tracks successes and failures
     - Updates progress every 10 bookmarks
   - On completion:
     - Sets status to 'completed' or 'failed'
     - Sets completed_at
     - Stores error details if any
     - Deletes the file if successful
   - Handles exceptions gracefully

2. Import necessary modules:
   - ImportJob model
   - ActivityStreamSerializer
   - default_storage
   - json, logging
   - timezone utilities

3. Use try/except blocks for robust error handling
4. Log important events

Place this after the existing unfurl_bookmark_meta task.
```

### Step 4.2: Trigger Task on Upload

**Context**: We need to trigger the Celery task when a file is uploaded.

**Prompt**:
```
Update BookmarkImportSubmitView to trigger the async task:

1. After creating the ImportJob in the post method:
   - Import the process_import_job task at the top
   - Call process_import_job.delay(import_job.id) after saving
   - This queues the task for async processing

2. Update the success message to indicate the import has been queued

This ensures the import is processed in the background while the user can continue using the site.
```

## Phase 5: Progress Tracking and Actions

### Step 5.1: Add Progress Update Method

**Context**: We need a method to efficiently update progress during import.

**Prompt**:
```
Add a method to the ImportJob model for updating progress:

1. In the ImportJob model, add a method update_progress(processed, failed=0) that:
   - Updates processed_bookmarks and failed_bookmarks
   - Only saves to database if progress changed by at least 1% or 10 records
   - This reduces database writes during large imports
   - Uses F() expressions for atomic updates

2. Import F from django.db.models at the top

This method will be called from the Celery task to track progress efficiently.
```

### Step 5.2: Create Action Views

**Context**: We need views to handle retry and cancel actions.

**Prompt**:
```
Add action views to bookmarks/views.py for retry and cancel:

1. Create BookmarkImportRetryView that:
   - Inherits from LoginRequiredMixin and View
   - Has a post method that:
     - Gets the import_job_id from POST
     - Verifies the job belongs to the current user
     - Verifies the job is in 'failed' status
     - Resets the job to 'pending' status
     - Clears error fields
     - Triggers process_import_job task again
     - Redirects back with success message

2. Create BookmarkImportCancelView that:
   - Similar structure to retry view
   - Verifies job is in 'pending' or 'processing' status
   - Updates status to 'cancelled'
   - Revokes the Celery task if still pending
   - Redirects back with success message

3. Import necessary modules for task control

Place these after the import submit view.
```

### Step 5.3: Update Template with Action Forms

**Context**: We need to add the action buttons to the template.

**Prompt**:
```
Update the import.html template to add action buttons:

1. In the actions column of the import jobs table:
   - For failed jobs: Add a form with POST to retry URL and a "Retry" button
   - For pending/processing jobs: Add a form with POST to cancel URL and a "Cancel" button
   - Include CSRF token in each form
   - Pass import_job.id as hidden input
   - Use appropriate Bootstrap button classes (btn-warning for retry, btn-danger for cancel)

2. The forms should be inline with the table cell
3. Only show buttons based on the job status

This allows users to interact with their import jobs.
```

### Step 5.4: Add Action URL Routes

**Context**: We need routes for the retry and cancel actions.

**Prompt**:
```
Update bookmarks/urls.py to add action routes:

1. Add these URL patterns after the import submit URL:
   - path('import/retry/', BookmarkImportRetryView.as_view(), name='bookmarks:import_retry')
   - path('import/cancel/', BookmarkImportCancelView.as_view(), name='bookmarks:import_cancel')

2. Import the new view classes at the top

This completes the URL routing for all import functionality.
```

## Phase 6: Polish and Error Handling

### Step 6.1: Add Admin Interface

**Context**: We should add admin interface for ImportJob model for debugging.

**Prompt**:
```
Update bookmarks/admin.py to add ImportJob admin:

1. Create an ImportJobAdmin class that:
   - Lists fields: user, status, file_path, created, total_bookmarks, processed_bookmarks
   - Adds list filters for status and created date
   - Adds search by user__username
   - Makes appropriate fields readonly
   - Orders by created descending

2. Register ImportJob with this admin class

This helps with debugging and monitoring imports.
```

### Step 6.2: Add Validation and Error Messages

**Context**: We need to improve error handling and user feedback.

**Prompt**:
```
Enhance error handling in the process_import_job task:

1. Add specific error handling for:
   - File not found (may have been deleted)
   - Invalid JSON format
   - Missing required fields in bookmarks
   - Database errors
   - Memory errors for huge files

2. Store meaningful error messages in error_message field
3. For individual bookmark failures:
   - Store bookmark index and error in failed_bookmark_details
   - Continue processing remaining bookmarks
   - Include bookmark title/URL in error for identification

3. Add progress logging every 100 bookmarks for large imports

This provides better debugging information and user feedback.
```

### Step 6.3: Add Template Enhancements

**Context**: Final template polish for better UX.

**Prompt**:
```
Enhance the import.html template:

1. Add help text explaining:
   - Supported file format (ActivityStreams JSON)
   - Maximum file size (50MB)
   - What happens with duplicates

2. For the import jobs table:
   - Show human-readable relative times (e.g., "2 hours ago")
   - Add tooltip to show exact timestamp
   - For failed imports, show failed_bookmarks count if > 0
   - Format large numbers with commas
   - Show estimated time remaining for processing jobs

3. Add an empty state message when no imports exist

4. Add confirmation dialogs for cancel action using JavaScript

This improves the user experience with better information and safety checks.
```

## Phase 7: Testing and Documentation

### Step 7.1: Create Test Cases

**Context**: We need comprehensive tests for the new functionality.

**Prompt**:
```
Create test cases in bookmarks/tests/test_import_jobs.py:

1. Test ImportJob model:
   - Test model creation and field validation
   - Test progress_percentage calculation
   - Test update_progress method

2. Test file upload:
   - Test valid file upload creates job
   - Test file size validation
   - Test file type validation
   - Test file storage location

3. Test import processing:
   - Test successful import
   - Test duplicate handling (skip/overwrite)
   - Test partial import with failures
   - Test invalid JSON handling

4. Test views and permissions:
   - Test only authenticated users can access
   - Test users only see their own jobs
   - Test retry/cancel actions

Use Django's TestCase and mock Celery tasks for synchronous testing.
```

### Step 7.2: Update Documentation

**Context**: Document the new feature for users and developers.

**Prompt**:
```
Update or create documentation:

1. Add a user guide section explaining:
   - How to export bookmarks (existing feature)
   - How to import bookmarks (new feature)
   - Supported formats and limitations
   - Troubleshooting common issues

2. Add developer notes about:
   - ImportJob model structure
   - File storage approach
   - Celery task processing
   - Error handling strategy

3. Update README if needed to mention import/export capabilities

This helps users understand and use the feature effectively.
```

## Implementation Order Summary

The implementation should proceed in this order to ensure each piece builds on the previous:

1. **Data Model** - Create the foundation
2. **File Upload** - Handle file storage  
3. **Views and Templates** - Build the UI
4. **Async Processing** - Add background jobs
5. **Progress and Actions** - Enable user control
6. **Polish** - Improve UX and error handling
7. **Testing** - Ensure reliability

Each phase is self-contained and can be tested independently before moving to the next phase.