# Production Deployment Guide

## Architecture

The project uses a **relative path approach** instead of npm workspaces for production deployment to ensure:
- Only frontend and shared code are deployed
- Backend code is never accidentally included
- Cleaner, more secure deployments

## Structure

```
financial-graph/
├── frontend/          # React frontend (deployed to Vercel)
├── shared/            # Shared types and utilities (included in frontend build)
├── backend/           # Backend services (NOT deployed with frontend)
├── tools/             # Development tools (NOT deployed)
└── docs/              # Documentation (NOT deployed)
```

## Deployment Configuration

### Package References

- **Frontend** references shared via: `"financial-graph-shared": "file:../shared"`
- **No workspace configuration** in root package.json
- Each package manages its own dependencies

### Vercel Configuration

**Build Command:**
```bash
cd shared && npm install && npm run build && cd ../frontend && npm install && npm run build
```

**Output Directory:** `frontend/dist`

**Ignored Files:** (see `.vercelignore`)
- `backend/` - All backend code
- `tools/` - Development tools
- `logs/` - Log files
- `docs/` - Documentation
- Test files and IDE configs

### Environment Variables

Required environment variables for frontend (set in Vercel):
- `VITE_INSTANT_APP_ID` - InstantDB application ID
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID

## Local Development

### Install Dependencies

```bash
# Install shared dependencies
cd shared
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install backend dependencies (for local dev only)
cd ../backend
npm install
```

### Build

```bash
# Build shared package
cd shared
npm run build

# Build frontend
cd ../frontend
npm run build
```

### Development Servers

```bash
# Frontend dev server
cd frontend
npm run dev

# Backend dev server (separate)
cd backend
bun run dev
```

## Pre-Deployment Checklist

- [ ] All TypeScript errors resolved (`npm run build` in frontend)
- [ ] Shared package built (`npm run build` in shared)
- [ ] No unused variables or imports
- [ ] Environment variables configured in Vercel
- [ ] `.vercelignore` excludes backend and sensitive files
- [ ] Test build locally: `cd frontend && npm install && npm run build`

## Deployment Process

1. **Push to Git:** Changes to `frontend/` or `shared/` trigger deployment
2. **Vercel Build:** Runs build command automatically
3. **Deploy:** Frontend deployed to production URL

## Security Notes

- Backend code is **never** included in frontend deployments
- `.vercelignore` explicitly excludes backend, tools, and logs
- Relative path approach prevents accidental workspace inclusion
- Each deployment only includes `frontend/` and `shared/` code

## Troubleshooting

### Build Fails with "Module not found"

Ensure shared package is built:
```bash
cd shared && npm run build
```

### TypeScript Errors

Check for unused variables:
```bash
cd frontend && npx tsc --noEmit
```

### Large Bundle Size

Current bundle: ~604 KB (180 KB gzipped)
- Consider code splitting for further optimization
- Use dynamic imports for large dependencies

## Monitoring

- **Build Logs:** Check Vercel dashboard for build output
- **Runtime Errors:** Monitor browser console and Vercel logs
- **Performance:** Use Vercel Analytics for metrics
