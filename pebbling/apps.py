from django.apps import AppConfig
from django.db.backends.signals import connection_created


class PebblingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pebbling"
