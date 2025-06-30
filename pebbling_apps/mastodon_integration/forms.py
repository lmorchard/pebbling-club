from django import forms
from django.core.exceptions import ValidationError
from .models import MastodonTimeline, MastodonAccount


class TimelineForm(forms.ModelForm):
    """Form for creating and editing Mastodon timeline configurations."""

    # Additional fields for specific timeline types
    hashtag = forms.CharField(
        max_length=100,
        required=False,
        help_text="Enter hashtag without the # symbol (e.g., 'python', 'django')",
        widget=forms.TextInput(
            attrs={"placeholder": "python", "class": "form-control"}
        ),
    )

    list_choice = forms.ChoiceField(
        choices=[],
        required=False,
        help_text="Select a list from your Mastodon account",
        widget=forms.Select(attrs={"class": "form-control"}),
    )

    class Meta:
        model = MastodonTimeline
        fields = ["timeline_type", "is_active"]
        widgets = {
            "timeline_type": forms.Select(attrs={"class": "form-control"}),
            "is_active": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }

    def __init__(self, *args, **kwargs):
        self.account = kwargs.pop("account", None)
        self.mastodon_lists = kwargs.pop("mastodon_lists", [])
        super().__init__(*args, **kwargs)

        # Set up list choices if provided
        if self.mastodon_lists:
            choices = [("", "Select a list...")]
            choices.extend([(lst["id"], lst["title"]) for lst in self.mastodon_lists])
            self.fields["list_choice"].choices = choices

        # If editing existing timeline, populate custom fields
        if self.instance and self.instance.pk:
            if self.instance.timeline_type == "HASHTAG":
                hashtag = self.instance.config.get("hashtag", "")
                self.fields["hashtag"].initial = hashtag
            elif self.instance.timeline_type == "LIST":
                list_id = self.instance.config.get("list_id", "")
                self.fields["list_choice"].initial = list_id

    def clean(self):
        cleaned_data = super().clean()
        timeline_type = cleaned_data.get("timeline_type")
        hashtag = cleaned_data.get("hashtag", "").strip()
        list_choice = cleaned_data.get("list_choice", "").strip()

        # Validate required fields based on timeline type
        if timeline_type == "HASHTAG":
            if not hashtag:
                raise ValidationError("Hashtag is required for hashtag timelines")

            # Clean hashtag (remove # if user added it)
            if hashtag.startswith("#"):
                hashtag = hashtag[1:]

            # Validate hashtag format (basic validation)
            if not hashtag.replace("_", "").replace("-", "").isalnum():
                raise ValidationError(
                    "Hashtag can only contain letters, numbers, hyphens, and underscores"
                )

            cleaned_data["hashtag"] = hashtag

        elif timeline_type == "LIST":
            if not list_choice:
                raise ValidationError("List selection is required for list timelines")

        # Check for duplicate timeline configurations
        if self.account:
            config = {}
            if timeline_type == "HASHTAG":
                config["hashtag"] = hashtag
            elif timeline_type == "LIST":
                # Find the selected list details
                selected_list = next(
                    (lst for lst in self.mastodon_lists if lst["id"] == list_choice),
                    None,
                )
                if selected_list:
                    config["list_id"] = list_choice
                    config["list_name"] = selected_list["title"]

            # Check for existing timeline with same configuration
            existing_qs = MastodonTimeline.objects.filter(
                account=self.account, timeline_type=timeline_type, config=config
            )

            # Exclude current instance if editing
            if self.instance and self.instance.pk:
                existing_qs = existing_qs.exclude(pk=self.instance.pk)

            if existing_qs.exists():
                if timeline_type == "HASHTAG":
                    raise ValidationError(
                        f"Timeline for hashtag #{hashtag} already exists"
                    )
                elif timeline_type == "LIST":
                    list_name = config.get("list_name", "this list")
                    raise ValidationError(f"Timeline for {list_name} already exists")
                else:
                    raise ValidationError(
                        f"{timeline_type.title()} timeline already exists"
                    )

        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)

        # Set the account
        if self.account:
            instance.account = self.account

        # Build config based on timeline type
        config = {}
        timeline_type = self.cleaned_data.get("timeline_type")

        if timeline_type == "HASHTAG":
            config["hashtag"] = self.cleaned_data.get("hashtag")
        elif timeline_type == "LIST":
            list_id = self.cleaned_data.get("list_choice")
            selected_list = next(
                (lst for lst in self.mastodon_lists if lst["id"] == list_id), None
            )
            if selected_list:
                config["list_id"] = list_id
                config["list_name"] = selected_list["title"]

        instance.config = config

        if commit:
            instance.save()

        return instance


class TimelineToggleForm(forms.Form):
    """Simple form for toggling timeline active status."""

    is_active = forms.BooleanField(required=False)

    def __init__(self, *args, **kwargs):
        self.timeline = kwargs.pop("timeline", None)
        super().__init__(*args, **kwargs)

        if self.timeline:
            self.fields["is_active"].initial = self.timeline.is_active

    def save(self):
        if self.timeline:
            self.timeline.is_active = self.cleaned_data["is_active"]
            self.timeline.save()
            return self.timeline
        return None
