"""Base classes and mixins for bookmark views."""

from django.views.generic import ListView
from django.http import HttpResponse, StreamingHttpResponse
from pebbling_apps.common.utils import django_enum, parse_since
from ..models import Bookmark, BookmarkSort
from ..serializers import MarkdownBookmarkSerializer
from enum import StrEnum, auto


@django_enum
class BookmarkAttachmentNames(StrEnum):
    NOTES = auto()
    FEED = auto()
    UNFURL = auto()


class BookmarkQueryListView(ListView):
    """Base class for bookmark list views with query support."""

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

    def get_format_parameter(self):
        """
        Extract the format parameter from request.GET.

        Returns:
            str: The format parameter value, normalized to lowercase with
                 whitespace stripped. Empty string if not provided.
        """
        return self.request.GET.get("format", "").lower().strip()

    def should_render_markdown(self):
        """
        Check if markdown format is requested via query parameter.

        Returns:
            bool: True if format=markdown parameter is present and valid,
                  False otherwise.
        """
        return self.get_format_parameter() == "markdown"

    def should_use_streaming_response(self, queryset):
        """
        Determine if we should use streaming response for large datasets.

        Args:
            queryset: The bookmark queryset to check

        Returns:
            bool: True if streaming should be used, False otherwise
        """
        # Use streaming for large result sets (>1000 bookmarks)
        # and when not paginated (limit parameter not set or very high)
        limit = self.get_paginate_by(queryset)
        return limit >= 1000 and queryset.count() > 1000

    def render_markdown_response(self):
        """
        Render the bookmark queryset as markdown and return HttpResponse.

        Uses the same queryset and pagination as the HTML view to ensure
        consistent behavior across formats.
        """
        # Get the same queryset that would be used for the HTML view
        queryset = self.get_queryset()

        # Optimize queryset for markdown rendering
        # We only need basic bookmark fields, not tags or complex relations
        queryset = queryset.only("url", "title", "description", "created_at")

        # Check if we should use streaming response for large datasets
        if self.should_use_streaming_response(queryset):
            return self.render_streaming_markdown_response(queryset)

        # Apply pagination to match HTML view behavior
        paginator = self.get_paginator(queryset, self.get_paginate_by(queryset))
        page_number = self.request.GET.get(self.page_kwarg, 1)
        page = paginator.get_page(page_number)

        # Serialize the bookmarks to markdown
        serializer = MarkdownBookmarkSerializer()
        markdown_content = serializer.serialize_to_markdown(page.object_list)

        # Return as plain text response
        response = HttpResponse(
            markdown_content, content_type="text/plain; charset=utf-8"
        )
        return response

    def render_streaming_markdown_response(self, queryset):
        """
        Render large bookmark querysets as streaming markdown response.

        Args:
            queryset: Optimized queryset for streaming

        Returns:
            StreamingHttpResponse: Streaming response for large datasets
        """
        serializer = MarkdownBookmarkSerializer()

        def generate_markdown():
            yield from serializer.stream_to_markdown(queryset)

        response = StreamingHttpResponse(
            generate_markdown(), content_type="text/plain; charset=utf-8"
        )
        return response

    def get(self, request, *args, **kwargs):
        """
        Handle GET requests with format routing.

        If format=markdown is requested, return markdown response.
        Otherwise, continue with normal HTML rendering.
        """
        if self.should_render_markdown():
            return self.render_markdown_response()

        # Continue with default HTML rendering
        return super().get(request, *args, **kwargs)
