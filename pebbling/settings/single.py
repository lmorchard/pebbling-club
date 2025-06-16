from .utils import read_env_files
from .base import *
import os

env = read_env_files(
    [
        ".env.docker",  # Docker-specific
        ".env",  # Local overrides
    ]
)

LOG_LEVEL = env("LOG_LEVEL", default="INFO")
DEBUG = env.bool("DEBUG", default=True)
SECRET_KEY = env("SECRET_KEY", default="your-secret-key-here-1234567890")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
DATA_BASE_DIR = Path(env("DATA_BASE_DIR", default="/app/data"))

# Add container hostnames to trusted origins for CSRF protection
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8000", 
    "http://127.0.0.1:8000"
]

# Configure SQLite database
SQLITE_BASE_DIR = Path(env("SQLITE_BASE_DIR", default="/app/data"))
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "db.sqlite3",
    },
    "feeds_db": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "feeds.sqlite3",
    },
    "celery_db": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "celery.sqlite3",
    },
    "cache_db": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SQLITE_BASE_DIR / "cache.sqlite3",
    },
}

# Configure SQLite-based Celery broker
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="sqla+sqlite:///data/celery.sqlite3")
CELERY_RESULT_BACKEND = "django-db"
CELERY_BEAT_SCHEDULE_FILENAME = env("CELERY_BEAT_SCHEDULE_FILENAME", default=str(DATA_BASE_DIR / "celerybeat-schedule"))

# Configure database cache
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",
    }
}
