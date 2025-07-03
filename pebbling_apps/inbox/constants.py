"""
Constants for inbox app, including source types and other shared values.
"""

from enum import Enum


class SourceType(str, Enum):
    """Source types for inbox items."""

    MASTODON = "mastodon"
    FEED = "feed"
    MANUAL = "manual"
    IMPORT = "import"

    @classmethod
    def choices(cls):
        """Return choices for Django model field."""
        return [(item.value, item.value.title()) for item in cls]


# Legacy string constants for backwards compatibility
MASTODON_SOURCE_TYPE = SourceType.MASTODON.value
FEED_SOURCE_TYPE = SourceType.FEED.value
MANUAL_SOURCE_TYPE = SourceType.MANUAL.value
IMPORT_SOURCE_TYPE = SourceType.IMPORT.value
