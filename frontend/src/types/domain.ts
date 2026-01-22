import type { Company as SharedCompany } from "financial-graph-shared";

// Frontend-specific company type that extends the shared Company type
// Includes additional fields from InstantDB relations and computed fields
export interface CompanyDetail extends SharedCompany {
  // Relations from InstantDB
  companyInfo?: {
    fiscal_year_end?: string;
    addresses?: any;
    phone?: string;
    former_names?: any;
    updated_at?: string;
  };
  
  // For subsidiaries - parent relationship
  parents?: Array<{
    ownership_percent?: number;
    parentCompany?: SharedCompany;
  }>;
  
  // Computed/convenience fields
  cik?: string; // Extracted from identity.primaryCIK for convenience
  jurisdiction?: string; // Extracted from jurisdiction_raw or jurisdiction_iso
}

// Simple type for field values in detail panels
export type PropertyValue = string | number | boolean | null | string[];
