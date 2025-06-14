# Docker image configuration
DOCKER_IMAGE_NAME ?= pebbling-club
DOCKER_IMAGE_TAG ?= latest

.PHONY: dev install docker-build docker-run

# Check if uv is installed
UV := $(shell command -v uv 2> /dev/null)

# Install uv if not found
uv:
	@if ! command -v uv &> /dev/null; then \
		echo "Installing uv..."; \
		curl -sSf https://astral.sh/uv/install.sh | sh; \
		export PATH="$$HOME/.cargo/bin:$$PATH"; \
	fi

# Install Python dependencies
install: uv
	uv sync

# Development server with hot reload
dev: install migrate
	uv run honcho start -f Procfile-dev

# Run development server
serve: install
	uv run python manage.py runserver

# Run celery worker
worker: install
	uv run celery -A pebbling worker --loglevel=info

# Open Python shell
shell: install
	uv run python manage.py shell

# Run tests
test: install
	uv run python manage.py test

# Format code
format: install
	uv run python -m black .
	uv run djlint pebbling pebbling_apps --reformat

# Lint code
lint: install
	uv run python -m black . --check
	uv run djlint pebbling pebbling_apps
	uv run mypy pebbling pebbling_apps --ignore-missing-imports

# Run database migrations
migrate: install
	mkdir -p data
	uv run python manage.py createcachetable --database cache_db
	uv run python manage.py migrate --database=celery_db
	uv run python manage.py migrate --database=feeds_db
	uv run python manage.py migrate

# Production database migrations
migrate_prod:
	uv run python manage.py createcachetable --database cache_db
	uv run python manage.py migrate --noinput --database=celery_db
	uv run python manage.py migrate --noinput --database=feeds_db
	uv run python manage.py migrate --noinput

# Freeze dependencies
freeze:
	uv pip freeze > requirements.txt

# Build Docker image
docker_build:
	docker build -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) -f docker/basic/Dockerfile .

# Create local data directory if it doesn't exist
data_dir:
	mkdir -p data

# Get the current user and group IDs
HOST_UID := $(shell id -u)
HOST_GID := $(shell id -g)

# Run Docker migrations as django user
docker_migrate:
	docker run -it --rm \
		--name pebbling-club-migrate \
		--user root \
		-v $(shell pwd)/data:/app/data:Z \
		-e DJANGO_ENV=dev \
		-e SQLITE_BASE_DIR=/app/data \
		-e DATA_BASE_DIR=/app/data \
		$(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) su -c "uv run python manage.py migrate --noinput" django

# Run Docker container
docker_run: data_dir docker_migrate
	docker run -it --rm \
		--name pebbling-club \
		--user root \
		-p 8000:8000 \
		-v $(shell pwd)/data:/app/data:Z \
		-e HOME=/tmp \
		-e DJANGO_ENV=dev \
		-e SQLITE_BASE_DIR=/app/data \
		-e DATA_BASE_DIR=/app/data \
		$(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) uv run honcho start -f Procfile

# View container logs
docker_logs:
	docker logs -f pebbling-club

# Stop the running container
docker_stop:
	docker stop pebbling-club

# Open a shell in the running container
docker_shell:
	docker exec -it pebbling-club /bin/bash

# Install Node.js dependencies
npm_install: package.json node_modules/.keep
	cd frontend && npm install

node_modules/.keep:
	mkdir -p node_modules && touch node_modules/.keep
