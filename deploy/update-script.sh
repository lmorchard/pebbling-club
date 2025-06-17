#!/bin/bash
# Simple update script you can run directly or via SSH

set -e

echo "=== Updating Pebbling Club ==="

# Pull latest changes
echo "Pulling latest code..."
git pull origin main

# Rebuild and restart containers
echo "Rebuilding containers..."
docker-compose -f docker/compose/docker-compose.yml build

echo "Running migrations..."
docker-compose -f docker/compose/docker-compose.yml exec -T web python manage.py migrate --noinput

echo "Restarting containers..."
docker-compose -f docker/compose/docker-compose.yml up -d

# Clean up
echo "Cleaning up old images..."
docker image prune -f

echo "=== Update complete! ==="