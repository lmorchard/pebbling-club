"""Export functionality views."""

import datetime
import json
import logging
import time

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import StreamingHttpResponse, HttpResponseBadRequest
from django.utils.html import escape
from django.views import View

from pebbling_apps.common.utils import parse_since
from ..models import Bookmark, Tag
from ..exporters import NetscapeBookmarkExporter, OPMLBookmarkExporter
from ..serializers import ActivityStreamSerializer
from ..streaming import StreamingJSONResponse, stream_bookmark_collection

logger = logging.getLogger("pebbling_apps.bookmarks")


class ExportParameterValidationMixin:
    """Mixin for validating common export parameters."""

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


class BookmarkExportNetscapeView(
    LoginRequiredMixin, ExportParameterValidationMixin, View
):
    """Export bookmarks in Netscape HTML format."""

    def get(self, request):
        # Validate all parameters
        tags, tags_error = self.validate_tags(request)
        if tags_error:
            return tags_error

        since_date, since_error = self.validate_since(request)
        if since_error:
            return since_error

        limit_value, limit_error = self.validate_limit(request)
        if limit_error:
            return limit_error

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
                "since": request.GET.get("since"),
                "limit": limit_value,
                "timestamp": datetime.datetime.now().isoformat(),
            },
        )

        return response


class BookmarkExportActivityStreamView(
    LoginRequiredMixin, ExportParameterValidationMixin, View
):
    """Export bookmarks in ActivityStream JSON-LD format."""

    def get(self, request):
        start_time = time.time()

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


class BookmarkExportOPMLView(LoginRequiredMixin, ExportParameterValidationMixin, View):
    """Export bookmarks in OPML 2.0 format."""

    def get(self, request):
        # Validate all parameters
        tags, tags_error = self.validate_tags(request)
        if tags_error:
            return tags_error

        since_date, since_error = self.validate_since(request)
        if since_error:
            return since_error

        limit_value, limit_error = self.validate_limit(request)
        if limit_error:
            return limit_error

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
                "since": request.GET.get("since"),
                "limit": limit_value,
                "timestamp": datetime.datetime.now().isoformat(),
            },
        )

        return response
