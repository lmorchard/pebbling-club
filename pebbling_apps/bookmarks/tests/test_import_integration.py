import json
import tempfile
from unittest.mock import patch, Mock
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from ..models import ImportJob, Bookmark, Tag
from ..services import ImportService, save_import_file
from ..tasks import process_import_job

User = get_user_model()


class ImportIntegrationTests(TransactionTestCase):
    """Integration tests for the complete import workflow."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.import_service = ImportService()

    def _mock_storage_for_content(self, mock_storage, json_content):
        """Helper method to mock storage for both reading and writing JSON content."""
        mock_destination = Mock()
        mock_source = Mock()
        mock_source.read.return_value = json_content
        mock_storage.open.side_effect = lambda path, mode: (
            Mock(__enter__=Mock(return_value=mock_destination), __exit__=Mock())
            if "w" in mode
            else Mock(__enter__=Mock(return_value=mock_source), __exit__=Mock())
        )

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_complete_import_workflow_success(self, mock_storage):
        """Test the complete import workflow from file upload to completion."""
        # Create realistic ActivityStreams data
        activitystream_data = {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                {"pebbling": "https://pebbling.club/ns/"},
            ],
            "type": "Collection",
            "published": "2024-01-01T12:00:00Z",
            "totalItems": 3,
            "items": [
                {
                    "type": "Link",
                    "url": "https://example.com/article1",
                    "name": "Test Article 1",
                    "summary": "This is the first test article",
                    "tag": ["tech", "programming"],
                    "published": "2024-01-01T10:00:00Z",
                },
                {
                    "type": "Link",
                    "url": "https://example.com/article2",
                    "name": "Test Article 2",
                    "summary": "This is the second test article",
                    "tag": ["science"],
                    "published": "2024-01-01T11:00:00Z",
                    "feedUrl": "https://example.com/feed.xml",
                },
                {
                    "type": "Link",
                    "url": "https://example.com/article3",
                    "name": "Test Article 3",
                    "summary": "This is the third test article",
                    "tag": ["news", "tech"],
                    "published": "2024-01-01T12:00:00Z",
                },
            ],
        }

        # Step 1: Save file (simulating file upload)
        json_content = json.dumps(activitystream_data)
        mock_file = SimpleUploadedFile("test.json", json_content.encode())

        # Mock storage operations for both write and read
        self._mock_storage_for_content(mock_storage, json_content)

        file_path = save_import_file(mock_file, self.user)

        # Step 2: Create import job
        import_job = ImportJob.objects.create(
            user=self.user,
            file_path=file_path,
            file_size=len(json_content),
            import_options={"duplicate_handling": "skip"},
        )

        # Step 3: Process the import job
        process_import_job(import_job.id)

        # Step 4: Verify results
        import_job.refresh_from_db()

        # Check import job status
        self.assertEqual(import_job.status, "completed")
        self.assertEqual(import_job.total_bookmarks, 3)
        self.assertEqual(import_job.processed_bookmarks, 3)
        self.assertEqual(import_job.failed_bookmarks, 0)
        self.assertIsNotNone(import_job.started_at)
        self.assertIsNotNone(import_job.completed_at)

        # Check bookmarks were created
        bookmarks = Bookmark.objects.filter(owner=self.user).order_by("url")
        self.assertEqual(bookmarks.count(), 3)

        # Verify first bookmark
        bookmark1 = bookmarks[0]
        self.assertEqual(bookmark1.url, "https://example.com/article1")
        self.assertEqual(bookmark1.title, "Test Article 1")
        self.assertEqual(bookmark1.description, "This is the first test article")
        tag_names = [tag.name for tag in bookmark1.tags.all()]
        self.assertIn("tech", tag_names)
        self.assertIn("programming", tag_names)

        # Verify second bookmark with feed
        bookmark2 = bookmarks[1]
        self.assertEqual(bookmark2.url, "https://example.com/article2")
        self.assertEqual(bookmark2.feed_url, "https://example.com/feed.xml")

        # Check tags were created properly
        all_tags = Tag.objects.filter(owner=self.user)
        tag_names = [tag.name for tag in all_tags]
        expected_tags = {"tech", "programming", "science", "news"}
        self.assertTrue(expected_tags.issubset(set(tag_names)))

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_import_with_duplicates_skip(self, mock_storage):
        """Test import with duplicate handling set to skip."""
        # Create existing bookmark
        existing_bookmark = Bookmark.objects.create(
            url="https://example.com/article1",
            title="Original Title",
            description="Original description",
            owner=self.user,
        )

        # Create ActivityStreams data with duplicate URL
        activitystream_data = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": [
                {
                    "type": "Link",
                    "url": "https://example.com/article1",  # Duplicate
                    "name": "New Title",
                    "summary": "New description",
                },
                {
                    "type": "Link",
                    "url": "https://example.com/article2",  # New
                    "name": "Unique Article",
                    "summary": "Unique description",
                },
            ],
        }

        # Save and process
        json_content = json.dumps(activitystream_data)
        mock_file = SimpleUploadedFile("test.json", json_content.encode())

        # Mock storage operations for both write and read
        self._mock_storage_for_content(mock_storage, json_content)

        file_path = save_import_file(mock_file, self.user)

        import_job = ImportJob.objects.create(
            user=self.user,
            file_path=file_path,
            file_size=len(json_content),
            import_options={"duplicate_handling": "skip"},
        )

        process_import_job(import_job.id)

        # Verify results
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "completed")
        self.assertEqual(import_job.processed_bookmarks, 2)

        # Check that original bookmark was not modified
        existing_bookmark.refresh_from_db()
        self.assertEqual(existing_bookmark.title, "Original Title")
        self.assertEqual(existing_bookmark.description, "Original description")

        # Check that new bookmark was created
        self.assertEqual(Bookmark.objects.filter(owner=self.user).count(), 2)
        new_bookmark = Bookmark.objects.get(url="https://example.com/article2")
        self.assertEqual(new_bookmark.title, "Unique Article")

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_import_with_duplicates_overwrite(self, mock_storage):
        """Test import with duplicate handling set to overwrite."""
        # Create existing bookmark
        existing_bookmark = Bookmark.objects.create(
            url="https://example.com/article1",
            title="Original Title",
            description="Original description",
            owner=self.user,
        )

        # Create ActivityStreams data with duplicate URL
        activitystream_data = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": [
                {
                    "type": "Link",
                    "url": "https://example.com/article1",  # Duplicate
                    "name": "Updated Title",
                    "summary": "Updated description",
                }
            ],
        }

        # Save and process
        json_content = json.dumps(activitystream_data)
        mock_file = SimpleUploadedFile("test.json", json_content.encode())

        # Mock storage operations for both write and read
        self._mock_storage_for_content(mock_storage, json_content)

        file_path = save_import_file(mock_file, self.user)

        import_job = ImportJob.objects.create(
            user=self.user,
            file_path=file_path,
            file_size=len(json_content),
            import_options={"duplicate_handling": "overwrite"},
        )

        process_import_job(import_job.id)

        # Verify results
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "completed")
        self.assertEqual(import_job.processed_bookmarks, 1)

        # Check that bookmark was updated
        existing_bookmark.refresh_from_db()
        self.assertEqual(existing_bookmark.title, "Updated Title")
        self.assertEqual(existing_bookmark.description, "Updated description")

        # Should still have only one bookmark
        self.assertEqual(Bookmark.objects.filter(owner=self.user).count(), 1)

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_import_with_failures(self, mock_storage):
        """Test import with some items failing."""
        # Mock storage operations
        mock_destination = Mock()
        mock_storage.open.return_value.__enter__.return_value = mock_destination
        # Create ActivityStreams data with one invalid item
        activitystream_data = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": [
                {
                    "type": "Link",
                    "url": "https://example.com/good",
                    "name": "Good Article",
                },
                {
                    "type": "Link",
                    # Missing required URL field
                    "name": "Bad Article",
                },
                {
                    "type": "Link",
                    "url": "https://example.com/another-good",
                    "name": "Another Good Article",
                },
            ],
        }

        # Save and process
        json_content = json.dumps(activitystream_data)
        mock_file = SimpleUploadedFile("test.json", json_content.encode())

        # Mock storage operations for both write and read
        self._mock_storage_for_content(mock_storage, json_content)

        file_path = save_import_file(mock_file, self.user)

        import_job = ImportJob.objects.create(
            user=self.user,
            file_path=file_path,
            file_size=len(json_content),
            import_options={"duplicate_handling": "skip"},
        )

        process_import_job(import_job.id)

        # Verify results
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "completed")
        self.assertEqual(import_job.total_bookmarks, 3)
        self.assertEqual(import_job.processed_bookmarks, 2)
        self.assertEqual(import_job.failed_bookmarks, 1)
        self.assertEqual(len(import_job.failed_bookmark_details), 1)

        # Check failed item details
        failed_detail = import_job.failed_bookmark_details[0]
        self.assertEqual(failed_detail["index"], 2)
        self.assertEqual(failed_detail["title"], "Bad Article")

        # Check that good bookmarks were still created
        self.assertEqual(Bookmark.objects.filter(owner=self.user).count(), 2)

    def test_import_file_not_found(self):
        """Test import when uploaded file is missing."""
        import_job = ImportJob.objects.create(
            user=self.user,
            file_path="nonexistent/file.json",
            file_size=1024,
            import_options={"duplicate_handling": "skip"},
        )

        process_import_job(import_job.id)

        # Verify job failed
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "failed")
        self.assertIn("Upload file not found", import_job.error_message)

    def test_import_invalid_json(self):
        """Test import with invalid JSON file."""
        # Create invalid JSON file
        invalid_json = "{ invalid json content"
        file_path = default_storage.save(
            f"imports/{self.user.id}/invalid.json", ContentFile(invalid_json)
        )

        import_job = ImportJob.objects.create(
            user=self.user,
            file_path=file_path,
            file_size=len(invalid_json),
            import_options={"duplicate_handling": "skip"},
        )

        process_import_job(import_job.id)

        # Verify job failed
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "failed")
        self.assertIn("Invalid JSON format", import_job.error_message)

        # Cleanup
        default_storage.delete(file_path)

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_import_progress_tracking(self, mock_storage):
        """Test that import progress is tracked correctly."""
        # Mock storage operations
        mock_destination = Mock()
        mock_storage.open.return_value.__enter__.return_value = mock_destination
        # Create data with enough items to trigger progress updates
        items = []
        for i in range(25):  # More than the 10-item update threshold
            items.append(
                {
                    "type": "Link",
                    "url": f"https://example.com/article{i}",
                    "name": f"Article {i}",
                }
            )

        activitystream_data = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": items,
        }

        # Save and process
        json_content = json.dumps(activitystream_data)
        mock_file = SimpleUploadedFile("test.json", json_content.encode())

        # Mock storage operations for both write and read
        self._mock_storage_for_content(mock_storage, json_content)

        file_path = save_import_file(mock_file, self.user)

        import_job = ImportJob.objects.create(
            user=self.user,
            file_path=file_path,
            file_size=len(json_content),
            import_options={"duplicate_handling": "skip"},
        )

        process_import_job(import_job.id)

        # Verify final results
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "completed")
        self.assertEqual(import_job.total_bookmarks, 25)
        self.assertEqual(import_job.processed_bookmarks, 25)
        self.assertEqual(import_job.progress_percentage, 100.0)

    def tearDown(self):
        """Clean up any uploaded files."""
        # Clean up any files that might have been created
        try:
            import_jobs = ImportJob.objects.filter(user=self.user)
            for job in import_jobs:
                if job.file_path and default_storage.exists(job.file_path):
                    default_storage.delete(job.file_path)
        except Exception:
            pass  # Ignore cleanup errors
