from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.views import View
from django.core.exceptions import PermissionDenied
import logging

from .models import Bookmark, BookmarkSort, Tag
from .forms import BookmarkForm
from urllib.parse import quote, unquote
from django.db import models
from django.db.models import Q
from pebbling_apps.common.utils import django_enum, parse_since
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from django.http import (
    JsonResponse,
    StreamingHttpResponse,
    HttpResponseBadRequest,
)
from django.utils.html import escape
from django.views.decorators.http import require_GET
from enum import StrEnum, auto

import datetime


@django_enum
class BookmarkAttachmentNames(StrEnum):
    NOTES = auto()
    FEED = auto()
    UNFURL = auto()


# Create logger for this app
logger = logging.getLogger("pebbling_apps.bookmarks")


class BookmarkQueryListView(ListView):
    def get_paginate_by(self, queryset=None):
        limit = self.request.GET.get("limit", 10)
        return int(limit) if str(limit).isdigit() else 10

    def get_query_kwargs(self):
        kwargs = {
            "search": self.request.GET.get("q"),
            "sort": self.request.GET.get("sort", BookmarkSort.DATE_DESC),
        }

        since = self.request.GET.get("since")
        if since:
            kwargs["since"] = parse_since(since)

        return kwargs

    def get_queryset(self):
        return Bookmark.objects.query(**self.get_query_kwargs())

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Copy all the bookmark query kwargs to the template context with a prefix
        query_kwargs = self.get_query_kwargs()
        for key, value in query_kwargs.items():
            context[f"bookmark_query_{key}"] = value

        return context


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


# List View: Show all bookmarks for the logged-in user
class BookmarkListView(BookmarkQueryListView):
    model = Bookmark
    template_name = "bookmarks/bookmark_list.html"
    context_object_name = "bookmarks"


# View to show all tags belonging to the user
class TagListView(ListView):
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


# View to show all bookmarks associated with a specific tag
class TagDetailView(BookmarkQueryListView):
    model = Bookmark
    template_name = "bookmarks/tag_detail.html"
    context_object_name = "bookmarks"

    def get_query_kwargs(self):
        self.tag_name = unquote(unquote(self.kwargs["tag_name"]))
        return {
            **super().get_query_kwargs(),
            "tags": [self.tag_name],
        }


class BookmarkExportNetscapeView(LoginRequiredMixin, View):
    """Export bookmarks in Netscape HTML format."""

    def get(self, request):
        from .exporters import NetscapeBookmarkExporter

        # Validate tag parameters before processing
        tags = request.GET.getlist("tag")
        if tags:
            for tag_name in tags:
                if not Tag.objects.filter(name=tag_name).exists():
                    return HttpResponseBadRequest(f"Tag '{tag_name}' does not exist")

        # Validate and parse since parameter
        since = request.GET.get("since")
        since_date = None
        if since:
            try:
                since_date = parse_since(since)
            except Exception as e:
                return HttpResponseBadRequest(f"Invalid 'since' parameter: {str(e)}")

        # Validate limit parameter
        limit = request.GET.get("limit")
        limit_value = None
        if limit:
            try:
                limit_value = int(limit)
                if limit_value <= 0:
                    return HttpResponseBadRequest("Limit must be a positive integer")
            except ValueError:
                return HttpResponseBadRequest(
                    "Invalid 'limit' parameter: must be an integer"
                )

        exporter = NetscapeBookmarkExporter()

        def generate():
            try:
                yield exporter.generate_header()

                # Get user's bookmarks with prefetched tags
                bookmarks = Bookmark.objects.query(owner=request.user).prefetch_related(
                    "tags"
                )

                # Apply tag filtering if requested
                if tags:
                    # Filter bookmarks that have ALL specified tags
                    for tag_name in tags:
                        bookmarks = bookmarks.filter(tags__name=tag_name)
                    bookmarks = bookmarks.distinct()

                # Apply date filtering if requested
                if since_date:
                    bookmarks = bookmarks.filter(created_at__gte=since_date)

                # Apply limit if requested
                if limit_value:
                    bookmarks = bookmarks[:limit_value]

                # Generate bookmarks using iterator for memory efficiency
                for bookmark_content in exporter.generate_bookmarks(
                    bookmarks.iterator(chunk_size=100)
                ):
                    yield bookmark_content

                yield exporter.generate_footer()
            except Exception as e:
                logger.error(f"Error during bookmark export: {str(e)}", exc_info=True)
                yield f"\n<!-- ERROR: Export failed: {escape(str(e))} -->\n"
                yield exporter.generate_footer()

        response = StreamingHttpResponse(
            generate(), content_type="text/html; charset=utf-8"
        )

        # Add Content-Disposition header with timestamp
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d")
        filename = f"pebbling_club_bookmarks_{timestamp}.html"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        # Log export activity
        logger.info(
            f"User {request.user.username} exported bookmarks",
            extra={
                "user": request.user.username,
                "tags": tags,
                "since": since,
                "limit": limit,
                "timestamp": datetime.datetime.now().isoformat(),
            },
        )

        return response


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
