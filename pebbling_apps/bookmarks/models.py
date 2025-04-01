from enum import StrEnum, auto
import hashlib
import contextlib
import functools
from django.conf import settings
from django.db import models
from django.conf import settings
from django.db import connection, connections
from django.contrib.auth import get_user_model
from pebbling_apps.common.models import TimestampedModel
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

    DATE_ASC = auto()
    DATE_DESC = auto()
    TITLE_ASC = auto()
    TITLE_DESC = auto()
    FEED_ASC = auto()
    FEED_DESC = auto()


class BookmarkFeedsQuerySet(models.QuerySet):
    """QuerySet for bookmarks with feed-related capabilities."""

    def __init__(self, *args, **kwargs):
        self.feeds_db_alias = kwargs.pop("feeds_db_alias", None)
        super().__init__(*args, **kwargs)

    def _clone(self):
        """Override _clone to preserve custom attributes."""
        clone = super()._clone()
        clone.feeds_db_alias = self.feeds_db_alias
        return clone

    def with_feed_newest_item_date(self) -> "BookmarkFeedsQuerySet":
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

    def exclude_null_feed_dates(self) -> "BookmarkFeedsQuerySet":
        return self.exclude(feed_newest_item_date__isnull=True)

    def order_by_feed_newest_item_date(
        self, descending=True
    ) -> "BookmarkFeedsQuerySet":
        order_prefix = "-" if descending else ""
        return self.with_feed_newest_item_date().order_by(
            f"{order_prefix}feed_newest_item_date"
        )


class BookmarkManager(models.Manager):

    def generate_unique_hash_for_url(self, url):
        """Generate a unique hash for a given URL."""
        return hashlib.sha1(url.encode("utf-8")).hexdigest()

    @contextlib.contextmanager
    def use_queryset(self):
        """
        Context manager that yields a queryset for the Bookmark model.
        This is useful mainly as a null-op alongside logic that uses the feeds database.
        """
        yield self.get_queryset()

    @contextlib.contextmanager
    def use_queryset_with_feeds_db(
        self, feeds_db_alias="feeds_db", feeds_db_name="feeds_db"
    ):
        """
        Context manager that attaches the feeds database and yields a queryset
        with feed-related capabilities.

        Usage:
            with Bookmark.objects.with_feeds_db() as queryset:
                # Get bookmarks with feed dates
                bookmarks = queryset.order_by_feed_newest_item_date()
        """
        # TODO: rework this to handle non-SQLite databases
        # if not settings.DATABASES[self.db]["ENGINE"] == "django.db.backends.sqlite3":
        cursor = connections[self.db].cursor()
        feeds_db_path = settings.DATABASES[feeds_db_name]["NAME"]
        try:
            cursor.execute(f"ATTACH DATABASE '{feeds_db_path}' AS {feeds_db_alias}")
            yield BookmarkFeedsQuerySet(
                self.model, using=self._db, feeds_db_alias=feeds_db_alias
            )
        finally:
            cursor.execute(f"DETACH DATABASE {feeds_db_alias}")

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
        sort=BookmarkSort.DATE_DESC,
        limit=10,
        page=0,
    ):
        """
        Query bookmarks based on owner, tags, and search string.
        """

        if sort == BookmarkSort.FEED_ASC or sort == BookmarkSort.FEED_DESC:
            queryset_context = self.use_queryset_with_feeds_db()
        else:
            queryset_context = self.use_queryset()

        with queryset_context as queryset:
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

            sort_options = {
                BookmarkSort.DATE_ASC: "created_at",
                BookmarkSort.DATE_DESC: "-created_at",
                BookmarkSort.TITLE_ASC: "title",
                BookmarkSort.TITLE_DESC: "-title",
                BookmarkSort.FEED_ASC: "newest_item_date",
                BookmarkSort.FEED_DESC: "-newest_item_date",
            }

            if sort == BookmarkSort.FEED_ASC or sort == BookmarkSort.FEED_DESC:
                queryset = queryset.with_feed_newest_item_date().order_by_feed_newest_item_date(
                    descending=sort == BookmarkSort.FEED_DESC
                )
            elif sort in sort_options:
                queryset = queryset.order_by(sort_options[sort])

            offset = page * limit
            queryset = queryset[offset : offset + limit]

            total = queryset.count()

            return list(queryset)

            """
            # Return paginated results with metadata
            return {
                "items": list(queryset),
                "total": total,
                "page": page,
                "pages": (total + limit - 1) // limit,
            }
            """


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
