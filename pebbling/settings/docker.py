from .utils import read_env_files
from .base import *
import os
import dj_database_url

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
DATA_BASE_DIR = Path("/app/data")

# Add container hostnames to trusted origins for CSRF protection
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8000", 
    "http://127.0.0.1:8000",
    "http://web:8001"
]

# Configure PostgreSQL database
DATABASE_URL = env("DATABASE_URL", default="postgres://pebbling:pebbling_password@postgres:5432/pebbling")
DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL),
    "feeds_db": dj_database_url.parse(DATABASE_URL + "_feeds"),
    "celery_db": dj_database_url.parse(DATABASE_URL + "_celery"),
    "cache_db": dj_database_url.parse(DATABASE_URL + "_cache"),
}

# Add PostgreSQL-specific options
for db_name in DATABASES:
    DATABASES[db_name]["ATOMIC_REQUESTS"] = True
    DATABASES[db_name]["CONN_MAX_AGE"] = 600

# Configure Redis for Celery
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = "django-db"
CELERY_BEAT_SCHEDULE_FILENAME = str(DATA_BASE_DIR / "celerybeat-schedule")

# Configure Redis for cache
REDIS_URL = env("REDIS_URL", default="redis://redis:6379/1")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}
