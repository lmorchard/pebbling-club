from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.http import urlencode
from .models import InboxItem


@admin.register(InboxItem)
class InboxItemAdmin(admin.ModelAdmin):
    list_display = ["title", "owner_link", "source_link", "created_at", "updated_at"]
    list_filter = ["created_at"]
    search_fields = [
        "title",
        "url",
        "description",
        "owner__username",
        "source",
        "tags__name",
    ]
    readonly_fields = ["unique_hash", "created_at", "updated_at"]
    filter_horizontal = ["tags"]
    ordering = ["-created_at"]

    # Enable autocomplete for tags in the form
    autocomplete_fields = ["tags"]

    @admin.display(description="Source", ordering="source")
    def source_link(self, obj):
        """Display source as a clickable link that filters by that source."""
        if not obj.source:
            return "-"

        # Create URL to filter by this source
        url = reverse("admin:inbox_inboxitem_changelist")
        params = urlencode({"q": obj.source})
        filter_url = f"{url}?{params}"

        # Truncate long source names for display
        display_source = obj.source
        if len(display_source) > 50:
            display_source = display_source[:47] + "..."

        return format_html(
            '<a href="{}" title="{}">{}</a>',
            filter_url,
            obj.source,  # Full source in tooltip
            display_source,  # Truncated for display
        )

    @admin.display(description="Owner", ordering="owner__username")
    def owner_link(self, obj):
        """Display owner as a clickable link that filters by that owner."""
        if not obj.owner:
            return "-"

        # Create URL to filter by this owner's username
        url = reverse("admin:inbox_inboxitem_changelist")
        params = urlencode({"q": obj.owner.username})
        filter_url = f"{url}?{params}"

        return format_html(
            '<a href="{}" title="Filter by user: {}">{}</a>',
            filter_url,
            obj.owner.username,
            obj.owner.username,
        )

    def get_queryset(self, request):
        """Optimize queries with select_related and prefetch_related."""
        return (
            super()
            .get_queryset(request)
            .select_related("owner")
            .prefetch_related("tags")
        )
