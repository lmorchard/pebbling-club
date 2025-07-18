from bs4 import BeautifulSoup as bs4
import feedparser
import urllib.parse
import requests
import extruct
from django.core.validators import URLValidator
from dataclasses import dataclass, field
from typing import Union
import json


@dataclass
class UnfurlMetadata:
    url: str
    metadata: dict = field(default_factory=dict)
    feeds: list[str] = field(default_factory=list)
    html: str = ""

    @classmethod
    def from_json(
        cls, json_str: str, omit_html: bool = False
    ) -> Union["UnfurlMetadata", None]:
        """Create an UnfurlMetadata instance from a JSON string."""
        if not json_str:
            return None

        data = json.loads(json_str)
        return cls(
            url=data["url"],
            metadata=data.get("metadata", {}),
            feeds=data.get("feeds", []),
            html=data.get("html", "") if not omit_html else "",
        )

    def to_dict(self, omit_html: bool = False) -> dict:
        """Convert the UnfurlMetadata instance to a dictionary."""
        data = {
            "url": self.url,
            "metadata": self.metadata,
            "feeds": self.feeds,
            "feed": self.feed,
            "title": self.title,
            "description": self.description,
            "image": self.image,
        }
        if not omit_html:
            data["html"] = self.html
        return data

    def to_json(self, omit_html: bool = False) -> str:
        """Convert the UnfurlMetadata instance to a JSON string."""
        return json.dumps(self.to_dict(omit_html=omit_html))

    def unfurl(self):
        """Fetch and parse the URL."""
        self.fetch()
        self.parse()

    def fetch(self):
        """Fetch the HTML content of the URL."""
        url_validator = URLValidator()
        url_validator(self.url)

        response = requests.get(self.url)
        response.encoding = response.apparent_encoding  # Ensure correct encoding
        self.html = response.content  # Use bytes content instead of text

    def parse(self):
        """Parse the fetched HTML to extract feeds and metadata."""
        parsed_url = urllib.parse.urlparse(self.url)

        self.feeds = self._findfeed(parsed_url)
        self.metadata = extruct.extract(self.html, base_url=self.url)

    @property
    def feed(self):
        if len(self.feeds) > 0:
            # HACK: Sort feeds by whether they contain "comment" in the URL, so that we deprioritize comment feeds
            sorted_feeds = sorted(self.feeds, key=lambda url: "comment" in url)
            return sorted_feeds[0]
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
        image_url = self._extract_first_metadata(
            [
                ("opengraph", "og:image"),
                ("dublincore", "http://purl.org/dc/elements/1.1/image"),
                ("rdfa", "http://ogp.me/ns#image"),
                ("json-ld", "image"),
                ("microdata", "image"),
            ]
        )
        if image_url:
            return urllib.parse.urljoin(self.url, image_url)
        return None

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

    @property
    def categories(self):
        return self._extract_metadata("microdata", "category")

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
                if metadata_type == "opengraph":
                    return self._extract_opengraph(metadata_key)
                elif metadata_type == "dublincore":
                    return self._extract_dublincore(metadata_key)
                elif metadata_type == "json-ld":
                    return self._extract_json_ld(metadata_key)
                elif metadata_type == "rdfa":
                    return self._extract_rdfa(metadata_key)
                elif metadata_type == "microdata":
                    return self._extract_microdata(metadata_key)
            return None
        except (KeyError, IndexError, AttributeError, StopIteration):
            return None

    def _extract_opengraph(self, metadata_key):
        """Extract OpenGraph metadata."""
        return next(
            value
            for key, value in self.metadata["opengraph"][0]["properties"]
            if key == metadata_key
        )

    def _extract_dublincore(self, metadata_key):
        """Extract Dublin Core metadata."""
        return next(
            element["content"]
            for element in self.metadata["dublincore"][0].get("elements", [])
            if element.get("URI") == metadata_key
        )

    def _extract_json_ld(self, metadata_key):
        """Extract JSON-LD metadata."""
        value = self.metadata["json-ld"][0].get(metadata_key)
        if metadata_key == "author":
            return value.get("name")
        return value

    def _extract_rdfa(self, metadata_key):
        """Extract RDFa metadata."""
        return next(
            element["@value"]
            for element in self.metadata["rdfa"][0].get(metadata_key, [])
        )

    def _extract_microdata(self, metadata_key):
        """Extract Microdata metadata."""
        for item in self.metadata["microdata"]:
            if "properties" in item:
                properties = item["properties"]
                if metadata_key in properties:
                    # If the key is a list, return the first non-empty value
                    if isinstance(properties[metadata_key], list):
                        return next(
                            (value for value in properties[metadata_key] if value),
                            None,
                        )
                    return properties[metadata_key]

    # https://alexmiller.phd/posts/python-3-feedfinder-rss-detection-from-url/
    def _findfeed(self, parsed_url):
        result = []
        possible_feeds = []
        html = bs4(self.html, features="lxml")

        # Look for <link> tags with alternate rel
        feed_urls = html.findAll("link", rel="alternate")

        if len(feed_urls) > 0:
            for f in feed_urls:
                t = f.get("type", None)
                if t:
                    if "rss" in t or "xml" in t:
                        href = f.get("href", None)
                        if href:
                            # Handle relative URLs properly
                            full_url = urllib.parse.urljoin(self.url, href)
                            possible_feeds.append(full_url)

        # Look for <a> tags with feed-related keywords
        base_url = f"{parsed_url.scheme}://{parsed_url.hostname}"
        if parsed_url.port:
            base_url += f":{parsed_url.port}"

        atags = html.findAll("a")

        for a in atags:
            href = a.get("href", None)
            if href:
                if "xml" in href or "rss" in href or "feed" in href:
                    # Handle relative and absolute URLs properly
                    full_url = urllib.parse.urljoin(self.url, href)
                    possible_feeds.append(full_url)

        # Remove duplicates
        unique_feeds = list(set(possible_feeds))

        # Test each possible feed URL
        for url in unique_feeds:
            try:
                f = feedparser.parse(url)
                if len(f.entries) > 0:
                    if url not in result:
                        result.append(url)
            except Exception as e:
                pass  # Silently ignore parse errors

        return result

    def __str__(self):
        title = self.title or "No Title"
        description = self.description or "No Description"
        feed = self.feed or "No Feed"
        feeds = ", ".join(self.feeds) if self.feeds else "No Feeds"
        return f"UnfurlMetadata(title={title}, description={description}, feed={feed}, feeds=[{feeds}])"

    def __repr__(self):
        return self.__str__()
