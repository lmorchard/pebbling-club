#!/bin/bash
# Hybrid local development startup script
# Run this from the project root: ./docker/*/dev-hybrid.sh

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get the project root directory (two levels up from this script)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Get the relative path from project root to script directory
RELATIVE_SCRIPT_DIR="${SCRIPT_DIR#$PROJECT_ROOT/}"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
    local exit_code=$?
    echo -e "\n${YELLOW}🛑 Caught interrupt signal. Cleaning up...${NC}"
    
    # Kill any background processes (honcho and its children)
    if [ -n "$HONCHO_PID" ]; then
        echo -e "${YELLOW}Stopping application processes...${NC}"
        kill -TERM $HONCHO_PID 2>/dev/null || true
        wait $HONCHO_PID 2>/dev/null || true
    fi
    
    # Kill docker logs process
    if [ -n "$DOCKER_LOGS_PID" ]; then
        echo -e "${YELLOW}Stopping Docker logs...${NC}"
        kill -TERM $DOCKER_LOGS_PID 2>/dev/null || true
        wait $DOCKER_LOGS_PID 2>/dev/null || true
    fi
    
    # Stop the docker containers
    echo -e "${YELLOW}Stopping Docker containers...${NC}"
    docker-compose -f "$RELATIVE_SCRIPT_DIR/docker-compose.yml" down
    
    echo -e "${GREEN}✅ Cleanup complete. Goodbye!${NC}"
    exit $exit_code
}

# Set up trap to catch Ctrl+C (SIGINT) and other termination signals
trap cleanup SIGINT SIGTERM EXIT

echo -e "${GREEN}🔧 Starting Hybrid Local Development Setup${NC}"
echo -e "${YELLOW}📁 Working from: $PROJECT_ROOT${NC}"

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if required tools are installed
command -v uv >/dev/null 2>&1 || { echo -e "${RED}❌ uv is not installed. See: https://docs.astral.sh/uv/getting-started/installation/${NC}"; exit 1; }
command -v honcho >/dev/null 2>&1 || { echo -e "${RED}❌ honcho is not installed. Run: uv pip install honcho${NC}"; exit 1; }

# Ensure dependencies are synced (including psycopg2-binary)
echo -e "${YELLOW}📦 Syncing Python dependencies with uv...${NC}"
uv sync

echo -e "${YELLOW}📦 Starting infrastructure services (PostgreSQL + Redis + Nginx)...${NC}"
docker-compose -f "$RELATIVE_SCRIPT_DIR/docker-compose.yml" build
docker-compose -f "$RELATIVE_SCRIPT_DIR/docker-compose.yml" up -d

echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"

# Wait for PostgreSQL
echo -n "Waiting for PostgreSQL"
until docker-compose -f "$RELATIVE_SCRIPT_DIR/docker-compose.yml" exec -T postgres pg_isready -U pebbling -d pebbling_club > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Wait for Redis
echo -n "Waiting for Redis"
until docker-compose -f "$RELATIVE_SCRIPT_DIR/docker-compose.yml" exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

echo -e "${YELLOW}🔄 Running database migrations...${NC}"
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  No .env file found. Using default settings.${NC}"
fi

uv run manage.py migrate

echo -e "${YELLOW}📁 Collecting static files for nginx...${NC}"
uv run manage.py collectstatic --noinput

echo -e "${GREEN}🚀 Starting application services...${NC}"
echo -e "${YELLOW}🌐 Main application: http://localhost:8000 (via nginx proxy)${NC}"
echo -e "${YELLOW}📊 Flower monitoring: http://localhost:8000/flower/ (via nginx proxy)${NC}"
echo -e "${YELLOW}🔧 Direct Django (dev): http://localhost:${PORT:-8010}${NC}"
echo -e "${YELLOW}🔧 Direct Flower (dev): http://localhost:8012/flower/${NC}"
echo -e "${YELLOW}To stop everything: Press Ctrl+C (Docker containers will stop automatically)${NC}"

# Start Docker logs streaming in background
echo -e "${YELLOW}🐳 Starting Docker logs streaming...${NC}"
docker-compose -f "$RELATIVE_SCRIPT_DIR/docker-compose.yml" logs -f --tail=10 &
DOCKER_LOGS_PID=$!

# Give Docker logs a moment to start
sleep 2

# Start the application services
honcho start -f "$RELATIVE_SCRIPT_DIR/Procfile-hybrid" &
HONCHO_PID=$!

# Wait for honcho to finish
wait $HONCHO_PID