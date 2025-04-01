import enum
from django.db.models import Q
from enum import StrEnum
from typing import TypeVar, get_args, Any, Type, Union
from durations_nlp import Duration
from durations_nlp.helpers import valid_duration
import datetime
from django.utils import timezone


E = TypeVar("E")


def django_enum(cls: Type[E]) -> Type[E]:
    """Patch to prevent Enum from being called in Django templates.

    https://code.djangoproject.com/ticket/31154
    """
    setattr(cls, "do_not_call_in_templates", True)
    return cls


def parse_since(since: str) -> Union[None, datetime.datetime]:
    """Parse a 'since' string into a datetime object."""
    if valid_duration(since):
        seconds_since = Duration(since).to_seconds()
        return timezone.now() - datetime.timedelta(seconds=seconds_since)
    try:
        return datetime.datetime.fromisoformat(since)
    except ValueError:
        return None
