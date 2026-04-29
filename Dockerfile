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

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
