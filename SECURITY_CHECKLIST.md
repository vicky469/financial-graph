# Security Checklist

## Completed

### 1. Database Permissions (InstantDB)
- [x] Added comprehensive permission rules in `shared/instant.perms.ts`
- [x] Core data entities (company, filing, parent_of, etc.) are **read-only** for clients
- [x] Notes require authentication for all operations
- [x] Users can only view/edit/delete their own notes
- [x] Audit table is read-only for clients (admin write only)

**To deploy:** `cd shared && npm run perms:push`

### 2. Audit Trail
- [x] Enabled audit trail (`ENABLE_AUDIT_TRAIL=true` in backend/.env)
- [x] Set 30-day retention (`AUDIT_RETENTION_DAYS=30`)
- [x] Added `recordAudit()` function for tracking changes
- [x] Added `computeFieldChanges()` for field-level diff tracking
- [x] Created centralized audit configuration (`backend/src/db/repo/audit-config.ts`)
- [x] Created audit status script (`bun run src/scripts/audit-status.ts`)
- [x] Companies repo now records audits on upsert

**Current Coverage:** 1/8 entities (12.5%)
- ✅ Enabled: `company`
- ❌ TODO: `filing`, `parent_of`, `subsidiary_enrichment`, `company_info`, `brand`, `segment`

**View Status:** Run `cd backend && bun run src/scripts/audit-status.ts`

### 3. Content Security Policy (CSP)
- [x] Added CSP meta tag in `frontend/index.html`
- [x] `script-src 'self' https://accounts.google.com` - Only allow our scripts + Google OAuth
- [x] `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` - Styles from trusted sources
- [x] `connect-src` - Limited to InstantDB, Google, SEC APIs
- [x] `frame-src https://accounts.google.com` - Only Google OAuth frames

### 4. Log Retention
- [x] Increased log retention to 30 days (configurable via `LOG_RETENTION_DAYS`)
- [x] Updated `backend/src/utils/logger.ts`

### 5. Schema Cleanup
- [x] Removed redundant `llmChanges` field from `subsidiary_enrichment` (use audit trail instead)
- [x] Removed `llmEnriched` and `llmEnrichedAt` fields

---

## TODO - Required Actions

### 1. Rotate Credentials (CRITICAL)
- [ ] Generate new `INSTANT_ADMIN_SECRET` in InstantDB dashboard
- [ ] Generate new `INSTANT_ADMIN_SECRET_TEST`
- [ ] Update `backend/.env` with new values
- [ ] Rotate `DEEPSEEK_API_KEY` if exposed
- [ ] Rotate `HF_TOKEN` if exposed

### 2. Push Permissions
- [ ] Run `cd shared && npm run perms:push` to deploy permission rules

### 3. Run Breach Investigation
- [ ] Run `cd backend && bun run scripts/investigate-breach.ts`
- [ ] Review the report at `backend/logs/security-reports/`
- [ ] Investigate any CRITICAL or HIGH findings

### 4. Verify .gitignore
- [ ] Ensure `.env` files are in `.gitignore`
- [ ] Ensure `backend/logs/` is in `.gitignore`
- [ ] Check for any committed secrets in git history

---

## TODO - Recommended Improvements

### 1. Add Audit Recording to All Repos
See current status: `cd backend && bun run src/scripts/audit-status.ts`

- [ ] `backend/src/db/repo/filings.ts` - Add audit on upsert
- [ ] `backend/src/db/repo/companies.ts` - Add audit for linkParentChild() and upsertCompanyInfo()
- [ ] `backend/src/db/repo/enrichments.ts` - Add audit on subsidiary enrichments
- [ ] `backend/src/db/repo/brands.ts` - Add audit on brand operations
- [ ] `backend/src/db/repo/segments.ts` - Add audit on segment operations

**How to add:**
1. Update `enabled: true` in `backend/src/db/repo/audit-config.ts`
2. Import `recordAudit()` and `computeFieldChanges()` from `./audits`
3. Call `recordAudit()` after successful upsert/update/delete operations

### 2. Rate Limiting
- [ ] Add rate limiting to API endpoints (if any backend APIs exist)
- [ ] Consider InstantDB rate limiting options

### 3. Input Validation
- [ ] Validate all user inputs on frontend
- [ ] Sanitize data before storing (especially notes content)
- [ ] Validate company mentions in notes

### 4. Session Security
- [ ] Review inactivity timeout settings (`InactivityTimeout` component)
- [ ] Consider adding session fingerprinting

### 5. Monitoring & Alerts
- [ ] Set up alerts for unusual database activity
- [ ] Monitor for bulk operations
- [ ] Set up error tracking (Sentry, etc.)

### 6. HTTPS/TLS
- [ ] Ensure production deployment uses HTTPS only
- [ ] Enable HSTS headers in production

### 7. Dependency Security
- [ ] Run `npm audit` regularly
- [ ] Set up Dependabot or similar for vulnerability alerts
- [ ] Keep dependencies updated

---

## Security Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  - CSP prevents XSS/script injection                        │
│  - localStorage cache (no sensitive data)                   │
│  - Google OAuth for authentication                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      InstantDB                               │
│  - Permission rules enforce access control                  │
│  - WebSocket connections (wss://)                           │
│  - Client SDK uses app ID (public)                          │
│  - Admin SDK uses secret token (backend only)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  - Admin token for write operations                         │
│  - Audit trail for change tracking                          │
│  - Log retention for investigation                          │
└─────────────────────────────────────────────────────────────┘
```

## Permission Matrix

| Entity | View | Create | Update | Delete |
|--------|------|--------|--------|--------|
| company | Auth users | Admin only | Admin only | Admin only |
| filing | Auth users | Admin only | Admin only | Admin only |
| parent_of | Auth users | Admin only | Admin only | Admin only |
| notes | Own + public | Auth users | Own only | Own only |
| audit | Auth users | Admin only | Admin only | Admin only |
| $users | Anyone | System only | No | No |

---

## Incident Response

If a breach is suspected:

1. **Immediately rotate all credentials**
2. **Run investigation script**: `bun run backend/scripts/investigate-breach.ts`
3. **Review audit logs** (if enabled)
4. **Check InstantDB dashboard** for activity
5. **Review git history** for unauthorized changes
6. **Document findings** and timeline

---

Last updated: 2026-01-25
