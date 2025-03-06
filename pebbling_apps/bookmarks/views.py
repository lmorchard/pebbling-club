from django.contrib.auth.decorators import login_required
from django.urls import reverse_lazy
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.core.exceptions import PermissionDenied
from .models import Bookmark, Tag
from .forms import BookmarkForm
from urllib.parse import quote, unquote
from django.db import models
from django.db.models import Q
from pebbling_apps.common.utils import filter_bookmarks
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from django.http import JsonResponse
from django.views.decorators.http import require_GET


def get_paginate_limit(request, default_limit=10):
    """Utility function to get pagination limit from query parameters."""
    limit = request.GET.get("limit", default_limit)
    return int(limit) if str(limit).isdigit() else default_limit


# List View: Show all bookmarks for the logged-in user
class BookmarkListView(ListView):
    model = Bookmark
    template_name = "bookmarks/bookmark_list.html"
    context_object_name = "bookmarks"

    def get_paginate_by(self, queryset):
        return get_paginate_limit(self.request)

    def get_queryset(self):
        queryset = Bookmark.objects.order_by("-created_at")
        query = self.request.GET.get("q")
        queryset = filter_bookmarks(queryset, query)  # Use the utility function
        return queryset


# Create View: Add a new bookmark
class BookmarkCreateView(CreateView):
    model = Bookmark
    template_name = "bookmarks/bookmark_form.html"
    form_class = BookmarkForm
    success_url = reverse_lazy("bookmarks:list")

    def get_initial(self):
        """Pre-populate form with query parameters or existing bookmark data."""
        initial = super().get_initial()
        url = self.request.GET.get("url", "")

        if url:
            self.existing_bookmark = Bookmark.objects.filter(
                owner=self.request.user,
                unique_hash=Bookmark.objects.generate_unique_hash_for_url(url),
            ).first()

            if self.existing_bookmark:
                initial.update(
                    {
                        "url": self.existing_bookmark.url,
                        "title": self.existing_bookmark.title,
                        "description": self.existing_bookmark.description,
                        "tags": " ".join(
                            tag.name for tag in self.existing_bookmark.tags.all()
                        ),
                        "unfurl_metadata": self.existing_bookmark.unfurl_metadata,
                    }
                )
                return initial

            # No existing bookmark - try to fetch metadata
            try:
                unfurl_metadata = UnfurlMetadata(url=url)
                unfurl_metadata.unfurl()  # Fetch and parse metadata

                initial.update(
                    {
                        "url": url,
                        "title": self.request.GET.get("title", unfurl_metadata.title),
                        "description": self.request.GET.get(
                            "description",
                            unfurl_metadata.description,
                        ),
                        "tags": self.request.GET.get("tags", ""),
                        "unfurl_metadata": unfurl_metadata,
                    }
                )
            except Exception as e:
                # If metadata fetch fails, just use query parameters
                initial.update(
                    {
                        "url": url,
                        "title": self.request.GET.get("title", ""),
                        "description": self.request.GET.get("description", ""),
                        "tags": self.request.GET.get("tags", ""),
                    }
                )

        return initial

    def get_context_data(self, **kwargs):
        """Add existing bookmark info and layout mode to context."""
        context = super().get_context_data(**kwargs)
        if hasattr(self, "existing_bookmark"):
            context["existing_bookmark"] = self.existing_bookmark
        # Add minimal_layout flag if popup parameter is present
        context["minimal_layout"] = "popup" in self.request.GET
        return context

    def get_form_kwargs(self):
        """Pass the current user to the form."""
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        """Handle successful form submission with custom redirect logic."""
        form.instance.owner = self.request.user
        self.object = form.save()

        # Check for next parameter
        next_param = self.request.GET.get("next")
        if next_param == "close":
            return render(
                self.request,
                "bookmarks/bookmark_create_close.html",
                {"bookmark": self.object},
            )
        elif next_param == "profile":
            return redirect("profiles:view", username=self.request.user.username)
        elif next_param == "same":
            return redirect(self.object.url)

        return super().form_valid(form)


class BookmarkUpdateView(UpdateView):
    model = Bookmark
    form_class = BookmarkForm
    template_name = "bookmarks/bookmark_form.html"
    success_url = reverse_lazy("bookmarks:list")

    def get_form_kwargs(self):
        """Pass the current user to the form."""
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def get_object(self, queryset=None):
        bookmark = super().get_object(queryset)
        if bookmark.owner != self.request.user:
            raise PermissionDenied  # Prevent unauthorized editing
        return bookmark


class BookmarkDeleteView(DeleteView):
    model = Bookmark
    template_name = "bookmarks/bookmark_confirm_delete.html"
    success_url = reverse_lazy("bookmarks:list")

    def get_object(self, queryset=None):
        bookmark = super().get_object(queryset)
        if bookmark.owner != self.request.user:
            raise PermissionDenied  # Prevent unauthorized deletion
        return bookmark


# View to show all tags belonging to the user
class TagListView(ListView):
    model = Tag
    template_name = "bookmarks/tag_list.html"
    context_object_name = "tags"

    def get_paginate_by(self, queryset):
        return get_paginate_limit(self.request)

    def get_queryset(self):
        """Return tags only for the logged-in user."""
        return Tag.objects.order_by("name")


# View to show all bookmarks associated with a specific tag
class TagDetailView(ListView):
    model = Bookmark
    template_name = "bookmarks/tag_detail.html"
    context_object_name = "bookmarks"

    def get_paginate_by(self, queryset):
        return get_paginate_limit(self.request)

    def get_queryset(self):
        """Return all bookmarks linked to a specific tag, regardless of owner."""
        self.tag_name = unquote(
            unquote(self.kwargs["tag_name"])
        )  # Get the single tag name
        tags = Tag.objects.filter(name=self.tag_name)  # Get the tag matching the name
        return (
            Bookmark.objects.filter(tags__in=tags).distinct().order_by("-created_at")
        )  # Get bookmarks for that tag

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["tag_name"] = self.tag_name
        return context


@login_required
@require_GET
def fetch_unfurl_metadata(request):
    """Fetch and return UnfurlMetadata for a given URL.
    Primarily in support of pc-bookmark-form
    """
    url = request.GET.get("href")
    if not url:
        return JsonResponse({"error": "Missing href parameter"}, status=400)

    try:
        metadata = UnfurlMetadata(url=url)
        metadata.unfurl()
        out = metadata.to_dict(omit_html=True)
        out["title"] = metadata.title
        out["description"] = metadata.description
        return JsonResponse(out)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
