from django.apps import AppConfig


class ProfilesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pebbling_apps.profiles"

    def ready(self):
        import pebbling_apps.profiles.signals
