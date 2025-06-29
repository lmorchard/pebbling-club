from django import forms
from .models import InboxItem
import requests


class InboxItemForm(forms.ModelForm):
    """Form for manually creating inbox items."""

    class Meta:
        model = InboxItem
        fields = ["url", "title", "description", "source"]
        widgets = {
            "url": forms.URLInput(
                attrs={
                    "placeholder": "https://example.com/article",
                    "class": "form-control",
                }
            ),
            "title": forms.TextInput(
                attrs={"placeholder": "Article title", "class": "form-control"}
            ),
            "description": forms.Textarea(
                attrs={
                    "placeholder": "Optional description",
                    "rows": 4,
                    "class": "form-control",
                }
            ),
            "source": forms.TextInput(
                attrs={
                    "placeholder": "e.g., manual, test, feed https://example.com/rss",
                    "class": "form-control",
                }
            ),
        }
        help_texts = {
            "source": 'Identify where this item came from (e.g., "manual", "test", "feed https://example.com/rss")',
            "url": "The URL of the item you want to add to your inbox",
            "title": "Title of the item",
            "description": "Optional description or notes about the item",
        }

    def clean_url(self):
        """Validate that the URL is accessible."""
        url = self.cleaned_data.get("url")
        if url:
            try:
                # Simple validation - just check if URL format is reasonable
                # We don't want to make actual HTTP requests during form validation
                # as it could be slow or fail due to network issues
                if not url.startswith(("http://", "https://")):
                    raise forms.ValidationError(
                        "URL must start with http:// or https://"
                    )
            except Exception as e:
                raise forms.ValidationError(f"Invalid URL: {e}")
        return url

    def clean_source(self):
        """Ensure source field is not empty."""
        source = self.cleaned_data.get("source")
        if not source or not source.strip():
            return "manual"  # Default source for manual entries
        return source.strip()
