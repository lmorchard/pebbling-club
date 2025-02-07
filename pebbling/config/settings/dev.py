import environ
from pathlib import Path

from .utils import read_env_files
from .base import *

read_env_files([
    ".env.dev",     # Development-specific
    ".env.local",   # Local overrides
    ".env",         # Default environment file
])

env = environ.Env()

SECRET_KEY = env("DJANGO_SECRET_KEY", default='django-insecure-37mhzl&hgom1g#)u3f9!^&-ysqxxxj#4&@*sk(7g$t^_7t^g7)')
DEBUG = env.bool("DEBUG", default=False)
#DATABASE_URL = env("DATABASE_URL", default="sqlite:///db.sqlite3")
