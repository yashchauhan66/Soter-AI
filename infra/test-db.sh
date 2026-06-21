#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Soter Guard — Test Database Connection
# ═══════════════════════════════════════════════════════════════════════════════
# Run this on EC2 to verify the database is reachable.
#
# Usage:
#   ssh -i <your-key>.pem ubuntu@<your-ec2-host>
#   bash ~/soter-guard/infra/test-db.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# ─── 1. Check .env.production exists ────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env.production"
if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="$HOME/soter-guard/.env.production"
fi

if [ ! -f "$ENV_FILE" ]; then
    err ".env.production not found! Run this from the repo directory."
    exit 1
fi

echo ""
echo "📋 Testing database connection..."

# ─── 2. Extract DATABASE_URL ────────────────────────────────────────────────
DATABASE_URL=$(grep -oP 'DATABASE_URL="\K[^"]+' "$ENV_FILE" 2>/dev/null || \
               grep -oP "DATABASE_URL='\K[^']+" "$ENV_FILE" 2>/dev/null || true)

if [ -z "$DATABASE_URL" ]; then
    err "DATABASE_URL not found in .env.production!"
    exit 1
fi

# Mask password for display
MASKED_URL=$(echo "$DATABASE_URL" | sed -E 's/://([^@]+)@/:****@/')
echo "   URL: $MASKED_URL"

# ─── 3. Test with psql (preferred) ──────────────────────────────────────────
if command -v psql &>/dev/null; then
    echo ""
    echo "🧪 Testing via psql..."
    if echo "SELECT 1 AS ok;" | psql "$DATABASE_URL" -t -A 2>/dev/null | grep -q "1"; then
        log "psql connection successful!"
    else
        warn "psql test failed — trying Node.js..."
    fi
fi

# ─── 4. Test with Node.js / prisma ──────────────────────────────────────────
if command -v node &>/dev/null; then
    echo ""
    echo "🧪 Testing via Node.js + Prisma..."
    cd "$(dirname "$ENV_FILE")"
    
    # Try prisma db execute first
    if npx prisma db execute --url="$DATABASE_URL" --stdin <<< "SELECT 1 AS ok" 2>/dev/null; then
        log "Prisma connection successful!"
    else
        # Try direct pg connection via node
        echo "   Trying direct PostgreSQL connection..."
        node -e "
        const { Client } = require('pg');
        const client = new Client({ connectionString: '$DATABASE_URL' });
        client.connect()
          .then(() => client.query('SELECT 1 AS ok'))
          .then((r) => { console.log('✅ DB OK:', JSON.stringify(r.rows[0])); return client.end(); })
          .catch((e) => { console.error('❌ DB FAIL:', e.message); process.exit(1); });
        " 2>&1
    fi
fi

# ─── 5. Check via Docker container (if app is running) ──────────────────────
echo ""
echo "🧪 Testing via running container (if deployed)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log "App health check passed (HTTP 200) — database is reachable!"
    echo ""
    curl -s http://127.0.0.1:3000/api/health | python3 -m json.tool 2>/dev/null || curl -s http://127.0.0.1:3000/api/health
elif [ "$HTTP_CODE" = "503" ]; then
    warn "App health check returned 503 — database is NOT reachable!"
elif [ "$HTTP_CODE" = "000" ]; then
    warn "App not running yet (skip)"
fi

echo ""
echo "✅ Database test complete!"
