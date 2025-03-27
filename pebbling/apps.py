from django.apps import AppConfig
from django.db.backends.signals import connection_created
from pebbling.db_signals import configure_sqlite_connection


class PebblingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pebbling"

    def ready(self):
        connection_created.connect(configure_sqlite_connection)
