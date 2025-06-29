"""
Management command to test Prometheus metrics collection.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from pebbling_apps.bookmarks.models import Bookmark
from pebbling_apps.feeds.models import Feed, FeedItem
from pebbling_apps.bookmarks.metrics import (
    increment_bookmark_operation,
    record_import_job_completion,
    update_bookmark_count_for_user,
)
from pebbling_apps.feeds.metrics import (
    increment_feed_poll_total,
    observe_feed_poll_duration,
    set_feed_items_discovered,
    update_active_feeds_count,
)
import requests
import time


class Command(BaseCommand):
    """Test metrics collection by triggering various operations."""

    help = "Test Prometheus metrics collection by simulating operations"

    def add_arguments(self, parser):
        parser.add_argument(
            "--show-metrics",
            action="store_true",
            help="Show current metrics from /metrics endpoint",
        )

    def handle(self, *args, **options):
        """Execute the command."""
        self.stdout.write(self.style.SUCCESS("Starting metrics testing..."))

        if options["show_metrics"]:
            self.show_current_metrics()
            return

        # Create test user if not exists
        user, created = get_user_model().objects.get_or_create(
            username="metrics_test_user",
            defaults={
                "email": "metrics@test.com",
                "first_name": "Metrics",
                "last_name": "Test",
            },
        )

        if created:
            self.stdout.write(f"Created test user: {user.username}")
        else:
            self.stdout.write(f"Using existing test user: {user.username}")

        # Test bookmark operations
        self.test_bookmark_operations(user)

        # Test feed operations
        self.test_feed_operations()

        # Test custom metrics
        self.test_custom_metrics(user)

        self.stdout.write(self.style.SUCCESS("Metrics testing completed!"))
        self.stdout.write("Check metrics at http://localhost:8000/metrics")

    def test_bookmark_operations(self, user):
        """Test bookmark-related metrics."""
        self.stdout.write("Testing bookmark operations...")

        # Create test bookmarks
        urls = [
            "https://example.com/test1",
            "https://example.com/test2",
            "https://example.com/test3",
        ]

        for i, url in enumerate(urls):
            bookmark, created = Bookmark.objects.get_or_create(
                url=url, owner=user, defaults={"title": f"Test Bookmark {i+1}"}
            )

            if created:
                self.stdout.write(f"  Created bookmark: {bookmark.title}")
            else:
                # Update to trigger update metrics
                bookmark.title = f"Updated Test Bookmark {i+1}"
                bookmark.save()
                self.stdout.write(f"  Updated bookmark: {bookmark.title}")

        # Update bookmark count metric
        bookmark_count = Bookmark.objects.filter(owner=user).count()
        update_bookmark_count_for_user(user.id, bookmark_count)
        self.stdout.write(f"  Updated bookmark count for user: {bookmark_count}")

    def test_feed_operations(self):
        """Test feed-related metrics."""
        self.stdout.write("Testing feed operations...")

        # Create test feed
        feed, created = Feed.objects.get_or_create(
            url="https://example.com/feed.xml", defaults={"title": "Test Feed"}
        )

        if created:
            self.stdout.write(f"  Created feed: {feed.title}")

        # Simulate feed polling metrics
        increment_feed_poll_total(feed.id, "success")
        observe_feed_poll_duration(feed.id, 1.5)  # 1.5 seconds
        set_feed_items_discovered(feed.id, 3)  # 3 new items

        self.stdout.write("  Recorded feed polling metrics")

        # Update active feeds count
        active_count = Feed.objects.filter(disabled=False).count()
        update_active_feeds_count(active_count)
        self.stdout.write(f"  Updated active feeds count: {active_count}")

    def test_custom_metrics(self, user):
        """Test custom metrics directly."""
        self.stdout.write("Testing custom metrics...")

        # Test bookmark operation metrics
        increment_bookmark_operation("create", user.id, "test")
        increment_bookmark_operation("update", user.id, "test")

        # Test import job metrics
        record_import_job_completion(
            user.id,
            "test_format",
            2.5,  # duration
            "completed",
            10,  # processed
            2,  # failed
        )

        self.stdout.write("  Recorded custom metrics")

    def show_current_metrics(self):
        """Fetch and display current metrics."""
        self.stdout.write("Fetching current metrics...")

        try:
            response = requests.get("http://localhost:8000/metrics", timeout=5)

            if response.status_code == 200:
                lines = response.text.split("\n")

                # Filter for our custom metrics
                custom_metrics = []
                for line in lines:
                    if any(
                        metric in line
                        for metric in [
                            "bookmark_operations_total",
                            "feed_polls_total",
                            "import_jobs_total",
                            "active_feeds_count",
                        ]
                    ):
                        custom_metrics.append(line)

                if custom_metrics:
                    self.stdout.write("\nCustom metrics found:")
                    for metric in custom_metrics[:10]:  # Show first 10
                        self.stdout.write(f"  {metric}")

                    if len(custom_metrics) > 10:
                        self.stdout.write(f"  ... and {len(custom_metrics) - 10} more")
                else:
                    self.stdout.write("No custom metrics found in output")

            else:
                self.stdout.write(
                    self.style.ERROR(
                        f"Failed to fetch metrics: HTTP {response.status_code}"
                    )
                )

        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Error fetching metrics: {e}"))
            self.stdout.write("Make sure the development server is running!")
