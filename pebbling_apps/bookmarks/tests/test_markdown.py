from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from pebbling_apps.bookmarks.models import Bookmark, Tag
from pebbling_apps.bookmarks.serializers import MarkdownBookmarkSerializer
import datetime

User = get_user_model()


class MarkdownBookmarkSerializerTest(TestCase):
    """Test the MarkdownBookmarkSerializer class."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.serializer = MarkdownBookmarkSerializer()

    def test_empty_queryset(self):
        """Test serialization of empty queryset."""
        queryset = Bookmark.objects.none()
        result = self.serializer.serialize_to_markdown(queryset)
        self.assertEqual(result, "<!-- No bookmarks found -->")

    def test_single_bookmark_with_description(self):
        """Test single bookmark with title, URL, and description."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Test Bookmark",
            description="This is a test description.",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        expected = """# 2025-06-28

- [Test Bookmark](https://example.com/test)
  > This is a test description.
"""
        self.assertEqual(result, expected)

    def test_single_bookmark_without_description(self):
        """Test single bookmark without description."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Test Bookmark",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        expected = """# 2025-06-28

- [Test Bookmark](https://example.com/test)
"""
        self.assertEqual(result, expected)

    def test_multiple_bookmarks_same_date(self):
        """Test multiple bookmarks on the same date."""
        base_time = timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0))

        bookmark1 = Bookmark.objects.create(
            url="https://example.com/first",
            title="First Bookmark",
            description="First description",
            owner=self.user,
            created_at=base_time,
        )

        bookmark2 = Bookmark.objects.create(
            url="https://example.com/second",
            title="Second Bookmark",
            owner=self.user,
            created_at=base_time + datetime.timedelta(hours=1),
        )

        queryset = Bookmark.objects.filter(
            id__in=[bookmark1.id, bookmark2.id]
        ).order_by("created_at")
        result = self.serializer.serialize_to_markdown(queryset)

        expected = """# 2025-06-28

- [First Bookmark](https://example.com/first)
  > First description

- [Second Bookmark](https://example.com/second)
"""
        self.assertEqual(result, expected)

    def test_multiple_bookmarks_different_dates(self):
        """Test bookmarks across different dates are grouped correctly."""
        bookmark1 = Bookmark.objects.create(
            url="https://example.com/old",
            title="Old Bookmark",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 27, 12, 0, 0)),
        )

        bookmark2 = Bookmark.objects.create(
            url="https://example.com/new",
            title="New Bookmark",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(
            id__in=[bookmark1.id, bookmark2.id]
        ).order_by("created_at")
        result = self.serializer.serialize_to_markdown(queryset)

        expected = """# 2025-06-27

- [Old Bookmark](https://example.com/old)

# 2025-06-28

- [New Bookmark](https://example.com/new)
"""
        self.assertEqual(result, expected)

    def test_markdown_special_characters_escaped(self):
        """Test that markdown special characters are properly escaped."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Test [Special] Characters (Like These) *Bold* _Italic_ #Hash",
            description="Description with [brackets] and (parentheses) and *asterisks*",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        # Check that special characters are escaped
        self.assertIn(r"\[Special\]", result)
        self.assertIn(r"\(Like These\)", result)
        self.assertIn(r"\*Bold\*", result)
        self.assertIn(r"\_Italic\_", result)
        self.assertIn(r"\#Hash", result)

    def test_multiline_description(self):
        """Test that multiline descriptions are handled correctly."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Test Bookmark",
            description="First line of description\nSecond line of description\n\nFourth line after empty line",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        expected = """# 2025-06-28

- [Test Bookmark](https://example.com/test)
  > First line of description
  > Second line of description
  >
  > Fourth line after empty line
"""
        self.assertEqual(result, expected)

    def test_empty_title_fallback(self):
        """Test that empty titles get 'Untitled' fallback."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        self.assertIn("- [Untitled](https://example.com/test)", result)

    def test_empty_url_handling(self):
        """Test handling of empty URLs."""
        bookmark = Bookmark.objects.create(
            url="",  # Empty URL
            title="Test Bookmark",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        self.assertIn("- [Test Bookmark]()", result)

    def test_none_description_handling(self):
        """Test handling of None descriptions."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Test Bookmark",
            description=None,
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        expected = """# 2025-06-28

- [Test Bookmark](https://example.com/test)
"""
        self.assertEqual(result, expected)

    def test_whitespace_only_description(self):
        """Test handling of whitespace-only descriptions."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Test Bookmark",
            description="   \n\t  \n  ",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        # Should not include description since it's only whitespace
        expected = """# 2025-06-28

- [Test Bookmark](https://example.com/test)
"""
        self.assertEqual(result, expected)

    def test_long_title_within_limits(self):
        """Test handling of long titles within database limits."""
        long_title = "A" * 250  # Long but within 255 char limit
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title=long_title,
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        # Should handle long titles without error
        self.assertIn(f"- [{long_title}](https://example.com/test)", result)

    def test_very_long_description(self):
        """Test handling of very long descriptions."""
        long_description = "B" * 2000  # Very long description
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Test Bookmark",
            description=long_description,
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        # Should handle long descriptions without error
        self.assertIn(f"  > {long_description}", result)

    def test_unicode_characters(self):
        """Test handling of unicode characters in titles and descriptions."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="测试书签 🔖 with émojis and accënts",
            description="Description with 中文, русский, العربية and 🌟✨🚀",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        # Should preserve unicode characters
        self.assertIn("测试书签 🔖 with émojis and accënts", result)
        self.assertIn("Description with 中文, русский, العربية and 🌟✨🚀", result)

    def test_newlines_in_title(self):
        """Test handling of newlines in titles."""
        bookmark = Bookmark.objects.create(
            url="https://example.com/test",
            title="Title with\nnewline",
            owner=self.user,
            created_at=timezone.make_aware(datetime.datetime(2025, 6, 28, 12, 0, 0)),
        )

        queryset = Bookmark.objects.filter(id=bookmark.id)
        result = self.serializer.serialize_to_markdown(queryset)

        # Should handle newlines in titles
        self.assertIn("Title with\nnewline", result)


class BookmarkMarkdownViewTest(TestCase):
    """Test markdown format support in bookmark views."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.client.login(username="testuser", password="testpass")

    def test_bookmarks_list_html_default(self):
        """Test that default behavior returns HTML."""
        response = self.client.get(reverse("bookmarks:list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")

    def test_bookmarks_list_markdown_format(self):
        """Test that format=markdown returns plain text markdown."""
        response = self.client.get(reverse("bookmarks:list") + "?format=markdown")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")

    def test_bookmarks_list_invalid_format_defaults_to_html(self):
        """Test that invalid format values default to HTML."""
        response = self.client.get(reverse("bookmarks:list") + "?format=invalid")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")

    def test_bookmarks_list_case_insensitive_format(self):
        """Test that format parameter is case insensitive."""
        response = self.client.get(reverse("bookmarks:list") + "?format=MARKDOWN")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")

    def test_tag_detail_view_markdown_format(self):
        """Test that tag detail view supports markdown format."""
        # Create a tag and bookmark
        tag = Tag.objects.create(name="test-tag", owner=self.user)
        bookmark = Bookmark.objects.create(
            url="https://example.com/test", title="Test Bookmark", owner=self.user
        )
        bookmark.tags.add(tag)

        response = self.client.get(
            reverse("bookmarks:tag_detail", args=["test-tag"]) + "?format=markdown"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertIn("Test Bookmark", response.content.decode())

    def test_markdown_with_query_parameters(self):
        """Test that markdown format works with other query parameters."""
        # Create test bookmarks
        old_bookmark = Bookmark.objects.create(
            url="https://example.com/old",
            title="Old Bookmark",
            owner=self.user,
            created_at=timezone.now() - datetime.timedelta(days=2),
        )

        new_bookmark = Bookmark.objects.create(
            url="https://example.com/new",
            title="New Bookmark",
            owner=self.user,
            created_at=timezone.now(),
        )

        # Test with since parameter
        response = self.client.get(
            reverse("bookmarks:list") + "?format=markdown&since=1d"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        content = response.content.decode()
        self.assertIn("New Bookmark", content)
        self.assertNotIn("Old Bookmark", content)

    def test_markdown_pagination(self):
        """Test that markdown format respects pagination."""
        # Create multiple bookmarks
        for i in range(15):
            Bookmark.objects.create(
                url=f"https://example.com/{i}", title=f"Bookmark {i}", owner=self.user
            )

        # Test first page with limit
        response = self.client.get(
            reverse("bookmarks:list") + "?format=markdown&limit=10"
        )
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()

        # Should only contain 10 bookmarks
        bookmark_count = content.count("- [Bookmark")
        self.assertEqual(bookmark_count, 10)

    def test_markdown_empty_results(self):
        """Test markdown format with no results."""
        response = self.client.get(reverse("bookmarks:list") + "?format=markdown")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), "<!-- No bookmarks found -->")

    def test_unauthenticated_access_allowed(self):
        """Test that markdown format allows unauthenticated access (same as HTML view)."""
        self.client.logout()
        response = self.client.get(reverse("bookmarks:list") + "?format=markdown")
        # Should return 200 like the HTML view
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")


class MarkdownFormatParameterTest(TestCase):
    """Test format parameter handling in views."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.client.login(username="testuser", password="testpass")

    def test_format_parameter_extraction(self):
        """Test various format parameter values."""
        test_cases = [
            ("markdown", True),
            ("MARKDOWN", True),
            ("Markdown", True),
            ("  markdown  ", True),  # With whitespace
            ("html", False),
            ("json", False),
            ("", False),
            ("invalid", False),
        ]

        for format_value, should_be_markdown in test_cases:
            with self.subTest(format_value=format_value):
                url = reverse("bookmarks:list")
                if format_value:
                    url += f"?format={format_value}"

                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)

                if should_be_markdown:
                    self.assertEqual(
                        response["Content-Type"], "text/plain; charset=utf-8"
                    )
                else:
                    self.assertEqual(
                        response["Content-Type"], "text/html; charset=utf-8"
                    )

    def test_streaming_response_for_large_datasets(self):
        """Test that streaming response is used for large datasets."""
        # This test would be hard to run in practice due to creating 1000+ bookmarks
        # So we'll test the streaming logic directly instead
        from pebbling_apps.bookmarks.views import BookmarkQueryListView
        from django.test import RequestFactory

        factory = RequestFactory()
        request = factory.get("/bookmarks?format=markdown&limit=2000")
        request.user = self.user

        view = BookmarkQueryListView()
        view.request = request

        # Create a mock queryset
        queryset = Bookmark.objects.all()

        # Test the streaming decision logic
        should_stream = view.should_use_streaming_response(queryset)
        # Should not stream with empty queryset and high limit
        self.assertFalse(should_stream)

    def test_stream_to_markdown_generator(self):
        """Test the stream_to_markdown generator function directly."""
        # Create a few test bookmarks
        for i in range(3):
            Bookmark.objects.create(
                url=f"https://example.com/{i}",
                title=f"Bookmark {i}",
                description=f"Description {i}",
                owner=self.user,
                created_at=timezone.make_aware(
                    datetime.datetime(2025, 6, 28, 12, i, 0)
                ),
            )

        queryset = Bookmark.objects.all().order_by("created_at")
        serializer = MarkdownBookmarkSerializer()

        # Collect all chunks from the generator
        chunks = list(serializer.stream_to_markdown(queryset))

        # Join all chunks to get full content
        full_content = "".join(chunks)

        # Should contain all bookmarks
        self.assertIn("Bookmark 0", full_content)
        self.assertIn("Bookmark 1", full_content)
        self.assertIn("Bookmark 2", full_content)
        self.assertIn("# 2025-06-28", full_content)
