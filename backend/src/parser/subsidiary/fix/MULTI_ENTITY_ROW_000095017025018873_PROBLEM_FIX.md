# Multi-Entity Row Fix: `000095017025018873`

## Problem
- Filing `1404655_000095017025018873_hubs-ex21_1.htm.gz` contains multiple entities in one table row.
- Heuristic merged values (e.g. name/jurisdiction concatenation) and produced low coverage (`66.7%`).

## Root Cause
- Parser assumes one entity per `<tr>` and flattens text.
- This filing uses stacked content per cell, so one-row parsing corrupts output.

## Constraint
- Follow `TASTE.md`: no brittle HTML-pattern special-casing.

## Fix
1. Add heuristic coverage gate in `src/parser/subsidiary/index.ts`:
- if coverage `< 0.90`, set reason `low_coverage`.
2. If `--fallback=none`, treat `low_coverage` as failure (do not silently pass).
3. Keep routing policy:
- valid records -> `SUCCESS.csv`
- filing failure context -> `FAILED.csv`

## Acceptance
- Coverage below `90%` cannot pass silently.
- No merged name/jurisdiction rows for this filing in SUCCESS.
- Good rows stay in SUCCESS; bad filing context is recorded in FAILED.
