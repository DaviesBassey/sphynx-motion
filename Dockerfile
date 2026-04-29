FROM node:20-alpine

WORKDIR /app

# Copy package manifests first for layer caching
COPY server/package.json server/package-lock.json* ./server/

# Install server dependencies (production only)
RUN cd server && npm ci --omit=dev

# Copy all project files (frontend + server)
COPY . .

# Remove dev/native artifacts not needed in production
RUN rm -rf ios android node_modules .git scripts

# Render injects PORT at runtime (default 10000). EXPOSE is documentation only.
EXPOSE 10000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-10000}/api/health" || exit 1

CMD ["node", "server/index.js"]
