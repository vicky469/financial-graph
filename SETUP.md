# Setup & Deployment

## Prerequisites

- Node.js 24 (Active LTS)
- Bun (latest)

## Quick Start (Local)

1. Install dependencies
```bash
cd shared && bun install
cd ../backend && bun install
cd ../frontend && bun install
```

2. Build shared
```bash
cd shared && bun run build
```

3. Configure env
```bash
# Repo root (frontend + serverless API)
cp .env.example .env
# Edit .env with VITE_ values + Resend settings

# Backend
cd backend
cp .env.example .env
# Edit backend/.env with InstantDB admin creds
```

4. Dev servers
```bash
# Backend (optional)
cd backend && bun run dev

# Frontend only (no /api routes)
cd frontend && bun run dev

# Frontend + serverless API (/api/contact)
npx vercel dev
```

## Environment Variables

Root `.env` (frontend + `/api/contact`):
- `VITE_INSTANTDB_APP_ID`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_NAME`
- `RESEND_API_KEY`
- `CONTACT_SENDER_EMAIL`
- `CONTACT_TO_EMAIL`

Backend `.env` (InstantDB admin, pipelines, jobs):
- `INSTANTDB_ADMIN_TOKEN`

## Deployment (Vercel)

Build config (from `vercel.json`):
- Build command: `cd shared && npm install && npm run build && cd ../frontend && npm install && npm run build`
- Output: `frontend/dist`
- API routes: `api/*` (serverless)

Set these env vars in Vercel Project → Settings → Environment Variables:
- All root `.env` keys listed above

Deploy:
1. Push to Git
2. Vercel builds and deploys frontend + API

## Troubleshooting

- Missing shared types: `cd shared && bun run build`
- Schema push fails: `cd backend && bun run schema:push`
- API not available locally: use `npx vercel dev` from repo root
