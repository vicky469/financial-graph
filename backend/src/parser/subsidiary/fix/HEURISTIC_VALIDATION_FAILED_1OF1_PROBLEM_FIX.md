# Problem + Fix Proposal: `heuristic_validation_failed (1/1 invalid rows)`

## Scope

Target cohort:
- `src/output/data/subsidiaries_FAILED.20260217_005551_985.csv`
- rows where `ErrorMessage == heuristic_validation_failed (1/1 invalid rows)`

Observed size:
- 52 rows (out of 1874 failed rows)
- issue distribution in dropped samples:
  - `Jurisdiction is required`: 50
  - placeholder company name (`None`/`NONE`): 6
  - jurisdiction symbol noise (`%`): 1

## What We Observed

Most of these are **not truly missing subsidiary rows**. They are heuristic extraction mistakes where we got one row but lost/misread jurisdiction.

Representative examples from failed CSV:

1. Jurisdiction exists in HTML but parser drops it
- cache: `src/output/data/subsidiary_exhibits/2025/EX-21/1640266_000155837025002703_vygr-20241231xex21d1.htm.gz`
- HTML row clearly has:
  - name: `Voyager Securities Corporation`
  - jurisdiction: `Massachusetts`
- parser result in fallback-disabled run: jurisdiction became empty and row failed validation.

2. Same pattern on standard two-column table
- cache: `src/output/data/subsidiary_exhibits/2025/EX-21/60667_000006066725000049_exhibit211_01312025.htm.gz`
- HTML row has:
  - name: `Lowe’s Home Centers, LLC`
  - jurisdiction: `North Carolina`
- parser dropped jurisdiction and then failed.

3. Header/key-value table row leaked as company row
- cache: `src/output/data/subsidiary_exhibits/2025/EX-21/1819576_000155837025003237_lqda-20241231xex21d1.htm.gz`
- extracted invalid company:
  - `Name under which business conducted:`

4. Multi-line company and jurisdiction lists collapsed into one row
- cache: `src/output/data/subsidiary_exhibits/2025/EX-21/829323_000165495425002032_inuvo_ex211.htm.gz`
- one `<td>` contains 10 company `<p>` lines, paired jurisdiction `<td>` has 10 jurisdiction `<p>` lines
- current extraction emitted one concatenated company string with empty jurisdiction.

## Root Cause Analysis

## Root Cause A: false-positive company detection on jurisdiction values (highest impact)

Code path:
- `src/parser/subsidiary/shape/table-detection.ts:64`
- `src/parser/subsidiary/data/columns.ts:205`

`hasCompanyEntitySuffix()` currently uses substring matching (`lower.includes(suffix)`) over short tokens like `co`, `ag`, `as`, `sa`, `na`.

This misclassifies many valid jurisdictions as “company-like”:
- `Massachusetts` -> true
- `North Carolina` -> true
- `Washington` -> true
- `Commonwealth of Pennsylvania` -> true

When this happens in `parseColumns`, jurisdiction-shift guard clears jurisdiction:
- `src/parser/subsidiary/data/columns.ts:205`

Result: valid row -> jurisdiction emptied -> validation fails as `Jurisdiction is required`.

## Root Cause B: key-value layout rows treated as subsidiary data

Code path:
- table classification/extraction picks rows like:
  - `Jurisdiction of organization: Delaware`
  - `Name under which business conducted: ...`

These should be treated as metadata/key-value, not subsidiary records.

## Root Cause C: stacked multi-line cell pairs are not split

Code path:
- extraction assumes one row = one subsidiary record.
- when both name/jurisdiction cells contain multiple `<p>` line items, parser does not zip/split aligned pairs.

## Root Cause D: placeholder rows (`None`) are still extracted

These are correctly rejected by validator later, but still create avoidable `failed` entries.

## Proposed Fix (Heuristic-only, no LLM changes)

## Phase 1 (highest ROI, lowest risk)

1. Replace substring-based company detection for value-level checks
- Keep table detection behavior stable where needed.
- For column-shift guard in `columns.ts`, use a stricter company detector:
  - token-boundary or regex-based suffix match
  - remove/avoid ambiguous short tokens for value matching (`co`, `ag`, `as`, `sa`, `na`)
  - require stronger signal than raw substring.

2. Apply stricter shift guard rule
- only shift jurisdiction->name when jurisdiction value is strongly company-like and not jurisdiction-like.
- this avoids clearing valid jurisdictions like `Massachusetts`.

Expected impact:
- fixes the majority of 50 `Jurisdiction is required` rows in this 1/1 cohort.

## Phase 2 (targeted table-shape recovery)

3. Add key-value row/table rejection
- skip rows whose left cell looks like metadata label ending with `:`
- skip table fragments with repeated label/value pairs instead of entity rows.

4. Add stacked `<p>` zip extraction for name/jurisdiction cells
- if both cells have multiple non-empty line items and counts align, emit N rows by zipping.

5. Optional quality cleanup
- trim address tail in name cell when row has clear ownership + jurisdiction and first line is the legal entity.

## Why this fix strategy

Why this staged plan?
- Phase 1 addresses systemic false-negative behavior with minimal blast radius.
- Phase 2 handles specific structural patterns in remaining outliers.

## Validation Plan (before merging code changes)

1. Replay the 52 targeted files with `fallbackPolicy=none`.
2. Compare:
- before/after count for `heuristic_validation_failed (1/1 invalid rows)`
- recovered valid heuristic rows count
3. Spot-check representative caches:
- `1640266_000155837025002703_vygr-20241231xex21d1.htm.gz`
- `60667_000006066725000049_exhibit211_01312025.htm.gz`
- `1819576_000155837025003237_lqda-20241231xex21d1.htm.gz`
- `829323_000165495425002032_inuvo_ex211.htm.gz`

This approach keeps heuristics strict, fixes clear parser bugs, and improves how many failed filings can be recovered without LLM.

## Implementation Status (2026-02-17)

Implemented heuristic fixes:
- Replaced weak company-like detection in row-shift logic with stricter token matching for value-level decisions.
- Kept broad company-like detection only for fallback scanning where we must avoid selecting company cells as jurisdiction.
- Added same-column guard: when detected `jurisdiction` index equals `name` index and extra cells exist, force jurisdiction fallback scan.
- Added fallback to parse jurisdiction from parenthetical name text when name/jurisdiction are combined in one column (example: `Company Name (Ohio)`).
- Added key-value/alias metadata row dropping (no alias persistence in parsed records or sinks).
- Added stacked multi-line `<p>/<div>/<li>` zip extraction for aligned name/jurisdiction lists in a single row.
- Added ownership-noise handling for lone `%` cells so they are treated as non-jurisdiction.
- Added numeric leading marker offset detection (e.g., `1.`) in addition to Roman numerals.
- Removed deprecated methods from `table-detection.ts`:
  - `looksLikeCompanyName`
  - `looksLikeJurisdiction`

Validation replay result (`fallbackPolicy=none`, same 52-row cohort):
- Before latest round: `success=37`, `empty=8`, `failed=7`
- After latest round: `success=44`, `empty=8`, `failed=0`

## Task List

- [x] Phase 1.1: Replace substring-based company detection in shift logic with stricter token-aware matching.
- [x] Phase 1.2: Tighten jurisdiction shift guard to avoid clearing valid jurisdiction values.
- [x] Phase 2.3: Drop key-value/metadata rows (including alias-label style rows) from subsidiary extraction.
- [x] Phase 2.4: Implement stacked multi-line name/jurisdiction zip extraction.
- [x] Add same-column (`name == jurisdiction`) fallback scan for jurisdiction detection.
- [x] Add parenthetical jurisdiction recovery from combined name fields (e.g., `(Ohio)`).
- [x] Treat lone `%` as ownership noise (not jurisdiction).
- [x] Support numeric row markers (`1.`, `2.`) as offset indicators.
- [x] Remove deprecated methods in `table-detection.ts`.
- [x] Replay and verify target cohort (`heuristic_validation_failed (1/1 invalid rows)`) reaches zero failed rows.
