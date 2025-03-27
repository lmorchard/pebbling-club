from django.test import TransactionTestCase, TestCase
from django.contrib.auth import get_user_model
from pebbling_apps.bookmarks.models import Bookmark, BookmarkManager
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from pebbling_apps.feeds.models import Feed
from django.utils import timezone
import datetime
import logging


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


# Note: This test case requires TransactionTestCase to avoid issues with
# TestCase using a transaction that results database locking errors
class BookmarkManagerCrossDatabaseTestCase(TransactionTestCase):
    databases = {"default", "feeds_db"}

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="12345")

    def test_get_bookmark_ids_by_feed_date(self):
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

        Feed.objects.create(
            url="http://example1.com/feed",
            disabled=False,
            newest_item_date=timezone.make_aware(datetime.datetime(2023, 1, 1, 10, 0, 0))
        )
        Feed.objects.create(
            url="http://example2.com/feed",
            disabled=False,
            newest_item_date=timezone.make_aware(datetime.datetime(2023, 1, 2, 10, 0, 0))
        )
        
        bookmark_ids = list(Bookmark.objects.get_bookmark_ids_by_feed_date())
        self.assertEqual(bookmark_ids, [bookmark2.id, bookmark1.id])
