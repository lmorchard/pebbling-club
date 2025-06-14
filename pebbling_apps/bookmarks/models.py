from enum import StrEnum, auto
import hashlib
import contextlib
import functools
from django.conf import settings
from django.db import models
from django.conf import settings
from django.db import connection, connections
from django.contrib.auth import get_user_model
from pebbling_apps.common.models import QueryPage, TimestampedModel
from pebbling_apps.common.utils import django_enum
from pebbling_apps.unfurl.models import UnfurlMetadataField
from urllib.parse import urlparse
from django.db.models import Case, When, Value, Q
from django.db.models.expressions import RawSQL
import logging


class TagManager(models.Manager):
    def parse_tag_string(self, tag_string, delimiter=" "):
        """Splits a string into a list of tag names."""
        return [tag.strip() for tag in tag_string.split(delimiter) if tag.strip()]

    def tags_to_string(self, tags_queryset, delimiter=" "):
        """Converts a queryset of Tag objects into a space-separated string."""
        return delimiter.join([str(tag.name) for tag in tags_queryset])


class Tag(TimestampedModel):
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
        return hashlib.sha1(url.encode("utf-8")).hexdigest()

    def get_queryset_with_feeds_db(
        self, feeds_db_alias="feeds_db", feeds_db_name="feeds_db"
    ):
        feeds_db_path = settings.DATABASES[feeds_db_name]["NAME"]
        return BookmarkWithFeedsQuerySet(
            model=self.model,
            using=self._db,
            hints=self._hints,
            feeds_db_path=feeds_db_path,
            feeds_db_alias=feeds_db_alias,
        )

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
            # Feed-related sorting is weird - attach the feeds database, sort
            # and filter based on the newest_item_date column
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


class Bookmark(TimestampedModel):
    """Bookmark model with url and title."""

    omit_html = getattr(settings, "OMIT_HTML_FROM_UNFURL_METADATA", True)

    objects = BookmarkManager()

    url = models.URLField(verbose_name="URL")
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
        self.unique_hash = self.generate_unique_hash()
        return super().save(*args, **kwargs)

    @property
    def host_name(self):
        """Extracts the host name from the bookmark URL."""
        return urlparse(self.url).hostname
