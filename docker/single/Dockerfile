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
    DJANGO_SETTINGS_MODULE=pebbling.settings \
    SECRET_KEY=your-secret-key-here-1234567890 \
    DEBUG=True \
    ALLOWED_HOSTS=* \
    SQLITE_BASE_DIR=/app/data \
    DATA_BASE_DIR=/app/data \
    CELERY_BEAT_SCHEDULE_FILENAME=/app/data/celerybeat-schedule \
    CELERY_BROKER_URL=sqla+sqlite:////app/data/celery.sqlite3

# Create user early to avoid cache invalidation
RUN useradd -ms /bin/bash django

# Copy only dependency files first for better caching
COPY pyproject.toml ./

# Create and activate virtual environment - this layer will only be rebuilt if pyproject.toml changes
RUN uv venv --python=python3.13 && \
    . .venv/bin/activate && \
    uv sync && \
    uv pip install gunicorn honcho

# Copy configuration files - these change less frequently than application code
COPY docker/single/Procfile /app/Procfile
COPY docker/single/nginx.conf /etc/nginx/nginx.conf

# Create necessary directories with appropriate permissions
RUN mkdir -p /app/run /app/static /app/media /app/data && \
    chown -R django:django /app/run /app/static /app/media /app/data

# Now copy application code - this will invalidate cache from this point forward
COPY --chown=django:django . .

# Copy frontend build artifacts
COPY --from=frontend-builder --chown=django:django /app/frontend/build/ /app/frontend/build/
USER django
RUN uv run manage.py collectstatic --noinput

USER root

# Set up volumes
VOLUME ["/app/data", "/var/data"]

# Expose the port the app runs on
EXPOSE 8000

# Set the default command
CMD ["honcho", "start", "-f", "Procfile"]
