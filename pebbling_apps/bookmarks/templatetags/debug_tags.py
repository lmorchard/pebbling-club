from django import template
from pprint import pformat

register = template.Library()


@register.simple_tag(takes_context=True)
def debug_context(context):
    # Convert the context to a dictionary, ensuring only key-value pairs are included
    context_dict = {key: value for key, value in context.flatten().items()}
    return pformat(context_dict)
