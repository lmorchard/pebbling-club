from .utils import read_env_files
from .base import *

env = read_env_files(
    [
        ".env.dev",  # Development-specific
        ".env",  # Local overrides
    ]
)

LOG_LEVEL = env("LOG_LEVEL", default="INFO")
DEBUG = env.bool("DEBUG", default=True)
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="django-insecure-37mhzl&hgom1g#)u3f9!^&-ysqxxxj#4&@*sk(7g$t^_7t^g7)",
)
DATA_BASE_DIR = BASE_DIR / "data"
SQLITE_BASE_DIR = BASE_DIR / "data"
INTERNAL_IPS = ["127.0.0.1"]
