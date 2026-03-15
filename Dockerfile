# Open Redis Web UI — multi-stage production image
# Stage 1: build the Vite frontend
# Stage 2: lean runtime image — Express serves the built assets

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json .npmrc ./
RUN npm install --userconfig .npmrc

COPY src/ ./src/
COPY public/ ./public/
COPY index.html vite.config.js ./

RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package.json .npmrc ./
RUN npm install --omit=dev --userconfig .npmrc

# Copy built frontend and backend
COPY --from=builder /app/dist ./dist
COPY server/ ./server/

# Persistent data directory
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV DATA_DIR=/app/data \
    PORT=9988 \
    NODE_ENV=production

# Express serves both the API and the built frontend on a single port
EXPOSE 9988

CMD ["node", "server/index.js"]
