/**
 * Types matching InstantDB query results
 * These match the schema defined in backend/src/instant.schema.ts
 */

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

export interface ParentOf {
  id: string;
  from_company_id: string; // Parent company (owner)
  to_company_id: string; // Child company (subsidiary)
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
