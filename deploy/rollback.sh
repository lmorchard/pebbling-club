#!/bin/bash
# Manual rollback script in case automatic rollback fails

set -e

DEPLOY_DIR="/opt/pebbling-club"
COMPOSE_FILE="docker/compose/docker-compose.yml"

echo "=== Manual Rollback Script ==="

cd "$DEPLOY_DIR"

# Show recent commits
echo "Recent commits:"
git log --oneline -10

echo ""
read -p "Enter commit hash to rollback to: " COMMIT_HASH

# Validate commit exists
if ! git rev-parse --quiet --verify "$COMMIT_HASH" > /dev/null; then
    echo "Error: Invalid commit hash"
    exit 1
fi

echo "Rolling back to commit: $(git log -1 --oneline $COMMIT_HASH)"
read -p "Are you sure? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Store current state
    CURRENT_COMMIT=$(git rev-parse HEAD)
    
    # Rollback code
    git reset --hard "$COMMIT_HASH"
    
    # Rebuild and restart containers
    docker-compose -f "$COMPOSE_FILE" build
    docker-compose -f "$COMPOSE_FILE" up -d --force-recreate
    
    # Run migrations (in case of database schema rollback)
    docker-compose -f "$COMPOSE_FILE" run --rm web python manage.py migrate --noinput
    
    echo "Rollback complete!"
    echo "Rolled back from $CURRENT_COMMIT to $COMMIT_HASH"
else
    echo "Rollback cancelled"
fi