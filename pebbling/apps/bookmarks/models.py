import hashlib
from django.db import models
from django.contrib.auth import get_user_model
from apps.common.models import TimestampedModel


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
    pass


class Bookmark(TimestampedModel):
    """Bookmark model with url and title."""

    objects = BookmarkManager()

    url = models.URLField()
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    unique_hash = models.CharField(max_length=255, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    tags = models.ManyToManyField("bookmarks.Tag", related_name="bookmarks", blank=True)
    meta = models.JSONField(blank=True, null=True)

    def __str__(self):
        return self.title

    def generate_unique_hash(self):
        """Generate a SHA-1 hash based on the URL."""
        return hashlib.sha1(self.url.encode("utf-8")).hexdigest()

    def save(self, *args, **kwargs):
        """Set unique_hash before saving if not already set."""

        self.unique_hash = self.generate_unique_hash()

        super().save(*args, **kwargs)  # Call the default save method
