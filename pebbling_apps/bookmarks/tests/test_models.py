from django.test import TestCase
from django.contrib.auth import get_user_model
from pebbling_apps.bookmarks.models import Bookmark, BookmarkManager

User = get_user_model()


class BookmarkManagerTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="12345")

    def test_generate_unique_hash_for_url(self):
        manager = BookmarkManager()
        url = "http://example.com"
        expected_hash = "a9b9f04336ce0181a08e774e01113b31b7b48c48"
        self.assertEqual(manager.generate_unique_hash_for_url(url), expected_hash)

    def test_update_or_create_feed_url_behavior(self):
        # Create a bookmark with unfurl_metadata but no feed_url
        bookmark, created = Bookmark.objects.update_or_create(
            url="http://example.com",
            owner=self.user,
            defaults={
                "title": "Example",
                "unfurl_metadata": UnfurlMetadataField(
                    feed_url="http://example.com/feed"
                ),
            },
        )
        self.assertTrue(created)
        self.assertEqual(bookmark.feed_url, "http://example.com/feed")

        # Update the bookmark, ensure feed_url is set from unfurl_metadata
        bookmark, created = Bookmark.objects.update_or_create(
            url="http://example.com",
            owner=self.user,
            defaults={"title": "Updated Example"},
        )
        self.assertFalse(created)
        self.assertEqual(bookmark.feed_url, "http://example.com/feed")

        # Change the feed_url directly and ensure it does not revert to unfurl_metadata
        bookmark.feed_url = "http://example.com/new-feed"
        bookmark.save()
        self.assertEqual(bookmark.feed_url, "http://example.com/new-feed")

        # Ensure update_or_create does not change the manually set feed_url
        bookmark, created = Bookmark.objects.update_or_create(
            url="http://example.com",
            owner=self.user,
            defaults={"title": "Another Update"},
        )
        self.assertFalse(created)
        self.assertEqual(bookmark.feed_url, "http://example.com/new-feed")
