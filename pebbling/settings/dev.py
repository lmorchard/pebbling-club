from .utils import read_env_files
from .base import *

env = read_env_files(
    [
        ".env.dev",  # Development-specific
        ".env.local",  # Local overrides
    ]
)

DEBUG = env.bool("DEBUG", default=True)
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="django-insecure-37mhzl&hgom1g#)u3f9!^&-ysqxxxj#4&@*sk(7g$t^_7t^g7)",
)
# DATABASE_URL = env("DATABASE_URL", default="sqlite:///db.sqlite3")
