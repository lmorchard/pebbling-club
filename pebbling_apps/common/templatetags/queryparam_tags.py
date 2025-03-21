from django import template
from urllib.parse import urlencode

register = template.Library()


@register.simple_tag(takes_context=True)
def update_qs(context, **kwargs):
    """
    Returns a query string with the current request's GET parameters,
    but with replacements from **kwargs.

    Example usage:
    {% load queryparam_tags %}
    <a href="?{% update_qs page=3 %}">Page 3</a>
    <a href="?{% update_qs order_by='name' %}">Sort by name</a>
    """
    # Get the current request's GET parameters
    request = context.get("request")
    if request is None:
        return ""

    # Create a dictionary with all current parameters
    updated_params = request.GET.copy()

    # Update with any replacements
    for key, value in kwargs.items():
        if value is None or value == "":
            # Remove the parameter if the value is empty
            if key in updated_params:
                del updated_params[key]
        else:
            # Otherwise set/replace the parameter
            updated_params[key] = value

    # Return the encoded query string
    return urlencode(updated_params, doseq=True)
