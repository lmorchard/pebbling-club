from django.db import models
from .unfurl import UnfurlMetadata
from .forms import UnfurlMetadataFormField


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
            return value.to_json(omit_html=self.omit_html)
        return value  # Return the value as is if it's not an UnfurlMetadata instance

    def from_db_value(self, value, expression, connection):
        """Convert the JSON string back to an UnfurlMetadata instance."""
        if value is None or value == "":  # Handle None or empty string gracefully
            return None
        return UnfurlMetadata.from_json(json_str=value, omit_html=self.omit_html)

    def to_python(self, value):
        """Convert the value from the database to an UnfurlMetadata instance."""
        if value is None or value == "":  # Handle None or empty string gracefully
            return None
        if isinstance(value, UnfurlMetadata):
            return value
        return UnfurlMetadata.from_json(value, omit_html=self.omit_html)

    def db_type(self, connection):
        """Specify the database column type for this field."""
        return "text"  # Use 'text' to store JSON strings

    def formfield(self, **kwargs):
        defaults = {"form_class": UnfurlMetadataFormField, "omit_html": self.omit_html}
        defaults.update(kwargs)
        return super().formfield(**defaults)
