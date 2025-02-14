from django.urls import path
from .views import (
    BookmarkListView,
    BookmarkCreateView,
    BookmarkUpdateView,
    BookmarkDeleteView,
    TagListView,
    TagDetailView,
)

app_name = "bookmarks"

urlpatterns = [
    path("", BookmarkListView.as_view(), name="list"),
    path("add/", BookmarkCreateView.as_view(), name="add"),
    path("<int:pk>/edit/", BookmarkUpdateView.as_view(), name="edit"),
    path("<int:pk>/delete/", BookmarkDeleteView.as_view(), name="delete"),
    path("tags/", TagListView.as_view(), name="tag_list"),  # List of all tags
    path(
        "tags/<str:tag_name>/", TagDetailView.as_view(), name="tag_detail"
    ),  # Bookmarks for a tag
]
