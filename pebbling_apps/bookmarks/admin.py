from django.contrib import admin
from .models import Bookmark, Tag, ImportJob
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


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "status",
        "created_at",
        "total_bookmarks",
        "processed_bookmarks",
        "failed_bookmarks",
        "progress_percentage",
    )
    list_filter = ("status", "created_at")
    search_fields = ("user__username",)
    readonly_fields = (
        "file_path",
        "file_size",
        "total_bookmarks",
        "processed_bookmarks",
        "failed_bookmarks",
        "started_at",
        "completed_at",
        "progress_percentage",
        "failed_bookmark_details",
    )
    ordering = ("-created_at",)

    fieldsets = (
        (
            "Job Details",
            {"fields": ("user", "status", "file_path", "file_size", "import_options")},
        ),
        (
            "Progress",
            {
                "fields": (
                    "total_bookmarks",
                    "processed_bookmarks",
                    "failed_bookmarks",
                    "progress_percentage",
                )
            },
        ),
        (
            "Timestamps",
            {"fields": ("created_at", "started_at", "completed_at")},
        ),
        (
            "Error Details",
            {
                "fields": ("error_message", "failed_bookmark_details"),
                "classes": ("collapse",),
            },
        ),
    )
