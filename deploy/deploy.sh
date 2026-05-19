#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${VPS_APP_DIR:-/docker/saffron-frontend}"
cd "$APP_DIR"

REGISTRY_HOST="${REGISTRY_HOST:-ghcr.io}"
if [[ -z "${REGISTRY_PASSWORD:-}" || -z "${REGISTRY_USER:-}" ]]; then
  echo "ERROR: REGISTRY_USER and REGISTRY_PASSWORD required to pull from private GHCR." >&2
  echo "Add GitHub secrets GHCR_USERNAME + GHCR_TOKEN, or make the package public." >&2
  exit 1
fi
echo "$REGISTRY_PASSWORD" | docker login -u "$REGISTRY_USER" --password-stdin "$REGISTRY_HOST"

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
