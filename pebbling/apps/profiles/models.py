from django.db import models
from django.conf import settings
from core.models import TimestampedModel


class Profile(TimestampedModel):
    """Profile model with additional user details."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bio = models.TextField(blank=True, null=True)
    # avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    def __str__(self):
        return f"Profile of {self.user.username}"
