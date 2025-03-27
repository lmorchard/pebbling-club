from django.apps import AppConfig
from django.db.backends.signals import connection_created


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pebbling_apps.common"

    def ready(self):
        from .db_signals import configure_sqlite_connection
        connection_created.connect(configure_sqlite_connection)
