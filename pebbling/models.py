from django.db import models
from django.utils import timezone


class TimestampedModel(models.Model):
    """Abstract base model with automatic timestamps"""

    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True  # This prevents Django from creating a database table
