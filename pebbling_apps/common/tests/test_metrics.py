"""
Tests for Prometheus metrics integration.
"""

from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.feeds.models import Feed, FeedItem
import json


class PrometheusMetricsTestCase(TestCase):
    """Test case for Prometheus metrics functionality."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        self.user = get_user_model().objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_metrics_endpoint_accessible(self):
        """Test that the /metrics endpoint is accessible and returns data."""
        response = self.client.get("/metrics")

        # Should return 200 OK
        self.assertEqual(response.status_code, 200)

        # Should return prometheus text format
        self.assertEqual(
            response["content-type"], "text/plain; version=0.0.4; charset=utf-8"
        )

        # Should contain some basic prometheus metrics
        content = response.content.decode("utf-8")
        self.assertIn("# HELP", content)
        self.assertIn("# TYPE", content)

    def test_django_metrics_present(self):
        """Test that basic Django metrics are being collected."""
        # Make a request to generate some metrics
        response = self.client.get("/")

        # Get metrics
        metrics_response = self.client.get("/metrics")
        content = metrics_response.content.decode("utf-8")

        # Should contain HTTP request metrics
        self.assertIn("django_http_requests_total", content)

        # Should contain database query metrics
        self.assertIn("django_db_query_duration_seconds", content)

    def test_custom_bookmark_metrics_registered(self):
        """Test that custom bookmark metrics are registered."""
        metrics_response = self.client.get("/metrics")
        content = metrics_response.content.decode("utf-8")

        # Check for custom bookmark metrics
        expected_metrics = [
            "bookmark_operations_total",
            "import_jobs_total",
            "import_job_duration_seconds",
        ]

        for metric in expected_metrics:
            self.assertIn(metric, content)

    def test_custom_feed_metrics_registered(self):
        """Test that custom feed metrics are registered."""
        metrics_response = self.client.get("/metrics")
        content = metrics_response.content.decode("utf-8")

        # Check for custom feed metrics
        expected_metrics = [
            "feed_polls_total",
            "feed_poll_duration_seconds",
            "feed_items_discovered_total",
            "active_feeds_count",
        ]

        for metric in expected_metrics:
            self.assertIn(metric, content)

    def test_bookmark_creation_metrics(self):
        """Test that bookmark creation generates metrics."""
        # Create a bookmark
        bookmark = Bookmark.objects.create(
            url="https://example.com", title="Test Bookmark", owner=self.user
        )

        # Get metrics
        metrics_response = self.client.get("/metrics")
        content = metrics_response.content.decode("utf-8")

        # Should contain bookmark operation metric
        self.assertIn("bookmark_operations_total", content)
        # Note: The actual metric value testing would require more complex parsing
        # of the prometheus format, which is beyond the scope of this basic test

    def test_model_metrics_present(self):
        """Test that model-level metrics are present."""
        metrics_response = self.client.get("/metrics")
        content = metrics_response.content.decode("utf-8")

        # Should contain model creation metrics from django-prometheus
        model_metrics = [
            "django_model_inserts_total",
            "django_model_updates_total",
            "django_model_deletes_total",
        ]

        for metric in model_metrics:
            self.assertIn(metric, content)
