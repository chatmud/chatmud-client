# Build React client
FROM node:20-alpine AS client-build
WORKDIR /app

# Install dependencies (delete package-lock to work around npm optional deps bug)
COPY package*.json ./
RUN rm -f package-lock.json && npm install --quiet

# Copy source and build
COPY . .
ARG VITE_WS_URL=/ws
ARG VITE_COMMIT_HASH=unknown
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_COMMIT_HASH=$VITE_COMMIT_HASH
RUN npm run build

# Build WebSocket proxy
FROM node:20-alpine AS proxy-build
WORKDIR /app/proxy

# Install dependencies first for better caching
COPY proxy/package*.json ./
RUN npm ci --quiet --only=production

# Copy TypeScript source and build
COPY proxy/tsconfig.json ./
COPY proxy/src ./src
RUN npm install --quiet --save-dev typescript @types/node && \
    npm run build && \
    npm prune --production

# Backend service - WebSocket proxy only
FROM node:20-alpine AS backend
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy proxy with correct ownership
COPY --from=proxy-build --chown=nodejs:nodejs /app/proxy/dist ./dist
COPY --from=proxy-build --chown=nodejs:nodejs /app/proxy/node_modules ./node_modules
COPY --from=proxy-build --chown=nodejs:nodejs /app/proxy/package.json ./

# Switch to non-root user
USER nodejs

# Environment defaults
ENV NODE_ENV=production \
    PORT=3001 \
    UPSTREAM_URL=tls://chatmud.com:7443

EXPOSE 3001

# Health check for backend
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# Frontend service - nginx serving static files
FROM nginx:alpine AS frontend
WORKDIR /usr/share/nginx/html

# Copy built client files
COPY --from=client-build /app/dist ./

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

# Health check for frontend
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
