#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
node -e "fetch('$BASE_URL/api/health').then(r=>{if(!r.ok)process.exit(1);return fetch('$BASE_URL/api/ready')}).then(r=>{if(!r.ok)process.exit(1)})"
echo "Application health and readiness checks passed"
