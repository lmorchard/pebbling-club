# Mastodon Integration for Inbox Feature - Specification

## Overview

Extend the existing inbox feature to support receiving items from Mastodon feeds/timelines, allowing users to gather links from Mastodon posts to read and curate in Pebbling Club.

## Context

Building on the successfully implemented inbox feature (Phases 1 & 2 complete), we now need to integrate Mastodon as a content source alongside RSS/Atom feeds.

We can use this library for Mastodon access from Python: https://github.com/halcy/Mastodon.py

## Goals

- Enable users to receive Mastodon posts with links into their inbox
- Provide proper parsing and formatting of Mastodon content
- Maintain existing inbox workflow and UI patterns
- Support OAuth connection to multiple Mastodon accounts
- Support multiple timeline types per account

## User Interface Requirements

### Settings Integration
- Create a separate "Mastodon Connections" page accessible from user settings
- After connecting an account, timeline configuration options appear on the same page
- Users can manage timelines at any time after initial connection

### OAuth Flow
1. User enters Mastodon server domain (e.g., "mastodon.social")
2. System makes exploratory API call to get server details
3. Display server name and description in simple confirmation dialog
4. If confirmed, initiate OAuth flow with `read` scope
5. Handle OAuth callback and store credentials

### Timeline Management
- Users can select multiple timeline types per connected account:
  - Home timeline
  - Local timeline  
  - Public timeline
  - Hashtag timelines (user enters hashtags manually)
  - List timelines (fetch and display existing lists for selection)
- Users can enable/disable individual timelines without disconnecting account
- Display polling status and recent poll history for each timeline

### Account Management
- Users can connect multiple Mastodon accounts
- Users can disconnect accounts (removes all associated timelines)
- Display connection status and last successful poll time

## Database Schema

### MastodonAccount Model
- Associated with User model
- Fields:
  - `server_url` - Mastodon instance URL
  - `server_name` - Display name of server
  - `server_description` - Server description
  - `access_token` - OAuth token (encrypted)
  - `account_id` - Mastodon account ID
  - `username` - Mastodon username
  - `display_name` - Mastodon display name
  - `is_active` - Connection enabled/disabled
  - `created_at`, `updated_at`

### MastodonTimeline Model
- Associated with MastodonAccount model
- Fields:
  - `timeline_type` - Choice field (home, local, public, hashtag, list)
  - `config` - JSON field for timeline-specific parameters
    - For hashtag: `{"hashtag": "python"}`
    - For list: `{"list_id": "12345", "list_name": "Tech News"}`
  - `is_active` - Timeline enabled/disabled
  - `last_status_id` - Last processed Mastodon status ID
  - `last_poll_attempt` - Timestamp of last poll attempt
  - `last_successful_poll` - Timestamp of last successful poll
  - `consecutive_failures` - Count of consecutive poll failures
  - `created_at`, `updated_at`

## Technical Implementation

### System Settings (Django settings + environment variables)
- `MASTODON_POLL_FREQUENCY` - Poll interval in seconds (default: 60)
- `MASTODON_EXCERPT_LENGTH` - Maximum excerpt length for titles (default: 100)
- `MASTODON_MAX_CONSECUTIVE_FAILURES` - Failures before auto-disable (default: 3)

### OAuth Integration
- Use Mastodon.py library for OAuth flow
- Request `read` scope permissions
- Server validation via exploratory API call before OAuth
- Store encrypted access tokens

### Polling Architecture
1. **Scheduled Task**: System-wide Celery task runs every minute
2. **User Iteration**: Finds all users with active Mastodon timelines
3. **Timeline Tasks**: Creates separate Celery task for each active timeline
4. **Rate Limiting**: Deferred for initial implementation

### Content Processing
1. **Link Detection**: Parse HTML content to extract links
2. **Multiple Links**: Create separate inbox item for each link found
3. **Content Filtering**: Ignore statuses without links
4. **Boost Handling**: Process boosted content, attribute to original author

### Inbox Item Creation
- **URL**: First/each link found in status content
- **Title**: Format as "user@server.com: spoiler_text or content_excerpt"
  - Content excerpt: HTML stripped, sentence boundary, 100 char max
- **Description**: Full Mastodon content with HTML formatting preserved
- **Tags**: Add Mastodon hashtags as regular user tags
- **Source**: Constructed from status author's account (`status.account.acct`)

### Error Handling & Monitoring
- **Polling Status**: Track and display last few poll attempts per timeline
- **Failure Handling**: 
  - Log errors, continue trying on next poll cycle
  - Auto-disable timeline after 3 consecutive failures
  - Track metrics for monitoring
- **Status Display**: Show success/failure, item counts, timestamps to users

### Management Commands
- Command to manually trigger timeline polls
- Should execute the same logic as scheduled task

## Success Criteria

- Users can successfully connect to multiple Mastodon accounts via OAuth
- Users can configure multiple timeline types per account
- System polls timelines every minute and creates inbox items for posts with links
- Inbox items maintain proper attribution and formatting
- Users can manage connections and view polling status
- Error handling gracefully manages failures without breaking the system
- Integration follows existing inbox UI/UX patterns

## Future Considerations

### Deferred Features
- Streaming API integration (replace polling)
- Advanced rate limiting and queuing
- User notifications for connection failures
- Media-only post handling
- Creating/posting to Mastodon (write scopes)
- Advanced hashtag discovery/suggestions
- User-level setting overrides

### Extensibility
- Timeline model designed to support additional timeline types
- JSON config field allows for flexible timeline parameters
- Polling architecture can be extended to other social platforms
- Error tracking system ready for enhanced monitoring