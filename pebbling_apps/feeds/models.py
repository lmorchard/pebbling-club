from django.db import models
from django.utils import timezone

from pebbling.models import TimestampedModel


class Feed(TimestampedModel):
    url = models.URLField(max_length=2048, unique=True)
    title = models.CharField(max_length=200, blank=True, null=True)
    newest_item_date = models.DateTimeField(null=True, blank=True)
    disabled = models.BooleanField(default=False)
    etag = models.CharField(max_length=256, blank=True, null=True)
    modified = models.CharField(max_length=256, unique=True, blank=True, null=True)

    def __str__(self):
        return self.title or self.url

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

    def __str__(self):
        return self.title

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
