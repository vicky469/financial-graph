# Setup Guide

## Prerequisites

- **Node.js 24** (Active LTS)
- **Bun** (latest)

## Quick Start

### 1. Install Node.js 24

Using nvm:
```bash
nvm install 24
nvm use 24
```

Or download from: https://nodejs.org/

### 2. Install Dependencies

```bash
# Install shared package dependencies
cd shared
bun install

# Install backend dependencies
cd ../backend
bun install

# Install frontend dependencies
cd ../frontend
bun install
```

### 3. Build Shared Package

```bash
cd shared
bun run build
```

### 4. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your InstantDB credentials

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env with your InstantDB app ID
```

### 5. Push Schema

```bash
cd backend
bun run schema:push
```

### 6. Run Development Servers

```bash
# Terminal 1: Backend (if you have backend API)
cd backend
bun run dev

# Terminal 2: Frontend
cd frontend
bun run dev
```

## Project Structure

```
financial-graph/
├── shared/              # Shared types package
│   ├── types/
│   │   ├── schema.ts   # InstantDB schema (source of truth)
│   │   ├── types.ts    # TypeScript types
│   │   ├── validation.ts
│   │   └── composite-keys.ts
│   └── package.json
│
├── backend/             # Backend application
│   ├── src/
│   │   ├── instant.schema.ts  # Re-exports from shared
│   │   └── ...
│   └── package.json
│
└── frontend/            # Frontend application
    ├── src/
    └── package.json
```

## Development Workflow

### Update Schema

1. Edit `shared/types/schema.ts`
2. Rebuild shared: `cd shared && bun run build`
3. Push to InstantDB: `cd backend && bun run schema:push`
4. Types automatically update in both backend and frontend

### Add New Types

1. Edit `shared/types/types.ts`
2. Rebuild shared: `cd shared && bun run build`
3. Import in backend/frontend: `import { NewType } from "@financial-graph/shared"`

## Deployment

### Option 1: Workspace Linking (Development)

Already configured with `workspace:*` in package.json files.

### Option 2: Published Package (Production)

```bash
# Publish shared package
cd shared
npm version patch
npm publish

# Update backend/frontend
cd backend
bun add @financial-graph/shared@latest

cd ../frontend
bun add @financial-graph/shared@latest
```

## Troubleshooting

### "Cannot find module '@financial-graph/shared'"

```bash
cd shared && bun run build
cd ../backend && bun install
cd ../frontend && bun install
```

### Schema push fails

Make sure you're in the backend directory:
```bash
cd backend
bun run schema:push
```

### Type errors after schema change

Rebuild shared and restart TypeScript server:
```bash
cd shared && bun run build
# Then restart TS server in your IDE
```

## Node.js Version

This project requires Node.js 24 (Active LTS). The `.nvmrc` files ensure consistent versions across environments.

```bash
# Check your Node version
node --version  # Should be v24.x.x

# Switch to Node 24 (with nvm)
nvm use
```
