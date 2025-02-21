from django import template
from urllib.parse import quote
from django.utils import timezone

register = template.Library()


@register.filter
def urlencode_bookmark_tag(value):
    """Double URL encode a string to make it safe for use in URLs."""
    return quote(quote(value, safe=":"), safe=":")
