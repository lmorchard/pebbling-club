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
        data = {
            "url": value.url,
            "metadata": value.metadata,
            "feeds": value.feeds,
        }
        if not self.omit_html:
            data["html"] = value.html
        return json.dumps(data, indent=2)

    def clean(self, value):
        """Convert JSON string back to UnfurlMetadata instance"""
        value = super().clean(value)
        if not value:
            return None

        try:
            data = json.loads(value)
            return UnfurlMetadata(
                url=data.get("url", ""),
                metadata=data.get("metadata", {}),
                feeds=data.get("feeds", []),
                html=data.get("html", ""),
            )
        except json.JSONDecodeError:
            raise forms.ValidationError("Invalid JSON format for unfurl metadata")
