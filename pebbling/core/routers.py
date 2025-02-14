class CacheRouter:
    """
    Router to handle cache database operations
    """
    cache_app = 'django_cache'
    cache_model = 'cacheentry'

    def db_for_read(self, model, **hints):
        if model._meta.db_table == "django_cache_table":
            return "cache_db"
        return None

    def db_for_write(self, model, **hints):
        if model._meta.db_table == "django_cache_table":
            return "cache_db"
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the cache table only appears in the cache_db database.
        """
        if model_name == self.cache_model:
            return db == "cache_db"
        if db == "cache_db":
            return model_name == self.cache_model
        return None

class CeleryRouter:
    """
    Router to handle Celery database operations
    """
    celery_apps = {'django_celery_results', 'django_celery_beat'}

    def db_for_read(self, model, **hints):
        if model._meta.app_label in self.celery_apps:
            return 'celery_db'
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label in self.celery_apps:
            return 'celery_db'
        return None

    def allow_relation(self, obj1, obj2, **hints):
        if (
            obj1._meta.app_label in self.celery_apps or 
            obj2._meta.app_label in self.celery_apps
        ):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the Celery tables only appear in the celery_db database.
        """
        # If we're dealing with a celery app
        if app_label in self.celery_apps:
            # Only allow it in celery_db
            return db == 'celery_db'
        
        # If we're dealing with celery_db
        if db == 'celery_db':
            # Only allow celery apps
            return app_label in self.celery_apps
            
        # For the default database, explicitly prevent celery apps
        if db == 'default':
            return app_label not in self.celery_apps
            
        # For all other databases, let other routers decide
        return None
