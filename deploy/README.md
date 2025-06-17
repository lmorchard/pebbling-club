# Simple Git Deployment

Quick setup for updating your existing Docker deployment via Git push.

## Option 1: Simple Update Script

If you just want to run updates manually or via SSH:

```bash
# Make executable
chmod +x deploy/update-script.sh

# Run to update
./deploy/update-script.sh

# Or run remotely
ssh user@server 'cd /path/to/repo && ./deploy/update-script.sh'
```

## Option 2: Git Hook

For automatic updates on push:

### Setup on Server

```bash
# In your existing repo
git config receive.denyCurrentBranch ignore

# Install hook
cp deploy/simple-post-receive .git/hooks/post-receive
chmod +x .git/hooks/post-receive

# Edit the WORK_TREE path in the hook
nano .git/hooks/post-receive
```

### Setup on Local Machine

```bash
# Add remote
git remote add production user@server:/path/to/repo

# Deploy
git push production main
```

## What It Does

1. Updates code (`git pull` or `git checkout`)
2. Rebuilds containers (`docker-compose build`)
3. Runs migrations (`manage.py migrate`)
4. Restarts services (`docker-compose up -d`)
5. Cleans up old images

## Files

- `simple-post-receive` - Minimal Git hook
- `update-script.sh` - Manual update script
- `simple-setup.md` - Detailed setup instructions