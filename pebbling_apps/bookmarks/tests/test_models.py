from django.test import TransactionTestCase, TestCase
from django.contrib.auth import get_user_model
from pebbling_apps.bookmarks.models import Bookmark, BookmarkManager
from pebbling_apps.unfurl.unfurl import UnfurlMetadata
from pebbling_apps.feeds.models import Feed, FeedsDatabaseAttachContext
from django.utils import timezone
import datetime
import logging
from django.db import connection


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

        self.bookmark1 = Bookmark.objects.create(
            url="http://example1.com",
            owner=self.user,
            feed_url="http://example1.com/feed",
            title="Test Bookmark 1",
        )
        self.bookmark2 = Bookmark.objects.create(
            url="http://example2.com",
            owner=self.user,
            feed_url="http://example2.com/feed",
            title="Test Bookmark 2",
        )
        self.bookmark3 = Bookmark.objects.create(
            url="http://example3.com",
            owner=self.user,
            feed_url="http://example3.com/feed",
            title="Test Bookmark 3",
        )

        Feed.objects.create(
            url="http://example1.com/feed",
            title="Feed 1",
            disabled=False,
            newest_item_date=timezone.make_aware(
                datetime.datetime(2023, 1, 1, 10, 0, 0)
            ),
        )
        Feed.objects.create(
            url="http://example2.com/feed",
            title="Feed 2",
            disabled=False,
            newest_item_date=timezone.make_aware(
                datetime.datetime(2023, 1, 2, 10, 0, 0)
            ),
        )
        Feed.objects.create(
            url="http://example3.com/feed",
            title="Feed 3",
            disabled=False,
            newest_item_date=timezone.make_aware(
                datetime.datetime(2023, 1, 3, 10, 0, 0)
            ),
        )

    def test_with_feed_newest_item_date(self):
        with FeedsDatabaseAttachContext.attach():
            # Get bookmarks with annotated feed dates
            bookmarks = list(Bookmark.objects.all().with_feed_newest_item_date())

            # Verify all bookmarks are returned
            self.assertEqual(len(bookmarks), 3)

            # Create a dictionary mapping bookmark ID to the queryset results for easier lookup
            bookmark_dict = {bookmark.id: bookmark for bookmark in bookmarks}

            # Get expected datetime values
            expected_date1 = datetime.datetime(2023, 1, 1, 10, 0, 0)
            expected_date2 = datetime.datetime(2023, 1, 2, 10, 0, 0)
            expected_date3 = datetime.datetime(2023, 1, 3, 10, 0, 0)

            # Check only date and time parts without timezone info to avoid issues
            # with different timezone representations
            self.assertEqual(
                bookmark_dict[self.bookmark1.id].feed_newest_item_date.strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                expected_date1.strftime("%Y-%m-%d %H:%M:%S"),
            )
            self.assertEqual(
                bookmark_dict[self.bookmark2.id].feed_newest_item_date.strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                expected_date2.strftime("%Y-%m-%d %H:%M:%S"),
            )
            self.assertEqual(
                bookmark_dict[self.bookmark3.id].feed_newest_item_date.strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                expected_date3.strftime("%Y-%m-%d %H:%M:%S"),
            )

            # Test ordering by the annotated field
            ordered_bookmarks = list(
                Bookmark.objects.all()
                .with_feed_newest_item_date()
                .order_by("-feed_newest_item_date")
            )
            self.assertEqual(len(ordered_bookmarks), 3)
            self.assertEqual(ordered_bookmarks[0].id, self.bookmark3.id)
            self.assertEqual(ordered_bookmarks[1].id, self.bookmark2.id)
            self.assertEqual(ordered_bookmarks[2].id, self.bookmark1.id)

    def test_order_by_feed_newest_item_date(self):
        with FeedsDatabaseAttachContext():
            # Get bookmarks ordered by newest item date
            bookmarks = list(Bookmark.objects.all().order_by_feed_newest_item_date())

            # Verify all bookmarks are returned
            self.assertEqual(len(bookmarks), 3)

            # Check the order of bookmarks
            self.assertEqual(bookmarks[0].id, self.bookmark3.id)
            self.assertEqual(bookmarks[1].id, self.bookmark2.id)
            self.assertEqual(bookmarks[2].id, self.bookmark1.id)

    def test_exclude_null_feed_dates(self):
        # Create a bookmark without a matching feed in the feeds database
        bookmark_no_feed = Bookmark.objects.create(
            url="http://example-no-feed.com",
            owner=self.user,
            feed_url="http://example-no-feed.com/feed",
            title="Test Bookmark No Feed",
        )

        with FeedsDatabaseAttachContext():
            # Get all bookmarks with feed dates
            all_bookmarks = list(Bookmark.objects.all().with_feed_newest_item_date())
            self.assertEqual(len(all_bookmarks), 4)  # All 4 bookmarks should be present

            # Only bookmarks with non-null feed dates
            filtered_bookmarks = list(
                Bookmark.objects.all()
                .with_feed_newest_item_date()
                .exclude_null_feed_dates()
            )
            self.assertEqual(
                len(filtered_bookmarks), 3
            )  # Only original 3 bookmarks should remain

            # Verify the bookmark with no feed is not in the filtered results
            filtered_ids = [bookmark.id for bookmark in filtered_bookmarks]
            self.assertNotIn(bookmark_no_feed.id, filtered_ids)

            # Verify all other bookmarks are in the filtered results
            self.assertIn(self.bookmark1.id, filtered_ids)
            self.assertIn(self.bookmark2.id, filtered_ids)
            self.assertIn(self.bookmark3.id, filtered_ids)
