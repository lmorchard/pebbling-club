import json
from django.utils.html import escape


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
