#!/bin/bash
# Health check script to verify deployment status

COMPOSE_FILE="docker/compose/docker-compose.yml"
DEPLOY_DIR="/opt/pebbling-club"

cd "$DEPLOY_DIR"

echo "=== Deployment Health Check ==="
echo "Time: $(date)"
echo ""

# Check Docker Compose services
echo "Docker Compose Status:"
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "Container Health:"
docker-compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# Check web service
echo ""
echo "Web Service Check:"
if curl -f -s -o /dev/null http://localhost:8000/health/; then
    echo "✅ Web service is responding"
else
    echo "❌ Web service is not responding"
fi

# Check database connection
echo ""
echo "Database Check:"
docker-compose -f "$COMPOSE_FILE" exec -T web python -c "
from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
    print('✅ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
"

# Check Redis
echo ""
echo "Redis Check:"
docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping || echo "❌ Redis not responding"

# Check disk space
echo ""
echo "Disk Space:"
df -h "$DEPLOY_DIR"

# Check recent logs
echo ""
echo "Recent Deploy Logs:"
tail -n 20 /var/log/pebbling-club-deploy.log