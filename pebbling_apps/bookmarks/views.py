from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.views.generic import (
    ListView,
    CreateView,
    UpdateView,
    DeleteView,
    TemplateView,
)
from django.views import View
from django.core.exceptions import PermissionDenied
import logging

from .models import Bookmark, BookmarkSort, Tag, ImportJob
from .forms import BookmarkForm, ImportJobForm
from .services import save_import_file
from .serializers import MarkdownBookmarkSerializer
from urllib.parse import quote, unquote
from django.db import models
from django.db.models import Q
from pebbling_apps.common.utils import django_enum, parse_since
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from django.http import (
    JsonResponse,
    StreamingHttpResponse,
    HttpResponseBadRequest,
    HttpResponse,
)
from django.utils.html import escape
from django.views.decorators.http import require_GET
from enum import StrEnum, auto
from django.utils import timezone

import datetime
import json


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


# Create View: Add a new bookmark
class BookmarkCreateView(LoginRequiredMixin, CreateView):
    model = Bookmark
    template_name = "bookmarks/bookmark_form.html"
    form_class = BookmarkForm
    success_url = reverse_lazy("bookmarks:list")

    def get_initial(self):
        """Pre-populate form with query parameters or existing bookmark data."""
        initial = super().get_initial()
        url = self.request.GET.get("url", "")

        if url and self.request.user.is_authenticated:
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


class BookmarkUpdateView(LoginRequiredMixin, UpdateView):
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


class BookmarkDeleteView(LoginRequiredMixin, DeleteView):
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


class BookmarkExportActivityStreamView(LoginRequiredMixin, View):
    """Export bookmarks in ActivityStream JSON-LD format."""

    def validate_tags(self, request):
        """
        Validate tag parameters from request.

        Returns:
            Tuple of (tags_list, error_response) where error_response is None on success
        """
        tags = request.GET.getlist("tag")
        if tags:
            for tag_name in tags:
                if not Tag.objects.filter(name=tag_name).exists():
                    return None, HttpResponseBadRequest(
                        f"Tag '{tag_name}' does not exist"
                    )
        return tags, None

    def validate_since(self, request):
        """
        Validate and parse since parameter from request.

        Returns:
            Tuple of (since_date, error_response) where error_response is None on success
        """
        since = request.GET.get("since")
        since_date = None
        if since:
            try:
                since_date = parse_since(since)
            except Exception as e:
                return None, HttpResponseBadRequest(
                    f"Invalid 'since' parameter: {str(e)}"
                )
        return since_date, None

    def validate_limit(self, request):
        """
        Validate limit parameter from request.

        Returns:
            Tuple of (limit_value, error_response) where error_response is None on success
        """
        limit = request.GET.get("limit")
        limit_value = None
        if limit:
            try:
                limit_value = int(limit)
                if limit_value <= 0:
                    return None, HttpResponseBadRequest(
                        "Limit must be a positive integer"
                    )
            except ValueError:
                return None, HttpResponseBadRequest(
                    "Invalid 'limit' parameter: must be an integer"
                )
        return limit_value, None

    def get(self, request):
        import time

        start_time = time.time()

        from .serializers import ActivityStreamSerializer
        from .streaming import StreamingJSONResponse, stream_bookmark_collection

        # Validate all parameters before processing
        tags, tags_error = self.validate_tags(request)
        if tags_error:
            return tags_error

        since_date, since_error = self.validate_since(request)
        if since_error:
            return since_error

        limit_value, limit_error = self.validate_limit(request)
        if limit_error:
            return limit_error

        serializer = ActivityStreamSerializer()

        def generate():
            try:
                # Get user's bookmarks with optimized prefetching
                bookmarks = (
                    Bookmark.objects.query(owner=request.user)
                    .prefetch_related("tags")
                    .select_related("owner")  # Optimize owner queries
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

                # Get count before applying limit for accurate totalItems
                total_count = bookmarks.count()

                # Apply limit if requested
                if limit_value:
                    bookmarks = bookmarks[:limit_value]

                # Create collection metadata with accurate count
                collection_metadata = {
                    "@context": [
                        serializer.ACTIVITY_STREAMS_CONTEXT,
                        serializer.PEBBLING_CONTEXT,
                    ],
                    "type": "Collection",
                    "published": datetime.datetime.now().isoformat(),
                    "totalItems": total_count,
                }

                # Log start of streaming for large exports
                if total_count > 100:
                    logger.info(
                        f"Starting large export of {total_count} bookmarks for user {request.user.username}"
                    )

                # Stream the collection using iterator for memory efficiency
                chunk_size = (
                    min(50, max(10, total_count // 10)) if total_count > 0 else 50
                )
                yield from stream_bookmark_collection(
                    collection_metadata,
                    bookmarks.iterator(chunk_size=chunk_size),
                    serializer,
                )

                # Log completion timing for performance monitoring
                end_time = time.time()
                duration = end_time - start_time
                logger.info(
                    f"Export completed in {duration:.2f}s for {total_count} bookmarks"
                )

            except Exception as e:
                logger.error(
                    f"Error during ActivityStream bookmark export: {str(e)}",
                    exc_info=True,
                )
                # Yield error collection on failure
                error_collection = {
                    "@context": "https://www.w3.org/ns/activitystreams",
                    "type": "Collection",
                    "published": datetime.datetime.now().isoformat(),
                    "totalItems": 0,
                    "items": [],
                    "error": f"Export failed: {str(e)}",
                }
                yield json.dumps(error_collection)

        response = StreamingJSONResponse(generate())

        # Add performance and security headers
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d")
        filename = f"pebbling_club_bookmarks_activitystream_{timestamp}.json"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        response["Expires"] = "0"

        # Log export activity with parameter information
        logger.info(
            f"User {request.user.username} exported bookmarks as ActivityStream",
            extra={
                "user": request.user.username,
                "format": "activitystream",
                "tags": tags,
                "since": request.GET.get("since"),
                "limit": limit_value,
                "timestamp": datetime.datetime.now().isoformat(),
                "duration_seconds": time.time() - start_time,
            },
        )

        return response


class BookmarkExportOPMLView(LoginRequiredMixin, View):
    """Export bookmarks in OPML 2.0 format."""

    def get(self, request):
        from .exporters import OPMLBookmarkExporter

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

        exporter = OPMLBookmarkExporter()

        def generate():
            try:
                yield exporter.generate_header(user=request.user)

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
                logger.error(
                    f"Error during OPML bookmark export: {str(e)}", exc_info=True
                )
                yield f"\n<!-- ERROR: Export failed: {escape(str(e))} -->\n"
                yield exporter.generate_footer()

        response = StreamingHttpResponse(
            generate(), content_type="application/xml; charset=utf-8"
        )

        # Add Content-Disposition header with timestamp
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d")
        filename = f"pebbling_club_bookmarks_{timestamp}.opml"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        # Log export activity
        logger.info(
            f"User {request.user.username} exported bookmarks as OPML",
            extra={
                "user": request.user.username,
                "format": "opml",
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


class BookmarkImportView(LoginRequiredMixin, TemplateView):
    """Display the import page with form and job list."""

    template_name = "bookmarks/import.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["form"] = ImportJobForm()
        import_jobs = ImportJob.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )
        context["import_jobs"] = import_jobs

        # Check if any jobs are pending or processing to enable auto-refresh
        context["needs_refresh"] = import_jobs.filter(
            status__in=["pending", "processing"]
        ).exists()

        return context


class BookmarkImportSubmitView(LoginRequiredMixin, View):
    """Handle import form submission."""

    def post(self, request):
        form = ImportJobForm(request.POST, request.FILES)

        if form.is_valid():
            # Save the uploaded file
            uploaded_file = form.cleaned_data["file"]
            file_path = save_import_file(uploaded_file, request.user)

            # Create import job
            import_job = ImportJob.objects.create(
                user=request.user,
                file_path=file_path,
                file_size=uploaded_file.size,
                import_options={
                    "duplicate_handling": form.cleaned_data["duplicate_handling"]
                },
            )

            # Trigger async processing task
            from .tasks import process_import_job

            process_import_job.delay(import_job.id)

            messages.success(
                request, "Import job has been queued for background processing."
            )
            return redirect("bookmarks:import")
        else:
            # Add form errors to messages
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f"{field}: {error}")
            return redirect("bookmarks:import")


class BookmarkImportRetryView(LoginRequiredMixin, View):
    """Handle retry action for failed import jobs."""

    def post(self, request):
        import_job_id = request.POST.get("import_job_id")

        if not import_job_id:
            messages.error(request, "Invalid import job.")
            return redirect("bookmarks:import")

        try:
            import_job = ImportJob.objects.get(id=import_job_id, user=request.user)

            if import_job.status != "failed":
                messages.error(request, "Only failed imports can be retried.")
                return redirect("bookmarks:import")

            # Reset job to pending status
            import_job.status = "pending"
            import_job.error_message = None
            import_job.failed_bookmark_details = []
            import_job.processed_bookmarks = 0
            import_job.failed_bookmarks = 0
            import_job.started_at = None
            import_job.completed_at = None
            import_job.save()

            # Trigger the processing task again
            from .tasks import process_import_job

            process_import_job.delay(import_job.id)

            messages.success(request, "Import job has been queued for retry.")

        except ImportJob.DoesNotExist:
            messages.error(request, "Import job not found.")
        except Exception as e:
            messages.error(request, f"Failed to retry import: {str(e)}")

        return redirect("bookmarks:import")


class BookmarkImportCancelView(LoginRequiredMixin, View):
    """Handle cancel action for pending/processing import jobs."""

    def post(self, request):
        import_job_id = request.POST.get("import_job_id")

        if not import_job_id:
            messages.error(request, "Invalid import job.")
            return redirect("bookmarks:import")

        try:
            import_job = ImportJob.objects.get(id=import_job_id, user=request.user)

            if import_job.status not in ["pending", "processing"]:
                messages.error(
                    request, "Only pending or processing imports can be cancelled."
                )
                return redirect("bookmarks:import")

            # Update status to cancelled
            import_job.status = "cancelled"
            import_job.completed_at = timezone.now()
            import_job.save()

            # TODO: Attempt to revoke the Celery task if it's still pending
            # This would require task ID tracking or other task management

            messages.success(request, "Import job has been cancelled.")

        except ImportJob.DoesNotExist:
            messages.error(request, "Import job not found.")
        except Exception as e:
            messages.error(request, f"Failed to cancel import: {str(e)}")

        return redirect("bookmarks:import")
