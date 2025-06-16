#!/bin/bash
# Setup script for Git deployment on the Linux host
# Run this script on your deployment server

set -e

# Configuration - modify these as needed
DEPLOY_USER="deploy"
DEPLOY_DIR="/opt/pebbling-club"
GIT_DIR="/opt/pebbling-club.git"
BRANCH="main"

echo "=== Setting up Git deployment for Pebbling Club ==="

# Create deploy user if it doesn't exist
if ! id "$DEPLOY_USER" &>/dev/null; then
    echo "Creating deploy user..."
    sudo useradd -m -s /bin/bash "$DEPLOY_USER"
    sudo usermod -aG docker "$DEPLOY_USER"
fi

# Create directories
echo "Creating directories..."
sudo mkdir -p "$DEPLOY_DIR" "$GIT_DIR"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR" "$GIT_DIR"

# Initialize bare Git repository
echo "Initializing Git repository..."
sudo -u "$DEPLOY_USER" git init --bare "$GIT_DIR"

# Set up the deployment directory
echo "Setting up deployment directory..."
sudo -u "$DEPLOY_USER" git clone "$GIT_DIR" "$DEPLOY_DIR"

# Install post-receive hook
echo "Installing post-receive hook..."
HOOK_FILE="$GIT_DIR/hooks/post-receive"
sudo cp post-receive "$HOOK_FILE"
sudo chmod +x "$HOOK_FILE"
sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$HOOK_FILE"

# Update hook configuration
sudo sed -i "s|DEPLOY_DIR=.*|DEPLOY_DIR=\"$DEPLOY_DIR\"|" "$HOOK_FILE"
sudo sed -i "s|BRANCH=.*|BRANCH=\"$BRANCH\"|" "$HOOK_FILE"

# Create log file
echo "Creating log file..."
sudo touch /var/log/pebbling-club-deploy.log
sudo chown "$DEPLOY_USER:$DEPLOY_USER" /var/log/pebbling-club-deploy.log

# Set up logrotate
echo "Setting up log rotation..."
cat << EOF | sudo tee /etc/logrotate.d/pebbling-club
/var/log/pebbling-club-deploy.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $DEPLOY_USER $DEPLOY_USER
}
EOF

# Create environment file template
echo "Creating environment file template..."
cat << 'EOF' | sudo -u "$DEPLOY_USER" tee "$DEPLOY_DIR/.env.production"
# Production environment variables
DEBUG=False
SECRET_KEY=your-production-secret-key-here
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgres://pebbling:password@postgres:5432/pebbling
CELERY_BROKER_URL=redis://redis:6379/0
REDIS_URL=redis://redis:6379/1
DJANGO_SQLITE_MULTIPLE_DB=false
LOG_LEVEL=INFO
EOF

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Add your SSH key to the deploy user:"
echo "   ssh-copy-id $DEPLOY_USER@$(hostname)"
echo ""
echo "2. Add this remote to your local repository:"
echo "   git remote add production $DEPLOY_USER@$(hostname):$GIT_DIR"
echo ""
echo "3. Configure the environment variables in:"
echo "   $DEPLOY_DIR/.env.production"
echo ""
echo "4. Push to deploy:"
echo "   git push production main"
echo ""
echo "5. For the first deployment, you may need to manually run:"
echo "   cd $DEPLOY_DIR"
echo "   docker-compose -f docker/compose/docker-compose.yml up -d"