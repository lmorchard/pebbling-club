import datetime
import time
from django.test import TestCase
from django.utils import timezone
from pebbling_apps.feeds.models import Feed, FeedItem


class FeedItemManagerTest(TestCase):
    def setUp(self):
        self.feed = Feed.objects.create(url="http://example.com/feed")

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
            datetime.datetime(2025, 3, 23, 12, 0, 0, tzinfo=timezone.utc),
        )

    def test_update_or_create_from_parsed_adds_date_if_missing(self):
        # Create a FeedItem without a date
        feed_item = FeedItem.objects.create(
            feed=self.feed,
            guid="no-date-guid",
            link="http://example.com/no-date-item",
            title="No Date Item",
        )

        # Prepare entry with a published_parsed date
        published_parsed = time.gmtime(time.mktime((2025, 3, 23, 12, 0, 0, 0, 0, 0)))
        entry = {
            "id": "no-date-guid",
            "link": "http://example.com/no-date-item",
            "title": "Updated No Date Item",
            "published_parsed": published_parsed,
        }

        # Update or create the FeedItem
        FeedItem.objects.update_or_create_from_parsed(self.feed, entry)

        # Fetch the updated FeedItem
        updated_feed_item = FeedItem.objects.get(guid="no-date-guid")

        # Assert that the date has been set correctly
        self.assertEqual(
            updated_feed_item.date,
            datetime.datetime(2025, 3, 23, 12, 0, 0, tzinfo=timezone.utc),
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
        new_published_parsed = time.gmtime(time.mktime((2025, 3, 23, 12, 0, 0, 0, 0, 0)))
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
