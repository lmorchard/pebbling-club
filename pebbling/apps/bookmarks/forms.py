from django import forms
from .models import Bookmark, Tag


class BookmarkForm(forms.ModelForm):
    tags = forms.CharField(
        required=False,
        help_text="Enter tags separated by spaces",
    )

    class Meta:
        model = Bookmark
        fields = ["url", "title", "description", "tags"]

    def __init__(self, *args, **kwargs):
        """Set the initial value for the tags field as a space-separated string."""
        self.user = kwargs.pop("user", None)  # Extract user from kwargs
        super().__init__(*args, **kwargs)

        # If editing an existing bookmark, prepopulate the tag field
        if self.instance and self.instance.pk:
            self.initial["tags"] = Tag.objects.tags_to_string(self.instance.tags.all())

    def clean_tags(self):
        """Convert a space-separated tag string into a list of Tag instances."""
        tag_string = self.cleaned_data["tags"]
        tag_names = Tag.objects.parse_tag_string(tag_string)

        if not self.user:
            raise forms.ValidationError("User must be provided to save tags.")

        tags = []
        for name in tag_names:
            tag, created = Tag.objects.get_or_create(name=name.strip(), owner=self.user)
            tags.append(tag)
        return tags

    def save_m2m(self):
        """Save tags relationship."""
        if hasattr(self, '_tags'):
            self.instance.tags.set(self._tags)

    def save(self, commit=True):
        """Save the form and handle the owner field."""
        if not self.user:
            raise ValueError("User must be set before saving")

        # Get the cleaned data
        data = self.cleaned_data.copy()
        tags = data.pop('tags')

        if commit:
            # Use update_or_create
            instance, created = Bookmark.objects.update_or_create(
                url=data['url'],
                owner=self.user,
                defaults=data
            )
            self.instance = instance
            # Set the tags
            instance.tags.set(tags)
        else:
            # Just create an unsaved instance
            instance = Bookmark(owner=self.user, **data)
            self.instance = instance
            # Store tags for later
            self._tags = tags

        return instance
