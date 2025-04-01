import enum
from django.db.models import Q
from enum import StrEnum
from typing import TypeVar, get_args, Any, Type, Union


E = TypeVar("E")


def django_enum(cls: Type[E]) -> Type[E]:
    """Patch to prevent Enum from being called in Django templates.

    https://code.djangoproject.com/ticket/31154
    """
    setattr(cls, "do_not_call_in_templates", True)
    return cls
