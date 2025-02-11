from .utils import read_env_files
from .base import *

env = read_env_files(
    [
        ".env.prod",  # Production-specific
        ".env.local",  # Local overrides
    ]
)

DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = env("DJANGO_SECRET_KEY")
