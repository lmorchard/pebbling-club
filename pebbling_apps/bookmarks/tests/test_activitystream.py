from django.test import TestCase
from django.contrib.auth import get_user_model
from ..models import Bookmark, Tag
from ..serializers import ActivityStreamSerializer

User = get_user_model()


class ActivityStreamSerializerTests(TestCase):
    """Test ActivityStreamSerializer methods directly."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.serializer = ActivityStreamSerializer()

    def test_bookmark_to_link_conversion(self):
        """Test converting a bookmark to ActivityStream Link object."""
        tag = Tag.objects.create(name="test-tag", owner=self.user)
        bookmark = Bookmark.objects.create(
            url="https://example.com",
            title="Test Bookmark",
            description="Test description",
            feed_url="https://example.com/feed.xml",
            owner=self.user,
        )
        bookmark.tags.set([tag])

        link_obj = self.serializer.bookmark_to_link(bookmark)

        self.assertEqual(link_obj["type"], "Link")
        self.assertEqual(link_obj["url"], bookmark.url)
        self.assertEqual(link_obj["name"], bookmark.title)
        self.assertEqual(link_obj["summary"], bookmark.description)
        self.assertEqual(link_obj["feedUrl"], bookmark.feed_url)
        self.assertEqual(link_obj["tag"], ["test-tag"])
        self.assertIn("published", link_obj)
        self.assertIn("updated", link_obj)

    def test_link_to_bookmark_data_conversion(self):
        """Test converting ActivityStream Link to bookmark data."""
        link_data = {
            "type": "Link",
            "url": "https://example.com",
            "name": "Test Bookmark",
            "summary": "Test description",
            "feedUrl": "https://example.com/feed.xml",
            "tag": ["tag1", "tag2"],
            "published": "2024-01-01T12:00:00Z",
        }

        bookmark_data = self.serializer.link_to_bookmark_data(link_data, self.user)

        self.assertEqual(bookmark_data["url"], link_data["url"])
        self.assertEqual(bookmark_data["title"], link_data["name"])
        self.assertEqual(bookmark_data["description"], link_data["summary"])
        self.assertEqual(bookmark_data["feed_url"], link_data["feedUrl"])
        self.assertEqual(bookmark_data["owner"], self.user)
        self.assertEqual(bookmark_data["_tags"], ["tag1", "tag2"])

    def test_activitystream_validation(self):
        """Test ActivityStream format validation."""
        # Valid collection
        valid_data = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": [],
        }
        result = self.serializer.validate_activitystream_format(valid_data)
        self.assertTrue(result["valid"])

        # Invalid - missing context
        invalid_data = {"type": "Collection", "items": []}
        result = self.serializer.validate_activitystream_format(invalid_data)
        self.assertFalse(result["valid"])
        self.assertIn("Missing @context", result["errors"][0])

        # Invalid - wrong type
        invalid_data = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "NotCollection",
            "items": [],
        }
        result = self.serializer.validate_activitystream_format(invalid_data)
        self.assertFalse(result["valid"])
        self.assertIn("must be of type 'Collection'", result["errors"][0])
