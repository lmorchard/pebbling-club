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
    path("bookmarks/", BookmarkListView.as_view(), name="list"),
    path("add", BookmarkCreateView.as_view(), name="add"),
    path("bookmark/<int:pk>/edit", BookmarkUpdateView.as_view(), name="edit"),
    path("bookmark/<int:pk>/delete", BookmarkDeleteView.as_view(), name="delete"),
    path("t/", TagListView.as_view(), name="tag_list"),
    path("t/<str:tag_name>", TagDetailView.as_view(), name="tag_detail"),
]
