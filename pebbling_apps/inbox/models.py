from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from pebbling_apps.common.models import TimestampedModel
from pebbling_apps.unfurl.models import UnfurlMetadataField
from urllib.parse import urlparse
from .constants import SourceType


class InboxItemManager(models.Manager):
    def generate_unique_hash_for_url(self, url):
        """Generate a unique hash for a given URL."""
        from pebbling_apps.bookmarks.services import URLNormalizer

        normalizer = URLNormalizer()
        return normalizer.generate_hash(url)

    def unread_for_user(self, user):
        """Return items without inbox:read tag for the user."""
        return self.filter(owner=user).exclude(
            tags__name="inbox:read", tags__is_system=True
        )

    def archived_for_user(self, user):
        """Return items with inbox:archived tag for the user."""
        return self.filter(
            owner=user, tags__name="inbox:archived", tags__is_system=True
        )

    def by_source(self, source):
        """Filter items by source field."""
        return self.filter(source=source)

    def query(
        self, owner=None, tags=None, search=None, source=None, since=None, sort="date"
    ):
        """Query inbox items with filtering and sorting."""
        queryset = self.get_queryset()

        if owner:
            queryset = queryset.filter(owner=owner)

        if tags:
            from pebbling_apps.bookmarks.models import Tag

            tag_ids = Tag.objects.filter(name__in=tags).values_list("id", flat=True)
            queryset = queryset.filter(tags__id__in=tag_ids)

        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(url__icontains=search)
                | Q(description__icontains=search)
                | Q(tags__name__icontains=search)
            ).distinct()

        if source:
            queryset = queryset.filter(source=source)

        if since:
            queryset = queryset.filter(created_at__gte=since)

        # Apply sorting
        if sort == "title":
            queryset = queryset.order_by("title")
        elif sort == "source":
            queryset = queryset.order_by("source")
        else:  # default to date
            queryset = queryset.order_by("-created_at")

        return queryset.select_related("owner").prefetch_related("tags")


# mypy cannot analyze this pattern, but it's the standard django-prometheus usage
class InboxItem(TimestampedModel):
    """Inbox item model - potential bookmarks for user review."""

    omit_html = getattr(settings, "OMIT_HTML_FROM_UNFURL_METADATA", True)

    objects = InboxItemManager()

    url = models.URLField(verbose_name="URL", max_length=10240)
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    unique_hash = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    tags = models.ManyToManyField(
        "bookmarks.Tag", related_name="inbox_items", blank=True
    )
    unfurl_metadata = UnfurlMetadataField(blank=True, null=True, omit_html=omit_html)
    feed_url = models.URLField(blank=True, null=True, verbose_name="Feed URL")
    source = models.CharField(max_length=255, help_text="Source of this inbox item")
    source_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type of source (e.g., 'mastodon', 'feed', 'manual')",
        db_index=True,
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Source-specific metadata (e.g., Mastodon status ID, feed item ID)",
    )

    class Meta:
        unique_together = ["owner", "unique_hash", "source"]
        indexes = [
            models.Index(fields=["owner", "created_at"]),
            models.Index(fields=["source"]),
            models.Index(fields=["owner", "source"]),
        ]

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
        """Extracts the host name from the inbox item URL."""
        return urlparse(self.url).hostname

    def is_read(self):
        """Check if item has inbox:read tag."""
        return self.tags.filter(name="inbox:read", is_system=True).exists()

    def is_archived(self):
        """Check if item has inbox:archived tag."""
        return self.tags.filter(name="inbox:archived", is_system=True).exists()

    def mark_read(self):
        """Add inbox:read system tag."""
        from pebbling_apps.bookmarks.models import Tag

        read_tag = Tag.objects.get_or_create_system_tag("inbox:read", self.owner)
        self.tags.add(read_tag)

    def mark_archived(self):
        """Add inbox:archived system tag."""
        from pebbling_apps.bookmarks.models import Tag

        archived_tag = Tag.objects.get_or_create_system_tag(
            "inbox:archived", self.owner
        )
        self.tags.add(archived_tag)

    def get_mastodon_status_url(self):
        """Get the original Mastodon status URL if this item came from Mastodon."""
        if self.metadata and "mastodon_status_url" in self.metadata:
            return self.metadata["mastodon_status_url"]
        return None

    def is_from_mastodon(self):
        """Check if this inbox item originated from Mastodon."""
        return self.source_type == SourceType.MASTODON
