import os
import mock
from django.test import TestCase
from django.core.exceptions import ValidationError

from ..unfurl import UnfurlMetadata


class UnfurlMetadataTests(TestCase):
    def setUp(self):
        self.test_html = """
        <html>
        <head>
            <meta property="og:title" content="OG Test Title">
            <meta property="og:description" content="OG Test Description">
            <meta property="og:image" content="https://example.com/image.jpg">
            <meta property="og:author" content="OG Test Author">
            <link rel="alternate" type="application/rss+xml" href="/rss.xml">
            <script type="application/ld+json">
            {
                "headline": "JSON-LD Title",
                "description": "JSON-LD Description",
                "image": "https://example.com/jsonld-image.jpg",
                "author": {"name": "OG Test Author"}
            }
            </script>
        </head>
        <body>
            <h1>Test Page</h1>
            <a href="/feed.xml">RSS Feed</a>
        </body>
        </html>
        """
        self.metadata = UnfurlMetadata(url="https://example.com")
        self.metadata.html = self.test_html

    @mock.patch("requests.get")
    def test_fetch(self, mock_get):
        mock_get.return_value.text = self.test_html
        self.metadata.fetch()
        self.assertEqual(self.metadata.html, self.test_html)

    def test_title_extraction(self):
        self.metadata.parse()
        self.assertEqual(self.metadata.title, "OG Test Title")

    def test_description_extraction(self):
        self.metadata.parse()
        self.assertEqual(self.metadata.description, "OG Test Description")

    def test_image_extraction(self):
        self.metadata.parse()
        self.assertEqual(self.metadata.image, "https://example.com/image.jpg")

    def test_author_extraction(self):
        self.metadata.parse()
        self.assertEqual(self.metadata.author, "OG Test Author")

    @mock.patch("feedparser.parse")
    def test_feed_detection(self, mock_feedparser):
        mock_feedparser.return_value.entries = [{"title": "Test Entry"}]
        self.metadata.parse()
        self.assertTrue(len(self.metadata.feeds) > 0)
        self.assertTrue("/rss.xml" in self.metadata.feeds[0])

    def test_missing_metadata(self):
        self.metadata.html = "<html><body>No metadata</body></html>"
        self.metadata.parse()
        self.assertIsNone(self.metadata.title)
        self.assertIsNone(self.metadata.description)
        self.assertIsNone(self.metadata.image)
        self.assertIsNone(self.metadata.author)

    def test_invalid_url(self):
        invalid_metadata = UnfurlMetadata(url="not-a-url")
        with self.assertRaises(ValidationError):
            invalid_metadata.fetch()

    def test_str_representation(self):
        self.metadata.parse()
        expected_str = (
            "UnfurlMetadata(title=OG Test Title, description=OG Test Description)"
        )
        self.assertEqual(str(self.metadata), expected_str)

    @mock.patch("feedparser.parse")
    def test_feed_parsing(self, mock_feedparser):
        mock_feedparser.return_value.entries = [{"title": "Test Entry"}]
        self.metadata.parse()
        self.assertTrue(len(self.metadata.feeds) > 0)
