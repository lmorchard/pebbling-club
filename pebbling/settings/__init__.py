from django.core.exceptions import ImproperlyConfigured
from .utils import read_env_files

env = read_env_files([".env"])

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env("LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        "pebbling_apps": {
            "handlers": ["console"],
            "level": env("LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
    },
}

django_env = env("DJANGO_ENV", default="prod")
if django_env not in ["dev", "prod"]:
    raise ImproperlyConfigured(f"Invalid DJANGO_ENV: {django_env}")

if django_env == "dev":
    from .dev import *
else:
    from .prod import *
