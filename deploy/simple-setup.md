# Simple Git Deployment Setup

Since you already have your server and containers running, here's a minimal setup:

## 1. On Your Server

In your existing repo directory:

```bash
# Convert to bare repo to accept pushes
cd /path/to/your/pebbling-club
git config receive.denyCurrentBranch ignore

# Or if you prefer, set up a separate bare repo:
cd /path/to/
git clone --bare /path/to/your/pebbling-club pebbling-club.git
cd pebbling-club.git/hooks
```

## 2. Install the Hook

Copy the simple hook:
```bash
cp /path/to/deploy/simple-post-receive hooks/post-receive
chmod +x hooks/post-receive

# Edit the WORK_TREE path
nano hooks/post-receive
# Change WORK_TREE="/path/to/your/pebbling-club" to your actual path
```

## 3. On Your Local Machine

Add the remote:
```bash
# If using the same repo with receive.denyCurrentBranch ignore:
git remote add production user@server:/path/to/your/pebbling-club

# If using a separate bare repo:
git remote add production user@server:/path/to/pebbling-club.git
```

## 4. Deploy

```bash
git push production main
```

That's it! The hook will:
1. Update the code
2. Rebuild containers
3. Run migrations
4. Restart services