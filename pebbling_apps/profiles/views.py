from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.urls import reverse_lazy
from django.shortcuts import render, get_object_or_404
from django.http import Http404
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.core.exceptions import PermissionDenied
from django.core.paginator import InvalidPage, Paginator
from pebbling_apps.bookmarks.models import Bookmark, Tag
from pebbling_apps.bookmarks.forms import BookmarkForm
from urllib.parse import quote, unquote
from django.db.models import Q

from pebbling_apps.bookmarks.models import Bookmark, BookmarkSort
from pebbling_apps.bookmarks.views import (
    BookmarkAttachmentNames,
    BookmarksQueryPageListView,
)
from pebbling_apps.common.views import QueryPageListView
from .forms import ProfileUpdateForm
from pebbling_apps.users.models import CustomUser
from pebbling_apps.common.utils import filter_bookmarks
import logging


@login_required
def profile_index(request):
    return redirect("profiles:view", request.user.username)


@login_required
def profile_edit(request, username):
    profile = request.user.profile  # Get the user's profile
    if request.user.username != username:
        raise PermissionDenied("You do not have permission to edit this profile.")
    if request.method == "POST":
        form = ProfileUpdateForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            return redirect("profile")  # Redirect to profile page after saving
    else:
        form = ProfileUpdateForm(instance=profile)
    return render(request, "profiles/profile_edit.html", {"form": form})


class ProfileBookmarkListView(BookmarksQueryPageListView):
    model = Bookmark
    template_name = "profiles/profile_view.html"
    context_object_name = "bookmarks"

    def get_queryset(self):
        username = self.kwargs.get("username")
        user = get_object_or_404(CustomUser, username=username)

        return Bookmark.objects.query_page(
            **self.get_query_page_kwargs(),
            owner=user,
        )


class ProfileTagDetailView(BookmarksQueryPageListView):
    model = Bookmark
    template_name = "profiles/tag_detail.html"
    context_object_name = "bookmarks"

    def get_queryset(self):
        """Return all bookmarks linked to a specific tag."""
        username = self.kwargs.get("username")  # Get the username from the URL
        user = get_object_or_404(CustomUser, username=username)  # Look up the user
        self.tag_name = unquote(
            unquote(self.kwargs["tag_name"])
        )  # Double-decode to restore the original tag name
        self.tag = get_object_or_404(Tag, name=self.tag_name, owner=user)

        return Bookmark.objects.query_page(
            **self.get_query_page_kwargs(),
            owner=user,
            tags=[self.tag_name],
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["tag_name"] = self.tag_name
        context["search_query"] = self.request.GET.get(
            "q", ""
        )  # Pass the search query to the context
        return context
