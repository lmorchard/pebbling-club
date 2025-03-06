from django.contrib import admin
from .models import Feed, FeedItem
from django.urls import reverse
from django.utils.html import format_html


# Register your models here.
@admin.register(Feed)
class FeedAdmin(admin.ModelAdmin):
    list_display = ("title", "url", "updated_at", "view_feeditems_link")
    search_fields = ("title", "url")

    def view_feeditems_link(self, obj):
        url = reverse("admin:feeds_feeditem_changelist") + f"?feed__id__exact={obj.id}"
        return format_html('<a href="{}">View FeedItems</a>', url)

    view_feeditems_link.short_description = "FeedItems"


@admin.register(FeedItem)
class FeedItemAdmin(admin.ModelAdmin):
    list_display = ("title", "feed", "created_at")
    search_fields = ("title", "feed__name")
