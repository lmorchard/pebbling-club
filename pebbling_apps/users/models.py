from django.contrib.auth.models import AbstractUser
from django.db import models
from django_prometheus.models import ExportModelOperationsMixin


# ExportModelOperationsMixin is a factory function that returns a class dynamically
# mypy cannot analyze this pattern, but it's the standard django-prometheus usage
class CustomUser(ExportModelOperationsMixin("user"), AbstractUser):  # type: ignore[misc]
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.username
