# Repository Layer

This directory contains repository functions for database operations.

## Audit Trail System

The audit trail system provides centralized configuration and tracking of entity-level changes.

### Quick Start

**View current audit status:**
```bash
cd backend
bun run src/scripts/audit-status.ts
```

**Enable audit trail globally:**
```bash
# In backend/.env
ENABLE_AUDIT_TRAIL=true
AUDIT_RETENTION_DAYS=30
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  audit-config.ts                                            │
│  - Centralized configuration                                │
│  - Entity enable/disable flags                              │
│  - Tracked fields specification                             │
│  - Helper functions (isEntityAudited, etc.)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  audits.ts                                                  │
│  - recordAudit() - Records audit entries                    │
│  - computeFieldChanges() - Computes field diffs             │
│  - getAuditsForEntity() - Queries audit history             │
│  - pruneExpiredAudits() - Cleanup old records               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Repository Files (companies.ts, filings.ts, etc.)         │
│  - Import recordAudit() and computeFieldChanges()           │
│  - Call after successful upsert/update/delete               │
│  - Automatically checks if entity is audited                │
└─────────────────────────────────────────────────────────────┘
```

### Adding Audit Trail to a Repository

**Step 1: Enable in configuration**

Edit `audit-config.ts`:
```typescript
export const AUDIT_CONFIG: Record<string, AuditEntityConfig> = {
  filing: {
    entityType: "filing",
    description: "SEC filings (10-K, 10-Q, etc.)",
    enabled: true, // ← Change to true
    trackedFields: [], // Empty = all fields
    operations: ["CREATE", "UPDATE"],
    notes: "Implemented in filings.ts upsertFiling()",
  },
  // ...
};
```

**Step 2: Import audit functions**

In your repo file (e.g., `filings.ts`):
```typescript
import { recordAudit, computeFieldChanges } from "./audits";
import { getAuditConfig } from "./audit-config";
```

**Step 3: Record audits in upsert/update functions**

```typescript
export async function upsertFiling(filingData: Partial<Filing>): Promise<string> {
  const id = generateFilingId(filingData.accession_number!);
  
  // Fetch existing entity for UPDATE detection
  const existing = await db.query({
    filing: { $: { where: { id } } }
  });
  const oldState = existing.filing?.[0] || null;
  const isNew = !oldState;
  
  // Prepare new entity state
  const node = {
    id,
    accession_number: filingData.accession_number!,
    form_type: filingData.form_type!,
    // ... other fields
    updated_at: new Date().toISOString(),
  };
  
  // Perform database operation
  await db.transact([db.tx.filing[id].update(node)]);
  
  // Record audit trail
  const config = getAuditConfig("filing");
  const fieldsChanged = computeFieldChanges(
    oldState, 
    node, 
    config?.trackedFields || []
  );
  
  await recordAudit({
    entity_type: "filing",
    entity_id: id,
    operation: isNew ? "CREATE" : "UPDATE",
    changed_by: "heuristic", // or "llm" or "human"
    fields_changed: fieldsChanged,
    source_id: filingData.source_id, // optional
  });
  
  return id;
}
```

**Step 4: Verify**

```bash
bun run src/scripts/audit-status.ts
```

### Current Coverage

Run `bun run src/scripts/audit-status.ts` to see current status.

As of last update:
- ✅ Enabled: `company`
- ❌ TODO: `filing`, `parent_of`, `subsidiary_enrichment`, `company_info`, `brand`, `segment`

### Configuration Options

**Entity Configuration:**
```typescript
interface AuditEntityConfig {
  entityType: string;        // Entity name (matches schema)
  description: string;       // Human-readable description
  enabled: boolean;          // Enable/disable audit trail
  trackedFields: string[];   // Specific fields to track ([] = all)
  operations: Array<"CREATE" | "UPDATE" | "DELETE">;
  notes?: string;            // Implementation notes
}
```

**Helper Functions:**
- `isAuditEnabled()` - Check if audit trail is globally enabled
- `isEntityAudited(entityType)` - Check if specific entity is audited
- `getAuditConfig(entityType)` - Get configuration for entity
- `getEnabledAuditEntities()` - Get all enabled entities
- `getAuditCoverageSummary()` - Get coverage statistics

### Querying Audit History

```typescript
import { getAuditsForEntity } from "./audits";

// Get all audits for a specific company
const audits = await getAuditsForEntity("company", companyId);

// Audits are returned in descending order (newest first)
audits.forEach(audit => {
  console.log(`${audit.operation} by ${audit.changed_by} at ${audit.changed_at}`);
  audit.fields_changed.forEach(change => {
    console.log(`  ${change.field}: ${change.old_value} → ${change.new_value}`);
  });
});
```

### Maintenance

**Prune expired audits:**
```typescript
import { pruneExpiredAudits } from "./audits";

const deletedCount = await pruneExpiredAudits();
console.log(`Deleted ${deletedCount} expired audit records`);
```

Audits are automatically expired based on `AUDIT_RETENTION_DAYS` (default: 7 days).

### Related Documentation

- Security checklist: `../../SECURITY_CHECKLIST.md`
- Pipeline observability spec: `../../.kiro/specs/pipeline-observability-audit/requirements.md`
- Audit configuration: `./audit-config.ts`
- Audit functions: `./audits.ts`
