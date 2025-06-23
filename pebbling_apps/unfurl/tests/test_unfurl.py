import os
import mock
from django.test import TestCase
from django.core.exceptions import ValidationError
import urllib.parse

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
        mock_get.return_value.content = self.test_html
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
        self.assertTrue(any("/rss.xml" in feed for feed in self.metadata.feeds))

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
            "UnfurlMetadata(title=OG Test Title, description=OG Test Description, "
            "feed=No Feed, feeds=[No Feeds])"
        )
        self.assertEqual(str(self.metadata), expected_str)

    @mock.patch("feedparser.parse")
    def test_feed_parsing(self, mock_feedparser):
        mock_feedparser.return_value.entries = [{"title": "Test Entry"}]
        self.metadata.parse()
        self.assertTrue(len(self.metadata.feeds) > 0)


class TestFindFeed(TestCase):
    """Test the _findfeed() method with various HTML scenarios"""

    def setUp(self):
        self.base_url = "https://example.com/blog/"
        self.parsed_url = urllib.parse.urlparse(self.base_url)

    @mock.patch("feedparser.parse")
    def test_findfeed_with_link_tags(self, mock_feedparser):
        """Test finding feeds from <link> tags with various types"""
        html = """
        <html>
        <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
            <link rel="alternate" type="application/atom+xml" href="https://example.com/atom.xml" title="Atom Feed">
            <link rel="alternate" type="text/xml" href="../feeds/all.xml" title="All Feeds">
            <link rel="stylesheet" href="/style.css">
            <link rel="alternate" type="text/html" href="/index.html">
        </head>
        <body>Content</body>
        </html>
        """
        
        # Setup feedparser mock to return entries for valid feeds
        def mock_parse(url):
            result = mock.Mock()
            if url.endswith('.xml'):
                result.entries = [{"title": f"Entry for {url}"}]
            else:
                result.entries = []
            return result
        
        mock_feedparser.side_effect = mock_parse
        
        metadata = UnfurlMetadata(url=self.base_url)
        metadata.html = html
        feeds = metadata._findfeed(self.parsed_url)
        
        # Should find 3 feeds (RSS, Atom, and All feeds)
        self.assertEqual(len(feeds), 3)
        self.assertIn("https://example.com/feed.xml", feeds)
        self.assertIn("https://example.com/atom.xml", feeds)
        self.assertIn("https://example.com/feeds/all.xml", feeds)

    @mock.patch("feedparser.parse")
    def test_findfeed_with_anchor_tags(self, mock_feedparser):
        """Test finding feeds from <a> tags with feed-related keywords"""
        html = """
        <html>
        <body>
            <a href="/rss">RSS Feed</a>
            <a href="feed.xml">Main Feed</a>
            <a href="https://feeds.example.com/podcast.xml">Podcast</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/feed/">Feed Directory</a>
        </body>
        </html>
        """
        
        # Mock feedparser to return entries for XML files
        def mock_parse(url):
            result = mock.Mock()
            if 'rss' in url or 'feed' in url or url.endswith('.xml'):
                result.entries = [{"title": f"Entry for {url}"}]
            else:
                result.entries = []
            return result
        
        mock_feedparser.side_effect = mock_parse
        
        metadata = UnfurlMetadata(url=self.base_url)
        metadata.html = html
        feeds = metadata._findfeed(self.parsed_url)
        
        # Should find feeds with keywords
        self.assertGreater(len(feeds), 0)
        # Check that relative URLs are properly joined
        self.assertTrue(any("https://example.com/" in feed for feed in feeds))

    @mock.patch("feedparser.parse")
    def test_findfeed_no_feeds(self, mock_feedparser):
        """Test when no feeds are found"""
        html = """
        <html>
        <head>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
        </body>
        </html>
        """
        
        mock_feedparser.return_value.entries = []
        
        metadata = UnfurlMetadata(url=self.base_url)
        metadata.html = html
        feeds = metadata._findfeed(self.parsed_url)
        
        self.assertEqual(len(feeds), 0)

    @mock.patch("feedparser.parse")
    def test_findfeed_duplicate_removal(self, mock_feedparser):
        """Test that duplicate feed URLs are removed"""
        html = """
        <html>
        <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml">
        </head>
        <body>
            <a href="/feed.xml">RSS Feed</a>
            <a href="/feed.xml">Subscribe to RSS</a>
            <a href="https://example.com/feed.xml">Full RSS URL</a>
        </body>
        </html>
        """
        
        mock_feedparser.return_value.entries = [{"title": "Test Entry"}]
        
        metadata = UnfurlMetadata(url=self.base_url)
        metadata.html = html
        feeds = metadata._findfeed(self.parsed_url)
        
        # Should only have one feed URL despite multiple references
        self.assertEqual(len(feeds), 1)
        self.assertEqual(feeds[0], "https://example.com/feed.xml")

    @mock.patch("feedparser.parse")
    def test_findfeed_with_port(self, mock_feedparser):
        """Test URL handling when base URL has a port"""
        base_url_with_port = "https://example.com:8080/blog/"
        parsed_url_with_port = urllib.parse.urlparse(base_url_with_port)
        
        html = """
        <html>
        <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml">
        </head>
        </html>
        """
        
        mock_feedparser.return_value.entries = [{"title": "Test Entry"}]
        
        metadata = UnfurlMetadata(url=base_url_with_port)
        metadata.html = html
        feeds = metadata._findfeed(parsed_url_with_port)
        
        self.assertEqual(len(feeds), 1)
        self.assertEqual(feeds[0], "https://example.com:8080/feed.xml")

    @mock.patch("feedparser.parse")
    def test_findfeed_parse_errors(self, mock_feedparser):
        """Test that parse errors are handled gracefully"""
        html = """
        <html>
        <head>
            <link rel="alternate" type="application/rss+xml" href="/good-feed.xml">
            <link rel="alternate" type="application/rss+xml" href="/bad-feed.xml">
        </head>
        </html>
        """
        
        def mock_parse(url):
            if "bad-feed" in url:
                raise Exception("Parse error")
            result = mock.Mock()
            result.entries = [{"title": "Good Entry"}]
            return result
        
        mock_feedparser.side_effect = mock_parse
        
        metadata = UnfurlMetadata(url=self.base_url)
        metadata.html = html
        feeds = metadata._findfeed(self.parsed_url)
        
        # Should only return the good feed
        self.assertEqual(len(feeds), 1)
        self.assertIn("good-feed.xml", feeds[0])

    @mock.patch("feedparser.parse")
    def test_findfeed_empty_entries(self, mock_feedparser):
        """Test that feeds with no entries are excluded"""
        html = """
        <html>
        <head>
            <link rel="alternate" type="application/rss+xml" href="/empty-feed.xml">
            <link rel="alternate" type="application/rss+xml" href="/full-feed.xml">
        </head>
        </html>
        """
        
        def mock_parse(url):
            result = mock.Mock()
            if "empty-feed" in url:
                result.entries = []
            else:
                result.entries = [{"title": "Entry"}]
            return result
        
        mock_feedparser.side_effect = mock_parse
        
        metadata = UnfurlMetadata(url=self.base_url)
        metadata.html = html
        feeds = metadata._findfeed(self.parsed_url)
        
        # Should only return the feed with entries
        self.assertEqual(len(feeds), 1)
        self.assertIn("full-feed.xml", feeds[0])

    @mock.patch("feedparser.parse")
    def test_findfeed_relative_url_bug(self, mock_feedparser):
        """Test the bug where relative URLs from <a> tags were incorrectly joined"""
        # This test specifically tests the bug that was fixed where
        # base + href was concatenated instead of properly joined
        html = """
        <html>
        <body>
            <a href="/feeds/main.xml">Main Feed</a>
            <a href="rss.xml">RSS Feed</a>
            <a href="../feed.xml">Parent Feed</a>
            <a href="./atom.xml">Atom Feed</a>
        </body>
        </html>
        """
        
        mock_feedparser.return_value.entries = [{"title": "Test Entry"}]
        
        # Test with a path that ends with /
        metadata = UnfurlMetadata(url="https://example.com/blog/")
        metadata.html = html
        feeds = metadata._findfeed(urllib.parse.urlparse(metadata.url))
        
        # All URLs should be properly resolved relative to the base URL
        expected_feeds = [
            "https://example.com/feeds/main.xml",  # /feeds/main.xml -> absolute path
            "https://example.com/blog/rss.xml",     # rss.xml -> relative to current dir
            "https://example.com/feed.xml",         # ../feed.xml -> parent directory
            "https://example.com/blog/atom.xml"     # ./atom.xml -> current directory
        ]
        
        for expected in expected_feeds:
            self.assertIn(expected, feeds, f"Expected {expected} to be in feeds list")
        
        # The old bug would have produced incorrect URLs like:
        # "https://example.com/feeds/main.xml" (this would have been wrong)
        # Instead of properly joining them
        
        # Also test with a path that doesn't end with /
        metadata2 = UnfurlMetadata(url="https://example.com/blog")
        metadata2.html = html
        feeds2 = metadata2._findfeed(urllib.parse.urlparse(metadata2.url))
        
        # Should still work correctly
        self.assertIn("https://example.com/feeds/main.xml", feeds2)
