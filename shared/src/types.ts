// Shared types for Financial Graph backend entities

export interface Company {
  id: string;
  name: string;
  aliases?: string[];
  type: string; // "public" | "private" | "issuer"
  parent_company_id?: string | null;
  founded_date?: string | null;
  jurisdiction_iso?: string | null;
  jurisdiction_raw?: string | null;
  identity?: {
    tickers?: string[];
    cik?: string;
    exchange?: string;
    lei?: string;
    duns?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface PublicCompanyDetails {
  id: string;
  company_id: string;
  sic_code?: string | null;
  industry_sector?: string | null;
  fiscal_year_end?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessSegment {
  id: string;
  company_id: string;
  segment_name: string;
  segment_type: string; // "operating" | "geographic" | "product"
  description: string;
  is_reportable: boolean;
  fiscal_year: number;
  fiscal_quarter?: number | null;
  revenue?: number | null;
  operating_income?: number | null;
  assets?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  owning_company_id: string;
  category?: string | null;
  status: string; // "active" | "discontinued"
  launch_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Filing {
  id: string;
  company_id: string;
  accession_number: string;
  accession_number_nodashes: string;
  form_type: string;
  filing_date: string;
  file_name: string;
  file_url: string;
  attachments?: Record<string, string>;
  source_quarter: string;
  period_end_date?: string | null;
  fiscal_year?: number | null;
  fiscal_quarter?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MAEvent {
  id: string;
  acquirer_id: string;
  target_id: string;
  event_type: string; // "acquisition" | "merger" | "spinoff" | "divestiture"
  announced_date?: string | null;
  effective_date: string;
  deal_value?: number | null;
  deal_value_currency: string;
  status: string; // "pending" | "completed" | "terminated"
  created_at: string;
  updated_at: string;
}

export interface CompanySnapshot {
  id: string;
  company_id: string;
  valid_from: string;
  valid_to?: string | null;
  name: string;
  aliases?: string[];
  type: string;
  identity?: Record<string, unknown>;
  change_reason: string;
  ma_event_id?: string | null;
  created_at: string;
}

// Edge types
export interface ParentOf {
  id: string;
  from_company_id: string;
  to_company_id: string;
  ownership_percent?: number | null;
  established_date: string;
  ended_date?: string | null;
  source: string; // "ma_event" | "spinoff" | "ipo" | "manual" | "sec_filing"
  source_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Owns {
  id: string;
  from_company_id: string;
  to_brand_id: string;
  acquired_date?: string | null;
  divested_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Acquired {
  id: string;
  from_company_id: string;
  to_company_id: string;
  ma_event_id: string;
  created_at: string;
}

export interface WasAcquiredBy {
  id: string;
  from_company_id: string;
  to_company_id: string;
  ma_event_id: string;
  created_at: string;
}

export interface Filed {
  id: string;
  from_company_id: string;
  to_filing_id: string;
  created_at: string;
}

export interface HasPublicDetails {
  id: string;
  from_company_id: string;
  to_details_id: string;
  created_at: string;
}

export interface HasSegments {
  id: string;
  from_company_id: string;
  to_segment_id: string;
  created_at: string;
}
