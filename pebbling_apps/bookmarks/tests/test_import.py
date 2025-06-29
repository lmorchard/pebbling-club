import json
import tempfile
from unittest.mock import patch, Mock, mock_open
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone
from datetime import datetime, timedelta

from ..models import ImportJob, Bookmark, Tag
from ..services import ImportService, save_import_file
from ..tasks import process_import_job

User = get_user_model()


class ImportJobModelTests(TestCase):
    """Test ImportJob model functionality."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_import_job_creation(self):
        """Test basic ImportJob creation."""
        import_job = ImportJob.objects.create(
            user=self.user,
            file_path="test/path.json",
            file_size=1024,
            import_options={"duplicate_handling": "skip"},
        )

        self.assertEqual(import_job.user, self.user)
        self.assertEqual(import_job.file_path, "test/path.json")
        self.assertEqual(import_job.file_size, 1024)
        self.assertEqual(import_job.status, "pending")
        self.assertEqual(import_job.import_options["duplicate_handling"], "skip")
        self.assertIsNone(import_job.started_at)
        self.assertIsNone(import_job.completed_at)

    def test_progress_percentage_calculation(self):
        """Test progress percentage calculation."""
        import_job = ImportJob.objects.create(
            user=self.user,
            file_path="test/path.json",
            file_size=1024,
            total_bookmarks=100,
            processed_bookmarks=50,
        )

        self.assertEqual(import_job.progress_percentage, 50.0)

        # Test zero division protection
        import_job.total_bookmarks = 0
        self.assertEqual(import_job.progress_percentage, 0.0)

    def test_update_progress_method(self):
        """Test the update_progress method."""
        import_job = ImportJob.objects.create(
            user=self.user,
            file_path="test/path.json",
            file_size=1024,
            total_bookmarks=100,
        )

        import_job.update_progress(25, 5)
        import_job.refresh_from_db()

        self.assertEqual(import_job.processed_bookmarks, 25)
        self.assertEqual(import_job.failed_bookmarks, 5)
        self.assertIsNotNone(import_job.updated_at)

    def test_status_choices(self):
        """Test all status choices are valid."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test/path.json", file_size=1024
        )

        valid_statuses = ["pending", "processing", "completed", "failed", "cancelled"]

        for status in valid_statuses:
            import_job.status = status
            import_job.save()
            import_job.refresh_from_db()
            self.assertEqual(import_job.status, status)


class ImportServiceTests(TestCase):
    """Test ImportService functionality."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.import_service = ImportService()
        self.sample_activitystream_data = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": [
                {
                    "type": "Link",
                    "url": "https://example.com",
                    "name": "Test Bookmark",
                    "summary": "Test description",
                    "tag": ["test", "example"],
                    "published": "2024-01-01T12:00:00Z",
                }
            ],
        }

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_load_json_file_success(self, mock_storage):
        """Test successful JSON file loading."""
        json_content = json.dumps(self.sample_activitystream_data)
        mock_file = mock_open(read_data=json_content)
        mock_storage.open.return_value = mock_file.return_value

        result = self.import_service.load_json_file("test/path.json")

        self.assertEqual(result, self.sample_activitystream_data)
        mock_storage.open.assert_called_once_with("test/path.json", "r")

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_load_json_file_not_found(self, mock_storage):
        """Test FileNotFoundError handling."""
        mock_storage.open.side_effect = FileNotFoundError()

        with self.assertRaises(FileNotFoundError) as context:
            self.import_service.load_json_file("test/path.json")

        self.assertIn("Upload file not found", str(context.exception))

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_load_json_file_invalid_json(self, mock_storage):
        """Test JSON decode error handling."""
        mock_file = mock_open(read_data="invalid json {")
        mock_storage.open.return_value = mock_file.return_value

        with self.assertRaises(json.JSONDecodeError) as context:
            self.import_service.load_json_file("test/path.json")

        self.assertIn("Invalid JSON format", str(context.exception))

    def test_process_bookmark_item_new_bookmark(self):
        """Test processing a new bookmark item."""
        link_item = {
            "type": "Link",
            "url": "https://example.com",
            "name": "Test Bookmark",
            "summary": "Test description",
            "tag": ["test"],
            "published": "2024-01-01T12:00:00Z",
        }

        bookmark, created, error = self.import_service.process_bookmark_item(
            link_item, self.user, "skip"
        )

        self.assertIsNotNone(bookmark)
        self.assertTrue(created)
        self.assertIsNone(error)
        self.assertEqual(bookmark.url, "https://example.com")
        self.assertEqual(bookmark.title, "Test Bookmark")
        self.assertEqual(bookmark.description, "Test description")
        self.assertEqual(bookmark.owner, self.user)

        # Check tags were created
        tag_names = [tag.name for tag in bookmark.tags.all()]
        self.assertIn("test", tag_names)

    def test_process_bookmark_item_duplicate_skip(self):
        """Test processing a duplicate bookmark with skip option."""
        # Create existing bookmark
        existing_bookmark = Bookmark.objects.create(
            url="https://example.com", title="Existing Title", owner=self.user
        )

        link_item = {
            "type": "Link",
            "url": "https://example.com",
            "name": "New Title",
            "summary": "New description",
        }

        bookmark, created, error = self.import_service.process_bookmark_item(
            link_item, self.user, "skip"
        )

        self.assertIsNotNone(bookmark)
        self.assertFalse(created)
        self.assertIsNone(error)
        self.assertEqual(bookmark.id, existing_bookmark.id)
        # Title should remain unchanged with skip
        self.assertEqual(bookmark.title, "Existing Title")

    def test_process_bookmark_item_duplicate_overwrite(self):
        """Test processing a duplicate bookmark with overwrite option."""
        # Create existing bookmark
        existing_bookmark = Bookmark.objects.create(
            url="https://example.com", title="Existing Title", owner=self.user
        )

        link_item = {
            "type": "Link",
            "url": "https://example.com",
            "name": "New Title",
            "summary": "New description",
        }

        bookmark, created, error = self.import_service.process_bookmark_item(
            link_item, self.user, "overwrite"
        )

        self.assertIsNotNone(bookmark)
        self.assertFalse(created)
        self.assertIsNone(error)
        self.assertEqual(bookmark.id, existing_bookmark.id)
        # Title should be updated with overwrite
        self.assertEqual(bookmark.title, "New Title")
        self.assertEqual(bookmark.description, "New description")

    def test_process_import_data_success(self):
        """Test successful import data processing."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test/path.json", file_size=1024
        )

        results = self.import_service.process_import_data(
            import_job, self.sample_activitystream_data
        )

        self.assertEqual(results["processed"], 1)
        self.assertEqual(results["failed"], 0)
        self.assertEqual(len(results["failed_details"]), 0)

        # Check import job was updated
        import_job.refresh_from_db()
        self.assertEqual(import_job.total_bookmarks, 1)

        # Check bookmark was created
        self.assertEqual(Bookmark.objects.filter(owner=self.user).count(), 1)
        bookmark = Bookmark.objects.get(owner=self.user)
        self.assertEqual(bookmark.url, "https://example.com")

    def test_process_import_data_with_failures(self):
        """Test import data processing with some failures."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test/path.json", file_size=1024
        )

        # Create data with one good item and one bad item
        data_with_failures = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Collection",
            "items": [
                {"type": "Link", "url": "https://example.com", "name": "Good Bookmark"},
                {
                    "type": "Link",
                    # Missing required URL field
                    "name": "Bad Bookmark",
                },
            ],
        }

        results = self.import_service.process_import_data(
            import_job, data_with_failures
        )

        self.assertEqual(results["processed"], 1)
        self.assertEqual(results["failed"], 1)
        self.assertEqual(len(results["failed_details"]), 1)

        failed_detail = results["failed_details"][0]
        self.assertEqual(failed_detail["index"], 2)
        self.assertIn("error", failed_detail)

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_cleanup_import_file_success(self, mock_storage):
        """Test successful file cleanup."""
        self.import_service.cleanup_import_file("test/path.json")
        mock_storage.delete.assert_called_once_with("test/path.json")

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_cleanup_import_file_failure(self, mock_storage):
        """Test file cleanup failure handling."""
        mock_storage.delete.side_effect = Exception("Delete failed")

        # Should not raise exception
        self.import_service.cleanup_import_file("test/path.json")
        mock_storage.delete.assert_called_once_with("test/path.json")


class SaveImportFileTests(TestCase):
    """Test save_import_file utility function."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    @patch("pebbling_apps.bookmarks.services.default_storage")
    def test_save_import_file(self, mock_storage):
        """Test saving an import file."""
        mock_file = Mock()
        mock_file.chunks.return_value = [b'{"test":', b' "data"}']
        mock_destination = Mock()
        mock_storage.open.return_value.__enter__.return_value = mock_destination

        result = save_import_file(mock_file, self.user)

        # Verify chunks() was called and data was written
        mock_file.chunks.assert_called_once()
        self.assertEqual(mock_destination.write.call_count, 2)
        mock_destination.write.assert_any_call(b'{"test":')
        mock_destination.write.assert_any_call(b' "data"}')

        # Check the path structure
        args = mock_storage.open.call_args[0]
        saved_path = args[0]
        self.assertTrue(saved_path.startswith(f"imports/{self.user.id}/"))
        self.assertTrue(saved_path.endswith(".json"))
        self.assertEqual(result, saved_path)


class ProcessImportJobTaskTests(TestCase):
    """Test the process_import_job Celery task."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    @patch("pebbling_apps.bookmarks.services.ImportService")
    def test_process_import_job_success(self, mock_import_service_class):
        """Test successful import job processing."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test/path.json", file_size=1024, status="pending"
        )

        # Mock the service
        mock_service = Mock()
        mock_import_service_class.return_value = mock_service
        mock_service.load_json_file.return_value = {"test": "data"}
        mock_service.process_import_data.return_value = {
            "processed": 5,
            "failed": 1,
            "failed_details": [],
        }

        # Run the task
        process_import_job(import_job.id)

        # Check import job was updated
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "completed")
        self.assertEqual(import_job.processed_bookmarks, 5)
        self.assertEqual(import_job.failed_bookmarks, 1)
        self.assertIsNotNone(import_job.started_at)
        self.assertIsNotNone(import_job.completed_at)

        # Check service methods were called
        mock_service.load_json_file.assert_called_once_with("test/path.json")
        mock_service.process_import_data.assert_called_once()
        mock_service.cleanup_import_file.assert_called_once_with("test/path.json")

    @patch("pebbling_apps.bookmarks.services.ImportService")
    def test_process_import_job_file_error(self, mock_import_service_class):
        """Test import job with file loading error."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test/path.json", file_size=1024, status="pending"
        )

        # Mock the service to raise file error
        mock_service = Mock()
        mock_import_service_class.return_value = mock_service
        mock_service.load_json_file.side_effect = FileNotFoundError("File not found")

        # Run the task
        process_import_job(import_job.id)

        # Check import job was marked as failed
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "failed")
        self.assertEqual(import_job.error_message, "File not found")
        self.assertIsNotNone(import_job.started_at)
        self.assertIsNotNone(import_job.completed_at)

    def test_process_import_job_not_found(self):
        """Test import job processing when job doesn't exist."""
        # Should not raise exception
        process_import_job(99999)
