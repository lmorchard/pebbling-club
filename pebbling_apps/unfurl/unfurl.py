from bs4 import BeautifulSoup as bs4
import feedparser
import urllib.parse
import requests
import extruct
from django.core.validators import URLValidator
from dataclasses import dataclass, field


@dataclass
class UnfurlMetadata:
    url: str
    metadata: dict = field(default_factory=dict)
    feeds: list[str] = field(default_factory=list)
    html: str = ""

    def unfurl(self):
        url_validator = URLValidator()
        url_validator(self.url)

        self.html = requests.get(self.url).text
        parsed_url = urllib.parse.urlparse(self.url)

        self.feeds = self._findfeed(parsed_url)
        self.metadata = extruct.extract(self.html, base_url=self.url)

    @property
    def feed(self):
        if len(self.feeds) > 0:
            return self.feeds[0]
        return None

    @property
    def title(self):
        return self._extract_first_metadata(
            [
                ("opengraph", "og:title"),
                ("dublincore", "http://purl.org/dc/elements/1.1/title"),
                ("rdfa", "http://ogp.me/ns#title"),
                ("json-ld", "headline"),
                ("microdata", "name"),
            ]
        )

    @property
    def description(self):
        return self._extract_first_metadata(
            [
                ("opengraph", "og:description"),
                ("dublincore", "http://purl.org/dc/elements/1.1/description"),
                ("rdfa", "http://ogp.me/ns#description"),
                ("json-ld", "description"),
                ("microdata", "description"),
            ]
        )

    @property
    def image(self):
        return self._extract_first_metadata(
            [
                ("opengraph", "og:image"),
                ("dublincore", "http://purl.org/dc/elements/1.1/image"),
                ("rdfa", "http://ogp.me/ns#image"),
                ("json-ld", "image"),
                ("microdata", "image"),
            ]
        )

    @property
    def author(self):
        return self._extract_first_metadata(
            [
                ("json-ld", "author"),
                ("opengraph", "og:author"),
                ("dublincore", "http://purl.org/dc/elements/1.1/creator"),
                ("rdfa", "http://ogp.me/ns#author"),
                ("microdata", "author"),
            ]
        )

    def _extract_first_metadata(self, metadata_pairs):
        """Utility method to extract the first available metadata."""
        for metadata_type, metadata_key in metadata_pairs:
            value = self._extract_metadata(metadata_type, metadata_key)
            if value:
                return value
        return None

    def _extract_metadata(self, metadata_type, metadata_key):
        """Utility method to extract metadata based on type and key."""
        try:
            # Check if the metadata type exists
            if metadata_type in self.metadata:
                # Handle OpenGraph
                if metadata_type == "opengraph":
                    return next(
                        value
                        for key, value in self.metadata[metadata_type][0]["properties"]
                        if key == metadata_key
                    )
                # Handle Dublin Core
                elif metadata_type == "dublincore":
                    return next(
                        element["content"]
                        for element in self.metadata[metadata_type][0].get(
                            "elements", []
                        )
                        if element.get("URI") == metadata_key
                    )
                # Handle JSON-LD
                elif metadata_type == "json-ld":
                    value = self.metadata[metadata_type][0].get(metadata_key)
                    if metadata_key == "author":
                        return value.get("name")
                    return value
                # Handle RDFa
                elif metadata_type == "rdfa":
                    return next(
                        element["@value"]
                        for element in self.metadata[metadata_type][0].get(
                            metadata_key, []
                        )
                    )
                # Handle Microdata
                elif metadata_type == "microdata":
                    for item in self.metadata[metadata_type]:
                        if "properties" in item:
                            properties = item["properties"]
                            if metadata_key in properties:
                                # If the key is a list, return the first non-empty value
                                if isinstance(properties[metadata_key], list):
                                    return next(
                                        (
                                            value
                                            for value in properties[metadata_key]
                                            if value
                                        ),
                                        None,
                                    )
                                return properties[metadata_key]
            return None
        except (KeyError, IndexError, StopIteration):
            return None

    # https://alexmiller.phd/posts/python-3-feedfinder-rss-detection-from-url/
    def _findfeed(self, parsed_url):
        result = []
        possible_feeds = []
        html = bs4(self.html, features="lxml")
        feed_urls = html.findAll("link", rel="alternate")
        if len(feed_urls) > 1:
            for f in feed_urls:
                t = f.get("type", None)
                if t:
                    if "rss" in t or "xml" in t:
                        href = f.get("href", None)
                        if href:
                            possible_feeds.append(href)
        base = parsed_url.scheme + "://" + parsed_url.hostname
        atags = html.findAll("a")
        for a in atags:
            href = a.get("href", None)
            if href:
                if "xml" in href or "rss" in href or "feed" in href:
                    possible_feeds.append(base + href)
        for url in list(set(possible_feeds)):
            f = feedparser.parse(url)
            if len(f.entries) > 0:
                if url not in result:
                    result.append(url)
        return result
