import { i } from "@instantdb/core";

/**
 * InstantDB Schema Definition
 *
 * This schema defines the structure of our financial knowledge graph.
 * It provides type safety and documents indexes for optimal query performance.
 *
 * Note: Indexes must also be created in the InstantDB dashboard.
 * This schema serves as the source of truth for what should be indexed.
 */

const schema = i.graph(
  {
    // Nodes (Entities)
    companies: i.entity({
      id: i.string().indexed(),
      name: i.string().indexed(),
      aliases: i.json(), // string[]
      type: i.string().indexed(), // "public" | "private" | "issuer"
      parent_company_id: i.string().optional().indexed(),
      founded_date: i.string().optional(),
      jurisdiction_iso: i.string().optional().indexed(),
      jurisdiction_raw: i.string().optional(),
      identity: i.json(), // { tickers?, cik?, exchange?, lei?, duns? }
      created_at: i.string(),
      updated_at: i.string(),
    }),

    public_info: i.entity({
      id: i.string().indexed(),
      company_id: i.string().indexed(),
      sic_code: i.string().optional().indexed(),
      industry_sector: i.string().optional().indexed(),
      fiscal_year_end: i.string().optional(),
      created_at: i.string(),
      updated_at: i.string(),
    }),

    business_segments: i.entity({
      id: i.string().indexed(),
      company_id: i.string().indexed(),
      segment_name: i.string().indexed(),
      segment_type: i.string().indexed(), // "operating" | "geographic" | "product"
      description: i.string(),
      is_reportable: i.boolean(),
      fiscal_year: i.number().indexed(),
      fiscal_quarter: i.number().optional(),
      revenue: i.number().optional(),
      operating_income: i.number().optional(),
      assets: i.number().optional(),
      created_at: i.string(),
      updated_at: i.string(),
    }),

    brands: i.entity({
      id: i.string().indexed(),
      name: i.string().indexed(),
      owning_company_id: i.string().indexed(),
      category: i.string().optional().indexed(),
      status: i.string().indexed(), // "active" | "discontinued"
      launch_date: i.string().optional(),
      created_at: i.string(),
      updated_at: i.string(),
    }),

    filings: i.entity({
      id: i.string().indexed(),
      company_id: i.string().indexed(),
      accession_number: i.string().unique().indexed(),
      accession_number_nodashes: i.string().indexed(),
      form_type: i.string().indexed(),
      filing_date: i.string().indexed(),
      file_name: i.string(),
      file_url: i.string(),
      attachments: i.json().optional(), // Record<string, string>
      source_quarter: i.string().indexed(),
      period_end_date: i.string().optional(),
      fiscal_year: i.number().optional().indexed(),
      fiscal_quarter: i.number().optional().indexed(),
      created_at: i.string(),
      updated_at: i.string(),
    }),

    ma_events: i.entity({
      id: i.string().indexed(),
      acquirer_id: i.string().indexed(),
      target_id: i.string().indexed(),
      event_type: i.string().indexed(), // "acquisition" | "merger" | "spinoff" | "divestiture"
      announced_date: i.string().optional(),
      effective_date: i.string().indexed(),
      deal_value: i.number().optional(),
      deal_value_currency: i.string(),
      status: i.string().indexed(), // "pending" | "completed" | "terminated"
      created_at: i.string(),
      updated_at: i.string(),
    }),

    company_snapshots: i.entity({
      id: i.string().indexed(),
      company_id: i.string().indexed(),
      valid_from: i.string().indexed(),
      valid_to: i.string().optional().indexed(),
      name: i.string(),
      aliases: i.json(), // string[]
      type: i.string(), // "public" | "private"
      identity: i.json(),
      change_reason: i.string().indexed(),
      ma_event_id: i.string().optional().indexed(),
      created_at: i.string(),
    }),

    // Edges (Relationships)
    parent_of: i.entity({
      id: i.string().indexed(),
      from_company_id: i.string().indexed(),
      to_company_id: i.string().indexed(),
      ownership_percent: i.number().optional(),
      established_date: i.string().indexed(),
      ended_date: i.string().optional().indexed(),
      source: i.string().indexed(), // "ma_event" | "spinoff" | "ipo" | "manual" | "sec_filing"
      source_id: i.string().optional().indexed(), //filling_id for sec_filing
      created_at: i.string(),
      updated_at: i.string(),
    }),

    owns: i.entity({
      id: i.string().indexed(),
      from_company_id: i.string().indexed(),
      to_brand_id: i.string().indexed(),
      acquired_date: i.string().optional(),
      divested_date: i.string().optional().indexed(),
      created_at: i.string(),
      updated_at: i.string(),
    }),

    acquired: i.entity({
      id: i.string().indexed(),
      from_company_id: i.string().indexed(),
      to_company_id: i.string().indexed(),
      ma_event_id: i.string().indexed(),
      created_at: i.string(),
    }),

    was_acquired_by: i.entity({
      id: i.string().indexed(),
      from_company_id: i.string().indexed(),
      to_company_id: i.string().indexed(),
      ma_event_id: i.string().indexed(),
      created_at: i.string(),
    }),

    filed: i.entity({
      id: i.string().indexed(),
      from_company_id: i.string().indexed(),
      to_filing_id: i.string().indexed(),
      created_at: i.string(),
    }),

    // Enrichment Metadata
    subsidiary_enrichments: i.entity({
      id: i.string().indexed(),
      company_id: i.string().indexed(),
      filing_id: i.string().indexed(),
      footnoteRefs: i.json(), // string[]
      footnotesHtml: i.string().optional(),
      llmEnriched: i.boolean().indexed(),
      llmEnrichedAt: i.string().optional(),
      created_at: i.string(),
      updated_at: i.string(),
    }),

    // Audit Trail
    audits: i.entity({
      id: i.string().indexed(),
      entity_type: i.string().indexed(), // "companies" | "parent_of"
      entity_id: i.string().indexed(), // UUID of audited entity
      operation: i.string().indexed(), // "CREATE" | "UPDATE" | "DELETE"
      changed_by: i.string().indexed(), // "heuristic" | "llm" | "human"
      changed_at: i.string().indexed(), // ISO-8601 timestamp
      source_id: i.string().optional().indexed(), // Filing ID
      fields_changed: i.json(), // Array of { field, old_value, new_value }
      expires_at: i.string().indexed(), // For 7-day TTL cleanup
    }),
  },
  {}
);

export default schema;
export type Schema = typeof schema;

/**
 * Index Reference (to be created in InstantDB dashboard)
 *
 * filings:
 *   - fiscal_year (indexed) ← For querying filings by fiscal year
 *   - form_type (indexed)   ← For filtering by form type (10-K, EX-21, etc.)
 *   - company_id (indexed)  ← For company -> filings queries
 *   - filing_date (indexed) ← For date range queries
 *
 * companies:
 *   - name (indexed)        ← For search
 *   - type (indexed)        ← For filtering by public/private
 *
 * parent_of:
 *   - from_company_id (indexed) ← For hierarchy traversal
 *   - to_company_id (indexed)   ← For reverse hierarchy
 *
 * subsidiary_enrichments:
 *   - company_id (indexed)  ← For querying enrichments by company
 *   - filing_id (indexed)   ← For querying enrichments by filing
 *   - llmEnriched (indexed) ← For querying unenriched subsidiaries
 */
