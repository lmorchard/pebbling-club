from django.db import models
from django.utils.timezone import now  # Import now() directly


class TimestampedModel(models.Model):
    """Abstract base model with automatic timestamps"""

    created_at = models.DateTimeField(default=now, editable=True)
    updated_at = models.DateTimeField(default=now, editable=True)

    def save(self, *args, **kwargs):
        # Set timestamps if not provided
        if not self.pk and not self.created_at:
            self.created_at = now()
        if not self.updated_at or self.updated_at == self.created_at:
            self.updated_at = now()

        super().save(*args, **kwargs)

    class Meta:
        abstract = True  # This prevents Django from creating a database table
