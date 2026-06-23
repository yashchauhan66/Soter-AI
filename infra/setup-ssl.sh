#!/usr/bin/env bash
# SoterAI - Nginx + SSL Setup for EC2
# Usage: sudo bash infra/setup-ssl.sh yourdomain.com

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${SSL_EMAIL:-admin@${DOMAIN}}"
APP_PORT="${APP_PORT:-3000}"
SITE_NAME="soter-guard"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}.conf"

log() { echo "[OK] $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[ERROR] $1"; exit 1; }

if [ -z "$DOMAIN" ]; then
  fail "Usage: sudo bash infra/setup-ssl.sh yourdomain.com"
fi

if [ "$(id -u)" -ne 0 ]; then
  fail "Run as root: sudo bash infra/setup-ssl.sh ${DOMAIN}"
fi

echo ""
echo "SoterAI - Nginx + SSL Setup"
echo "Domain: ${DOMAIN}"
echo "App upstream: 127.0.0.1:${APP_PORT}"
echo ""

apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx
mkdir -p /var/www/certbot

# Remove stale broken site before testing/restarting nginx.
rm -f /etc/nginx/sites-enabled/default
rm -f "$NGINX_ENABLED"

cat > "$NGINX_AVAILABLE" <<NGINXCONF
upstream soter_app {
    server 127.0.0.1:${APP_PORT};
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 100m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://soter_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
NGINXCONF

ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
nginx -t
systemctl enable nginx
systemctl restart nginx
log "HTTP reverse proxy is live on port 80"

certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  --redirect \
  --hsts

nginx -t
systemctl reload nginx
log "SSL setup complete: https://${DOMAIN}"

echo ""
echo "Next steps:"
echo "1. Ensure EC2 Security Group allows inbound TCP 80 and 443."
echo "2. Set these production env values and recreate the app container:"
echo "   NEXTAUTH_URL=https://${DOMAIN}"
echo "   NEXT_PUBLIC_APP_URL=https://${DOMAIN}"
echo "   CYBERRAKSHAK_BASE_URL=https://${DOMAIN}"
echo "   ZEROVEIL_BASE_URL=https://${DOMAIN}"
echo ""