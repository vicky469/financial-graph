export type Company = {
  id: string; // UUID v5 (deterministic)
  name: string; // e.g., "Meta Platforms, Inc."
  aliases: string[]; // e.g., ["Facebook", "FB"]
  type: "public" | "private" | "issuer"; // Trading status or Reporting status
  parent_company_id: string | null; // UUID (not used for edges, kept for reference)
  founded_date: string | null; // ISO-8601 UTC: "2004-02-04T00:00:00Z"

  // Jurisdiction
  jurisdiction_iso: string | null; // ISO 3166-2: "US-DE", "GB-ENG"
  jurisdiction_raw: string | null; // Original text: "Delaware", "England"

  identity: {
    // Public companies only
    tickers?: string[]; // e.g., ["META", "FB"]
    cik?: string[]; // e.g., ["0001326801"] - array to store all CIKs (companies can have multiple)
    exchange?: string; // e.g., "NASDAQ", "NYSE"

    // All companies (recommended)
    lei?: string; // 20-char Legal Entity Identifier

    // Private companies (optional)
    duns?: string; // 9-digit DUNS number
  };

  created_at: string; // ISO-8601 UTC timestamp
  updated_at: string; // ISO-8601 UTC timestamp
};

export type PublicInfo = {
  id: string; // UUID v5 (deterministic)
  company_id: string; // References companies.id

  // Sector & Industry
  sic_code: string | null; // 4-digit SIC code e.g., "5961"
  industry_sector: string | null; // Derived high-quality sector e.g., "Technology"

  // Reporting Info
  fiscal_year_end: string | null; // e.g., "1231" (MMDD)

  created_at: string;
  updated_at: string;
};

export type BusinessSegment = {
  id: string; // UUID v5 (deterministic)
  company_id: string; // References companies.id

  // Segment Identity
  segment_name: string; // e.g., "AWS", "North America"
  segment_type: "operating" | "geographic" | "product";
  description: string; // Qualitative description from 10-K

  // Reporting Info
  is_reportable: boolean; // GAAP: true if >10% material
  fiscal_year: number; // e.g., 2024
  fiscal_quarter: number | null; // 1-4

  // Financial Metrics (USD)
  revenue: number | null;
  operating_income: number | null;
  assets: number | null;

  created_at: string;
  updated_at: string;
};

export type Brand = {
  id: string; // UUID v5 (deterministic)
  name: string; // e.g., "iPhone", "AWS", "Instagram"
  owning_company_id: string; // UUID (references companies.id)
  category: string | null; // e.g., "consumer_electronics", "software"
  status: "active" | "discontinued"; // Current status
  launch_date: string | null; // ISO-8601 UTC: "2007-06-29T00:00:00Z"

  created_at: string;
  updated_at: string;
};

export type MaEvent = {
  id: string; // UUID v5 (deterministic)
  acquirer_id: string; // UUID (references companies.id)
  target_id: string; // UUID (references companies.id)
  event_type: "acquisition" | "merger" | "spinoff" | "divestiture";
  announced_date: string | null; // ISO-8601 UTC
  effective_date: string; // ISO-8601 UTC (required)
  deal_value: number | null; // USD (e.g., 44000000000 for $44B)
  deal_value_currency: string; // ISO 4217: "USD", "EUR", "GBP"
  status: "pending" | "completed" | "terminated";

  created_at: string;
  updated_at: string;
};

export type Filing = {
  id: string; // UUID v5 (deterministic)
  company_id: string; // UUID (references companies.id)

  // SEC EDGAR metadata
  accession_number: string; // e.g., "0001214659-25-002647" (with dashes)
  accession_number_nodashes: string; // e.g., "000121465925002647"
  form_type: string; // e.g., "10-K", "20-F", "EX-21"
  filing_date: string; // ISO-8601 UTC: "2025-01-15T00:00:00Z"

  // File location
  file_name: string; // e.g., "aapl-20231230_10k.htm"
  file_url: string; // Full URL to filing document
  attachments?: Record<string, string>; // e.g. { "EX-21": "https://..." }

  // Filing timing (when filed)
  source_quarter: number; // When filed: 1-4
  source_year: number; // When filed: e.g., 2025
  
  // Reported period (from document content, not filing date)
  period_end_date: string | null; // ISO-8601 UTC: "2024-12-31T00:00:00Z"
  fiscal_year: number | null; // e.g., 2024
  fiscal_quarter: number | null; // 1, 2, 3, or 4

  created_at: string;
  updated_at: string;
};

export type CompanySnapshot = {
  id: string; // UUID v5 (deterministic)
  company_id: string; // UUID (references companies.id)

  // Temporal validity
  valid_from: string; // ISO-8601 UTC: when this state became true
  valid_to: string | null; // ISO-8601 UTC: when this state ended (null = current)

  // State at this point in time
  name: string; // Company name at this time
  aliases: string[]; // Aliases at this time
  type: "public" | "private"; // Trading status at this time
  identity: {
    tickers?: string[]; // e.g., ["META", "FB"]
    cik?: string; // e.g., "0001326801" (with leading zeros)
    exchange?: string; // e.g., "NASDAQ", "NYSE"
    lei?: string;
    duns?: string;
  };

  // Why this snapshot was created
  change_reason:
    | "ma_event"
    | "spinoff"
    | "ipo"
    | "delisting"
    | "name_change"
    | "manual_correction";
  ma_event_id: string | null; // UUID if change_reason = "ma_event"

  created_at: string; // When snapshot was recorded
};

// Enrichment Metadata
export type SubsidiaryEnrichment = {
  id: string; // UUID v5 (deterministic)
  company_id: string; // References companies.id
  filing_id: string; // References filings.id
  footnoteRefs: string[]; // e.g., ["1", "a", "2B"]
  footnotesHtml: string | null; // Preprocessed HTML content
  llmEnriched: boolean; // Whether LLM enrichment has been completed
  llmEnrichedAt: string | null; // ISO-8601 UTC timestamp of enrichment
  created_at: string;
  updated_at: string;
};

// Edges

export type ParentOfEdge = {
  id: string; // UUID v5 (deterministic)
  from_company_id: string; // Parent company UUID
  to_company_id: string; // Child company (subsidiary) UUID

  ownership_percent: number | null; // 0-100 (e.g., 51.5 for 51.5%)
  established_date: string; // ISO-8601 UTC: when ownership began
  ended_date: string | null; // ISO-8601 UTC: when ownership ended (null = active)

  source: "ma_event" | "spinoff" | "ipo" | "manual" | "sec_filing";
  source_id: string | null; // UUID of ma_event or filing if applicable

  created_at: string;
  updated_at: string;
};

export type OwnsEdge = {
  id: string; // UUID v5 (deterministic)
  from_company_id: string; // Company UUID
  to_brand_id: string; // Brand UUID

  acquired_date: string | null; // ISO-8601 UTC: when company acquired brand (null if original)
  divested_date: string | null; // ISO-8601 UTC: when company sold brand (null = still owns)

  created_at: string;
  updated_at: string;
};

export type AcquiredEdge = {
  id: string; // UUID v5 (deterministic)
  from_company_id: string; // Acquirer UUID
  to_company_id: string; // Target UUID
  ma_event_id: string; // ma_events.id

  created_at: string;
};

export type WasAcquiredByEdge = {
  id: string; // UUID v5 (deterministic)
  from_company_id: string; // Target UUID
  to_company_id: string; // Acquirer UUID
  ma_event_id: string; // ma_events.id

  created_at: string;
};

export type FiledEdge = {
  id: string; // UUID v5 (deterministic)
  from_company_id: string; // Company UUID
  to_filing_id: string; // Filing UUID

  created_at: string;
};

// Audit Trail
export type FieldChange = {
  field: string;
  old_value: unknown;
  new_value: unknown;
};

export type Audit = {
  id: string; // UUID v5
  entity_type: string; // "companies" | "parent_of"
  entity_id: string; // UUID of audited entity
  operation: "CREATE" | "UPDATE" | "DELETE";
  changed_by: "heuristic" | "llm" | "human";
  changed_at: string; // ISO-8601 timestamp
  source_id: string | null; // Filing ID
  fields_changed: FieldChange[];
  expires_at: string; // For TTL cleanup
};
