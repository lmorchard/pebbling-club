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
