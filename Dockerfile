FROM node:20-alpine AS builder

WORKDIR /app

COPY LICENSE ./
COPY .npmrc package.json package-lock.json* ./
RUN npm ci --userconfig .npmrc

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=2604 \
    DATA_DIR=/app/data

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Data directory for persistent connection configs
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data


VOLUME ["/app/data"]

EXPOSE 2604

USER nextjs

CMD ["npm", "start"]
