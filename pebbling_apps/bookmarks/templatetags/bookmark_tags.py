from django import template
from urllib.parse import quote
from django.urls import reverse

register = template.Library()


@register.filter
def urlencode_bookmark_tag(value):
    """Double URL encode a string to make it safe for use in URLs."""
    return quote(quote(value, safe=":"), safe=":")


@register.simple_tag(takes_context=True)
def bookmarklet_new_bookmark(
    context, popup: bool = False, popup_width: int = 600, popup_height: int = 420
) -> str:
    """Generate a bookmarklet JavaScript code as a string."""

    # Get the request from the template context
    request = context["request"]

    # Get the URL for the 'bookmarks:add' route using the request host
    new_url = f"{request.scheme}://{request.get_host()}{reverse('bookmarks:add')}"

    # Build the bookmarklet parts list
    parts = [
        # Bookmarklets are so cursed...
        "javascript:",
        # Get selected text
        "if(document.getSelection){s=document.getSelection();}else{s='';};",
        # Pre-fill tags from keyword search parameters in Firefox
        # see: https://support.mozilla.org/en-US/kb/bookmarks-firefox#w_how-to-use-keywords-with-bookmarks
        't="%s";',
        # Construct URL params
        "p=new URLSearchParams({",
        "url:location.href,",
        "title:document.title,",
        "description:s,",
        # Handle Firefox keyword search parameter
        'tags:(t[0]==="%"&&t[1]==="s")?"":t,',
        # Set mode based on popup parameter
        f'popup:true,next:"close"' if popup else 'next:"same"',
        "});",
        # Construct final URL
        f'u="{new_url}?"+p.toString();',
        # Either open popup or redirect
        (
            f'void(window.open(u, "_blank", "width={popup_width},height={popup_height}"))'
            if popup
            else "document.location=u"
        ),
    ]

    # Join all parts, filtering out any empty strings
    return "".join(part for part in parts if part)
