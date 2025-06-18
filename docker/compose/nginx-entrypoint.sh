#!/bin/sh
set -e

echo "Starting nginx with authentication setup..."

# Generate htpasswd for Flower UI access
if [ -n "$FLOWER_PASSWORD" ]; then
    htpasswd -cb /etc/nginx/.htpasswd_flower admin "$FLOWER_PASSWORD"
    echo "✓ Generated Flower authentication for user 'admin'"
else
    echo "⚠️  FLOWER_PASSWORD not set - Flower UI will be inaccessible"
fi

# Generate htpasswd for metrics access
if [ -n "$METRICS_PASSWORD" ]; then
    htpasswd -cb /etc/nginx/.htpasswd_metrics prometheus "$METRICS_PASSWORD"
    echo "✓ Generated metrics authentication for user 'prometheus'"
else
    echo "⚠️  METRICS_PASSWORD not set - metrics endpoints will be inaccessible"
fi

echo "Starting nginx..."

# Start nginx
exec nginx -g "daemon off;"