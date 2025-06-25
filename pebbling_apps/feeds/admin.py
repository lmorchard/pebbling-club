from django.contrib import admin
from .models import Feed, FeedItem
from django.urls import reverse
from django.utils.html import format_html
from .tasks import poll_feed, poll_all_feeds


# Register your models here.
@admin.register(Feed)
class FeedAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "url",
        "updated_at",
        "newest_item_date",
        "view_feeditems_link",
    )
    search_fields = ("title", "url")
    actions = ["poll_selected_feeds", "poll_all_feeds_action"]

    @admin.display(description="FeedItems")
    def view_feeditems_link(self, obj):
        url = reverse("admin:feeds_feeditem_changelist") + f"?feed__id__exact={obj.id}"
        return format_html('<a href="{}">View FeedItems</a>', url)
    
    @admin.action(description="Poll selected feeds")
    def poll_selected_feeds(self, request, queryset):
        count = 0
        for feed in queryset:
            poll_feed.delay(feed.id)
            count += 1
        self.message_user(
            request,
            f"Queued {count} feed{'s' if count != 1 else ''} for polling"
        )
    
    @admin.action(description="Poll ALL feeds (ignore selection)")
    def poll_all_feeds_action(self, request, queryset):
        poll_all_feeds.delay()
        total_count = Feed.objects.count()
        self.message_user(
            request,
            f"Queued task to poll all {total_count} feeds in the system"
        )


@admin.register(FeedItem)
class FeedItemAdmin(admin.ModelAdmin):
    list_display = ("title", "feed", "created_at")
    search_fields = ("title", "feed__name")
