# Auto-Deployment with Webhooks

## Server Setup

### 1. Login to GitHub Container Registry

```bash
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Create token: https://github.com/settings/tokens (needs `read:packages`)

### 2. Start webhook listener

```bash
export WEBHOOK_SECRET="random-secret-string"
export WEBHOOK_PORT=9877
node webhook.js &
```

Or with PM2:
```bash
pm2 start webhook.js --name webhook
pm2 save
```

### 3. User-Configurable Session Settings

The WebSocket proxy supports per-user session persistence and buffering. Users can configure these settings through the web UI (not environment variables).

**Settings:**
- **Persistence Timeout**: 0 (disconnect immediately) to 43,200,000ms (12 hours), default 300,000ms (5 min)
- **Max Buffer Lines**: 10 to 10,000 lines, default 1,000 lines
- **Buffer Size**: Hard-limited to 10MB (not configurable)

**Initial Connection:**
Pass settings as URL parameters when connecting to WebSocket:
```javascript
const ws = new WebSocket(`ws://host/ws?persistenceTimeout=600000&maxBufferLines=500`);
```

**Update While Connected:**
Send a config update message:
```javascript
const message = {
  type: "updateConfig",
  persistenceTimeout: 600000,  // 10 minutes
  maxBufferLines: 500
};
const payload = new Uint8Array([0x00, ...new TextEncoder().encode(JSON.stringify(message))]);
ws.send(payload);
```

The server will validate and apply the new settings, then send a confirmation with `type: "configUpdated"`.

### 4. Start the app

```bash
docker-compose up -d
```

## GitHub Setup

Add repository secrets (Settings > Secrets and variables > Actions):

- `WEBHOOK_URL`: `http://your-server.com:9877`
- `WEBHOOK_SECRET`: `same-random-secret-string`

## How it works

1. Push to master
2. GitHub builds Docker image and pushes to ghcr.io
3. GitHub triggers webhook to your server
4. Server pulls new image and restarts container

## Manual commands

```bash
# View logs
docker-compose logs -f

# Manual update
docker-compose pull && docker-compose up -d

# Trigger webhook manually
curl -X POST http://your-server.com:9877 \
  -H "Authorization: Bearer YOUR_SECRET"
```
