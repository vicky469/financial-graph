/**
 * Shared Database Types
 * 
 * These types are derived from the InstantDB schema and shared
 * between backend and frontend for type safety and consistency.
 */

import type { InstaQLEntity } from "@instantdb/core";
import type schema from "./schema";

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Company Type Enum
 * Represents the legal/trading status of a company
 */
export const CompanyType = {
  PUBLIC: 1,   // Publicly traded company
  PRIVATE: 2,  // Private company
  ISSUER: 3,   // SEC issuer (files reports but may not be publicly traded)
  UNKNOWN: 4,  // Type not yet determined
} as const;

export type CompanyTypeValue = typeof CompanyType[keyof typeof CompanyType];

/**
 * Parent-Child Relationship Source
 * Indicates how the relationship was established
 */
export const ParentOfSource = {
  MA_EVENT: 1,    // From M&A event
  SPINOFF: 2,     // From spinoff
  IPO: 3,         // From IPO
  MANUAL: 4,      // Manually added
  SEC_FILING: 5,  // From SEC filing (e.g., EX-21)
} as const;

export type ParentOfSourceValue = typeof ParentOfSource[keyof typeof ParentOfSource];

// ============================================================================
// COMPANY
// ============================================================================

type CompanyRaw = InstaQLEntity<typeof schema, "company">;

/**
 * Company entity
 * Represents a business entity (public, private, or issuer)
 */
export interface Company extends Omit<CompanyRaw, 'type' | 'identity'> {
  type: CompanyTypeValue; // Refined: 1 | 2 | 3 | 4
  identity?: CompanyIdentity; // Typed JSON field
}

/**
 * Company identity structure (stored as JSON)
 */
export interface CompanyIdentity {
  // Public/Issuer companies
  tickers?: string;     // Comma-separated, e.g., "META,FB"
  ciks?: string;        // Comma-separated CIKs, e.g., "0001326801,0001234567" - 10 digits each with leading zeros
  exchanges?: string;   // Comma-separated, e.g., "NASDAQ,NYSE"
  sp500?: boolean;      // S&P 500 constituent

  // All companies (recommended)
  lei?: string;         // Legal Entity Identifier (20 chars)

  // Private companies
  duns?: string;        // DUNS number (9 digits)
}

// ============================================================================
// FILING
// ============================================================================

/**
 * Filing entity
 * Represents an SEC filing document
 */
export type Filing = InstaQLEntity<typeof schema, "filing">;

/**
 * Filing attachments structure (stored as JSON)
 */
export type FilingAttachments = Record<string, string>; // e.g., { "EX-21": "https://..." }

// ============================================================================
// PARENT-CHILD RELATIONSHIPS
// ============================================================================

type ParentOfEdgeRaw = InstaQLEntity<typeof schema, "parent_of">;

/**
 * Parent-Child relationship edge
 * Represents ownership/control of one company by another
 * Supports temporal tracking (established_date, ended_date)
 */
export interface ParentOfEdge extends Omit<ParentOfEdgeRaw, 'source'> {
  source: ParentOfSourceValue; // Refined: 1 | 2 | 3 | 4 | 5
}

// ============================================================================
// SUBSIDIARY ENRICHMENT
// ============================================================================

/**
 * Subsidiary enrichment metadata
 * Additional context about subsidiaries from SEC filings
 */
export type SubsidiaryEnrichment = InstaQLEntity<typeof schema, "subsidiary_enrichment">;

// ============================================================================
// COMPANY INFO
// ============================================================================

/**
 * Company information
 * Additional metadata about a company (1:1 relationship)
 */
export type CompanyInfo = InstaQLEntity<typeof schema, "company_info">;

// ============================================================================
// BUSINESS SEGMENT
// ============================================================================

/**
 * Business segment
 * Represents a reportable business segment from financial filings
 */
export type BusinessSegment = InstaQLEntity<typeof schema, "business_segment">;

// ============================================================================
// BRAND
// ============================================================================

/**
 * Brand entity
 * Represents a brand owned by a company
 * Unique per company (composite_key: company_id:name)
 */
export type Brand = InstaQLEntity<typeof schema, "brand">;

// ============================================================================
// OWNERSHIP (BRAND)
// ============================================================================

/**
 * Brand ownership edge
 * Tracks company ownership of brands over time
 */
export type OwnsEdge = InstaQLEntity<typeof schema, "owns">;

// ============================================================================
// AUDIT
// ============================================================================

/**
 * Audit trail record
 * Tracks changes to entities for compliance/debugging
 */
export type Audit = InstaQLEntity<typeof schema, "audit">;

/**
 * Audit field change structure (stored as JSON)
 */
export interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

/**
 * Audit with typed fields_changed
 */
export interface AuditWithChanges extends Omit<Audit, 'fields_changed'> {
  fields_changed: FieldChange[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if company is public or issuer (has CIK)
 */
export function isPublicCompany(company: Company): boolean {
  return company.type === CompanyType.PUBLIC || company.type === CompanyType.ISSUER;
}

/**
 * Check if company is private
 */
export function isPrivateCompany(company: Company): boolean {
  return company.type === CompanyType.PRIVATE;
}

/**
 * Check if relationship is from SEC filing
 */
export function isFromSecFiling(edge: ParentOfEdge): boolean {
  return edge.source === ParentOfSource.SEC_FILING;
}
