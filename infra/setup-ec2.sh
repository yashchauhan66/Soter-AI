#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Soter Guard — First-Time EC2 Setup
# ═══════════════════════════════════════════════════════════════════════════════
# Run this ONCE on your EC2 instance to prepare for CI/CD deployments.
#
# Usage:
#   1. SSH into EC2:
#      ssh -i <your-key>.pem ubuntu@<your-ec2-host>
#
#   2. Run this script:
#      bash <(curl -fsSL https://raw.githubusercontent.com/.../setup-ec2.sh)
#      OR copy-paste the commands below manually.
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Soter Guard — First-Time EC2 Setup${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# ─── 1. Install Docker ──────────────────────────────────────────────────────
echo -e "${YELLOW}[1/5] Installing Docker...${NC}"
if ! command -v docker &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker.io docker-compose-v2
    sudo usermod -aG docker ubuntu
    log "Docker installed. You may need to re-login for group changes."
else
    log "Docker already installed ($(docker --version))"
fi

# ─── 2. Clone repository ────────────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Cloning repository...${NC}"
REPO_DIR="/home/ubuntu/soter-guard"
if [ -d "$REPO_DIR" ]; then
    log "Repository already cloned at ${REPO_DIR}"
else
    git clone https://github.com/<your-org>/Ai-Security-Guard.git "$REPO_DIR"
    log "Repository cloned to ${REPO_DIR}"
fi

# ─── 3. Login to Docker Hub ─────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Docker Hub login...${NC}"
echo ""
echo -e "  ${YELLOW}Enter your Docker Hub credentials:${NC}"
echo -e "  (These are needed to push images during CI/CD)"
echo ""
read -rp "  Docker Hub username: " DH_USER
read -rsp "  Docker Hub password/token: " DH_PASS
echo ""
echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin && \
    log "Docker Hub logged in as ${DH_USER}" || \
    warn "Login failed. Run 'docker login' manually later."

# ─── 4. Create .env.production ──────────────────────────────────────────────
echo -e "${YELLOW}[4/5] Creating .env.production...${NC}"
if [ -f "$REPO_DIR/.env.production" ]; then
    log ".env.production already exists — keeping existing file"
else
    echo ""
    echo -e "  ${YELLOW}Create .env.production now. Required variables:${NC}"
    echo ""
    echo "  DATABASE_URL     PostgreSQL connection string"
    echo "  NEXTAUTH_SECRET  NextAuth signing secret (min 32 chars)"
    echo "  AUTH_SECRET      Auth secret (same as NEXTAUTH_SECRET)"
    echo "  NEXTAUTH_URL     Public URL (e.g. https://yourdomain.com)"
    echo "  AUTH_TRUST_HOST  Set to 'true'"
    echo "  NODE_ENV         Set to 'production'"
    echo "  REDIS_URL        redis://redis:6379"
    echo "  QDRANT_URL       http://qdrant:6333"
    echo "  VECTOR_PROVIDER  qdrant"
    echo ""
    echo -e "  ${YELLOW}Generating template with placeholder values...${NC}"
    echo -e "  ${YELLOW}Edit the file manually after setup.${NC}"
    cat > "$REPO_DIR/.env.production" << 'ENVEOF'
# ═══════════════════════════════════════════════════════════════
# Soter Guard — Production Environment
# ═══════════════════════════════════════════════════════════════
# Generate secrets: openssl rand -base64 32
# ═══════════════════════════════════════════════════════════════

# Database
DATABASE_URL="postgresql://user:password@host:5432/soter?schema=public"

# Auth
NEXTAUTH_SECRET="replace-with-32-char-random-secret"
AUTH_SECRET="replace-with-32-char-random-secret"
NEXTAUTH_URL="https://yourdomain.com"
AUTH_TRUST_HOST="true"

# App
NODE_ENV="production"

# Redis (Docker Compose internal)
REDIS_URL="redis://redis:6379"

# Vector store (Docker Compose internal)
QDRANT_URL="http://qdrant:6333"
VECTOR_PROVIDER="qdrant"
ENVEOF
    log "Template created at ${REPO_DIR}/.env.production"
    echo ""
    echo -e "  ${YELLOW}⚠️  IMPORTANT: Edit this file with your real values:${NC}"
    echo -e "     nano ${REPO_DIR}/.env.production"
    echo ""
fi

# ─── 5. Copy docker-compose.yml & infra files ────────────────────────────────
echo -e "${YELLOW}[5/5] Copying deployment files...${NC}"
cd "$REPO_DIR"
cp docker-compose.yml docker-compose.production.yml 2>/dev/null || true
log "Deployment files ready at ${REPO_DIR}"
log "  docker-compose.yml  — services config"
log "  infra/setup-ssl.sh  — nginx + SSL setup (run when you have a domain)"

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ EC2 Setup Complete!${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo ""
echo -e "  1. Edit your env vars:"
echo -e "     nano ${REPO_DIR}/.env.production"
echo ""
echo -e "  2. Push to main to trigger deployment:"
echo -e "     git push origin main"
echo ""
echo -e "  3. (Optional) Set up nginx + SSL with a domain:"
echo -e "     cd ${REPO_DIR} && sudo bash infra/setup-ssl.sh yourdomain.com"
echo ""
echo -e "  ${YELLOW}GitHub secrets you still need to set:${NC}"
echo -e "  • EC2_SSH_PRIVATE_KEY  — content of your EC2 PEM key file"
echo -e "  • EC2_HOST             — your EC2 public hostname"
echo -e "  • EC2_USER             — ubuntu"
echo -e "  • DOCKER_USERNAME      — your Docker Hub username"
echo -e "  • DOCKER_PASSWORD      — your Docker Hub password/token"
echo ""
