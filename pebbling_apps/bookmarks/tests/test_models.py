from django.conf import settings
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import connection
from pebbling_apps.bookmarks.models import Bookmark, BookmarkManager
from pebbling_apps.unfurl.unfurl import UnfurlMetadata

User = get_user_model()


class BookmarkManagerTestCase(TestCase):
    databases = {"default", "feeds_db"}

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="12345")

    def test_generate_unique_hash_for_url(self):
        manager = BookmarkManager()
        url = "http://example.com"
        expected_hash = "89dce6a446a69d6b9bdc01ac75251e4c322bcdff"
        self.assertEqual(manager.generate_unique_hash_for_url(url), expected_hash)

    def test_create_bookmark_sets_feed_url_from_unfurl_metadata(self):
        bookmark, created = Bookmark.objects.update_or_create(
            url="http://example.com",
            owner=self.user,
            defaults={
                "title": "Example",
                "unfurl_metadata": UnfurlMetadata(
                    url="http://example.com", feeds=["http://example.com/feed"]
                ),
            },
        )
        self.assertTrue(created)
        self.assertEqual(bookmark.feed_url, "http://example.com/feed")

    def test_update_bookmark_preserves_feed_url(self):
        # First create a bookmark
        bookmark = Bookmark.objects.create(
            url="http://example.com",
            owner=self.user,
            title="Example",
            feed_url="http://example.com/feed",
        )

        # Update the bookmark
        bookmark, created = Bookmark.objects.update_or_create(
            url="http://example.com",
            owner=self.user,
            defaults={"title": "Updated Example"},
        )
        self.assertFalse(created)
        self.assertEqual(bookmark.feed_url, "http://example.com/feed")

    def test_manual_feed_url_change_is_preserved(self):
        bookmark = Bookmark.objects.create(
            url="http://example.com",
            owner=self.user,
            feed_url="http://example.com/feed",
        )

        bookmark.feed_url = "http://example.com/new-feed"
        bookmark.save()

        # Verify update_or_create preserves manual change
        bookmark, created = Bookmark.objects.update_or_create(
            url="http://example.com",
            owner=self.user,
            defaults={"title": "Another Update"},
        )
        self.assertFalse(created)
        self.assertEqual(bookmark.feed_url, "http://example.com/new-feed")

    def test_feed_url_updates_when_specified_in_defaults(self):
        bookmark = Bookmark.objects.create(
            url="http://example.com",
            owner=self.user,
            feed_url="http://example.com/feed",
        )

        bookmark, created = Bookmark.objects.update_or_create(
            url="http://example.com",
            owner=self.user,
            defaults={
                "title": "Final Update",
                "feed_url": "http://example.com/newest-feed",
            },
        )
        self.assertFalse(created)
        self.assertEqual(bookmark.feed_url, "http://example.com/newest-feed")

    def test_get_bookmark_ids_by_feed_date(self):
        # Create bookmarks with different feed URLs
        bookmark1 = Bookmark.objects.create(
            url="http://example1.com",
            owner=self.user,
            title="Example 1",
            feed_url="http://example1.com/feed",
        )
        bookmark2 = Bookmark.objects.create(
            url="http://example2.com",
            owner=self.user,
            title="Example 2",
            feed_url="http://example2.com/feed",
        )

        # Insert test feed data in the feeds database
        with connection.cursor() as cursor:
            cursor.execute("BEGIN")
            feeds_db_path = settings.DATABASES["feeds_db"]["NAME"]
            cursor.execute(f"ATTACH DATABASE '{feeds_db_path}' AS feeds_db")

            # Insert test feed data with bookmark2's feed being more recent
            cursor.execute(
                """
                INSERT OR REPLACE INTO feeds_db.feeds_feed (url, disabled, newest_item_date)
                VALUES (?, 0, ?), (?, 0, ?)
            """,
                [
                    "http://example1.com/feed",
                    "2023-01-01 10:00:00",
                    "http://example2.com/feed",
                    "2023-01-02 10:00:00",
                ],
            )
            cursor.execute("COMMIT")
            cursor.execute("DETACH DATABASE feeds_db")

        # Get sorted bookmark IDs
        sorted_ids = Bookmark.objects.get_bookmark_ids_by_feed_date()

        # Verify bookmark2 comes first since its feed has a more recent newest_item_date
        self.assertEqual(sorted_ids, [bookmark2.id, bookmark1.id])
