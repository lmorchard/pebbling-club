# Docker image configuration
DOCKER_IMAGE_NAME ?= pebbling-club
DOCKER_IMAGE_TAG ?= latest
DEPLOY_REMOTE ?= castiel
DEPLOY_BRANCH ?= releases/castiel

.PHONY: help 

# Help target
help:
	@echo "Pebbling Club Makefile Help"
	@echo "==========================="
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev               - Development server with hot reload"
	@echo "  make install           - Install dependencies"
	@echo "  make serve             - Run development server"
	@echo "  make worker            - Run celery worker"
	@echo "  make celery-purge      - Clear all Celery queues"
	@echo "  make shell             - Open Python shell"
	@echo "  make test              - Run tests"
	@echo "  make migrate           - Run database migrations (single DB)"
	@echo "  make migrate_multi     - Run database migrations (multiple SQLite DBs)"
	@echo "  make metrics-test      - Test metrics collection"
	@echo "  make metrics-show      - Show current metrics"
	@echo "  make metrics-endpoint  - Show metrics endpoint URL"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker_build      - Build Docker image"
	@echo "  make docker_run        - Run Docker container"
	@echo ""
	@echo "Docker Compose Commands:"
	@echo "  make docker_compose_build    - Build Docker Compose services"
	@echo "  make docker_compose_up       - Start Docker Compose services"
	@echo "  make docker_compose_down     - Stop Docker Compose services"
	@echo "  make docker_compose_logs     - View Docker Compose logs"
	@echo "  make docker_compose_migrate  - Run migrations in Docker Compose"
	@echo "  make docker_compose_shell    - Open a shell in the web container"

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
dev-honcho: migrate
	uv run honcho start -f Procfile-dev

dev:
	./docker/local-dev/dev-hybrid.sh

# Run development server
serve:
	uv run python manage.py runserver

# Run celery worker
worker:
	uv run celery -A pebbling worker --loglevel=info

# Clear celery queue
celery-purge:
	uv run celery -A pebbling purge -f

# Open Python shell
shell:
	uv run python manage.py shell

# Run tests
test:
	DJANGO_SQLITE_MULTIPLE_DB=false uv run python manage.py test

# Run all tests with multi-database mode enabled
test-multidb:
	DJANGO_SQLITE_MULTIPLE_DB=true uv run python manage.py test

# Metrics commands
metrics-test:
	uv run python manage.py test_metrics

metrics-show:
	uv run python manage.py test_metrics --show-metrics

metrics-endpoint:
	@echo "Metrics endpoint: http://localhost:8000/metrics/"
	@echo "Make sure the development server is running first!"

# Format code
format:
	uv run python -m black .
	uv run djlint pebbling pebbling_apps --reformat

# Lint code
lint:
	uv run python -m black . --check
	uv run djlint pebbling pebbling_apps
	uv run mypy pebbling pebbling_apps --ignore-missing-imports

# Check code quality and run tests
check: lint test

# Run database migrations (single database mode)
migrate:
	mkdir -p data
	uv run python manage.py migrate

# Run database migrations (multiple SQLite databases mode)
migrate_multi:
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

deploy:
	git push -f ${DEPLOY_REMOTE} HEAD:${DEPLOY_BRANCH}

# Build Docker image
docker_build:
	docker build -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) -f docker/single/Dockerfile .

# Create local data directory if it doesn't exist
data_dir:
	mkdir -p data

# Run Docker migrations as django user
docker_migrate:
	docker run -it --rm \
		--name pebbling-club-migrate \
		--user root \
		-v $(shell pwd)/data:/app/data:Z \
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

# Docker Compose targets

# Build Docker Compose services
docker_compose_build:
	docker-compose -f docker/compose/docker-compose.yml build django-builder nginx

# Start Docker Compose services
docker_compose_up:
	docker-compose -f docker/compose/docker-compose.yml up -d

# Stop Docker Compose services
docker_compose_down:
	docker-compose -f docker/compose/docker-compose.yml down

# View Docker Compose logs
docker_compose_logs:
	docker-compose -f docker/compose/docker-compose.yml logs -n 25 -f

# Run migrations in Docker Compose
docker_compose_migrate:
	docker-compose -f docker/compose/docker-compose.yml exec web python manage.py migrate

# Open a shell in the web container
docker_compose_shell:
	docker-compose -f docker/compose/docker-compose.yml exec web bash

# Run a Django management command in Docker Compose
docker_compose_django_command:
	docker-compose -f docker/compose/docker-compose.yml exec web python manage.py $(cmd)

# Migrate PostgreSQL data from Docker volume to host directory
docker_compose_migrate_postgres_volume:
	./docker/compose/migrate-postgres-volume.sh
