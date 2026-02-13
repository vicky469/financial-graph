# Technical Debt

## Company Role Modeling (Public + Subsidiary on Same Entity)

### Problem
- `company.type` is currently a single scalar classification.
- Real-world edge case: one legal entity can be both `PUBLIC` and `SUBSIDIARY`.
- Current subsidiary ingestion can create a second company row instead of reusing the existing public row.

### Why This Happens
- Deterministic company IDs include `type` in the key generation path.
- Public/issuer and subsidiary records use different identity keys, so they do not naturally converge.
- Subsidiary DB sink currently generates `SUBSIDIARY` IDs directly and upserts those nodes.

### Impact
- Duplicate company nodes for the same legal entity.
- Fragmented graph relationships and enrichment history.
- Extra cleanup/reconciliation work after ingestion.

### Decision
- Keep `company.type` as the primary indexed classification for now.
- Add a secondary role model (`types[]` or a role flag like `is_subsidiary`) for multi-role support.
- Do **not** use comma-delimited strings like `"1,2"` for roles.

### Recommended Implementation (Phased)
1. Add a secondary role field to `company` (preferred: role array, fallback: boolean role flags).
2. Update subsidiary ingestion to attempt match-before-create:
   - Match candidate existing entities by normalized name + jurisdiction.
   - If one high-confidence match exists, reuse existing `company.id` and add subsidiary role.
   - If no match, create new subsidiary company row.
   - If ambiguous, log and send to manual review workflow.
3. Keep current `type` filters and queries unchanged initially.
4. Add observability:
   - Count reused vs newly-created subsidiary entities.
   - Count ambiguous matches.
5. Backfill historical duplicates with a controlled merge script later.

### Exit Criteria
- Subsidiary pipeline no longer creates duplicate company rows for known public entities.
- Reuse rate and ambiguity metrics are tracked in logs/monitoring.
- Existing public-company query performance remains stable.

### Open Questions
- Role field format choice: `types[]` vs boolean flags.
- Matching confidence rules (exact normalized match only vs fuzzy matching).
- Manual review storage destination for ambiguous matches.
