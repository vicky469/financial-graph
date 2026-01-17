"use strict";
// Future schema additions - M&A tracking entities
// These are not yet implemented but defined for future use
// To use: merge these entities into instant.schema.ts when ready
Object.defineProperty(exports, "__esModule", { value: true });
exports.futureEntities = void 0;
const core_1 = require("@instantdb/core");
// === M&A Event Tracking ===
// Track mergers, acquisitions, spinoffs, and divestitures
exports.futureEntities = {
    ma_events: core_1.i.entity({
        acquirer_id: core_1.i.string().indexed(),
        announced_date: core_1.i.string().optional(),
        created_at: core_1.i.string(),
        deal_value: core_1.i.number().optional(),
        deal_value_currency: core_1.i.string(),
        effective_date: core_1.i.string().indexed(),
        event_type: core_1.i.string().indexed(), // "acquisition" | "merger" | "spinoff" | "divestiture"
        status: core_1.i.string().indexed(), // "pending" | "completed" | "terminated"
        target_id: core_1.i.string().indexed(),
        updated_at: core_1.i.string(),
    }),
    // Edge: Acquirer acquired Target
    acquired: core_1.i.entity({
        created_at: core_1.i.string(),
        from_company_id: core_1.i.string().indexed(), // Acquirer
        ma_event_id: core_1.i.string().indexed(),
        to_company_id: core_1.i.string().indexed(), // Target
    }),
    // Edge: Target was acquired by Acquirer (reverse)
    was_acquired_by: core_1.i.entity({
        created_at: core_1.i.string(),
        from_company_id: core_1.i.string().indexed(), // Target
        ma_event_id: core_1.i.string().indexed(),
        to_company_id: core_1.i.string().indexed(), // Acquirer
    }),
    // Temporal snapshots of company state
    company_snapshots: core_1.i.entity({
        aliases: core_1.i.any(),
        change_reason: core_1.i.string().indexed(), // "ma_event" | "spinoff" | "ipo" | "delisting" | "name_change"
        company_id: core_1.i.string().indexed(),
        created_at: core_1.i.string(),
        identity: core_1.i.any(),
        ma_event_id: core_1.i.string().indexed().optional(),
        name: core_1.i.string(),
        type: core_1.i.string(),
        valid_from: core_1.i.string().indexed(),
        valid_to: core_1.i.string().indexed().optional(),
    }),
};
// Usage example:
// 1. Copy entities above into instant.schema.ts entities section
// 2. Implement M&A ingestion pipeline
// 3. Create repo functions for M&A operations
// 4. Update frontend to display M&A events
