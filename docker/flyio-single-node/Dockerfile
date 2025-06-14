ARG PYTHON_VERSION=3.11-slim

##########################################################################
# Build stage
# We need node.js to build the frontend assets, but not while running prod
##########################################################################

FROM python:${PYTHON_VERSION} AS builder

# Install Node.js for frontend build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Python requirements
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Copy frontend files and build
COPY package.json package-lock.json* ./
COPY frontend/ ./frontend/
RUN npm ci && npm run build

##########################################################################
# Production stage
# Everything else we need to run a production stack
##########################################################################

FROM python:${PYTHON_VERSION}

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update -y && \
    apt-get install -y make curl unzip tar gzip sqlite3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the application
RUN useradd -ms /bin/bash django

# Set working directory
WORKDIR /app

# Copy Python wheels and install
COPY --from=builder /app/wheels /wheels/
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels/ -r requirements.txt && \
    rm -rf /wheels

# Copy built frontend assets
COPY --from=builder /app/frontend/build/ /app/frontend/build/

# Copy Django application
COPY . .

# Collect static files
RUN DJANGO_ENV=dev python manage.py collectstatic --noinput

COPY docker/flyio-single-node/Procfile /app/Procfile

# Create required directories
RUN mkdir -p /var/data /var/log/gunicorn /var/log/celery /var/run/celery
RUN chown -R django:django /app && \
    chown -R django:django /var/data && \
    chown -R django:django /var/log/gunicorn && \
    chown -R django:django /var/log/celery && \
    chown -R django:django /var/run/celery

VOLUME [ "/var/data" ]

EXPOSE 8000

USER django
CMD ["honcho", "start"]
