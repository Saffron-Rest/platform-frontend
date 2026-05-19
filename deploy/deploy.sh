#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${VPS_APP_DIR:-/docker/saffron-frontend}"
cd "$APP_DIR"

REGISTRY_HOST="${REGISTRY_HOST:-ghcr.io}"
if [[ -n "${REGISTRY_PASSWORD:-}" && -n "${REGISTRY_USER:-}" ]]; then
  echo "$REGISTRY_PASSWORD" | docker login -u "$REGISTRY_USER" "$REGISTRY_HOST" --password-stdin
fi

HTTP_PORT="${HTTP_PORT:-80}"

cat > .env <<EOF
FRONTEND_IMAGE=${FRONTEND_IMAGE:?FRONTEND_IMAGE required}
HTTP_PORT=${HTTP_PORT}
EOF
chmod 600 .env

docker network inspect saffron_net >/dev/null 2>&1 || docker network create saffron_net

docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans

echo "Frontend: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${HTTP_PORT:-80}"
docker ps --filter name=saffron-frontend --format '{{.Names}} {{.Status}}'
