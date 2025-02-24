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
    html: str = ""
    feeds: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def unfurl(self):
        url_validator = URLValidator()
        url_validator(self.url)

        self.html = requests.get(self.url).text
        parsed_url = urllib.parse.urlparse(self.url)

        self.feeds = self.findfeed(parsed_url)
        self.metadata = extruct.extract(self.html, base_url=self.url)

    # https://alexmiller.phd/posts/python-3-feedfinder-rss-detection-from-url/
    def findfeed(self, parsed_url):
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

    @property
    def feed(self):
        if len(self.feeds) > 0:
            return self.feeds[0]
        return None

    @property
    def title(self):
        return (
            self._title_from_opengraph()
            or self._title_from_dublincore()
            or self._title_from_rdfa()
        )

    def _title_from_opengraph(self):
        try:
            return next(
                value
                for key, value in self.metadata["opengraph"][0]["properties"]
                if key == "og:title"
            )
        except (KeyError, IndexError, StopIteration):
            return None

    def _title_from_dublincore(self):
        try:
            return next(
                element["content"]
                for element in self.metadata.get("dublincore", [{}])[0].get(
                    "elements", []
                )
                if element.get("URI") == "http://purl.org/dc/elements/1.1/title"
            )
        except (KeyError, IndexError, StopIteration):
            return None

    def _title_from_rdfa(self):
        try:
            return next(
                element["@value"]
                for element in self.metadata.get("rdfa", [{}])[0].get(
                    "http://ogp.me/ns#title", []
                )
            )
        except (KeyError, IndexError, StopIteration):
            return None

    @property
    def description(self):
        return (
            self._description_from_opengraph()
            or self._description_from_dublincore()
            or self._description_from_rdfa()
        )

    def _description_from_dublincore(self):
        try:
            return next(
                element["content"]
                for element in self.metadata.get("dublincore", [{}])[0].get(
                    "elements", []
                )
                if element.get("URI") == "http://purl.org/dc/elements/1.1/description"
            )
        except (KeyError, IndexError, StopIteration):
            return None

    def _description_from_rdfa(self):
        try:
            return next(
                element["@value"]
                for element in self.metadata.get("rdfa", [{}])[0].get(
                    "http://ogp.me/ns#description", []
                )
            )
        except (KeyError, IndexError, StopIteration):
            return None

    def _description_from_opengraph(self):
        try:
            return next(
                value
                for key, value in self.metadata["opengraph"][0]["properties"]
                if key == "og:description"
            )
        except (KeyError, IndexError, StopIteration):
            return None

    @property
    def image(self):
        return (
            self._image_from_opengraph()
            or self._image_from_dublincore()
            or self._image_from_rdfa()
        )

    def _image_from_opengraph(self):
        try:
            return next(
                value
                for key, value in self.metadata["opengraph"][0]["properties"]
                if key == "og:image"
            )
        except (KeyError, IndexError, StopIteration):
            return None

    def _image_from_dublincore(self):
        try:
            return next(
                element["content"]
                for element in self.metadata.get("dublincore", [{}])[0].get(
                    "elements", []
                )
                if element.get("URI") == "http://purl.org/dc/elements/1.1/image"
            )
        except (KeyError, IndexError, StopIteration):
            return None

    def _image_from_rdfa(self):
        try:
            return next(
                element["@value"]
                for element in self.metadata.get("rdfa", [{}])[0].get(
                    "http://ogp.me/ns#image", []
                )
            )
        except (KeyError, IndexError, StopIteration):
            return None
