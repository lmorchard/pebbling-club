"""
Bookmarks views package.

This package organizes bookmark-related views into logical submodules:
- base: Base classes and mixins
- bookmarks: CRUD operations for bookmarks
- tags: Tag-related views
- export: Export functionality (Netscape, ActivityStream, OPML)
- import_views: Import functionality
- api: API endpoints and utilities
"""

# Import all views to maintain backward compatibility
from .base import BookmarkQueryListView, BookmarkAttachmentNames
from .bookmarks import (
    BookmarkListView,
    BookmarkCreateView,
    BookmarkUpdateView,
    BookmarkDeleteView,
)
from .tags import TagListView, TagDetailView
from .export import (
    BookmarkExportNetscapeView,
    BookmarkExportActivityStreamView,
    BookmarkExportOPMLView,
)
from .import_views import (
    BookmarkImportView,
    BookmarkImportSubmitView,
    BookmarkImportRetryView,
    BookmarkImportCancelView,
)
from .api import fetch_unfurl_metadata

__all__ = [
    # Base classes
    "BookmarkQueryListView",
    "BookmarkAttachmentNames",
    # Bookmark CRUD
    "BookmarkListView",
    "BookmarkCreateView",
    "BookmarkUpdateView",
    "BookmarkDeleteView",
    # Tags
    "TagListView",
    "TagDetailView",
    # Export
    "BookmarkExportNetscapeView",
    "BookmarkExportActivityStreamView",
    "BookmarkExportOPMLView",
    # Import
    "BookmarkImportView",
    "BookmarkImportSubmitView",
    "BookmarkImportRetryView",
    "BookmarkImportCancelView",
    # API
    "fetch_unfurl_metadata",
]
