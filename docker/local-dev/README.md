# Hybrid Local Development Setup

This setup provides production parity for data services (PostgreSQL + Redis) while keeping development services (Django, Celery) running natively for fast reloading.

## Architecture

**Docker Services (Infrastructure):**

- PostgreSQL 16 (port 5432)
- Redis 7 (port 6379)
- Nginx proxy (port 8000) - serves static files and proxies to native services

**Native Services (Development):**

- Django runserver (hot reload, port 8010)
- Celery worker (with file watching)
- Celery beat
- Flower (Celery monitoring, port 5555)
- Frontend build (with watch mode)

## Quick Start

1. **Install dependencies:**

   ```bash
   pip install honcho watchdog psycopg2-binary
   ```

2. **Copy environment file:**

   ```bash
   cp docker/local-dev/env-example .env
   # Edit .env if needed
   ```

3. **Start everything:**

   ```bash
   ./docker/local-dev/dev-hybrid.sh
   ```

4. **Access your services:**
   - **🌐 Main app (via nginx):** http://localhost:8000
   - **📊 Flower (via nginx):** http://localhost:8000/flower/
   - **🔧 Direct Django (dev):** http://localhost:8010
   - **🔧 Direct Flower (dev):** http://localhost:5555/flower/
   - **🗃️ PostgreSQL:** localhost:5432 (user: pebbling, pass: dev_password_123, db: pebbling_club)
   - **⚡ Redis:** localhost:6379

## Commands

- **Start development:** `./docker/local-dev/dev-hybrid.sh`
- **Stop everything:** Press Ctrl+C (automatically stops all services and containers)

## Benefits vs Previous Setup

### ✅ Gains

- **Production parity:** Same PostgreSQL, Redis, and nginx as production
- **Nginx proxy:** Same request routing and static file serving as production
- **Celery monitoring:** Flower works with Redis broker
- **Better debugging:** Reproduce production database issues locally
- **Faster tests:** PostgreSQL performs better than SQLite for complex queries
- **Redis features:** Use Redis-specific features (pub/sub, etc.)
- **Static file handling:** Test nginx static file serving locally

### ⚠️ Changes

- **External dependencies:** Requires Docker for infrastructure
- **Slightly slower startup:** ~10-15 seconds vs instant SQLite
- **Persistent data:** Database survives restarts (use `docker volume prune` to clear)

## Migration from Old Setup

The old SQLite-based setup is still available in `Procfile-dev`. You can switch back anytime.

To migrate existing data:

1. Export from SQLite: `python manage.py dumpdata > data.json`
2. Start hybrid setup: `./docker/local-dev/dev-hybrid.sh`
3. Import to PostgreSQL: `python manage.py loaddata data.json`

## Troubleshooting

- **"Connection refused":** Make sure Docker is running and services started
- **"Database doesn't exist":** The init script should create it automatically
- **Port conflicts:** Change ports in `docker/local-dev/docker-compose.yml` if needed
- **Permission issues:** Make sure script is executable: `chmod +x docker/local-dev/dev-hybrid.sh`
