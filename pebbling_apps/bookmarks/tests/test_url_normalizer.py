from django.test import TestCase
from pebbling_apps.bookmarks.services import URLNormalizer


class TestURLNormalizer(TestCase):
    """Test cases for URLNormalizer class."""

    def setUp(self):
        """Set up test fixtures."""
        self.normalizer = URLNormalizer()

        # Test URLs from the spec
        self.TEST_INITIAL_URLS = [
            "http://abcnews.go.com/US/wireStory?id=201062&CMP=OTC-RSSFeeds0312",
            "http://an9.org/devdev/why_frameworks_suck?sxip-homesite=&checked=1",
            "http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0%2C0",
            "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project/",
            "http://annearchy.com/blog/?p=3661",
            "http://mashable.com/2013/08/11/teens-facebook/?utm_cid=mash-prod-email-topstories",
            "http://bash.org/?564283",
            "http://bash.org/?428429",
            "http://bash.org/?429313",
        ]

        self.TEST_LATER_URLS = [
            "http://abcnews.go.com/US/wireStory?CMP=OTC-RSSFeeds0312&id=201062",
            "http://an9.org/devdev/why_frameworks_suck?checked=1&sxip-homesite=",
            "http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0,0",
            "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project",
            "http://annearchy.com/blog?p=3661",
            "http://mashable.com/2013/08/11/teens-facebook",
            "http://bash.org/?564283=",
            "http://bash.org/?428429",
            "http://bash.org/?429313",
        ]

    def test_spec_urls_produce_same_hash(self):
        """Test that URL pairs from the spec produce the same hash."""
        for initial_url, later_url in zip(self.TEST_INITIAL_URLS, self.TEST_LATER_URLS):
            initial_hash = self.normalizer.generate_hash(initial_url)
            later_hash = self.normalizer.generate_hash(later_url)
            self.assertEqual(
                initial_hash,
                later_hash,
                f"Hashes don't match for:\n  {initial_url}\n  {later_url}",
            )

    def test_basic_normalization(self):
        """Test basic URL normalization rules."""
        # Test lowercase hostname
        url1 = "https://EXAMPLE.COM/path"
        url2 = "https://example.com/path"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        # Test default port removal
        url1 = "http://example.com:80/path"
        url2 = "http://example.com/path"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        url1 = "https://example.com:443/path"
        url2 = "https://example.com/path"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        # Test trailing slash removal
        url1 = "https://example.com/path/"
        url2 = "https://example.com/path"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        # Root path should keep its slash
        url = "https://example.com/"
        normalized = self.normalizer.normalize_url(url)
        self.assertTrue(normalized.endswith("/"))

    def test_tracking_parameter_removal(self):
        """Test removal of tracking parameters."""
        # Test UTM parameters
        url1 = "https://example.com?utm_source=twitter&utm_campaign=test"
        url2 = "https://example.com"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        # Test case-insensitive UTM
        url1 = "https://example.com?UTM_Source=twitter"
        url2 = "https://example.com"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        # Test fbclid
        url1 = "https://example.com?fbclid=abc123"
        url2 = "https://example.com"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        # Test mixed parameters (keep non-tracking)
        url1 = "https://example.com?page=1&utm_source=test&id=123"
        url2 = "https://example.com?page=1&id=123"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

    def test_query_parameter_sorting(self):
        """Test alphabetical sorting of query parameters."""
        url1 = "https://example.com?z=3&a=1&m=2"
        url2 = "https://example.com?a=1&m=2&z=3"
        self.assertEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

    def test_parameter_preservation(self):
        """Test that all query parameters are preserved, including empty ones."""
        # Empty value parameters should be preserved (not the same as no parameters)
        url1 = "https://example.com?a=1&b=&c=3"
        url2 = "https://example.com?a=1&c=3"
        self.assertNotEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

        # Keep "0" and "false" values
        url = "https://example.com?zero=0&false=false"
        normalized = self.normalizer.normalize_url(url)
        self.assertIn("zero=0", normalized)
        self.assertIn("false=false", normalized)

        # Test the specific bash.org case that was broken
        url1 = "http://bash.org/?429313"
        url2 = "http://bash.org/?428429"
        self.assertNotEqual(
            self.normalizer.generate_hash(url1), self.normalizer.generate_hash(url2)
        )

    def test_fragment_preservation(self):
        """Test that URL fragments are preserved."""
        url = "https://example.com/page#section"
        normalized = self.normalizer.normalize_url(url)
        self.assertIn("#section", normalized)

    def test_error_handling(self):
        """Test error handling for malformed URLs."""
        # Should handle malformed URLs gracefully
        malformed_urls = [
            "not-a-url",
            "://missing-scheme",
            "http://",
            "",
        ]

        for url in malformed_urls:
            # Should not raise exception
            hash_value = self.normalizer.generate_hash(url)
            self.assertTrue(hash_value)  # Should return some hash
            self.assertEqual(len(hash_value), 64)  # SHA-256 produces 64 hex chars
