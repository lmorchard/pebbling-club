from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.urls import reverse_lazy
from django.shortcuts import render, get_object_or_404
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.core.exceptions import PermissionDenied
from pebbling_apps.bookmarks.models import Bookmark, Tag
from pebbling_apps.bookmarks.forms import BookmarkForm
from urllib.parse import quote, unquote
from django.db.models import Q

from pebbling_apps.bookmarks.models import Bookmark
from .forms import ProfileUpdateForm
from pebbling_apps.users.models import CustomUser
from pebbling_apps.common.utils import filter_bookmarks


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


def get_paginate_limit(request, default_limit=100):
    """Utility function to get pagination limit from query parameters."""
    limit = request.GET.get("limit", default_limit)
    return int(limit) if str(limit).isdigit() else default_limit


class ProfileBookmarkListView(ListView):
    model = Bookmark
    template_name = "profiles/profile_view.html"
    context_object_name = "bookmarks"

    def get_paginate_by(self, queryset):
        return get_paginate_limit(self.request)

    def get_queryset(self):
        username = self.kwargs.get("username")
        user = get_object_or_404(CustomUser, username=username)
        queryset = Bookmark.objects.filter(owner=user).order_by("-created_at")

        query = self.request.GET.get("q")
        queryset = filter_bookmarks(queryset, query)  # Use the utility function
        return queryset


class ProfileTagDetailView(ListView):
    model = Bookmark
    template_name = "profiles/tag_detail.html"
    context_object_name = "bookmarks"

    def get_paginate_by(self, queryset):
        return get_paginate_limit(self.request)

    def get_queryset(self):
        """Return all bookmarks linked to a specific tag."""
        username = self.kwargs.get("username")  # Get the username from the URL
        user = get_object_or_404(CustomUser, username=username)  # Look up the user
        # Double-decode to restore the original tag name
        self.tag_name = unquote(unquote(self.kwargs["tag_name"]))
        self.tag = get_object_or_404(Tag, name=self.tag_name, owner=user)
        return self.tag.bookmarks.all().order_by("-created_at")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["tag_name"] = self.tag_name
        return context
