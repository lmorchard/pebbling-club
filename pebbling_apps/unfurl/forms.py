from django import forms
from django.conf import settings
import json
from .unfurl import UnfurlMetadata


class UnfurlMetadataFormField(forms.CharField):
    widget = forms.Textarea
    default_attrs = {"rows": 10}

    def __init__(self, *args, omit_html=False, **kwargs):
        self.omit_html = omit_html
        kwargs.setdefault("widget", self.widget(attrs=self.default_attrs))
        kwargs.setdefault("required", False)
        kwargs.setdefault("help_text", "JSON representation of URL metadata")
        super().__init__(*args, **kwargs)

    def prepare_value(self, value):
        """Convert UnfurlMetadata instance to JSON string for form display"""
        if not value:
            return ""
        if isinstance(value, str):
            return value
        return value.to_json(omit_html=self.omit_html)

    def clean(self, value):
        """Convert JSON string back to UnfurlMetadata instance"""
        value = super().clean(value)
        if not value:
            return None
        try:
            return UnfurlMetadata.from_json(value, omit_html=self.omit_html)
        except json.JSONDecodeError:
            raise forms.ValidationError("Invalid JSON format for unfurl metadata")
