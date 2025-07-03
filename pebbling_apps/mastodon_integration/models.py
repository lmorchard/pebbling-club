from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django_prometheus.models import ExportModelOperationsMixin
from pebbling_apps.common.models import TimestampedModel
import logging

logger = logging.getLogger(__name__)


class MastodonAccountManager(models.Manager):
    def active_for_user(self, user):
        """Return active Mastodon accounts for the user."""
        return self.filter(user=user, is_active=True)

    def by_server(self, server_url):
        """Filter accounts by server URL."""
        return self.filter(server_url=server_url)


class MastodonAccount(ExportModelOperationsMixin("mastodon_account"), TimestampedModel):  # type: ignore[misc]
    """Mastodon account connection for a user."""

    objects = MastodonAccountManager()

    user = models.ForeignKey(
        get_user_model(), on_delete=models.CASCADE, related_name="mastodon_accounts"
    )
    server_url = models.URLField(verbose_name="Mastodon Server URL", max_length=255)
    server_name = models.CharField(
        max_length=255, blank=True, help_text="Display name of the server"
    )
    server_description = models.TextField(blank=True, help_text="Server description")
    access_token = models.TextField(
        help_text="OAuth access token (encrypted)"
    )  # Will be encrypted later
    account_id = models.CharField(max_length=50, help_text="Mastodon account ID")
    username = models.CharField(max_length=255, help_text="Mastodon username")
    display_name = models.CharField(
        max_length=255, blank=True, help_text="Mastodon display name"
    )
    is_active = models.BooleanField(
        default=True, help_text="Account connection enabled/disabled"
    )

    class Meta:
        unique_together = ["user", "server_url", "account_id"]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["server_url"]),
        ]

    def __str__(self):
        return f"{self.username}@{self.server_url}"


class MastodonTimelineManager(models.Manager):
    def active(self):
        """Return active timelines from active accounts."""
        return self.filter(is_active=True, account__is_active=True)

    def for_user(self, user):
        """Return timelines for a specific user."""
        return self.filter(account__user=user)

    def active_for_user(self, user):
        """Return active timelines for a specific user."""
        return self.filter(account__user=user, is_active=True, account__is_active=True)

    def by_type(self, timeline_type):
        """Filter timelines by type."""
        return self.filter(timeline_type=timeline_type)


class MastodonTimeline(
    ExportModelOperationsMixin("mastodon_timeline"), TimestampedModel  # type: ignore[misc]
):
    """Timeline configuration for a Mastodon account."""

    TIMELINE_CHOICES = [
        ("HOME", "Home Timeline"),
        ("LOCAL", "Local Timeline"),
        ("PUBLIC", "Public Timeline"),
        ("HASHTAG", "Hashtag Timeline"),
        ("LIST", "List Timeline"),
    ]

    objects = MastodonTimelineManager()

    account = models.ForeignKey(
        MastodonAccount, on_delete=models.CASCADE, related_name="timelines"
    )
    timeline_type = models.CharField(max_length=20, choices=TIMELINE_CHOICES)
    config = models.JSONField(
        default=dict,
        help_text="Timeline-specific configuration (e.g., hashtag name, list ID)",
    )
    is_active = models.BooleanField(default=True, help_text="Timeline enabled/disabled")

    # Polling state tracking
    last_status_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Last processed Mastodon status ID",
    )
    last_poll_attempt = models.DateTimeField(
        null=True, blank=True, help_text="Timestamp of last poll attempt"
    )
    last_successful_poll = models.DateTimeField(
        null=True, blank=True, help_text="Timestamp of last successful poll"
    )
    consecutive_failures = models.IntegerField(
        default=0, help_text="Count of consecutive poll failures"
    )

    class Meta:
        unique_together = ["account", "timeline_type", "config"]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account", "is_active"]),
            models.Index(fields=["timeline_type"]),
            models.Index(fields=["last_poll_attempt"]),
            models.Index(fields=["consecutive_failures"]),
        ]

    def __str__(self):
        config_display = ""
        if self.timeline_type == "HASHTAG" and "hashtag" in self.config:
            config_display = f" (#{self.config['hashtag']})"
        elif self.timeline_type == "LIST" and "list_name" in self.config:
            config_display = f" ({self.config['list_name']})"

        return f"{self.account.username}@{self.account.server_url}: {self.get_timeline_type_display()}{config_display}"

    def get_status_display(self):
        """Human readable status."""
        if not self.is_active:
            return "Disabled"
        elif not self.account.is_active:
            return "Account Disabled"
        elif self.consecutive_failures >= getattr(
            settings, "MASTODON_MAX_CONSECUTIVE_FAILURES", 3
        ):
            return "Failed"
        elif self.last_successful_poll:
            return "Active"
        else:
            return "Not Polled"

    def get_last_poll_summary(self):
        """Summary of last poll attempt."""
        if not self.last_poll_attempt:
            return "Never polled"

        status = (
            "Success"
            if self.last_successful_poll == self.last_poll_attempt
            else "Failed"
        )
        return f"{status} at {self.last_poll_attempt.strftime('%Y-%m-%d %H:%M:%S')}"

    def is_healthy(self):
        """Boolean indicating if timeline is working."""
        if not self.is_active or not self.account.is_active:
            return False

        max_failures = getattr(settings, "MASTODON_MAX_CONSECUTIVE_FAILURES", 3)
        return self.consecutive_failures < max_failures

    def mark_poll_successful(self, latest_status_id=None):
        """Mark a successful poll attempt."""
        now = timezone.now()
        self.last_poll_attempt = now
        self.last_successful_poll = now
        self.consecutive_failures = 0
        if latest_status_id:
            self.last_status_id = latest_status_id
        self.save()

    def mark_poll_failed(self, error_message=None):
        """Mark a failed poll attempt."""
        self.last_poll_attempt = timezone.now()
        self.consecutive_failures += 1
        if error_message:
            logger.warning(f"Timeline {self.id} poll failed: {error_message}")
        self.save()
