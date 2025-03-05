from django import forms
from django.conf import settings
import json
from .unfurl import UnfurlMetadata
from django.forms.boundfield import BoundField
from django.template.loader import get_template


class UnfurlMetadataWidget(forms.Textarea):
    # template_name = "unfurl/unfurl_metadata_widget.html"

    def __init__(self, attrs=None):
        default_attrs = {"rows": 10}
        if attrs:
            default_attrs.update(attrs)
        super().__init__(default_attrs)


class UnfurlMetadataBoundField(BoundField):
    template_name = "unfurl/unfurl_metadata_field.html"

    def __init__(self, form, field, name):
        super().__init__(form, field, name)

    def render(self):
        template = get_template(self.template_name)
        return template.render(
            {
                "field": self,
                "form": self.form,
                "name": self.name,
            }
        )


class UnfurlMetadataFormField(forms.CharField):

    def __init__(self, *args, omit_html=False, **kwargs):
        self.omit_html = omit_html
        widget_attrs = {
            "label": kwargs.pop("label", "Unfurl Metadata"),
            "rows": 10,
        }
        kwargs["widget"] = UnfurlMetadataWidget(attrs=widget_attrs)
        kwargs.setdefault("required", False)
        kwargs.setdefault("help_text", "JSON representation of URL metadata")
        super().__init__(*args, **kwargs)

    def get_bound_field(self, form, field_name):
        return UnfurlMetadataBoundField(form, self, field_name)

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
