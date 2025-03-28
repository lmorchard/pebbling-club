import contextlib
from django.db import models
from django.utils import timezone
import datetime
import logging
import time
from feedparser import FeedParserDict
from django.conf import settings
from django.db import connections
from pebbling_apps.common.models import TimestampedModel
import sqlite3

logger = logging.getLogger(__name__)


class FeedManager(models.Manager):
    def active_feeds(self) -> models.QuerySet:
        """Return all active feeds (not disabled)."""
        return self.filter(disabled=False)

    def recent_feeds(self) -> models.QuerySet:
        """Return feeds ordered by newest item date."""
        return self.order_by("-newest_item_date")


class FeedItemManager(models.Manager):
    def recent_items(self) -> models.QuerySet:
        """Return feed items ordered by date."""
        return self.order_by("-date")

    def for_feed(self, feed: "Feed") -> models.QuerySet:
        """Return all items for a specific feed."""
        return self.filter(feed=feed)

    def update_or_create_from_parsed(self, feed: "Feed", entry: dict) -> tuple:
        """Update or create a FeedItem from a parsed entry."""
        published = None
        if "published_parsed" in entry:
            try:
                published_parsed = entry.get("published_parsed")
                if published_parsed is not None:
                    published = datetime.datetime.fromtimestamp(
                        time.mktime(published_parsed)
                    )
                    published = timezone.make_aware(published)
            except Exception as e:
                logger.warning(
                    f"Failed to parse date for entry: {entry.get('id', 'unknown')}: {e}"
                )

        # Attempt to fetch an existing FeedItem
        feed_item = self.filter(
            feed=feed, guid=entry.get("id", entry.get("link"))
        ).first()

        # If the feed item exists and has a date, use the existing date
        if feed_item and feed_item.date:
            published = feed_item.date

        # Update or create the FeedItem
        feed_item, created = self.update_or_create(
            feed=feed,
            guid=entry.get("id", entry.get("link")),
            defaults={
                "last_seen_at": timezone.now(),
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "description": entry.get("description", ""),
                "summary": entry.get("summary", ""),
                "date": published or timezone.now(),
                "json": entry,
            },
        )

        # Update feed's newest_item_date if this item is newer
        if published and (
            not feed.newest_item_date or published > feed.newest_item_date
        ):
            feed.newest_item_date = published
            feed.save(update_fields=["newest_item_date"])

        return feed_item, created


class Feed(TimestampedModel):
    url = models.URLField(max_length=2048, unique=True)
    title = models.CharField(max_length=200, blank=True, null=True)
    newest_item_date = models.DateTimeField(null=True, blank=True)
    disabled = models.BooleanField(default=False)
    etag = models.CharField(max_length=256, blank=True, null=True)
    modified = models.CharField(max_length=256, unique=True, blank=True, null=True)
    json = models.JSONField(blank=True, null=True)

    objects = FeedManager()  # Assign the custom manager

    def __str__(self) -> str:
        return self.title or self.url

    @classmethod
    def get_active_feed_urls_by_date(cls):
        """Returns a list of feed URLs ordered by newest_item_date."""
        return list(
            cls.objects.using("feeds_db")
            .filter(disabled=False)
            .order_by("-newest_item_date")
            .values_list("url", flat=True)
        )

    def update_from_parsed(self, parsed_feed: FeedParserDict) -> None:
        """Update the feed's JSON data and title from the parsed feed."""
        self.json = {
            key: value for key, value in parsed_feed.items() if key != "entries"
        }
        self.title = parsed_feed.get("title", "")
        self.save()

    def to_dict(self) -> dict:
        """Convert Feed instance to a dictionary for JSON serialization."""
        return {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "newest_item_date": (
                self.newest_item_date.isoformat() if self.newest_item_date else None
            ),
            "disabled": self.disabled,
            "etag": self.etag,
            "modified": self.modified,
            "json": self.json,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    class Meta:
        ordering = ["-newest_item_date"]
        indexes = [
            models.Index(fields=["newest_item_date"]),
            models.Index(fields=["disabled"]),
        ]


class FeedItem(TimestampedModel):
    feed = models.ForeignKey(Feed, on_delete=models.CASCADE, related_name="items")
    guid = models.CharField(max_length=2048)
    date = models.DateTimeField()
    link = models.URLField(max_length=2048)
    title = models.CharField(max_length=500)
    summary = models.TextField(blank=True)
    description = models.TextField(blank=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    json = models.JSONField(blank=True, null=True)

    objects = FeedItemManager()

    def __str__(self) -> str:
        return self.title

    def to_dict(self) -> dict:
        """Convert FeedItem instance to a dictionary for JSON serialization."""
        return {
            "id": self.id,
            "feed_id": self.feed_id,
            "guid": self.guid,
            "date": self.date.isoformat() if self.date else None,
            "link": self.link,
            "title": self.title,
            "summary": self.summary,
            "description": self.description,
            "last_seen_at": self.last_seen_at.isoformat(),
            "first_seen_at": self.first_seen_at.isoformat(),
            "json": self.json,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    class Meta:
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["guid"]),
            models.Index(fields=["date"]),
            models.Index(fields=["last_seen_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["feed", "guid"], name="unique_feed_item")
        ]


class FeedsDatabaseAttachContext:
    """
    A context manager for attaching and detaching the feeds database.
    Does not support nesting - only one database can be attached at a time.

    Usage:
        with FeedsDatabaseContext() as db_alias:
            # perform database operations using the alias
    """

    # Class variables to track attachment state
    _is_attached = False
    _current_alias = ""

    def __init__(
        self,
        default_database_name="default",
        attached_database_name="feeds_db",
        attach_alias="feeds_db",
        max_retries=3,
        retry_delay=0.5,
    ):
        """
        Initialize the database attachment parameters.

        :param default_database_name: Database config name of the default database to attach from
        :param attached_database_name: Database config name of the database to attach
        :param attach_alias: Alias to use for the attached database
        :param max_retries: Maximum number of retries if the database is locked
        :param retry_delay: Delay in seconds between retries
        """
        self.default_database_name = default_database_name
        self.attached_database_name = attached_database_name
        self.attach_alias = attach_alias
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.feeds_db_path = settings.DATABASES[attached_database_name]["NAME"]

    def __enter__(self):
        """Attach the database and return the alias."""
        # Guard against nesting by checking if any database is already attached
        if FeedsDatabaseAttachContext._is_attached:
            raise RuntimeError(
                "Database attachment cannot be nested - a database is already attached"
            )

        attempts = 0
        while True:
            attempts += 1
            try:
                with connections[self.default_database_name].cursor() as cursor:
                    cursor.execute(
                        f"ATTACH DATABASE '{self.feeds_db_path}' AS {self.attach_alias}"
                    )
                FeedsDatabaseAttachContext._is_attached = True
                FeedsDatabaseAttachContext._current_alias = self.attach_alias
                return self.attach_alias
            except sqlite3.OperationalError as e:
                if (
                    "database is locked" in str(e).lower()
                    and attempts <= self.max_retries
                ):
                    logger.warning(
                        f"Database locked, retrying attachment (attempt {attempts}/{self.max_retries})..."
                    )
                    time.sleep(self.retry_delay)
                else:
                    logger.error(
                        f"Failed to attach database after {attempts} attempts: {e}"
                    )
                    raise

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Detach the database."""
        with connections[self.default_database_name].cursor() as cursor:
            cursor.execute(f"DETACH DATABASE {self.attach_alias}")
        FeedsDatabaseAttachContext._is_attached = False
        FeedsDatabaseAttachContext._current_alias = ""

    @classmethod
    def get_attached_database_alias(cls):
        """
        Get the alias of the attached feeds database.
        """
        return cls._current_alias

    @classmethod
    def is_attached(cls):
        """
        Check if any feeds database is currently attached.
        """
        return cls._is_attached
