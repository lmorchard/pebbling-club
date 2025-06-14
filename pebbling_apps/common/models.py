from django.db import models
from django.utils.timezone import now  # Import now() directly


class TimestampedModel(models.Model):
    """Abstract base model with automatic timestamps"""

    created_at = models.DateTimeField(default=now, editable=True)
    updated_at = models.DateTimeField(default=now, editable=True)

    def save(self, *args, **kwargs):
        # Set timestamps if not provided
        if not self.pk and not self.created_at:
            self.created_at = now()
        if not self.updated_at or self.updated_at == self.created_at:
            self.updated_at = now()

        super().save(*args, **kwargs)

    class Meta:
        abstract = True  # This prevents Django from creating a database table


class QueryPage:
    def __init__(self, object_list, count, limit, page_number):
        self._object_list = object_list
        self._count = count
        self._limit = limit
        self._page_number = page_number

    def count(self):
        return self._count

    def __iter__(self):
        for x in self._object_list:
            yield x

    def __getitem__(self, subscript):
        # TODO: properly handle subscript with offset based on this page's limit and page_number
        if isinstance(subscript, slice):
            # HACK: just ignore Django paginator subslice and return the whole page
            return self._object_list
        else:
            return self._object_list[subscript]
