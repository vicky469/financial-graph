# columns.ts Guide

File:
- `src/parser/subsidiary/data/columns.ts`

## Purpose

`parseColumns(...)` converts one table row into normalized field values used by extraction:
- `cleanName`
- `jurisdiction`
- `ownership`
- `footnote refs`

This is the main place where column drift/shift is handled.

## Inputs

`parseColumns(...)` receives:
- row cells (`cells`, filtered content cells)
- optional raw row cells (`rawCells`, includes layout-only cells)
- detected header-based indices (`nameColIdx`, `jurColIdx`, `ownershipColIdx`)

## Output

Returns `ParsedColumns` with:
- `rawName`
- `cleanName`
- `nameFootnoteRefs`
- `jurisdiction`
- `ownership`
- `ownershipFootnoteRefs`

## Parsing Flow

1. Detect row offset.
- If first column is a Roman numeral level marker, shift all indices by `+1`.
- If first column is empty indentation and second has real text, shift by `+1`.

2. Parse name cell.
- Uses `parseNameCell(...)`.
- Extracts cleaned name, name footnote refs, and ownership if embedded in name.

3. Resolve jurisdiction column.
- Start from header-detected jurisdiction column.
- If it is empty/out-of-bounds/ownership-like, scan backward to find better candidate.
- Skip cells that look ownership-like or company-like.

4. Parse jurisdiction value.
- Uses `parseJurisdictionCell(...)`.
- Cleans symbols/noise.

5. Shift guard for company name in jurisdiction.
- If parsed jurisdiction looks company-like:
  - if current name is not company-like, move jurisdiction text into `cleanName` (likely shifted row)
  - otherwise clear jurisdiction

6. Resolve ownership.
- Use ownership column when present.
- For multi-year ownership columns, choose the most recent (rightmost contiguous percentage-like value).
- If not found, fall back to ownership parsed from name text.

## Key Heuristics

- Company-like detection is shared with shape logic:
  - `hasCompanyEntitySuffix(...)` from `table-detection.ts`
- Ownership-like detection:
  - percentage / numeric percentage / dash placeholders
- Jurisdiction candidate selection is primarily negative filtering:
  - not ownership-like
  - not company-like

## Why This File Matters

Most parsing quality issues with wrong name/jurisdiction assignments are caused by:
- merged headers vs data-column mismatch
- leading marker/indent cells
- malformed rows where company text shifts into jurisdiction column

`columns.ts` is the first and best place to fix those issues.

## Related Files

- `src/parser/subsidiary/data/cells.ts`
- `src/parser/subsidiary/data/extraction.ts`
- `src/parser/subsidiary/data/content-extraction.ts`
- `src/parser/subsidiary/shape/table-detection.ts`
- `src/validation/subsidiary-validator.ts`
