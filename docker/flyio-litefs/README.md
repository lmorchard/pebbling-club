Unorganized notes on how to stand this up in fly.io

```
fly -c docker/flyio-litefs/fly.toml launch --now --copy-config --ha=false
fly -c docker/flyio-litefs/fly.toml consul attach
fly -c docker/flyio-litefs/fly.toml secrets set \
    ALLOWED_HOSTS=pebbling-club-django-litefs.fly.dev \
    CSRF_TRUSTED_ORIGINS=https://pebbling-club-django-litefs.fly.dev \
    SECRET_KEY=aiosdhjfoasdfiuas \
    DATA_BASE_DIR=/var/data \
    SQLITE_BASE_DIR=/litefs
fly -c docker/flyio-litefs/fly.toml ssh console --pty -C 'python /app/manage.py createsuperuser'
```
