# @financial-graph/shared

Shared types, schema, and utilities for financial-graph backend and frontend.

## What's Included

- **Schema**: InstantDB schema definition
- **Types**: Schema-derived TypeScript types
- **Enums**: CompanyType, ParentOfSource, etc.
- **Type Guards**: isPublicCompany, isPrivateCompany, etc.
- **Validation**: assertDefined, assertNonEmpty, etc.
- **Composite Keys**: Key generation and parsing

## Installation

### Local Development (Workspace)

```json
{
  "dependencies": {
    "@financial-graph/shared": "workspace:*"
  }
}
```

### Production (Published Package)

```bash
bun add @financial-graph/shared@latest
```

## Usage

```typescript
import { Company, CompanyType, isPublicCompany } from "@financial-graph/shared";
import { assertDefined } from "@financial-graph/shared";
import { generateCompanyCompositeKey } from "@financial-graph/shared";
```

## Testing

```bash
bun test          # Run tests once
bun test --watch  # Watch mode
```

## Building

```bash
bun install
bun run build    # Compile TypeScript to dist/
bun run watch    # Watch mode for development
bun run clean    # Clean dist/
```

## Publishing

For separate deployments:

```bash
cd shared
npm version patch
npm publish
```

Then update backend/frontend:

```bash
cd backend && bun add @financial-graph/shared@latest
cd frontend && bun add @financial-graph/shared@latest
```

## Examples

See `types/composite-keys.test.ts` for comprehensive examples of all functionality.
