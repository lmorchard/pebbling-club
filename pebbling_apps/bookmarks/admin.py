from django.contrib import admin
from .models import Bookmark, Tag
from .tasks import unfurl_bookmark_metadata


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at", "updated_at")
    list_filter = ("owner",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ("title", "url", "owner", "created_at")
    list_filter = ("owner",)
    search_fields = ("title", "url", "description")
    autocomplete_fields = ("tags",)
    readonly_fields = ("unique_hash", "unfurl_metadata")
    actions = ["unfurl_selected_bookmarks"]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "owner",
                    "url",
                    "title",
                    "description",
                    "tags",
                )
            },
        ),
        (
            "Metadata",
            {
                "fields": (
                    "unique_hash",
                    "unfurl_metadata",
                ),
            },
        ),
    )

    def get_list_filter(self, request):
        # Only show owner filter, hide tags filter
        return ("owner",)

    @admin.action(description="Unfurl metadata for selected bookmarks")
    def unfurl_selected_bookmarks(self, request, queryset):
        count = 0
        for bookmark in queryset:
            unfurl_bookmark_metadata.delay(bookmark.id)
            count += 1
        self.message_user(
            request,
            f"Queued {count} bookmark{'s' if count != 1 else ''} for metadata unfurling",
        )
