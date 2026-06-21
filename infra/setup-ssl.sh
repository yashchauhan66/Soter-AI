#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Soter Guard — Nginx + SSL Setup for EC2
# ═══════════════════════════════════════════════════════════════════════════════
# Run this ONCE on a fresh EC2 instance to set up nginx reverse proxy with
# Let's Encrypt SSL certificates.
#
# Usage:
#   chmod +x setup-ssl.sh
#   sudo ./setup-ssl.sh yourdomain.com
#
# Requirements:
#   - Ubuntu 22.04+ / Debian 12+
#   - Docker already installed
#   - App already running on port 3000 (via docker compose)
#   - Domain's A/AAAA record pointing to this server's IP
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Color helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

# ─── Validate domain argument ───────────────────────────────────────────────
DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
    echo ""
    err "Usage: sudo ./setup-ssl.sh yourdomain.com"
    echo ""
    echo "  Make sure your domain's DNS A/AAAA record points to this server's IP"
    echo "  before running this script."
    echo ""
    exit 1
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Soter Guard — Nginx + SSL Setup${NC}"
echo -e "${CYAN}  Domain: ${DOMAIN}${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# ─── Step 1: Install nginx ──────────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Installing nginx...${NC}"
if ! command -v nginx &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq nginx
    log "nginx installed ($(nginx -v 2>&1))"
else
    log "nginx already installed ($(nginx -v 2>&1))"
fi

# ─── Step 2: Install certbot ────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Installing certbot (Let's Encrypt)...${NC}"
if ! command -v certbot &>/dev/null; then
    sudo apt-get install -y -qq certbot python3-certbot-nginx
    log "certbot installed ($(certbot --version 2>&1))"
else
    log "certbot already installed ($(certbot --version 2>&1))"
fi

# ─── Step 3: Create ACME challenge directory ────────────────────────────────
echo -e "${YELLOW}[3/6] Setting up ACME challenge directory...${NC}"
sudo mkdir -p /var/www/certbot
log "ACME directory ready at /var/www/certbot"

# ─── Step 4: Deploy nginx config ────────────────────────────────────────────
echo -e "${YELLOW}[4/6] Deploying nginx config for ${DOMAIN}...${NC}"

# Copy the nginx config from the repo (or create a fresh one)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_CONF_SRC="${SCRIPT_DIR}/nginx/soter-guard.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/soter-guard.conf"

if [ -f "$NGINX_CONF_SRC" ]; then
    # Replace placeholder domain with the actual domain
    sudo cp "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"
    sudo sed -i "s/example\.com/${DOMAIN}/g" "$NGINX_CONF_DEST"
    log "Copied nginx config from repo"
else
    warn "nginx config not found at ${NGINX_CONF_SRC}"
    warn "Creating a default config with domain ${DOMAIN}..."
    # The setup script can still work even without the repo config
    # by downloading it or creating it inline. We'll create a basic one.
    sudo tee "$NGINX_CONF_DEST" > /dev/null << NGINXCONF
upstream soter-app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 100m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       10m;
    ssl_session_tickets       off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 100m;

    location / {
        proxy_pass http://soter-app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout    60s;
        proxy_send_timeout    60s;
        proxy_connect_timeout 10s;
    }
}
NGINXCONF
    log "Created nginx config inline"
fi

# Enable the site (disable default if it exists)
sudo ln -sf "$NGINX_CONF_DEST" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config (allow failure if certs don't exist yet)
if sudo nginx -t 2>/dev/null; then
    log "nginx config test PASSED"
else
    warn "nginx config test FAILED (expected if SSL certs aren't installed yet)"
    warn "Proceeding with certbot to generate certificates..."
fi

sudo systemctl enable nginx
sudo systemctl restart nginx
log "nginx started on port 80"

# ─── Step 5: Get SSL certificate via Certbot ────────────────────────────────
echo -e "${YELLOW}[5/6] Requesting SSL certificate from Let's Encrypt...${NC}"

# Stop Docker app briefly so port 80 is free for certbot's standalone challenge
# (Optional: certbot nginx plugin handles this automatically, but we use
#  the nginx plugin which is cleaner — it modifies the nginx config)
sudo certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "admin@${DOMAIN}" \
    --domains "${DOMAIN}" \
    --domains "www.${DOMAIN}" \
    --redirect \
    --hsts \
    --staple-ocsp \
    --must-staple \
    2>&1 || {
        warn "certbot failed with nginx plugin. Trying standalone mode..."
        sudo systemctl stop nginx
        sudo certbot certonly --standalone \
            --non-interactive \
            --agree-tos \
            --email "admin@${DOMAIN}" \
            --domains "${DOMAIN}" \
            --domains "www.${DOMAIN}" \
            2>&1 || {
                err "certbot failed! Check that DNS points to this server."
                err "Run manually: sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
                sudo systemctl restart nginx
                exit 1
            }
        sudo systemctl restart nginx
    }

log "SSL certificate obtained for ${DOMAIN} and www.${DOMAIN}"

# ─── Step 6: Setup auto-renewal ─────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Setting up SSL certificate auto-renewal...${NC}"

# certbot installs a systemd timer automatically, but let's verify
if systemctl list-timers --all 2>/dev/null | grep -q certbot; then
    log "certbot auto-renewal timer is active"
else
    warn "certbot timer not found. Setting up cron job..."
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
    log "cron job added for certbot renewal at 3 AM daily"
fi

# Test renewal process (dry-run)
sudo certbot renew --dry-run 2>&1 | tail -5
log "certbot renewal dry-run PASSED"

# ─── Final nginx reload ─────────────────────────────────────────────────────
echo ""
log "Reloading nginx with full SSL config..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ SSL Setup Complete!${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}https://${DOMAIN}${NC}  →  nginx  →  localhost:3000 (Docker)"
echo ""
echo -e "  ${YELLOW}What was done:${NC}"
echo -e "  • nginx installed & configured as reverse proxy"
echo -e "  • Let's Encrypt SSL certificate obtained for ${DOMAIN}"
echo -e "  • HTTP → HTTPS redirect active"
echo -e "  • HSTS enabled (max-age=31536000)"
echo -e "  • Auto-renewal scheduled (systemd timer)"
echo ""
echo -e "  ${YELLOW}Management commands:${NC}"
echo -e "  sudo nginx -t              # Test config"
echo -e "  sudo systemctl reload nginx # Apply changes"
echo -e "  sudo certbot renew --dry-run # Test renewal"
echo -e "  sudo certbot certificates   # List certs"
echo ""
echo -e "  ${YELLOW}⚠️  Next Steps — CRITICAL:${NC}"
echo -e "  1. Open ports 80 and 443 in your EC2 Security Group!"
echo -e "     (If you haven't already, add inbound rules for HTTP + HTTPS)"
echo -e "  2. Update NEXTAUTH_URL in .env.production to:"
DOMAIN_FOR_MSG="${DOMAIN}"
echo -e "     NEXTAUTH_URL=https://${DOMAIN_FOR_MSG}"
echo -e "  3. If you used an IP instead of a domain, certbot will NOT work."
echo -e "     You need a real domain with DNS A record pointing to this server."
echo ""

