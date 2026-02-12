# Build React client
FROM node:20-alpine AS client-build
WORKDIR /app

# Install dependencies (delete package-lock to work around npm optional deps bug)
COPY package*.json ./
RUN rm -f package-lock.json && npm install --quiet

# Copy source and build
COPY . .
ARG VITE_WS_URL=/ws
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# Build proxy server
FROM node:20-alpine AS server-build
WORKDIR /app/server

# Install dependencies first for better caching
COPY server/package*.json ./
RUN npm ci --quiet --only=production

# Copy TypeScript source and build
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm install --quiet --save-dev typescript @types/node && \
    npm run build && \
    npm prune --production

# Production - serves BOTH client and proxy
FROM node:20-alpine AS production
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy server with correct ownership
COPY --from=server-build --chown=nodejs:nodejs /app/server/dist ./dist
COPY --from=server-build --chown=nodejs:nodejs /app/server/node_modules ./node_modules
COPY --from=server-build --chown=nodejs:nodejs /app/server/package.json ./

# Copy React client build to be served as static files
COPY --from=client-build --chown=nodejs:nodejs /app/dist ./public

# Switch to non-root user
USER nodejs

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    UPSTREAM_URL=tls://chatmud.com:7443

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
