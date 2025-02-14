class CacheRouter:
    """
    Router to handle cache database operations
    """
    def db_for_read(self, model, **hints):
        if getattr(model, '_meta', None) and model._meta.db_table == 'django_cache_table':
            return 'cache_db'
        return None

    def db_for_write(self, model, **hints):
        if getattr(model, '_meta', None) and model._meta.db_table == 'django_cache_table':
            return 'cache_db'
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the cache table only appears in the cache_db database.
        """
        if db == 'cache_db':
            return True  # Allow all operations on cache_db for now
        return None  # Let other routers or default handle other cases 