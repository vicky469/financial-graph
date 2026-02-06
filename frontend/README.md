# Frontend

## Feature Flags

- Flags live in `shared/types/featureFlags.ts` and are read in `frontend/src/config/featureFlags.ts`.
- Flags default to `false` unless explicitly set to `"true"` in the environment.
- `VITE_FEATURE_WORKSPACE` enables public note visibility controls.
- `VITE_FEATURE_PREVIEW_BANNER` enables the preview banner UI for authenticated users.
