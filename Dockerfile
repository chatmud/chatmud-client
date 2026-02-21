# Stage 1: Build proxy (TypeScript → JS)
FROM node:22-alpine AS proxy-build
WORKDIR /build/proxy
COPY proxy/package.json proxy/package-lock.json ./
RUN npm ci
COPY proxy/src/ ./src/
COPY proxy/tsconfig.json ./
RUN npm run build
RUN npm ci --omit=dev

# Stage 2: Runtime
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=proxy-build /build/proxy/dist/ ./dist/
COPY --from=proxy-build /build/proxy/node_modules/ ./node_modules/
COPY --from=proxy-build /build/proxy/package.json ./
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
