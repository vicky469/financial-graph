# Fix Taste: Subsidiary Parser

## Goal
Keep heuristic parsing simple, explainable, and maintainable.

## Principles
- Prefer robust general rules over narrow pattern patches.
- Avoid special-case logic for rare HTML structures.
- Do not optimize for one filing layout at the cost of readability.
- If heuristics are uncertain, let validation/fallback handle it.

## What To Avoid
- Corner-case extraction logic for mixed structures like table rows with stacked `<p>/<div>` content pretending to be multiple rows.
- Deep branching that is hard to reason about.
- Format-specific patches without broad evidence.

## Practical Rule
If a fix only helps a tiny formatting edge case and makes code harder to understand, do not add it.
