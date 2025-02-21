from django.utils import timezone
import pytz


def timezone_context(request):
    """Add timezone info to template context."""
    # Default to UTC if no user timezone is set
    user_timezone = timezone.get_current_timezone()
    if request.user.is_authenticated:
        # Check if the timezone is provided in the request headers
        timezone_from_request = request.headers.get("Timezone")
        if timezone_from_request:
            user_timezone = pytz.timezone(
                timezone_from_request
            )  # Use the timezone from the request
        else:
            # For now, we'll use the default
            user_timezone = pytz.timezone("America/Los_Angeles")  # PST/PDT

    return {
        "user_timezone": user_timezone,
    }
