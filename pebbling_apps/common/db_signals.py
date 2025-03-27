from django.db.backends.signals import connection_created


def configure_sqlite_connection(sender, connection, **kwargs):
    """Configure SQLite connection with performance optimizations."""
    if connection.vendor == "sqlite":
        cursor = connection.cursor()
        
        # Performance settings
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA mmap_size=134217728")
        cursor.execute("PRAGMA journal_size_limit=27103364")
        cursor.execute("PRAGMA cache_size=2000")
        cursor.execute("PRAGMA busy_timeout=5000")


connection_created.connect(configure_sqlite_connection)
