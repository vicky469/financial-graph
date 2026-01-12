# SEC Data Processing Scripts

This directory contains scripts for processing SEC EDGAR data and updating the financial graph database.

## Scripts

### `update-company-names-and-ciks.ts`

Updates company records with proper name/alias handling and CIK arrays based on registrant metadata analysis.

**Purpose:**
- Handle companies that have changed names over time (1 CIK → Multiple Names)
- Handle different companies with the same name (Multiple CIKs → 1 Name)
- Ensure data quality and avoid duplicates

**What it does:**

1. **1 CIK = Multiple Names** (Name Changes/Rebranding)
   - Uses the name from the **most recent filing** as the primary name
   - Stores all other historical names in the `aliases` array
   - Example: Facebook, Inc. → Meta Platforms, Inc.

2. **Multiple CIKs = 1 Name** (Different Entities)
   - Merges into a single company record
   - Stores all CIKs in the `identity.cik` array
   - Avoids duplicate company records
   - Example: "ABC Corp" (CIK 123456) and "ABC Corp" (CIK 789012) → One company with both CIKs

**Usage:**

```bash
# Run the script
bun run update:company-names

# Or directly
bun src/data_source/sec/scripts/update-company-names-and-ciks.ts
```

**Input:**
- `output/registrant_metadata_2025.csv` - All SEC filings with registrant names and CIKs

**Output:**
- Updates `companies` table in database
- Creates new companies if they don't exist
- Updates existing companies with:
  - Correct primary name (from most recent filing)
  - All historical names in aliases array
  - All CIKs in identity.cik array

**Statistics (from 2025 data):**

```
One-to-One (1 CIK = 1 Name):
  150,806 CIKs have exactly one name

One-to-Many (1 CIK = Multiple Names):
  892 CIKs have multiple names (name changes/rebranding)
  Total name variations: 1,799
  Average names per CIK: 2.02
  Max names for single CIK: 4

Many-to-One (Multiple CIKs = 1 Name):
  164 names are used by multiple CIKs (different entities)
  Total CIK variations: 367
  Average CIKs per name: 2.24
  Max CIKs for single name: 6
```

**Example Output:**

```
=== Step 1: Analyzing CIK → Name relationships ===
Total CIKs: 151,698
CIKs with single name: 150,806
CIKs with multiple names: 892

=== Step 2: Analyzing Name → CIK relationships ===
Total unique primary names: 151,534
Names with single CIK: 151,370
Names with multiple CIKs: 164

=== Step 3: Updating company records ===
  Merged CIKs for "ABC Corp": 1 → 2 CIKs
  Created company "XYZ Inc" with 3 CIKs: 123456, 234567, 345678

=== Summary ===
Companies created: 5,234
Companies updated: 1,056
Companies skipped (no changes): 145,408
Companies with merged CIKs: 164

=== Examples: Companies with Multiple Names ===
CIK 1326801:
  Primary: Meta Platforms, Inc.
  Aliases: Facebook, Inc.

=== Examples: Names with Multiple CIKs ===
"ABC Corp":
  CIKs: 123456, 789012
```

### Other Scripts

- `ingestSecMetadata.ts` - Downloads and processes SEC EDGAR metadata
- `download_exhibit_files.ts` - Downloads specific exhibit files (EX-21, EX-8)

## Related Documentation

- `../../../docs/primary-name-determination.md` - Detailed explanation of primary name logic
- `../../../docs/cik-array-final-approach.md` - Multiple CIKs per company approach
- `../notebook/analyze_registrants.ipynb` - Analysis notebook with statistics

## Workflow

Typical data ingestion workflow:

```bash
# 1. Download SEC metadata
bun run ingest:metadata

# 2. Ingest tickers (creates initial company records)
bun run ingest:tickers

# 3. Ingest filings
bun run ingest:filings

# 4. Update company names and CIKs (handles name changes and duplicates)
bun run update:company-names

# 5. Build CIK lookup cache (for fast lookups)
bun run build:cik-lookup

# 6. Download and ingest exhibits
bun run download:ex21
bun run ingest:ex21

# 7. Ingest subsidiaries
bun run ingest:subsidiaries
```

## Database Schema

The script updates the `companies` table:

```typescript
type Company = {
  id: string;              // UUID v5 (deterministic from first CIK)
  name: string;            // Primary name (from most recent filing)
  aliases: string[];       // Historical names
  type: "public" | "private" | "issuer";
  identity: {
    cik?: string[];        // All CIKs for this company
    tickers?: string[];
    exchange?: string;
    lei?: string;
  };
  // ... other fields
}
```

## Notes

- The script is **idempotent** - safe to run multiple times
- Existing companies are updated, not duplicated
- CIK arrays are merged (union of all CIKs)
- Aliases are merged (union of all historical names)
- Primary name is always from the most recent filing
- ID generation uses first CIK (non-deterministic but acceptable)
