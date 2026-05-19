# Push to GitHub — platform-frontend

Repo: **https://github.com/Saffron-Rest/platform-frontend**

## 1. Push code

```bash
cd ~/Desktop/saffron-app/platform-frontend
git push -u origin main
```

If SSH fails, add `~/.ssh/id_ed25519.pub` to GitHub → **SSH keys**, then:

```bash
git remote set-url origin git@github.com:Saffron-Rest/platform-frontend.git
git push -u origin main
```

## 2. GitHub secrets

Same VPS secrets as backend (you can reuse them in this repo):

| Secret | Value |
|--------|--------|
| `VPS_HOST` | `76.13.130.67` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Your private SSH key |
| `GHCR_TOKEN` | Optional if package is public |

## 3. Order of deploy

1. Deploy **backend** first ([platform-backend](https://github.com/Saffron-Rest/platform-backend))
2. Deploy **frontend** (this repo) — Actions → **Deploy** → Run workflow

## 4. Verify

Open http://76.13.130.67 — Saffron login page.

Image: `ghcr.io/saffron-rest/platform-frontend:latest`
