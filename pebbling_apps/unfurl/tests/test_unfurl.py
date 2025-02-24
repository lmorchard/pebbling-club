import os
from django.test import TestCase
from ..unfurl import UnfurlMetadata


class UnfurlMetadataTests(TestCase):
    def setUp(self):
        self.metadata = UnfurlMetadata(url="http://blog.lmorchard.com")

        # Load HTML content from test files
        self.metadata.html = self.load_html("data/test_page_1.html")

    def load_html(self, filename):
        """Helper method to read HTML files from the test data directory."""
        file_path = os.path.join(os.path.dirname(__file__), filename)
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read()

    def test_fetch(self):
        self.metadata.fetch()
        self.assertIsNotNone(self.metadata.html)

    def test_parse(self):
        self.metadata.fetch()  # Ensure we have fetched HTML first
        self.metadata.parse()
        self.assertIsInstance(self.metadata.feeds, list)
