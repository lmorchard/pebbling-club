#!/bin/bash
set -e

echo "=== PostgreSQL Volume to Host Directory Migration ==="
echo

# Check if services are running
if docker-compose -f docker/compose/docker-compose.yml ps | grep -q "postgres.*Up"; then
    echo "⚠️  PostgreSQL is running. Stopping services..."
    docker-compose -f docker/compose/docker-compose.yml down
fi

# Create backup directory
BACKUP_DIR="./postgres_data_backup_$(date +%Y%m%d_%H%M%S)"
echo "📁 Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Find the volume name (usually prefixed with the project name)
VOLUME_NAME=$(docker volume ls | grep postgres_data | awk '{print $2}' | head -1)
if [ -z "$VOLUME_NAME" ]; then
    echo "❌ No PostgreSQL volume found. Exiting."
    exit 1
fi
echo "📦 Found volume: $VOLUME_NAME"

# Copy data from volume to backup directory
echo "📋 Copying data from volume to backup directory..."
docker run --rm \
    -v "$VOLUME_NAME:/source:ro" \
    -v "$(pwd)/$BACKUP_DIR:/backup" \
    alpine \
    sh -c "cp -av /source/. /backup/"

# Create the new host directory
HOST_DIR="./postgres_data"
echo "📁 Creating host directory: $HOST_DIR"
mkdir -p "$HOST_DIR"

# Copy data to the new host directory
echo "📋 Copying data to host directory..."
cp -av "$BACKUP_DIR"/* "$HOST_DIR/"

# Set proper permissions (PostgreSQL runs as UID 70)
echo "🔧 Setting PostgreSQL permissions..."
docker run --rm \
    -v "$(pwd)/$HOST_DIR:/data" \
    alpine \
    chown -R 70:70 /data

echo
echo "✅ Migration complete!"
echo
echo "Next steps:"
echo "1. Update docker-compose.yml to use './postgres_data:/var/lib/postgresql/data'"
echo "2. Run 'docker-compose -f docker/compose/docker-compose.yml up -d'"
echo "3. Verify PostgreSQL is working correctly"
echo "4. Once verified, you can remove the old volume with:"
echo "   docker volume rm $VOLUME_NAME"
echo "5. Backup directory is at: $BACKUP_DIR (can be removed after verification)"