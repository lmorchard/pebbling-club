from django.contrib import admin
from .models import Bookmark, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at", "updated_at")
    list_filter = ("owner",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ("title", "url", "owner", "created_at")
    list_filter = ("owner", "tags")
    search_fields = ("title", "url", "description")
    filter_horizontal = ("tags",)
    readonly_fields = ("unique_hash",)
    fieldsets = (
        (None, {"fields": ("url", "title", "description", "owner")}),
        (
            "Tags",
            {
                "fields": ("tags",),
            },
        ),
        (
            "Metadata",
            {
                "fields": ("meta", "unique_hash"),
                "classes": ("collapse",),
            },
        ),
    )

    def get_list_filter(self, request):
        # Only show owner filter, hide tags filter
        return ("owner",)
