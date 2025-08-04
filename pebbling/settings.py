from pathlib import Path
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Load environment variables
def read_env_files(env_filenames):
    dot_env_dir = BASE_DIR
    for env_filename in env_filenames:
        env_file = dot_env_dir / env_filename
        if env_file.exists():
            environ.Env.read_env(env_file)
    return environ.Env()


env = read_env_files([".env"])

# Basic Django settings from environment variables
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = env("SECRET_KEY", default="django-insecure-dev-key-change-in-production")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS", default=["http://localhost:8000", "http://127.0.0.1:8000"]
)

# User registration settings
ALLOW_USER_REGISTRATION = env.bool("ALLOW_USER_REGISTRATION", default=True)


# Mastodon integration settings
MASTODON_POLL_FREQUENCY = env.int("MASTODON_POLL_FREQUENCY", default=60)
MASTODON_POLL_LIMIT = env.int("MASTODON_POLL_LIMIT", default=250)
MASTODON_EXCERPT_LENGTH = env.int("MASTODON_EXCERPT_LENGTH", default=100)
MASTODON_MAX_CONSECUTIVE_FAILURES = env.int(
    "MASTODON_MAX_CONSECUTIVE_FAILURES", default=3
)

# Development-specific settings
if DEBUG:
    INTERNAL_IPS = ["127.0.0.1"]

# Production-specific settings
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Data directories
DATA_BASE_DIR = BASE_DIR / env("DATA_BASE_DIR", default="data")
SQLITE_BASE_DIR = BASE_DIR / env("SQLITE_BASE_DIR", default="data")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_celery_results",  # Stores Celery task results in DB
    "django_celery_beat",  # Enables periodic tasks
    "pebbling",
    "pebbling_apps.common",
    "pebbling_apps.users",
    "pebbling_apps.profiles",
    "pebbling_apps.bookmarks",
    "pebbling_apps.feeds",
    "pebbling_apps.home",
    "pebbling_apps.unfurl",
    "pebbling_apps.inbox",
    "pebbling_apps.mastodon_integration",
]

# Add debug toolbar app in debug mode
if DEBUG:
    INSTALLED_APPS.append("debug_toolbar")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Add debug toolbar middleware in debug mode
if DEBUG:
    # Insert after SecurityMiddleware but before WhiteNoise
    MIDDLEWARE.insert(1, "debug_toolbar.middleware.DebugToolbarMiddleware")

ROOT_URLCONF = "pebbling.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "pebbling_apps.common.context_processors.shift_refresh",
                "pebbling_apps.users.context_processors.timezone_context",
                "pebbling_apps.bookmarks.context_processors.bookmark_context",
            ],
        },
    },
]

WSGI_APPLICATION = "pebbling.wsgi.application"

# Logging configuration
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

# Check if we should use multiple SQLite databases
SQLITE_MULTIPLE_DB = env.bool("DJANGO_SQLITE_MULTIPLE_DB", default=True)

if SQLITE_MULTIPLE_DB:
    _shared_sqlite_options = {
        "ENGINE": "django.db.backends.sqlite3",
        "OPTIONS": {
            "transaction_mode": "IMMEDIATE",
            "timeout": 5,
            "init_command": """
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;
                PRAGMA mmap_size = 134217728;
                PRAGMA journal_size_limit = 27103364;
                PRAGMA cache_size=2000;
            """,
        },
    }

    DATABASES = {
        "default": {
            **_shared_sqlite_options,
            "NAME": SQLITE_BASE_DIR / "main.sqlite3",
        },
        "feeds_db": {
            **_shared_sqlite_options,
            "NAME": SQLITE_BASE_DIR / "feeds.sqlite3",
        },
        "celery_db": {
            **_shared_sqlite_options,
            "NAME": SQLITE_BASE_DIR / "celery.sqlite3",
        },
        "cache_db": {
            **_shared_sqlite_options,
            "NAME": SQLITE_BASE_DIR / "cache.sqlite3",
        },
    }
else:
    # Use single database configuration (e.g., PostgreSQL) with prometheus instrumentation
    database_config = env.db("DATABASE_URL", default="sqlite:///data/main.sqlite3")

    # Update engine to use prometheus wrapper
    if database_config["ENGINE"] == "django.db.backends.postgresql":
        database_config["ENGINE"] = "django.db.backends.postgresql"
    elif database_config["ENGINE"] == "django.db.backends.sqlite3":
        database_config["ENGINE"] = "django.db.backends.sqlite3"

    DATABASES = {"default": database_config}

# Configure database routers
# Always include routers - they will handle single vs multi-database mode gracefully
DATABASE_ROUTERS = [
    "pebbling.routers.CacheRouter",
    "pebbling.routers.CeleryRouter",
    "pebbling.routers.FeedsRouter",
]

# File upload settings
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024  # 25MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024  # 25MB

# Celery settings
CELERY_BEAT_SCHEDULE_FILENAME = str(DATA_BASE_DIR / "celerybeat-schedule")

if SQLITE_MULTIPLE_DB:
    # Multiple database mode - use separate SQLite file for Celery broker
    CELERY_DB_PATH = str(SQLITE_BASE_DIR / "celery.sqlite3")
    CELERY_BROKER_URL = f"sqla+sqlite:///{CELERY_DB_PATH}"
else:
    # Single database mode - use Redis or other broker from environment
    CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")

# Configure caches based on SQLITE_MULTIPLE_DB
if SQLITE_MULTIPLE_DB:
    # Multiple database mode - use database cache with separate cache_db
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": "django_cache_table",
            "OPTIONS": {
                "DATABASE": "cache_db",
            },
        }
    }
else:
    # Single database mode - use Redis cache
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": env("REDIS_URL", default="redis://localhost:6379/1"),
        }
    }

CELERY_RESULT_BACKEND = "django-db"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_EXTENDED = True

# Use django-celery-beat for database-backed periodic tasks
# This allows admins to manage schedules via Django admin
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
APPEND_SLASH = False

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "static"
STATICFILES_DIRS = [
    BASE_DIR / "frontend/build",
]

# Media files
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "users.CustomUser"
LOGIN_REDIRECT_URL = "profiles:index"
LOGOUT_REDIRECT_URL = "users:login"
LOGIN_URL = "users:login"
