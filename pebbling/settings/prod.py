from pathlib import Path

from .utils import read_env_files
from .base import *

env = read_env_files(
    [
        ".env.prod",  # Production-specific
        ".env",  # Local overrides
    ]
)

LOG_LEVEL = env("LOG_LEVEL", default="INFO")
DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")

DATA_BASE_DIR = Path(env("DATA_BASE_DIR", default="/var/data")).resolve()
SQLITE_BASE_DIR = Path(env("SQLITE_BASE_DIR", default="/var/data")).resolve()
STATIC_URL = "/static/"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
