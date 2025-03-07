import hashlib
from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from pebbling_apps.common.models import TimestampedModel
from pebbling_apps.unfurl.models import UnfurlMetadataField
from urllib.parse import urlparse


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


class BookmarkManager(models.Manager):
    def generate_unique_hash_for_url(self, url):
        """Generate a unique hash for a given URL."""
        return hashlib.sha1(url.encode("utf-8")).hexdigest()

    def update_or_create(self, defaults=None, **kwargs):
        """Override update_or_create to handle URL-based lookups."""
        defaults = defaults or {}

        if "url" in kwargs:
            # Generate hash from URL and move URL to defaults
            url = kwargs.pop("url")
            kwargs["unique_hash"] = self.generate_unique_hash_for_url(url)
            defaults["url"] = url

        return super().update_or_create(defaults=defaults, **kwargs)


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
