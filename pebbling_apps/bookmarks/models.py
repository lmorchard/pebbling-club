from enum import StrEnum, auto
import hashlib
import contextlib
import functools
from django.conf import settings
from django.db import models
from django.conf import settings
from django.db import connection, connections
from django.contrib.auth import get_user_model
from django_prometheus.models import ExportModelOperationsMixin
from pebbling_apps.common.models import QueryPage, TimestampedModel
from pebbling_apps.common.utils import django_enum
from pebbling_apps.unfurl.models import UnfurlMetadataField
from urllib.parse import urlparse
from django.db.models import Case, When, Value, Q, F
from django.db.models.expressions import RawSQL
import logging


class TagManager(models.Manager):
    def parse_tag_string(self, tag_string, delimiter=" "):
        """Splits a string into a list of tag names."""
        return [tag.strip() for tag in tag_string.split(delimiter) if tag.strip()]

    def tags_to_string(self, tags_queryset, delimiter=" "):
        """Converts a queryset of Tag objects into a space-separated string."""
        return delimiter.join([str(tag.name) for tag in tags_queryset])


# ExportModelOperationsMixin is a factory function that returns a class dynamically
# mypy cannot analyze this pattern, but it's the standard django-prometheus usage
class Tag(ExportModelOperationsMixin("tag"), TimestampedModel):  # type: ignore[misc]
    objects = TagManager()
    name = models.CharField(max_length=64, unique=True)
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)

    def __str__(self):
        return self.name


@django_enum
class BookmarkSort(StrEnum):
    """Enum for sorting bookmarks."""

    DATE = auto()
    DATE_ASC = auto()
    DATE_DESC = auto()
    TITLE = auto()
    TITLE_ASC = auto()
    TITLE_DESC = auto()
    FEED = auto()
    FEED_ASC = auto()
    FEED_DESC = auto()


BOOKMARK_SORT_COLUMNS = {
    BookmarkSort.DATE: "-created_at",
    BookmarkSort.DATE_ASC: "created_at",
    BookmarkSort.DATE_DESC: "-created_at",
    BookmarkSort.TITLE: "title",
    BookmarkSort.TITLE_ASC: "title",
    BookmarkSort.TITLE_DESC: "-title",
    BookmarkSort.FEED: "-newest_item_date",
    BookmarkSort.FEED_ASC: "newest_item_date",
    BookmarkSort.FEED_DESC: "-newest_item_date",
}


class BookmarkWithFeedsQuerySet(models.QuerySet):
    """
    Custom QuerySet for Bookmark model that interacts with the feeds database.

    Kind of hacky and some queryset methods may be broken, mainly intended
    to support the option to sort bookmarks by last new feed item date.
    """

    def __init__(self, *args, **kwargs):
        self.feeds_db_alias = kwargs.pop("feeds_db_alias", None)
        self.feeds_db_path = kwargs.pop("feeds_db_path", None)
        super().__init__(*args, **kwargs)

    def _clone(self):
        """Override _clone to preserve custom attributes."""
        clone = super()._clone()
        clone.feeds_db_alias = self.feeds_db_alias
        clone.feeds_db_path = self.feeds_db_path
        return clone

    def _attach_db(self):
        if self.feeds_db_path and self.feeds_db_alias:
            with connections[self.db].cursor() as cursor:
                cursor.execute(
                    "ATTACH DATABASE %s AS %s",
                    [str(self.feeds_db_path), self.feeds_db_alias],
                )

    def _detach_db(self):
        if self.feeds_db_path and self.feeds_db_alias:
            with connections[self.db].cursor() as cursor:
                cursor.execute("DETACH DATABASE %s", [self.feeds_db_alias])

    def _fetch_all(self):
        self._attach_db()
        try:
            super()._fetch_all()
        finally:
            self._detach_db()

    def count(self):
        if self._result_cache is not None:
            return len(self._result_cache)

        self._attach_db()
        try:
            count = self.query.get_count(using=self.db)
        finally:
            self._detach_db()
        return count

    def with_feed_newest_item_date(self) -> "BookmarkWithFeedsQuerySet":
        clone = self._clone()

        # Use RawSQL to select the newest_item_date from the feeds database
        db_alias = self.feeds_db_alias
        clone = clone.annotate(
            feed_newest_item_date=RawSQL(
                f"""
                    SELECT {db_alias}.feeds_feed.newest_item_date
                    FROM {db_alias}.feeds_feed
                    WHERE {db_alias}.feeds_feed.url = bookmarks_bookmark.feed_url
                """,
                [],
            )
        )

        return clone

    def exclude_null_feed_dates(self) -> "BookmarkWithFeedsQuerySet":
        return self.exclude(feed_newest_item_date__isnull=True)

    def order_by_feed_newest_item_date(
        self, descending=True
    ) -> "BookmarkWithFeedsQuerySet":
        order_prefix = "-" if descending else ""
        return self.with_feed_newest_item_date().order_by(
            f"{order_prefix}feed_newest_item_date"
        )


class BookmarkManager(models.Manager):

    def generate_unique_hash_for_url(self, url):
        """Generate a unique hash for a given URL."""
        from .services import URLNormalizer

        normalizer = URLNormalizer()
        return normalizer.generate_hash(url)

    def get_queryset_with_feeds_db(
        self, feeds_db_alias="feeds_db", feeds_db_name="feeds_db"
    ):
        if getattr(settings, "SQLITE_MULTIPLE_DB", True):
            # Multiple database mode - use the cross-database queryset
            feeds_db_path = settings.DATABASES[feeds_db_name]["NAME"]
            return BookmarkWithFeedsQuerySet(
                model=self.model,
                using=self._db,
                hints=self._hints,
                feeds_db_path=feeds_db_path,
                feeds_db_alias=feeds_db_alias,
            )
        else:
            # Single database mode - return regular queryset
            return self.get_queryset()

    def update_or_create(self, url, defaults=None, **kwargs):
        """Override update_or_create to handle URL-based lookups."""
        defaults = defaults or {}

        # Generate hash from URL and move URL to defaults
        unique_hash = self.generate_unique_hash_for_url(url)
        defaults["url"] = url

        # Fetch existing item
        existing_item = self.filter(
            unique_hash=unique_hash, owner=kwargs.get("owner")
        ).first()

        if (
            existing_item
            and not existing_item.feed_url
            and existing_item.unfurl_metadata
            and existing_item.unfurl_metadata.feed
        ):
            defaults["feed_url"] = existing_item.unfurl_metadata.feed
        elif (
            "unfurl_metadata" in defaults
            and defaults["unfurl_metadata"].feed
            and "feed_url" not in defaults
        ):
            defaults["feed_url"] = defaults["unfurl_metadata"].feed

        return super().update_or_create(
            defaults=defaults, unique_hash=unique_hash, **kwargs
        )

    def query(
        self,
        owner=None,
        tags=None,
        search=None,
        since=None,
        sort=BookmarkSort.DATE,
    ):
        if sort in (BookmarkSort.FEED, BookmarkSort.FEED_ASC, BookmarkSort.FEED_DESC):
            if getattr(settings, "SQLITE_MULTIPLE_DB", True):
                # Multiple database mode - use cross-database queryset
                queryset = (
                    self.get_queryset_with_feeds_db()
                    .with_feed_newest_item_date()
                    .exclude_null_feed_dates()
                    .order_by_feed_newest_item_date(
                        descending=sort != BookmarkSort.FEED_DESC
                    )
                )
                if since:
                    queryset = queryset.filter(feed_newest_item_date__gte=since)
            else:
                # Single database mode - use subquery
                from pebbling_apps.feeds.models import Feed
                from django.db.models import Subquery, OuterRef

                feed_date_subquery = Feed.objects.filter(
                    url=OuterRef("feed_url")
                ).values("newest_item_date")[:1]

                queryset = (
                    self.get_queryset()
                    .annotate(feed_newest_item_date=Subquery(feed_date_subquery))
                    .exclude(feed_newest_item_date__isnull=True)
                )

                descending = sort != BookmarkSort.FEED_ASC
                order_prefix = "-" if descending else ""
                queryset = queryset.order_by(f"{order_prefix}feed_newest_item_date")

                if since:
                    queryset = queryset.filter(feed_newest_item_date__gte=since)

        elif sort in BOOKMARK_SORT_COLUMNS:
            queryset = self.get_queryset().order_by(BOOKMARK_SORT_COLUMNS[sort])
            if since:
                queryset = queryset.filter(created_at__gte=since)

        if owner:
            queryset = queryset.filter(owner=owner)

        if tags:
            tag_ids = Tag.objects.filter(name__in=tags).values_list("id", flat=True)
            queryset = queryset.filter(tags__id__in=tag_ids)

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(url__icontains=search)
                | Q(description__icontains=search)
                | Q(tags__name__icontains=search)
            ).distinct()

            queryset = queryset.annotate(
                search_rank=Case(
                    When(title__icontains=search, then=Value(1)),
                    When(description__icontains=search, then=Value(2)),
                    default=Value(3),
                    output_field=models.IntegerField(),
                )
            ).order_by("search_rank")

        return queryset


# ExportModelOperationsMixin is a factory function that returns a class dynamically
# mypy cannot analyze this pattern, but it's the standard django-prometheus usage
class Bookmark(ExportModelOperationsMixin("bookmark"), TimestampedModel):  # type: ignore[misc]
    """Bookmark model with url and title."""

    omit_html = getattr(settings, "OMIT_HTML_FROM_UNFURL_METADATA", True)

    objects = BookmarkManager()

    url = models.URLField(verbose_name="URL", max_length=10240)
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    unique_hash = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    tags = models.ManyToManyField("bookmarks.Tag", related_name="bookmarks", blank=True)

    unfurl_metadata = UnfurlMetadataField(blank=True, null=True, omit_html=omit_html)
    feed_url = models.URLField(blank=True, null=True, verbose_name="Feed URL")

    class Meta:
        unique_together = ["owner", "unique_hash"]

    def __str__(self):
        return self.title

    def generate_unique_hash(self):
        """Generate a SHA-1 hash based on the URL."""
        return self.__class__.objects.generate_unique_hash_for_url(self.url)

    def save(self, *args, **kwargs):
        """Standard save with unique_hash generation."""
        # Track if this is a create or update operation
        is_create = self.pk is None

        self.unique_hash = self.generate_unique_hash()
        result = super().save(*args, **kwargs)

        # Record metrics after successful save (with error handling)
        try:
            from .metrics import increment_bookmark_operation

            operation = "create" if is_create else "update"
            increment_bookmark_operation(operation, self.owner_id, "manual")
        except Exception:
            # Metrics collection should never break the save operation
            pass

        return result

    @property
    def host_name(self):
        """Extracts the host name from the bookmark URL."""
        return urlparse(self.url).hostname


class ImportJob(TimestampedModel):
    """Model to track bookmark import jobs."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    file_path = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    file_size = models.BigIntegerField()
    total_bookmarks = models.IntegerField(null=True, blank=True)
    processed_bookmarks = models.IntegerField(default=0)
    failed_bookmarks = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)
    failed_bookmark_details = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    import_options = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.status}"

    @property
    def progress_percentage(self):
        """Calculate the progress percentage if total_bookmarks is set."""
        if self.total_bookmarks and self.total_bookmarks > 0:
            return int((self.processed_bookmarks / self.total_bookmarks) * 100)
        return 0

    def update_progress(self, processed, failed=0):
        """Update progress efficiently with minimal database writes."""
        # Only update if progress changed significantly (1% or 10 records)
        if self.total_bookmarks:
            old_percentage = self.progress_percentage
            new_percentage = int((processed / self.total_bookmarks) * 100)

            # Update if percentage changed by 1% or processed changed by 10 or more
            if (
                abs(new_percentage - old_percentage) >= 1
                or abs(processed - self.processed_bookmarks) >= 10
                or failed != self.failed_bookmarks
            ):

                # Use F() expressions for atomic updates
                ImportJob.objects.filter(id=self.id).update(
                    processed_bookmarks=processed, failed_bookmarks=failed
                )
