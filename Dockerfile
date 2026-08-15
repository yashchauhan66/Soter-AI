# ═══════════════════════════════════════════════════════════════════════════════
# Soter Guard — Dockerfile (Standalone Output)
# ═══════════════════════════════════════════════════════════════════════════════
# Build: docker build -t soter:latest --secret id=npmrc,src=$HOME/.npmrc .
# Run:   docker run -p 3000:3000 --env-file .env.production soter:latest
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Stage 1: Dependencies ──────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (devDeps needed for build)
RUN npm ci --ignore-scripts

# ─── Stage 2: Builder ───────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules

COPY . .

# Ensure public/ exists so the runner-stage COPY always has a source
# (this repo ships no static assets, so the dir may be absent)
RUN mkdir -p public

# Generate Prisma client (needed at build time for type generation)
RUN npx prisma generate

# Build local workspace packages first (e.g. @soterai/core SDK)
# so that TypeScript can resolve their types during the Next.js build
RUN npm run build:sdk:js
RUN npm run build:guard-core

# Build Next.js (standalone output mode)
RUN npm run build

# ─── Stage 3: Runner ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# libc6-compat is REQUIRED at runtime, not just at build time: onnxruntime-node
# ships a glibc-linked libonnxruntime.so.1, and Alpine is musl. Without this the
# ML tier throws on load and the guard silently falls back to rules-only.
RUN apk add --no-cache libc6-compat openssl ca-certificates && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (minimal production files)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + migrations for runtime
COPY --from=builder /app/prisma ./prisma

# Copy ML models for ONNX runtime inference (90MB+ LFS files)
COPY --from=builder /app/models ./models

# Copy security artifacts (model trust store, capability registry)
COPY --from=builder /app/artifacts/security ./artifacts/security

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
