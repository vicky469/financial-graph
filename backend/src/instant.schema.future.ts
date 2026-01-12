// Future schema additions - M&A tracking entities
// These are not yet implemented but defined for future use
// To use: merge these entities into instant.schema.ts when ready

import { i } from "@instantdb/core";

// === M&A Event Tracking ===
// Track mergers, acquisitions, spinoffs, and divestitures

export const futureEntities = {
  ma_events: i.entity({
    acquirer_id: i.string().indexed(),
    announced_date: i.string().optional(),
    created_at: i.string(),
    deal_value: i.number().optional(),
    deal_value_currency: i.string(),
    effective_date: i.string().indexed(),
    event_type: i.string().indexed(), // "acquisition" | "merger" | "spinoff" | "divestiture"
    status: i.string().indexed(), // "pending" | "completed" | "terminated"
    target_id: i.string().indexed(),
    updated_at: i.string(),
  }),

  // Edge: Acquirer acquired Target
  acquired: i.entity({
    created_at: i.string(),
    from_company_id: i.string().indexed(), // Acquirer
    ma_event_id: i.string().indexed(),
    to_company_id: i.string().indexed(), // Target
  }),

  // Edge: Target was acquired by Acquirer (reverse)
  was_acquired_by: i.entity({
    created_at: i.string(),
    from_company_id: i.string().indexed(), // Target
    ma_event_id: i.string().indexed(),
    to_company_id: i.string().indexed(), // Acquirer
  }),

  // Temporal snapshots of company state
  company_snapshots: i.entity({
    aliases: i.any(),
    change_reason: i.string().indexed(), // "ma_event" | "spinoff" | "ipo" | "delisting" | "name_change"
    company_id: i.string().indexed(),
    created_at: i.string(),
    identity: i.any(),
    ma_event_id: i.string().indexed().optional(),
    name: i.string(),
    type: i.string(),
    valid_from: i.string().indexed(),
    valid_to: i.string().indexed().optional(),
  }),
};

// Usage example:
// 1. Copy entities above into instant.schema.ts entities section
// 2. Implement M&A ingestion pipeline
// 3. Create repo functions for M&A operations
// 4. Update frontend to display M&A events
