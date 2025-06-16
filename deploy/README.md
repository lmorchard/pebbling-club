# Git Deployment Setup

This directory contains scripts for setting up automatic Docker deployment via Git push.

## Overview

When you push to the production Git repository, a post-receive hook automatically:
1. Updates the code
2. Rebuilds Docker containers if needed
3. Runs database migrations
4. Restarts services with zero downtime
5. Rolls back automatically if deployment fails

## Setup Instructions

### 1. On Your Production Server

1. Copy the `deploy/` directory to your server
2. Run the setup script as root:
   ```bash
   cd deploy/
   sudo ./setup-deploy.sh
   ```

3. Configure environment variables:
   ```bash
   sudo nano /opt/pebbling-club/.env.production
   ```

4. Add your SSH key to the deploy user:
   ```bash
   ssh-copy-id deploy@your-server.com
   ```

### 2. On Your Local Machine

1. Add the production remote:
   ```bash
   git remote add production deploy@your-server.com:/opt/pebbling-club.git
   ```

2. Deploy by pushing:
   ```bash
   git push production main
   ```

## Files

- `post-receive` - Git hook that runs on push
- `setup-deploy.sh` - Initial server setup script
- `deploy-health-check.sh` - Check deployment status
- `rollback.sh` - Manual rollback script
- `production-docker-compose.override.yml` - Production Docker overrides

## Deployment Flow

1. **Push Detection**: Git receives your push
2. **Code Update**: Fetches and checks out new code
3. **Dependency Check**: Rebuilds if requirements changed
4. **Build**: Builds Docker images
5. **Migration**: Runs database migrations
6. **Static Files**: Collects static assets
7. **Restart**: Restarts containers gracefully
8. **Health Check**: Verifies services are running
9. **Cleanup**: Removes old Docker images

## Monitoring

- Deployment logs: `/var/log/pebbling-club-deploy.log`
- Health check: `./deploy-health-check.sh`
- Docker logs: `docker-compose logs -f`

## Rollback

### Automatic Rollback
The deployment automatically rolls back if:
- Services fail to start
- Health checks fail

### Manual Rollback
```bash
cd /opt/pebbling-club
./deploy/rollback.sh
```

## Security Considerations

1. **SSH Keys**: Use SSH keys, not passwords
2. **Firewall**: Only expose necessary ports (80, 443)
3. **Secrets**: Never commit secrets, use environment variables
4. **Permissions**: Deploy user has minimal necessary permissions

## Customization

### Different Branch
Edit `BRANCH` in `post-receive` hook

### Notifications
Uncomment and configure the `notify()` function in `post-receive`

### Health Checks
Add custom health checks to `deploy-health-check.sh`

### SSL/TLS
1. Add certificates to `/opt/pebbling-club/ssl/`
2. Update nginx configuration for HTTPS

## Troubleshooting

### Deployment Fails
1. Check logs: `tail -f /var/log/pebbling-club-deploy.log`
2. Run health check: `./deploy-health-check.sh`
3. Check Docker: `docker-compose ps`

### Permission Issues
```bash
sudo chown -R deploy:deploy /opt/pebbling-club
sudo usermod -aG docker deploy
```

### Container Issues
```bash
cd /opt/pebbling-club
docker-compose down
docker-compose up -d
```

## Best Practices

1. **Test Locally**: Always test with `docker-compose` locally first
2. **Database Backups**: Set up regular PostgreSQL backups
3. **Monitoring**: Use tools like Prometheus, Grafana, or Datadog
4. **Staging**: Consider a staging environment for testing
5. **Secrets**: Use a secrets manager in production