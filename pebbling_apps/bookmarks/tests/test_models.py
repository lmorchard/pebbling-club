from django.test import TestCase
from django.contrib.auth import get_user_model
from pebbling_apps.bookmarks.models import Bookmark

User = get_user_model()

class BookmarkManagerTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='12345')

    def test_update_or_create_sets_feed_url(self):
        # Create a bookmark with unfurl_metadata but no feed_url
        bookmark, created = Bookmark.objects.update_or_create(
            url='http://example.com',
            owner=self.user,
            defaults={
                'title': 'Example',
                'unfurl_metadata': {'feed_url': 'http://example.com/feed'}
            }
        )
        self.assertTrue(created)
        self.assertEqual(bookmark.feed_url, 'http://example.com/feed')

        # Update the bookmark, ensure feed_url is set from unfurl_metadata
        bookmark, created = Bookmark.objects.update_or_create(
            url='http://example.com',
            owner=self.user,
            defaults={'title': 'Updated Example'}
        )
        self.assertFalse(created)
        self.assertEqual(bookmark.feed_url, 'http://example.com/feed')
