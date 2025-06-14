ARG PYTHON_VERSION=3.13-slim

##########################################################################
# Frontend build stage
# We only need Node.js to build the frontend assets
##########################################################################
FROM node:22-slim AS frontend-builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install frontend dependencies
RUN npm ci

# Copy the rest of the project and build 
# We need the full project and not just the frontend directory
COPY . .
RUN npm run build

##########################################################################
# Production stage
# Everything else we need to run a production stack
##########################################################################
FROM python:${PYTHON_VERSION}

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Set environment variables
ENV PATH="/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONWARNINGS="ignore::SyntaxWarning" \
    DJANGO_ENV=dev \
    SECRET_KEY=your-secret-key-here-1234567890 \
    DEBUG=True \
    ALLOWED_HOSTS=* \
    SQLITE_BASE_DIR=/app/data \
    DATA_BASE_DIR=/app/data \
    CELERY_BEAT_SCHEDULE_FILENAME=/app/data/celerybeat-schedule \
    CELERY_BROKER_URL=sqla+sqlite:////app/data/celery.sqlite3

COPY pyproject.toml ./

# Create and activate virtual environment
RUN uv venv --python=python3.13 && \
    . .venv/bin/activate && \
    uv sync && \
    uv pip install gunicorn honcho

COPY docker/basic/Procfile /app/Procfile
COPY docker/basic/nginx.conf /etc/nginx/nginx.conf
COPY . .
COPY --from=frontend-builder /app/frontend/build/ /app/frontend/build/

# Collect static files as django user
RUN useradd -ms /bin/bash django
RUN mkdir -p /app/run /app/static /app/media /app/data && \
    chown -R django:django /app/run /app/static /app/media /app/data
USER django
RUN uv run manage.py collectstatic --noinput

USER root

# Set up volumes
VOLUME ["/app/data", "/var/data"]

# Expose the port the app runs on
EXPOSE 8000

# Set the default command
CMD ["honcho", "start", "-f", "Procfile"]
