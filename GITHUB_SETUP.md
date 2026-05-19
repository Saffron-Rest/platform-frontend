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
| `SSH_PASSPHRASE` | Only if your private key has a passphrase |

Add under **Settings → Secrets and variables → Actions → Repository secrets** (not only Environment).

**Passphrase-protected key?** Either add `SSH_PASSPHRASE` with the key password, or (recommended for CI) create a deploy-only key with **no** passphrase:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/saffron_github_deploy -N "" -C "saffron-github-deploy"
cat ~/.ssh/saffron_github_deploy.pub   # add in Hostinger → VPS → SSH keys
cat ~/.ssh/saffron_github_deploy       # paste into GitHub secret SSH_PRIVATE_KEY
```

Copy key: `cat ~/.ssh/id_ed25519` — must include `-----BEGIN` / `-----END` lines.
| `GHCR_TOKEN` | Yes — PAT with `read:packages` |
| `GHCR_USERNAME` | Yes — GitHub username that owns the PAT (not the org name) |
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
