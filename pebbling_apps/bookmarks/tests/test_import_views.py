from unittest.mock import patch, Mock
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.messages import get_messages
from django.utils import timezone

from ..models import ImportJob

User = get_user_model()


class ImportViewTests(TestCase):
    """Test import-related views."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = Client()
        self.client.login(username="testuser", password="testpass123")

    def test_import_view_get(self):
        """Test GET request to import view."""
        response = self.client.get(reverse("bookmarks:import"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Import Bookmarks")
        self.assertContains(response, "Upload ActivityStreams JSON File")
        self.assertIn("form", response.context)
        self.assertIn("import_jobs", response.context)

    def test_import_view_with_existing_jobs(self):
        """Test import view with existing import jobs."""
        # Create some import jobs
        ImportJob.objects.create(
            user=self.user,
            file_path="test1.json",
            file_size=1024,
            status="completed",
            processed_bookmarks=10,
        )
        ImportJob.objects.create(
            user=self.user, file_path="test2.json", file_size=1024, status="processing"
        )

        response = self.client.get(reverse("bookmarks:import"))

        self.assertEqual(response.status_code, 200)
        import_jobs = response.context["import_jobs"]
        self.assertEqual(import_jobs.count(), 2)
        # Should show needs_refresh because one job is processing
        self.assertTrue(response.context["needs_refresh"])

    def test_import_view_no_refresh_needed(self):
        """Test import view when no refresh is needed."""
        # Create only completed/failed jobs
        ImportJob.objects.create(
            user=self.user, file_path="test1.json", file_size=1024, status="completed"
        )
        ImportJob.objects.create(
            user=self.user, file_path="test2.json", file_size=1024, status="failed"
        )

        response = self.client.get(reverse("bookmarks:import"))

        self.assertEqual(response.status_code, 200)
        # Should not need refresh
        self.assertFalse(response.context["needs_refresh"])

    def test_import_view_requires_login(self):
        """Test that import view requires authentication."""
        self.client.logout()
        response = self.client.get(reverse("bookmarks:import"))

        # Should redirect to login
        self.assertEqual(response.status_code, 302)


class ImportSubmitViewTests(TestCase):
    """Test import form submission view."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = Client()
        self.client.login(username="testuser", password="testpass123")

    @patch("pebbling_apps.bookmarks.tasks.process_import_job")
    @patch("pebbling_apps.bookmarks.views.import_views.save_import_file")
    def test_import_submit_success(self, mock_save_file, mock_task):
        """Test successful import submission."""
        mock_save_file.return_value = "imports/1/test.json"
        mock_task.delay.return_value = Mock()

        # Create a JSON file
        json_content = '{"@context": "https://www.w3.org/ns/activitystreams", "type": "Collection", "items": []}'
        uploaded_file = SimpleUploadedFile(
            "test.json", json_content.encode(), content_type="application/json"
        )

        response = self.client.post(
            reverse("bookmarks:import_submit"),
            {"file": uploaded_file, "duplicate_handling": "skip"},
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("bookmarks:import"))

        # Check import job was created
        import_job = ImportJob.objects.get(user=self.user)
        self.assertEqual(import_job.file_path, "imports/1/test.json")
        self.assertEqual(import_job.status, "pending")
        self.assertEqual(import_job.import_options["duplicate_handling"], "skip")

        # Check task was triggered
        mock_task.delay.assert_called_once_with(import_job.id)

        # Check success message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("queued for background processing", str(messages[0]))

    def test_import_submit_invalid_form(self):
        """Test import submission with invalid form."""
        # Submit without file
        response = self.client.post(
            reverse("bookmarks:import_submit"), {"duplicate_handling": "skip"}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("bookmarks:import"))

        # Should not create import job
        self.assertEqual(ImportJob.objects.filter(user=self.user).count(), 0)

        # Check error message
        messages = list(get_messages(response.wsgi_request))
        self.assertTrue(len(messages) > 0)

    def test_import_submit_requires_login(self):
        """Test that import submit requires authentication."""
        self.client.logout()
        response = self.client.post(reverse("bookmarks:import_submit"), {})

        # Should redirect to login
        self.assertEqual(response.status_code, 302)


class ImportRetryViewTests(TestCase):
    """Test import retry view."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = Client()
        self.client.login(username="testuser", password="testpass123")

    @patch("pebbling_apps.bookmarks.tasks.process_import_job")
    def test_retry_failed_job(self, mock_task):
        """Test retrying a failed import job."""
        import_job = ImportJob.objects.create(
            user=self.user,
            file_path="test.json",
            file_size=1024,
            status="failed",
            error_message="Test error",
            processed_bookmarks=5,
            failed_bookmarks=2,
            started_at=timezone.now(),
            completed_at=timezone.now(),
        )

        response = self.client.post(
            reverse("bookmarks:import_retry"), {"import_job_id": import_job.id}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("bookmarks:import"))

        # Check job was reset
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "pending")
        self.assertIsNone(import_job.error_message)
        self.assertEqual(import_job.processed_bookmarks, 0)
        self.assertEqual(import_job.failed_bookmarks, 0)
        self.assertIsNone(import_job.started_at)
        self.assertIsNone(import_job.completed_at)

        # Check task was triggered
        mock_task.delay.assert_called_once_with(import_job.id)

        # Check success message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("queued for retry", str(messages[0]))

    def test_retry_non_failed_job(self):
        """Test retrying a non-failed job should fail."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test.json", file_size=1024, status="completed"
        )

        response = self.client.post(
            reverse("bookmarks:import_retry"), {"import_job_id": import_job.id}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)

        # Job should remain unchanged
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "completed")

        # Check error message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("Only failed imports can be retried", str(messages[0]))

    def test_retry_other_users_job(self):
        """Test retrying another user's job should fail."""
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="testpass123"
        )
        import_job = ImportJob.objects.create(
            user=other_user, file_path="test.json", file_size=1024, status="failed"
        )

        response = self.client.post(
            reverse("bookmarks:import_retry"), {"import_job_id": import_job.id}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)

        # Check error message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("Import job not found", str(messages[0]))

    def test_retry_missing_job_id(self):
        """Test retry without job ID."""
        response = self.client.post(reverse("bookmarks:import_retry"), {})

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)

        # Check error message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("Invalid import job", str(messages[0]))

    def test_retry_requires_login(self):
        """Test that retry requires authentication."""
        self.client.logout()
        response = self.client.post(reverse("bookmarks:import_retry"), {})

        # Should redirect to login
        self.assertEqual(response.status_code, 302)


class ImportCancelViewTests(TestCase):
    """Test import cancel view."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = Client()
        self.client.login(username="testuser", password="testpass123")

    def test_cancel_pending_job(self):
        """Test cancelling a pending import job."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test.json", file_size=1024, status="pending"
        )

        response = self.client.post(
            reverse("bookmarks:import_cancel"), {"import_job_id": import_job.id}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("bookmarks:import"))

        # Check job was cancelled
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "cancelled")
        self.assertIsNotNone(import_job.completed_at)

        # Check success message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("has been cancelled", str(messages[0]))

    def test_cancel_processing_job(self):
        """Test cancelling a processing import job."""
        import_job = ImportJob.objects.create(
            user=self.user,
            file_path="test.json",
            file_size=1024,
            status="processing",
            started_at=timezone.now(),
        )

        response = self.client.post(
            reverse("bookmarks:import_cancel"), {"import_job_id": import_job.id}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)

        # Check job was cancelled
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "cancelled")

    def test_cancel_completed_job(self):
        """Test cancelling a completed job should fail."""
        import_job = ImportJob.objects.create(
            user=self.user, file_path="test.json", file_size=1024, status="completed"
        )

        response = self.client.post(
            reverse("bookmarks:import_cancel"), {"import_job_id": import_job.id}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)

        # Job should remain unchanged
        import_job.refresh_from_db()
        self.assertEqual(import_job.status, "completed")

        # Check error message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn(
            "Only pending or processing imports can be cancelled", str(messages[0])
        )

    def test_cancel_other_users_job(self):
        """Test cancelling another user's job should fail."""
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="testpass123"
        )
        import_job = ImportJob.objects.create(
            user=other_user, file_path="test.json", file_size=1024, status="pending"
        )

        response = self.client.post(
            reverse("bookmarks:import_cancel"), {"import_job_id": import_job.id}
        )

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)

        # Check error message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("Import job not found", str(messages[0]))

    def test_cancel_missing_job_id(self):
        """Test cancel without job ID."""
        response = self.client.post(reverse("bookmarks:import_cancel"), {})

        # Should redirect back to import page
        self.assertEqual(response.status_code, 302)

        # Check error message
        messages = list(get_messages(response.wsgi_request))
        self.assertEqual(len(messages), 1)
        self.assertIn("Invalid import job", str(messages[0]))

    def test_cancel_requires_login(self):
        """Test that cancel requires authentication."""
        self.client.logout()
        response = self.client.post(reverse("bookmarks:import_cancel"), {})

        # Should redirect to login
        self.assertEqual(response.status_code, 302)
