from django.db import migrations


def set_feed_url_from_unfurl_metadata(apps, schema_editor):
    Bookmark = apps.get_model("bookmarks", "Bookmark")
    for bookmark in Bookmark.objects.all():
        if bookmark.unfurl_metadata and bookmark.unfurl_metadata.feed:
            bookmark.feed_url = bookmark.unfurl_metadata.feed
            bookmark.save(update_fields=["feed_url"])


class Migration(migrations.Migration):

    dependencies = [
        ("bookmarks", "0006_bookmark_feed_url"),
    ]

    operations = [
        migrations.RunPython(set_feed_url_from_unfurl_metadata),
    ]
