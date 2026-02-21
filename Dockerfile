# Stage 1: Build client (Svelte/Vite → static assets)
FROM node:22-alpine AS client-build
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build
# Output lands in /build/proxy/public/ (vite outDir: ../proxy/public)

# Stage 2: Build proxy (TypeScript → JS)
FROM node:22-alpine AS proxy-build
WORKDIR /build/proxy
COPY proxy/package.json proxy/package-lock.json ./
RUN npm ci
COPY proxy/src/ ./src/
COPY proxy/tsconfig.json ./
RUN npm run build
RUN npm ci --omit=dev

# Stage 3: Runtime
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=proxy-build /build/proxy/dist/ ./dist/
COPY --from=proxy-build /build/proxy/node_modules/ ./node_modules/
COPY --from=proxy-build /build/proxy/package.json ./
COPY --from=client-build /build/proxy/public/ ./public/
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
