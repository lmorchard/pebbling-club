import json
import datetime
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from ..models import Bookmark, Tag
from ..serializers import ActivityStreamSerializer

User = get_user_model()


class ActivityStreamRoundtripTests(TestCase):
    """Test ActivityStream import/export roundtrip functionality."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = Client()
        self.client.login(username="testuser", password="testpass123")

    def create_test_bookmarks(self):
        """Create sample bookmarks for testing."""
        # Create some tags
        tag1 = Tag.objects.create(name="python", owner=self.user)
        tag2 = Tag.objects.create(name="web-dev", owner=self.user)
        tag3 = Tag.objects.create(name="tutorial", owner=self.user)

        # Create bookmarks with various combinations
        bookmark1 = Bookmark.objects.create(
            url="https://example.com/article1",
            title="Python Tutorial",
            description="Learn Python basics",
            owner=self.user,
        )
        bookmark1.tags.set([tag1, tag3])

        bookmark2 = Bookmark.objects.create(
            url="https://example.com/article2",
            title="Web Development Guide",
            description="",  # Empty description
            owner=self.user,
            feed_url="https://example.com/feed.xml",
        )
        bookmark2.tags.set([tag2, tag3])

        bookmark3 = Bookmark.objects.create(
            url="https://example.com/article3",
            title="Unicode Test: こんにちは 🌟",
            description="Test with unicode characters: café, naïve, résumé",
            owner=self.user,
        )
        bookmark3.tags.set([tag1, tag2])

        # Bookmark with no tags
        bookmark4 = Bookmark.objects.create(
            url="https://example.com/article4",
            title="No Tags Bookmark",
            description="This bookmark has no tags",
            owner=self.user,
        )

        return [bookmark1, bookmark2, bookmark3, bookmark4]

    def test_single_bookmark_roundtrip(self):
        """Test roundtrip of a single bookmark preserves all data."""
        # Create a bookmark
        tag = Tag.objects.create(name="test-tag", owner=self.user)
        bookmark = Bookmark.objects.create(
            url="https://test.example.com",
            title="Test Bookmark",
            description="Test description",
            owner=self.user,
        )
        bookmark.tags.set([tag])

        # Export the bookmark
        export_url = reverse("bookmarks:export_activitystream")
        export_response = self.client.get(export_url)
        self.assertEqual(export_response.status_code, 200)

        # Parse exported data
        exported_data = json.loads(b"".join(export_response.streaming_content))

        # Validate export structure
        self.assertEqual(exported_data["type"], "Collection")
        self.assertEqual(len(exported_data["items"]), 1)

        exported_bookmark = exported_data["items"][0]
        self.assertEqual(exported_bookmark["type"], "Link")
        self.assertEqual(exported_bookmark["url"], bookmark.url)
        self.assertEqual(exported_bookmark["name"], bookmark.title)
        self.assertEqual(exported_bookmark["summary"], bookmark.description)
        self.assertEqual(exported_bookmark["tag"], ["test-tag"])

        # Clear existing bookmarks and tags
        Bookmark.objects.all().delete()
        Tag.objects.all().delete()

        # Import the data back
        import_url = reverse("bookmarks:import_activitystream")
        import_response = self.client.post(
            import_url, data=json.dumps(exported_data), content_type="application/json"
        )
        self.assertEqual(import_response.status_code, 200)

        import_result = import_response.json()
        self.assertEqual(import_result["imported"], 1)
        self.assertEqual(import_result["updated"], 0)
        self.assertEqual(import_result["errors"], [])

        # Verify imported bookmark
        imported_bookmark = Bookmark.objects.get(owner=self.user)
        self.assertEqual(imported_bookmark.url, bookmark.url)
        self.assertEqual(imported_bookmark.title, bookmark.title)
        self.assertEqual(imported_bookmark.description, bookmark.description)

        # Verify tags
        imported_tags = list(imported_bookmark.tags.values_list("name", flat=True))
        self.assertEqual(imported_tags, ["test-tag"])

    def test_multiple_bookmarks_roundtrip(self):
        """Test roundtrip of multiple bookmarks with various tag combinations."""
        original_bookmarks = self.create_test_bookmarks()
        original_count = len(original_bookmarks)

        # Export all bookmarks
        export_url = reverse("bookmarks:export_activitystream")
        export_response = self.client.get(export_url)
        self.assertEqual(export_response.status_code, 200)

        exported_data = json.loads(b"".join(export_response.streaming_content))
        self.assertEqual(len(exported_data["items"]), original_count)

        # Store original data for comparison
        original_data = {}
        for bookmark in original_bookmarks:
            tags = list(bookmark.tags.values_list("name", flat=True))
            original_data[bookmark.url] = {
                "title": bookmark.title,
                "description": bookmark.description,
                "feed_url": bookmark.feed_url,
                "tags": sorted(tags),
            }

        # Clear all bookmarks and tags
        Bookmark.objects.all().delete()
        Tag.objects.all().delete()

        # Import the data back
        import_url = reverse("bookmarks:import_activitystream")
        import_response = self.client.post(
            import_url, data=json.dumps(exported_data), content_type="application/json"
        )
        self.assertEqual(import_response.status_code, 200)

        import_result = import_response.json()
        self.assertEqual(import_result["imported"], original_count)
        self.assertEqual(import_result["updated"], 0)
        self.assertEqual(len(import_result["errors"]), 0)

        # Verify all bookmarks were imported correctly
        imported_bookmarks = Bookmark.objects.filter(owner=self.user)
        self.assertEqual(imported_bookmarks.count(), original_count)

        for bookmark in imported_bookmarks:
            original = original_data[bookmark.url]
            self.assertEqual(bookmark.title, original["title"])
            self.assertEqual(bookmark.description, original["description"])
            self.assertEqual(bookmark.feed_url, original["feed_url"])

            imported_tags = sorted(bookmark.tags.values_list("name", flat=True))
            self.assertEqual(imported_tags, original["tags"])

    def test_unicode_content_roundtrip(self):
        """Test roundtrip with unicode content in titles and descriptions."""
        # Create bookmark with unicode content
        tag = Tag.objects.create(name="unicode-test", owner=self.user)
        bookmark = Bookmark.objects.create(
            url="https://unicode.example.com",
            title="Unicode Test: 你好世界 🚀 café naïve",
            description="Description with unicode: résumé, São Paulo, Москва",
            owner=self.user,
        )
        bookmark.tags.set([tag])

        # Export and import
        export_url = reverse("bookmarks:export_activitystream")
        export_response = self.client.get(export_url)
        exported_data = json.loads(b"".join(export_response.streaming_content))

        # Clear and reimport
        Bookmark.objects.all().delete()
        Tag.objects.all().delete()

        import_url = reverse("bookmarks:import_activitystream")
        import_response = self.client.post(
            import_url, data=json.dumps(exported_data), content_type="application/json"
        )
        self.assertEqual(import_response.status_code, 200)

        # Verify unicode preservation
        imported_bookmark = Bookmark.objects.get(owner=self.user)
        self.assertEqual(imported_bookmark.title, bookmark.title)
        self.assertEqual(imported_bookmark.description, bookmark.description)

    def test_filtered_export_roundtrip(self):
        """Test roundtrip of filtered exports."""
        self.create_test_bookmarks()

        # Export only bookmarks with 'python' tag
        export_url = reverse("bookmarks:export_activitystream")
        export_response = self.client.get(export_url + "?tag=python")
        exported_data = json.loads(b"".join(export_response.streaming_content))

        # Should only get bookmarks with python tag
        python_bookmarks = Bookmark.objects.filter(
            owner=self.user, tags__name="python"
        ).distinct()
        self.assertEqual(len(exported_data["items"]), python_bookmarks.count())

        # Import to a new user to verify filtering worked
        new_user = User.objects.create_user(
            username="newuser", email="new@example.com", password="newpass123"
        )
        self.client.login(username="newuser", password="newpass123")

        import_url = reverse("bookmarks:import_activitystream")
        import_response = self.client.post(
            import_url, data=json.dumps(exported_data), content_type="application/json"
        )
        self.assertEqual(import_response.status_code, 200)

        # Verify only python-tagged bookmarks were imported
        imported_count = Bookmark.objects.filter(owner=new_user).count()
        self.assertEqual(imported_count, python_bookmarks.count())

    def test_skip_duplicates_functionality(self):
        """Test skip_duplicates import option."""
        # Create initial bookmark
        bookmark = Bookmark.objects.create(
            url="https://test.example.com",
            title="Original Title",
            description="Original description",
            owner=self.user,
        )

        # Export the bookmark
        export_url = reverse("bookmarks:export_activitystream")
        export_response = self.client.get(export_url)
        exported_data = json.loads(b"".join(export_response.streaming_content))

        # Modify exported data
        exported_data["items"][0]["name"] = "Modified Title"
        exported_data["items"][0]["summary"] = "Modified description"

        # Import with skip_duplicates=True
        import_url = reverse("bookmarks:import_activitystream")
        import_response = self.client.post(
            import_url + "?skip_duplicates=true",
            data=json.dumps(exported_data),
            content_type="application/json",
        )
        self.assertEqual(import_response.status_code, 200)

        import_result = import_response.json()
        self.assertEqual(import_result["imported"], 0)
        self.assertEqual(import_result["skipped"], 1)
        self.assertEqual(import_result["updated"], 0)

        # Verify original bookmark was not modified
        bookmark.refresh_from_db()
        self.assertEqual(bookmark.title, "Original Title")
        self.assertEqual(bookmark.description, "Original description")

        # Import with skip_duplicates=False (default)
        import_response = self.client.post(
            import_url, data=json.dumps(exported_data), content_type="application/json"
        )
        self.assertEqual(import_response.status_code, 200)

        import_result = import_response.json()
        self.assertEqual(import_result["imported"], 0)
        self.assertEqual(import_result["updated"], 1)
        self.assertEqual(import_result["skipped"], 0)

        # Verify bookmark was updated
        bookmark.refresh_from_db()
        self.assertEqual(bookmark.title, "Modified Title")
        self.assertEqual(bookmark.description, "Modified description")

    def test_empty_collection_roundtrip(self):
        """Test import/export of empty collections."""
        # Export with no bookmarks
        export_url = reverse("bookmarks:export_activitystream")
        export_response = self.client.get(export_url)
        exported_data = json.loads(b"".join(export_response.streaming_content))

        self.assertEqual(exported_data["type"], "Collection")
        self.assertEqual(exported_data["totalItems"], 0)
        self.assertEqual(len(exported_data["items"]), 0)

        # Import empty collection
        import_url = reverse("bookmarks:import_activitystream")
        import_response = self.client.post(
            import_url, data=json.dumps(exported_data), content_type="application/json"
        )
        self.assertEqual(import_response.status_code, 200)

        import_result = import_response.json()
        self.assertEqual(import_result["imported"], 0)
        self.assertEqual(import_result["updated"], 0)
        self.assertEqual(import_result["skipped"], 0)
        self.assertEqual(import_result["errors"], [])

    def test_error_cases(self):
        """Test various error scenarios."""
        import_url = reverse("bookmarks:import_activitystream")

        # Test invalid JSON
        response = self.client.post(
            import_url, data="invalid json", content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid JSON", response.json()["error"])

        # Test invalid content type
        response = self.client.post(
            import_url, data='{"test": "data"}', content_type="text/plain"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Content-Type", response.json()["error"])

        # Test malformed ActivityStream
        malformed_data = {"type": "NotACollection", "items": []}
        response = self.client.post(
            import_url, data=json.dumps(malformed_data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid ActivityStream format", response.json()["error"])

        # Test missing required fields
        invalid_link = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": [
                {
                    "type": "Link",
                    "url": "https://example.com",
                    # Missing required 'name' field
                }
            ],
        }
        response = self.client.post(
            import_url, data=json.dumps(invalid_link), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)  # Partial success
        result = response.json()
        self.assertEqual(result["imported"], 0)
        self.assertEqual(len(result["errors"]), 1)
        self.assertIn("missing required 'name' field", result["errors"][0])


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
