class CacheRouter:
    """
    Router to handle cache database operations
    """

    cache_app = "django_cache"
    cache_model = "cacheentry"

    def _cache_db_available(self):
        """Check if cache_db is configured"""
        from django.conf import settings
        return "cache_db" in getattr(settings, "DATABASES", {})

    def db_for_read(self, model, **hints):
        if model._meta.db_table == "django_cache_table":
            if self._cache_db_available():
                return "cache_db"
            else:
                return "default"
        return None

    def db_for_write(self, model, **hints):
        if model._meta.db_table == "django_cache_table":
            if self._cache_db_available():
                return "cache_db"
            else:
                return "default"
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the cache table only appears in the cache_db database.
        """
        if model_name == self.cache_model:
            if self._cache_db_available():
                return db == "cache_db"
            else:
                return db == "default"
        if db == "cache_db":
            return model_name == self.cache_model
        if db == "default" and not self._cache_db_available():
            return True
        return None


class CeleryRouter:
    """
    Router to handle Celery database operations
    """

    celery_apps = {"django_celery_results", "django_celery_beat"}

    def _celery_db_available(self):
        """Check if celery_db is configured"""
        from django.conf import settings
        return "celery_db" in getattr(settings, "DATABASES", {})

    def db_for_read(self, model, **hints):
        if model._meta.app_label in self.celery_apps:
            if self._celery_db_available():
                return "celery_db"
            else:
                return "default"
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label in self.celery_apps:
            if self._celery_db_available():
                return "celery_db"
            else:
                return "default"
        return None

    def allow_relation(self, obj1, obj2, **hints):
        if (
            obj1._meta.app_label in self.celery_apps
            or obj2._meta.app_label in self.celery_apps
        ):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the Celery tables only appear in the celery_db database.
        """
        # If we're dealing with a celery app
        if app_label in self.celery_apps:
            if self._celery_db_available():
                return db == "celery_db"
            else:
                return db == "default"

        # If we're dealing with celery_db
        if db == "celery_db":
            # Only allow celery apps
            return app_label in self.celery_apps

        # For the default database
        if db == "default":
            if self._celery_db_available():
                # When celery_db exists, prevent celery apps in default
                return app_label not in self.celery_apps
            else:
                # When celery_db doesn't exist, allow celery apps in default
                return True

        # For all other databases, let other routers decide
        return None


class FeedsRouter:
    """
    Router to handle Feeds database operations
    """

    # TODO: can this specified as pebbling_apps.feeds? seems like no
    feeds_app = "feeds"

    def _feeds_db_available(self):
        """Check if feeds_db is configured"""
        from django.conf import settings
        return "feeds_db" in getattr(settings, "DATABASES", {})

    def db_for_read(self, model, **hints):
        if model._meta.app_label == self.feeds_app:
            if self._feeds_db_available():
                return "feeds_db"
            else:
                return "default"
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == self.feeds_app:
            if self._feeds_db_available():
                return "feeds_db"
            else:
                return "default"
        return None

    def allow_relation(self, obj1, obj2, **hints):
        if (
            obj1._meta.app_label == self.feeds_app
            or obj2._meta.app_label == self.feeds_app
        ):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the Feeds tables only appear in the feeds_db database.
        """
        if app_label == self.feeds_app:
            if self._feeds_db_available():
                return db == "feeds_db"
            else:
                return db == "default"
        if db == "feeds_db":
            return app_label == self.feeds_app
        if db == "default" and not self._feeds_db_available():
            # When feeds_db is not available, allow feeds app in default
            return True
        if db == "default":
            return app_label != self.feeds_app
        return None
