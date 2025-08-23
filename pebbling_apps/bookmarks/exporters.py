import json
from django.utils.html import escape
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.sax.saxutils import XMLGenerator
from io import StringIO


class NetscapeBookmarkExporter:
    """Export bookmarks in Netscape HTML format."""

    def generate_header(self):
        """Generate the Netscape format header."""
        return """<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <!--This is an automatically generated file.
    It will be read and overwritten.
    Do Not Edit! -->
    <Title>Bookmarks</Title>
    <H1>Bookmarks</H1>
    <DL><p>"""

    def generate_footer(self):
        """Generate the Netscape format footer."""
        return """    </DL><p>"""

    def format_bookmark(self, bookmark):
        """Format a single bookmark in Netscape format."""
        # Skip bookmarks without URLs
        if not bookmark.url:
            return ""

        # Extract attributes
        title = escape(bookmark.title or "Untitled")
        url = escape(bookmark.url)

        # Convert timestamps to Unix epoch format
        add_date = int(bookmark.created_at.timestamp()) if bookmark.created_at else ""
        last_modified = (
            int(bookmark.updated_at.timestamp()) if bookmark.updated_at else ""
        )

        # Build the bookmark tag
        bookmark_html = f'        <DT><A HREF="{url}"'

        if add_date:
            bookmark_html += f' ADD_DATE="{add_date}"'

        if last_modified:
            bookmark_html += f' LAST_MODIFIED="{last_modified}"'

        if bookmark.unique_hash:
            bookmark_html += f' ID="{escape(bookmark.unique_hash)}"'

        # Add feed URL from unfurl metadata if present
        if bookmark.unfurl_metadata:
            try:
                # unfurl_metadata might be a string or an UnfurlMetadata object
                if isinstance(bookmark.unfurl_metadata, str):
                    metadata = json.loads(bookmark.unfurl_metadata)
                    feed_url = metadata.get("feed")
                else:
                    # For UnfurlMetadata objects, check if feed is set and not the default "No Feed"
                    feed_url = getattr(bookmark.unfurl_metadata, "feed", None)
                    if feed_url == "No Feed":
                        feed_url = None

                if feed_url:
                    bookmark_html += f' FEED="{escape(feed_url)}"'
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass

        # Add tags if present
        tags = bookmark.tags.all()
        if tags:
            tag_names = [tag.name for tag in tags]
            bookmark_html += f' TAGS="{escape(",".join(tag_names))}"'

        bookmark_html += f">{title}</A>"

        # Add description if present
        if bookmark.description:
            bookmark_html += f"\n        <DD>{escape(bookmark.description)}"

        return bookmark_html

    def generate_bookmarks(self, bookmarks_queryset):
        """Generator that yields formatted bookmarks."""
        for bookmark in bookmarks_queryset:
            formatted = self.format_bookmark(bookmark)
            if formatted:
                yield f"\n{formatted}"


class OPMLBookmarkExporter:
    """Export bookmarks in OPML 2.0 format using streaming XML generation."""

    def generate_header(self, user=None):
        """Generate the OPML format header with metadata using XMLGenerator."""
        now = datetime.now().strftime("%a, %d %b %Y %H:%M:%S GMT")
        title = "Pebbling Club Bookmarks"
        if user and hasattr(user, "username"):
            title = f"{user.username}'s Pebbling Club Bookmarks"

        # Use StringIO to capture the XML output
        output = StringIO()
        gen = XMLGenerator(output, encoding="utf-8")

        # Generate XML header and opening tags
        gen.startDocument()
        gen.startElement("opml", {"version": "2.0"})

        # Generate head section
        gen.startElement("head", {})

        gen.startElement("title", {})
        gen.characters(title)
        gen.endElement("title")

        gen.startElement("dateCreated", {})
        gen.characters(now)
        gen.endElement("dateCreated")

        gen.startElement("dateModified", {})
        gen.characters(now)
        gen.endElement("dateModified")

        gen.startElement("ownerName", {})
        gen.characters(user.username if user else "Pebbling Club User")
        gen.endElement("ownerName")

        gen.startElement("docs", {})
        gen.characters("http://opml.org/spec2.opml")
        gen.endElement("docs")

        gen.endElement("head")

        # Start body element
        gen.startElement("body", {})

        return output.getvalue()

    def generate_footer(self):
        """Generate the OPML format footer using XMLGenerator."""
        output = StringIO()
        gen = XMLGenerator(output, encoding="utf-8")

        # Close body and opml elements
        gen.endElement("body")
        gen.endElement("opml")
        gen.endDocument()

        return output.getvalue()

    def format_bookmark(self, bookmark):
        """Format a single bookmark as an OPML outline element using XMLGenerator."""
        if not bookmark.url:
            return ""

        # Build attributes dictionary
        attrs = {
            "text": bookmark.title or "Untitled",
            "type": "link",
            "url": bookmark.url,
        }

        # Add creation date if available
        if bookmark.created_at:
            attrs["created"] = bookmark.created_at.strftime("%a, %d %b %Y %H:%M:%S GMT")

        # Add description if present
        if bookmark.description:
            # OPML doesn't have a standard description field, but we can use _note
            attrs["_note"] = bookmark.description

        # Add tags as categories if present
        tags = bookmark.tags.all()
        if tags:
            tag_names = [tag.name for tag in tags]
            attrs["category"] = ",".join(tag_names)

        # Check for feed URL in unfurl metadata
        if bookmark.unfurl_metadata:
            try:
                if isinstance(bookmark.unfurl_metadata, str):
                    metadata = json.loads(bookmark.unfurl_metadata)
                    feed_url = metadata.get("feed")
                else:
                    feed_url = getattr(bookmark.unfurl_metadata, "feed", None)
                    if feed_url == "No Feed":
                        feed_url = None

                if feed_url:
                    # Add RSS feed URL for subscription lists
                    attrs["xmlUrl"] = feed_url
                    attrs["type"] = "rss"  # Override type for RSS feeds
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass

        # Use XMLGenerator to create the outline element
        output = StringIO()
        gen = XMLGenerator(output, encoding="utf-8")

        # Generate self-closing outline element
        gen.startElement("outline", attrs)
        gen.endElement("outline")

        return output.getvalue()

    def generate_bookmarks(self, bookmarks_queryset):
        """Generator that yields formatted bookmarks as OPML outlines."""
        for bookmark in bookmarks_queryset:
            formatted = self.format_bookmark(bookmark)
            if formatted:
                yield formatted
