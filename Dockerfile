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

# Build Next.js (standalone output mode)
RUN npm run build

# ─── Stage 3: Runner ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl ca-certificates && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (minimal production files)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + migrations for runtime
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
