import environ
from pathlib import Path

from .utils import read_env_files
from .base import *

# Define possible .env files (in order of precedence)
read_env_files([
    ".env.prod",    # Production-specific
    ".env.local",   # Local overrides
    ".env",         # Default environment file
])

env = environ.Env()

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")
