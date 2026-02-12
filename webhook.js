#!/usr/bin/env node

const http = require('http');
const { execSync } = require('child_process');

const PORT = process.env.WEBHOOK_PORT || 9877;
const SECRET = process.env.WEBHOOK_SECRET;
const IMAGE = process.env.IMAGE_NAME || 'ghcr.io/chatmud/react-client:latest';

if (!SECRET) {
  console.error('ERROR: WEBHOOK_SECRET required');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/') {
    const auth = req.headers.authorization;

    if (auth !== `Bearer ${SECRET}`) {
      console.log('Unauthorized request');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    console.log('Deployment triggered');
    res.writeHead(200);
    res.end('Deploying');

    setTimeout(() => {
      try {
        console.log('Pulling latest image...');
        execSync(`docker pull ${IMAGE}`, { stdio: 'inherit' });

        console.log('Restarting container...');
        execSync('docker-compose up -d', { stdio: 'inherit' });

        console.log('Deployment complete');
      } catch (error) {
        console.error('Deployment failed:', error.message);
      }
    }, 100);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Webhook listening on port ${PORT}`);
  console.log(`Image: ${IMAGE}`);
});
