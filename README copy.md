# Saffron Platform Frontend

React + Vite admin web app for Saffron Cash Flow.

## Local run

```bash
npm install
npm run dev
```

Open http://localhost:5173 — API is proxied to http://localhost:3001 (start [platform-backend](https://github.com/Saffron-Rest/platform-backend) separately).

## Production

- Built as static files in Docker (nginx)
- Serves the SPA and proxies `/api` → `saffron-backend:3001`
- Public URL: http://76.13.130.67

## Deploy

Push to `main` → GitHub Actions builds and deploys to VPS.

See [GITHUB_SETUP.md](GITHUB_SETUP.md) and [deploy/README.md](deploy/README.md).

## Demo login

| Email | Password |
|-------|----------|
| admin@saffron.local | admin123 |
