"""Tag-related views."""

from django.views.generic import ListView
from urllib.parse import unquote

from ..models import Bookmark, Tag
from .base import BookmarkQueryListView


class TagListView(ListView):
    """View to show all tags belonging to the user."""

    model = Tag
    template_name = "bookmarks/tag_list.html"
    context_object_name = "tags"

    def get_paginate_by(self, queryset):
        default_limit = 100
        limit = self.request.GET.get("limit", default_limit)
        return int(limit) if str(limit).isdigit() else default_limit

    def get_queryset(self):
        """Return tags only for the logged-in user."""
        return Tag.objects.order_by("name")


class TagDetailView(BookmarkQueryListView):
    """View to show all bookmarks associated with a specific tag."""

    model = Bookmark
    template_name = "bookmarks/tag_detail.html"
    context_object_name = "bookmarks"

    def get_query_kwargs(self):
        self.tag_name = unquote(unquote(self.kwargs["tag_name"]))
        return {
            **super().get_query_kwargs(),
            "tags": [self.tag_name],
        }
