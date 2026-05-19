# Deploy (GitHub Actions)

Repo: [Saffron-Rest/platform-frontend](https://github.com/Saffron-Rest/platform-frontend)

## GitHub secrets

**Settings → Secrets and variables → Actions**

| Secret | Example |
|--------|---------|
| `VPS_HOST` | `76.13.130.67` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private SSH key |
| `HTTP_PORT` | `80` (optional) |
| `GHCR_TOKEN` | PAT with `read:packages` |
| `GHCR_USERNAME` | Your GitHub username (PAT owner) |

Deploy **backend first**: [platform-backend](https://github.com/Saffron-Rest/platform-backend) (`saffron-backend` container must be running on `saffron_net`).

## Public site (via Kong)

Traffic enters **Kong** on port 80 — not this container directly.

| URL | Routed to |
|-----|-----------|
| http://76.13.130.67/ | `saffron-frontend` (this image) |
| http://76.13.130.67/api | `saffron-backend:3001` |

Deploy Kong from repo root: `deploy/kong/` (see `deploy/kong/README.md`).
