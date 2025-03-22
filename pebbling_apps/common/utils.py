import enum
from django.db.models import Q
from enum import StrEnum
from typing import TypeVar, get_args, Any, Type, Union


def filter_bookmarks(queryset, query):
    """Filter bookmarks based on the search query."""
    if query:
        queryset = queryset.filter(
            Q(title__icontains=query)
            | Q(url__icontains=query)
            | Q(description__icontains=query)
            | Q(tags__name__icontains=query)
        ).distinct()
    return queryset


E = TypeVar("E")


def django_enum(cls: Type[E]) -> Type[E]:
    """Patch to prevent Enum from being called in Django templates.

    https://code.djangoproject.com/ticket/31154
    """
    setattr(cls, "do_not_call_in_templates", True)
    return cls
