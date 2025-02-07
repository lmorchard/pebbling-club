import os
from django.core.exceptions import ImproperlyConfigured

env = os.getenv("DJANGO_ENV", "dev")  # Default to dev if not set
if env not in ["dev", "prod"]:
    raise ImproperlyConfigured(f"Invalid DJANGO_ENV: {env}")

if env == "dev":
    from .dev import *
else:
    from .prod import *
