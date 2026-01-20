/**
 * Frontend types - imported from shared package
 * 
 * This file re-exports types from @financial-graph/shared.
 * Both frontend and backend share the same schema and types.
 */

// Import schema-derived types from shared
export type {
  Company,
  CompanyIdentity,
  CompanyTypeValue,
  Filing,
  FilingAttachments,
  ParentOfEdge,
  ParentOfSourceValue,
  SubsidiaryEnrichment,
  // CompanyInfo, // Commented out - not exported from shared
  // BusinessSegment, // Commented out - not exported from shared
  // Brand, // Commented out - not exported from shared
  // OwnsEdge, // Commented out - owns entity is not active in schema
  Audit,
  FieldChange,
  AuditWithChanges,
} from "financial-graph-shared";

// Define types that are not exported from shared but used locally
export interface CompanyInfo {
  fiscal_year_end?: string;
  addresses?: {
    mailing?: {
      city?: string;
      stateOrCountry?: string;
    };
  };
  phone?: string;
  former_names?: Array<{
    name: string;
    from: string;
    to: string;
  }>;
  updated_at?: string;
}

export interface BusinessSegment {
  id: string;
  name: string;
  // Add other properties as needed
}

export interface Brand {
  id: string;
  name: string;
  status: string;
  category?: string;
  // Add other properties as needed
}

// Import enums and constants
export { CompanyType, ParentOfSource } from "financial-graph-shared";

// Import type guards
export {
  isPublicCompany,
  isPrivateCompany,
  isFromSecFiling,
} from "financial-graph-shared";

// Frontend-specific type aliases for compatibility with existing code
import type { ParentOfEdge as BackendParentOf } from "financial-graph-shared";

export type ParentOf = BackendParentOf & {
  from_company_id: string; // Alias for parentCompany link
  to_company_id: string;   // Alias for subsidiaryCompany link
};

// Owns type commented out since owns entity is not active in schema
// export type Owns = BackendOwns & {
//   from_company_id: string; // Alias for company link
//   to_brand_id: string;     // Alias for brand link
// };
