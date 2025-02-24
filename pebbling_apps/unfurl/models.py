from django.db import models
import json
from .unfurl import UnfurlMetadata


class UnfurlMetadataField(models.Field):
    description = "A field to store UnfurlMetadata as JSON"

    def __init__(self, *args, omit_html=False, **kwargs):
        self.omit_html = omit_html
        super().__init__(*args, **kwargs)

    def get_prep_value(self, value):
        """Convert the UnfurlMetadata instance to a JSON string for storage."""
        if value is None:
            return None  # Handle None gracefully
        if isinstance(value, UnfurlMetadata):
            data = {
                "url": value.url,
                "metadata": value.metadata,
                "feeds": value.feeds,
            }
            if not self.omit_html:
                data["html"] = value.html
            return json.dumps(data)
        return value  # Return the value as is if it's not an UnfurlMetadata instance

    def from_db_value(self, value, expression, connection):
        """Convert the JSON string back to an UnfurlMetadata instance."""
        if value is None or value == "":  # Handle None or empty string gracefully
            return None
        data = json.loads(value)
        return UnfurlMetadata(
            url=data["url"],
            metadata=data.get("metadata", {}),
            feeds=data.get("feeds", []),
            html=data.get("html", ""),
        )

    def to_python(self, value):
        """Convert the value from the database to an UnfurlMetadata instance."""
        if value is None or value == "":  # Handle None or empty string gracefully
            return None
        if isinstance(value, UnfurlMetadata):
            return value
        data = json.loads(value)
        return UnfurlMetadata(
            url=data["url"],
            metadata=data.get("metadata", {}),
            feeds=data.get("feeds", []),
            html=data.get("html", ""),
        )

    def db_type(self, connection):
        """Specify the database column type for this field."""
        return "text"  # Use 'text' to store JSON strings
