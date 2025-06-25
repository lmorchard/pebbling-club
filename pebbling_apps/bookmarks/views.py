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


class BookmarkImportActivityStreamView(LoginRequiredMixin, View):
    """Import bookmarks from ActivityStream JSON-LD format."""

    def post(self, request):
        import time
        from django.db import transaction

        start_time = time.time()

        from .serializers import ActivityStreamSerializer

        # Validate request size (prevent DoS attacks)
        content_length = request.META.get("CONTENT_LENGTH")
        if content_length:
            try:
                content_length = int(content_length)
                max_size = 50 * 1024 * 1024  # 50MB limit
                if content_length > max_size:
                    return JsonResponse(
                        {
                            "error": f"Request too large. Maximum size is {max_size // (1024*1024)}MB"
                        },
                        status=413,
                    )
            except ValueError:
                pass  # Invalid content length header, continue

        # Check for skip_duplicates parameter (query param or JSON body)
        skip_duplicates = False

        # Check query parameter first
        if request.GET.get("skip_duplicates", "").lower() in ("true", "1"):
            skip_duplicates = True

        # Validate content type
        content_type = request.content_type
        if not content_type or not content_type.startswith("application/json"):
            return JsonResponse(
                {"error": "Content-Type must be application/json"}, status=400
            )

        try:
            # Parse JSON data with size validation
            import json

            request_body = request.body
            if len(request_body) > 50 * 1024 * 1024:  # 50MB limit
                return JsonResponse({"error": "Request body too large"}, status=413)

            json_data = json.loads(request_body.decode("utf-8"))

            # Check for skip_duplicates in JSON body (overrides query param)
            if isinstance(json_data, dict) and "skip_duplicates" in json_data:
                skip_duplicates = bool(json_data.get("skip_duplicates", False))
                # If data is wrapped, extract the actual ActivityStream data
                if "data" in json_data:
                    json_data = json_data["data"]

        except json.JSONDecodeError as e:
            return JsonResponse({"error": f"Invalid JSON: {str(e)}"}, status=400)
        except UnicodeDecodeError as e:
            return JsonResponse(
                {"error": f"Invalid UTF-8 encoding: {str(e)}"}, status=400
            )
        except MemoryError:
            return JsonResponse({"error": "Request too large to process"}, status=413)

        serializer = ActivityStreamSerializer()

        try:
            # Validate ActivityStream format
            collection_data = serializer.parse_collection(json_data)

            total_items = len(collection_data["items"])

            # Validate collection size
            max_items = 50000  # Prevent processing extremely large collections
            if total_items > max_items:
                return JsonResponse(
                    {
                        "error": f"Collection too large. Maximum {max_items} items allowed, got {total_items}"
                    },
                    status=413,
                )

            # Log start of import for large collections
            if total_items > 100:
                logger.info(
                    f"Starting import of {total_items} bookmarks for user {request.user.username}"
                )

            # Process bookmarks in batches within transactions
            imported_count = 0
            updated_count = 0
            skipped_count = 0
            errors = []

            batch_size = 100
            batches = [
                collection_data["items"][i : i + batch_size]
                for i in range(0, total_items, batch_size)
            ]

            for batch_num, batch in enumerate(batches):
                try:
                    with transaction.atomic():
                        for i, link_item in enumerate(batch):
                            try:
                                # Convert Link to bookmark data
                                bookmark_data = serializer.link_to_bookmark_data(
                                    link_item, request.user
                                )

                                # Extract tags for separate processing
                                tags_data = bookmark_data.pop("_tags", [])

                                # Remove timestamps for update_or_create (let Django handle them)
                                bookmark_data.pop("created_at", None)
                                bookmark_data.pop("updated_at", None)

                                # Create or update bookmark based on skip_duplicates setting
                                from .models import Bookmark

                                if skip_duplicates:
                                    # Use get_or_create to skip existing bookmarks
                                    bookmark, created = Bookmark.objects.get_or_create(
                                        url=bookmark_data["url"],
                                        owner=request.user,
                                        defaults=bookmark_data,
                                    )
                                    if created:
                                        imported_count += 1
                                    else:
                                        skipped_count += 1
                                else:
                                    # Use update_or_create to update existing bookmarks
                                    bookmark, created = (
                                        Bookmark.objects.update_or_create(
                                            url=bookmark_data["url"],
                                            owner=request.user,
                                            defaults=bookmark_data,
                                        )
                                    )
                                    if created:
                                        imported_count += 1
                                    else:
                                        updated_count += 1

                                # Process tags (always update tags, even for skipped duplicates)
                                if tags_data:
                                    bookmark_data["_tags"] = tags_data
                                    tags = serializer.process_bookmark_tags(
                                        bookmark_data, request.user
                                    )
                                    bookmark.tags.set(tags)

                            except Exception as e:
                                global_index = batch_num * batch_size + i
                                logger.error(
                                    f"Error processing bookmark {global_index}: {str(e)}"
                                )
                                errors.append(f"Item {global_index}: {str(e)}")

                        # Log progress for large imports
                        if total_items > 100:
                            progress = min(
                                100, ((batch_num + 1) * batch_size / total_items) * 100
                            )
                            logger.debug(
                                f"Import progress: {progress:.1f}% ({batch_num + 1}/{len(batches)} batches)"
                            )

                except Exception as e:
                    logger.error(f"Error processing batch {batch_num}: {str(e)}")
                    errors.append(f"Batch {batch_num} failed: {str(e)}")
                    # Continue with next batch instead of failing completely

            # Log completion timing and statistics
            end_time = time.time()
            duration = end_time - start_time

            logger.info(
                f"User {request.user.username} imported ActivityStream bookmarks",
                extra={
                    "user": request.user.username,
                    "format": "activitystream",
                    "skip_duplicates": skip_duplicates,
                    "total_items": total_items,
                    "imported": imported_count,
                    "updated": updated_count,
                    "skipped": skipped_count,
                    "errors": len(errors),
                    "duration_seconds": duration,
                    "items_per_second": total_items / duration if duration > 0 else 0,
                    "timestamp": datetime.datetime.now().isoformat(),
                },
            )

            response_data = {
                "imported": imported_count,
                "updated": updated_count,
                "skipped": skipped_count,
                "errors": errors,
                "processing_time_seconds": round(duration, 2),
                "total_items_processed": total_items,
            }

            # Return appropriate status code based on results
            if len(errors) > total_items // 2 and total_items > 1:
                # More than half failed - partial failure (only for multiple items)
                return JsonResponse(response_data, status=207)  # Multi-Status
            else:
                # Success or partial success - collection was processed successfully
                # even if individual items had errors
                return JsonResponse(response_data, status=200)

        except ValueError as e:
            logger.error(f"ActivityStream validation error: {str(e)}")
            return JsonResponse(
                {"error": f"Invalid ActivityStream format: {str(e)}"}, status=400
            )
        except transaction.TransactionManagementError as e:
            logger.error(
                f"Database transaction error during import: {str(e)}", exc_info=True
            )
            return JsonResponse(
                {
                    "error": "Database transaction failed. Import may be partially complete."
                },
                status=500,
            )
        except MemoryError:
            logger.error("Memory error during import - collection too large")
            return JsonResponse(
                {
                    "error": "Collection too large to process. Try importing smaller batches."
                },
                status=413,
            )
        except Exception as e:
            logger.error(f"Unexpected error during import: {str(e)}", exc_info=True)
            return JsonResponse({"error": f"Import failed: {str(e)}"}, status=500)


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
