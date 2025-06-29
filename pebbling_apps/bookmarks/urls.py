from django.urls import path
from .views import (
    BookmarkListView,
    BookmarkCreateView,
    BookmarkUpdateView,
    BookmarkDeleteView,
    TagListView,
    TagDetailView,
    BookmarkExportNetscapeView,
    BookmarkExportActivityStreamView,
    BookmarkImportView,
    BookmarkImportSubmitView,
    BookmarkImportRetryView,
    BookmarkImportCancelView,
    fetch_unfurl_metadata,
)

app_name = "bookmarks"

urlpatterns = [
    path("bookmarks/", BookmarkListView.as_view(), name="list"),
    path("bookmarks/new", BookmarkCreateView.as_view(), name="add"),
    path("bookmarks/unfurl", fetch_unfurl_metadata, name="unfurl"),
    path(
        "bookmarks/export/netscape.html",
        BookmarkExportNetscapeView.as_view(),
        name="export_netscape",
    ),
    path(
        "bookmarks/export/activitystream.json",
        BookmarkExportActivityStreamView.as_view(),
        name="export_activitystream",
    ),
    # NOTE: Legacy ActivityStream import endpoint removed in favor of async import system
    path("import/", BookmarkImportView.as_view(), name="import"),
    path("import/submit/", BookmarkImportSubmitView.as_view(), name="import_submit"),
    path("import/retry/", BookmarkImportRetryView.as_view(), name="import_retry"),
    path("import/cancel/", BookmarkImportCancelView.as_view(), name="import_cancel"),
    path("bookmarks/<int:pk>/edit", BookmarkUpdateView.as_view(), name="edit"),
    path("bookmarks/<int:pk>/delete", BookmarkDeleteView.as_view(), name="delete"),
    path("t/", TagListView.as_view(), name="tag_list"),
    path("t/<str:tag_name>", TagDetailView.as_view(), name="tag_detail"),
]
