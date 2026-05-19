# platform-frontend — GitHub setup

Repo: https://github.com/Saffron-Rest/platform-frontend

## One pipeline (`pipeline.yml`)

```
push to main →  1 · Test (npm build)
             →  2 · Build & push image (GHCR)
             →  3 · Deploy web to VPS (port 80)
```

## Secrets (same VPS as backend)

| Secret | Required |
|--------|----------|
| `VPS_HOST` | Yes — `76.13.130.67` |
| `VPS_USER` | Yes — `root` |
| `SSH_PRIVATE_KEY` | Yes — full private key (`VPS_SSH_KEY` also works) |

Add under **Settings → Secrets and variables → Actions → Repository secrets** (not only Environment).

Copy key: `cat ~/.ssh/id_ed25519` — must include `-----BEGIN` / `-----END` lines.
| `GHCR_TOKEN` | If package is private |
| `HTTP_PORT` | Optional — default `80` |

Backend secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`) are **not** needed in this repo.

## Deploy order

1. [platform-backend](https://github.com/Saffron-Rest/platform-backend) — deploy first  
2. **This repo** — then deploy frontend  

## Push

```bash
cd ~/Desktop/saffron-app/platform-frontend
git remote set-url origin git@github.com:Saffron-Rest/platform-frontend.git
git add .
git commit -m "Fix CI: single pipeline in .github/workflows"
git push origin main
```

## App URL

http://76.13.130.67
