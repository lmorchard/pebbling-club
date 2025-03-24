from django.db import models
from django.utils import timezone
import datetime
import logging
import time
from feedparser import FeedParserDict

from pebbling_apps.common.models import TimestampedModel

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

    objects = FeedItemManager()  # Assign the custom manager

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
