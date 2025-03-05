from django import forms
from .models import Bookmark, Tag


class TagsFormField(forms.CharField):
    """Form field for handling space-separated tags."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("required", False)
        kwargs.setdefault("help_text", "Enter tags separated by spaces")
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)

    def prepare_value(self, value):
        """Convert list of Tag instances to space-separated string."""
        if isinstance(value, str):
            return value
        if value is None:
            return ""
        return Tag.objects.tags_to_string(value)

    def clean(self, value):
        """Convert space-separated string to list of Tag instances."""
        value = super().clean(value)
        if not value:
            return []

        if not self.user:
            raise forms.ValidationError("User must be provided to save tags.")

        tag_names = Tag.objects.parse_tag_string(value)
        return [
            Tag.objects.get_or_create(name=name.strip(), owner=self.user)[0]
            for name in tag_names
        ]


class BookmarkForm(forms.ModelForm):
    tags = TagsFormField()

    class Meta:
        model = Bookmark
        fields = ["url", "title", "description", "tags", "unfurl_metadata"]

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self.fields["tags"].user = self.user
        self.fields["tags"].widget.attrs["autofocus"] = True

    def save(self, commit=True):
        """Save the form and handle the owner field."""
        if not self.user:
            raise ValueError("User must be set before saving")

        data = self.cleaned_data.copy()
        tags = data.pop("tags")

        if commit:
            instance, created = Bookmark.objects.update_or_create(
                url=data["url"], owner=self.user, defaults=data
            )
            self.instance = instance
            instance.tags.set(tags)
        else:
            instance = Bookmark(owner=self.user, **data)
            self.instance = instance
            self._tags = tags

        return instance
