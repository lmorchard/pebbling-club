from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.http import urlencode
from .models import MastodonAccount, MastodonTimeline


@admin.register(MastodonAccount)
class MastodonAccountAdmin(admin.ModelAdmin):
    list_display = [
        "username",
        "server_name",
        "user_link",
        "is_active",
        "timeline_count",
        "created_at",
    ]
    list_filter = ["is_active", "server_url", "created_at"]
    search_fields = [
        "username",
        "display_name",
        "server_name",
        "server_url",
        "user__username",
    ]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]

    @admin.display(description="User", ordering="user__username")
    def user_link(self, obj):
        """Display user as a clickable link that filters by that user."""
        if not obj.user:
            return "-"

        url = reverse("admin:mastodon_integration_mastodonaccount_changelist")
        params = urlencode({"q": obj.user.username})
        filter_url = f"{url}?{params}"

        return format_html(
            '<a href="{}" title="Filter by user: {}">{}</a>',
            filter_url,
            obj.user.username,
            obj.user.username,
        )

    @admin.display(description="Timelines")
    def timeline_count(self, obj):
        """Display count of timelines for this account."""
        count = obj.timelines.count()
        if count == 0:
            return "0"

        url = reverse("admin:mastodon_integration_mastodontimeline_changelist")
        params = urlencode({"account__id": obj.id})
        filter_url = f"{url}?{params}"

        return format_html(
            '<a href="{}">{} timeline{}</a>',
            filter_url,
            count,
            "s" if count != 1 else "",
        )

    def get_queryset(self, request):
        """Optimize queries with select_related and prefetch_related."""
        return (
            super()
            .get_queryset(request)
            .select_related("user")
            .prefetch_related("timelines")
        )


@admin.register(MastodonTimeline)
class MastodonTimelineAdmin(admin.ModelAdmin):
    list_display = [
        "timeline_display",
        "account_link",
        "is_active",
        "status_display",
        "last_poll_attempt",
        "consecutive_failures",
    ]
    list_filter = [
        "timeline_type",
        "is_active",
        "account__is_active",
        "consecutive_failures",
        "created_at",
    ]
    search_fields = [
        "account__username",
        "account__server_url",
        "account__user__username",
        "timeline_type",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
        "last_poll_attempt",
        "last_successful_poll",
        "consecutive_failures",
    ]
    ordering = ["-created_at"]

    @admin.display(description="Timeline", ordering="timeline_type")
    def timeline_display(self, obj):
        """Display timeline type with configuration details."""
        display = obj.get_timeline_type_display()

        if obj.timeline_type == "HASHTAG" and "hashtag" in obj.config:
            display += f" (#{obj.config['hashtag']})"
        elif obj.timeline_type == "LIST" and "list_name" in obj.config:
            display += f" ({obj.config['list_name']})"

        return display

    @admin.display(description="Account", ordering="account__username")
    def account_link(self, obj):
        """Display account as a clickable link."""
        if not obj.account:
            return "-"

        url = reverse("admin:mastodon_integration_mastodonaccount_changelist")
        params = urlencode({"id": obj.account.id})
        filter_url = f"{url}?{params}"

        return format_html(
            '<a href="{}" title="View account">{}</a>', filter_url, str(obj.account)
        )

    @admin.display(description="Status")
    def status_display(self, obj):
        """Display timeline status with color coding."""
        status = obj.get_status_display()

        if status == "Active":
            color = "green"
        elif status == "Failed":
            color = "red"
        elif status == "Disabled" or status == "Account Disabled":
            color = "gray"
        else:
            color = "orange"

        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>', color, status
        )

    def get_queryset(self, request):
        """Optimize queries with select_related."""
        return super().get_queryset(request).select_related("account", "account__user")
