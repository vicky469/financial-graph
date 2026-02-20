# Frontend

## Feature Flags

- Flags live in `shared/types/featureFlags.ts` and are read in `frontend/src/config/featureFlags.ts`.
- Flags default to `false` unless explicitly set to `"true"` in the environment.
- `VITE_FEATURE_WORKSPACE` enables public note visibility controls.
- `VITE_FEATURE_PREVIEW_BANNER` enables the preview banner UI for authenticated users.
- `VITE_FEATURE_STRUCTURE_NESTING` enables nested expand/collapse behavior in the Structure list.

## Contact Form

The landing contact form posts to a Vercel serverless API (`/api/contact`) and sends an email via Resend.

### Email Delivery (Resend)

The form submits to `/api/contact` and sends an email via Resend.

Set these environment variables in Vercel (Project → Settings → Environment Variables),
or locally when using `vercel dev`. These are server-only secrets and should **not**
live in `frontend/.env`.

- `RESEND_API_KEY`
- `CONTACT_SENDER_EMAIL` (must be a verified sender/domain in Resend)
- `CONTACT_TO_EMAIL` (your inbox)

### Deployment & Safety Notes

- The API route lives in `api/contact.ts` and is deployed as a **Vercel Serverless Function**.
- The frontend is still a static Vite build (`frontend/dist`).
- This is safe to keep in the same Vercel project because:
  - Serverless env vars are **not exposed to the browser** unless they start with `VITE_`.
  - Only the `/api/*` serverless runtime can read `RESEND_API_KEY`, `CONTACT_SENDER_EMAIL`, and `CONTACT_TO_EMAIL`.
  - The static frontend bundle never includes those secrets.

If you want complete isolation, you can split into two Vercel projects (frontend + API), but it’s not required.

### How To Test

1. Start the site:
   - Recommended: `vercel dev` at repo root (so `/api/contact` is available).
   - Or deploy to Vercel and test there.
2. Submit the form and confirm the email arrives.
