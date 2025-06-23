import datetime
import time
from django.test import TestCase
from django.utils import timezone
from django.conf import settings
from unittest import skipIf
from pebbling_apps.feeds.models import Feed, FeedItem


@skipIf(
    not getattr(settings, "SQLITE_MULTIPLE_DB", True),
    "Feed tests only run when SQLITE_MULTIPLE_DB is enabled"
)
class FeedItemManagerTest(TestCase):
    databases = {"default", "feeds_db"} if getattr(settings, "SQLITE_MULTIPLE_DB", True) else {"default"}

    def setUp(self):
        self.feed = Feed.objects.create(
            url='http://example.com/feed.xml',
            title='Test Feed'
        )

    def test_update_or_create_from_parsed_creates_new_item_with_published_parsed(self):
        # Prepare entry with a published_parsed date
        published_parsed = time.gmtime(time.mktime((2025, 3, 23, 12, 0, 0, 0, 0, 0)))
        entry = {
            "id": "new-unique-guid",
            "link": "http://example.com/new-item",
            "title": "New Item",
            "published_parsed": published_parsed,
        }

        # Update or create the FeedItem
        FeedItem.objects.update_or_create_from_parsed(self.feed, entry)

        # Fetch the newly created FeedItem
        new_feed_item = FeedItem.objects.get(guid="new-unique-guid")

        # Assert that the date has been set correctly
        self.assertEqual(
            new_feed_item.date,
            datetime.datetime(2025, 3, 23, 12, 0, 0, tzinfo=datetime.timezone.utc),
        )

    def test_update_or_create_from_parsed_uses_existing_date(self):
        # Create a FeedItem with an existing date
        existing_date = timezone.now() - datetime.timedelta(days=1)
        feed_item = FeedItem.objects.create(
            feed=self.feed,
            guid="unique-guid",
            date=existing_date,
            link="http://example.com/item",
            title="Existing Item",
        )

        # Prepare entry with a different published_parsed date
        new_published_parsed = time.gmtime(
            time.mktime((2025, 3, 23, 12, 0, 0, 0, 0, 0))
        )
        entry = {
            "id": "unique-guid",
            "link": "http://example.com/item",
            "title": "Updated Item",
            "published_parsed": new_published_parsed,
        }

        # Update or create the FeedItem
        FeedItem.objects.update_or_create_from_parsed(self.feed, entry)

        # Fetch the updated FeedItem
        updated_feed_item = FeedItem.objects.get(guid="unique-guid")

        # Assert that the date has not been overwritten
        self.assertEqual(updated_feed_item.date, existing_date)

    def test_update_newest_item_date_with_newer_item(self):
        # Create initial item
        initial_date = timezone.now() - datetime.timedelta(days=2)
        initial_date = initial_date.replace(microsecond=0)
        self.feed.newest_item_date = initial_date
        self.feed.save()

        # Create newer item
        newer_date = timezone.now() - datetime.timedelta(days=1)
        newer_date = newer_date.replace(microsecond=0)
        entry = {
            'id': 'test1',
            'title': 'Test Entry',
            'link': 'http://example.com/entry1',
            'published_parsed': newer_date.timetuple()
        }
        
        FeedItem.objects.update_or_create_from_parsed(self.feed, entry)
        self.feed.refresh_from_db()
        self.assertEqual(self.feed.newest_item_date.replace(microsecond=0), newer_date)

    def test_keep_newest_item_date_with_older_item(self):
        # Set initial newest date
        initial_date = timezone.now() - datetime.timedelta(days=1)
        initial_date = initial_date.replace(microsecond=0)
        self.feed.newest_item_date = initial_date
        self.feed.save()

        # Create older item
        older_date = timezone.now() - datetime.timedelta(days=2)
        older_date = older_date.replace(microsecond=0)
        entry = {
            'id': 'test2',
            'title': 'Test Entry',
            'link': 'http://example.com/entry2',
            'published_parsed': older_date.timetuple()
        }
        
        FeedItem.objects.update_or_create_from_parsed(self.feed, entry)
        self.feed.refresh_from_db()
        self.assertEqual(self.feed.newest_item_date.replace(microsecond=0), initial_date)

    def test_update_newest_item_date_when_none(self):
        # Ensure newest_item_date starts as None
        self.assertIsNone(self.feed.newest_item_date)

        # Create item with a date
        item_date = timezone.now() - datetime.timedelta(days=1)
        item_date = item_date.replace(microsecond=0)
        entry = {
            'id': 'test3',
            'title': 'Test Entry',
            'link': 'http://example.com/entry3',
            'published_parsed': item_date.timetuple()
        }
        
        FeedItem.objects.update_or_create_from_parsed(self.feed, entry)
        self.feed.refresh_from_db()
        self.assertEqual(self.feed.newest_item_date.replace(microsecond=0), item_date)

    def test_handle_entry_without_published_date(self):
        # Set initial newest date
        initial_date = timezone.now() - datetime.timedelta(days=1)
        self.feed.newest_item_date = initial_date
        self.feed.save()

        # Create entry without published date
        entry = {
            'id': 'test4',
            'title': 'Test Entry',
            'link': 'http://example.com/entry4'
        }
        
        FeedItem.objects.update_or_create_from_parsed(self.feed, entry)
        self.feed.refresh_from_db()
        self.assertEqual(self.feed.newest_item_date, initial_date)
