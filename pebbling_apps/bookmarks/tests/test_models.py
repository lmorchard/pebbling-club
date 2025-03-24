from django.test import TestCase
from django.contrib.auth import get_user_model
from pebbling_apps.bookmarks.models import Bookmark, BookmarkManager
from pebbling_apps.unfurl.unfurl import UnfurlMetadata

User = get_user_model()


class BookmarkManagerTestCase(TestCase):
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
