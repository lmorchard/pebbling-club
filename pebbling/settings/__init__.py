from django.core.exceptions import ImproperlyConfigured
from .utils import read_env_files

env = read_env_files([".env"])
django_env = env("DJANGO_ENV", default="prod")
if django_env not in ["dev", "prod"]:
    raise ImproperlyConfigured(f"Invalid DJANGO_ENV: {django_env}")

if django_env == "dev":
    from .dev import *
else:
    from .prod import *

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
        "level": LOG_LEVEL,
    },
    "loggers": {
        "pebbling_apps": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}

_shared_sqlite_options = {
    "transaction_mode": "IMMEDIATE",
    "timeout": 5,  # seconds
    "init_command": """
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        PRAGMA mmap_size=134217728;
        PRAGMA journal_size_limit=27103364;
        PRAGMA cache_size=2000;
    """,
}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "main.sqlite3",
        "OPTIONS": {
            **_shared_sqlite_options,
        },
    },
    "feeds_db": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "feeds.sqlite3",
        "OPTIONS": {
            **_shared_sqlite_options,
        },
    },
    "celery_db": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "celery.sqlite3",
        "OPTIONS": {
            **_shared_sqlite_options,
        },
    },
    "cache_db": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "cache.sqlite3",
        "OPTIONS": {
            **_shared_sqlite_options,
        },
    },
}

# Celery settings
CELERY_BEAT_SCHEDULE_FILENAME = str(DATA_BASE_DIR / "celerybeat-schedule")
CELERY_DB_PATH = str(SQLITE_BASE_DIR / "celery.sqlite3")
CELERY_BROKER_URL = (
    # Use separate SQLite DB for Celery
    f"sqla+sqlite:///{CELERY_DB_PATH}"
)
