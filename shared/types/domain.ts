/**
 * Domain Types
 * 
 * Core business domain types for companies, filings, and relationships
 */

import type { InstaQLEntity } from "@instantdb/core";
import type schema from "../instant.schema";

// ============================================================================
// ENUMS
// ============================================================================

export const CompanyType = {
  PUBLIC: 1,
  PRIVATE: 2,
  ISSUER: 3,
  UNKNOWN: 4,
  TRUST: 5,
  SUBSIDIARY: 6
} as const;

export type CompanyTypeValue = (typeof CompanyType)[keyof typeof CompanyType];

export const ParentOfSource = {
  MA_EVENT: 1,
  SPINOFF: 2,
  IPO: 3,
  MANUAL: 4,
  SEC_FILING: 5,
} as const;

export type ParentOfSourceValue = (typeof ParentOfSource)[keyof typeof ParentOfSource];

// ============================================================================
// RAW TYPES (from InstantDB)
// ============================================================================

type CompanyRaw = InstaQLEntity<typeof schema, "company">;
type ParentOfEdgeRaw = InstaQLEntity<typeof schema, "parent_of">;

export type Filing = InstaQLEntity<typeof schema, "filing">;
export type FilingAttachments = Record<string, string>;
export type SubsidiaryEnrichment = InstaQLEntity<typeof schema, "subsidiary_enrichment">;
export type Audit = InstaQLEntity<typeof schema, "audit">;

// ============================================================================
// DOMAIN INTERFACES
// ============================================================================

/** JSON structure for company.identity field */
export interface CompanyIdentity {
  primaryCIK?: string;
  ciks?: string;
  tickers?: string;
  exchanges?: string;
  sp500?: boolean;
  lei?: string;
  duns?: string;
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  ein?: string;
  category?: string;
  ownerOrg?: string;
}

/** Company with properly typed `type` (enum) and `identity` (JSON) */
export interface Company extends Omit<CompanyRaw, "type" | "identity"> {
  type: CompanyTypeValue;
  identity?: CompanyIdentity;
}

/** ParentOfEdge with properly typed `source` (enum) */
export interface ParentOfEdge extends Omit<ParentOfEdgeRaw, "source"> {
  source: ParentOfSourceValue;
}

/** JSON structure for audit.fields_changed array items */
export interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

/** Audit with properly typed `fields_changed` (JSON array) */
export interface AuditWithChanges extends Omit<Audit, "fields_changed"> {
  fields_changed: FieldChange[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isPublicCompany(company: Company): boolean {
  return (
    company.type === CompanyType.PUBLIC || company.type === CompanyType.ISSUER
  );
}

export function isPrivateCompany(company: Company): boolean {
  return company.type === CompanyType.PRIVATE;
}

export function isFromSecFiling(edge: ParentOfEdge): boolean {
  return edge.source === ParentOfSource.SEC_FILING;
}
