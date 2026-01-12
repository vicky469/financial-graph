/**
 * Shared Database Types & Validation
 * 
 * InstantDB handles: type checking, required/optional, unique constraints
 * We handle: business logic validation that InstantDB can't express
 * 
 * Types vs Interfaces:
 * - `type` aliases are direct re-exports from InstantDB (InstaQLEntity)
 * - `interface` adds proper typing for enum/JSON fields that InstantDB types as number/any
 * - Code should use the interfaces (Company, ParentOfEdge) not the raw types
 */

import { z } from "zod";
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
} as const;

export type CompanyTypeValue = typeof CompanyType[keyof typeof CompanyType];

export const ParentOfSource = {
  MA_EVENT: 1,
  SPINOFF: 2,
  IPO: 3,
  MANUAL: 4,
  SEC_FILING: 5,
} as const;

export type ParentOfSourceValue = typeof ParentOfSource[keyof typeof ParentOfSource];

// ============================================================================
// RAW TYPES (from InstantDB - don't use directly, use interfaces below)
// ============================================================================

type CompanyRaw = InstaQLEntity<typeof schema, "company">;
type ParentOfEdgeRaw = InstaQLEntity<typeof schema, "parent_of">;

// These are fine to use directly (no enum/JSON fields needing better typing)
export type Filing = InstaQLEntity<typeof schema, "filing">;
export type FilingAttachments = Record<string, string>;
export type SubsidiaryEnrichment = InstaQLEntity<typeof schema, "subsidiary_enrichment">;
export type Audit = InstaQLEntity<typeof schema, "audit">;
// export type CompanyInfo = InstaQLEntity<typeof schema, "company_info">;
// export type BusinessSegment = InstaQLEntity<typeof schema, "business_segment">;
// export type Brand = InstaQLEntity<typeof schema, "brand">;
// export type OwnsEdge = InstaQLEntity<typeof schema, "owns">;

// ============================================================================
// INTERFACES (use these - proper typing for enum/JSON fields)
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
}

/** Company with properly typed `type` (enum) and `identity` (JSON) */
export interface Company extends Omit<CompanyRaw, 'type' | 'identity'> {
  type: CompanyTypeValue;
  identity?: CompanyIdentity;
}

/** ParentOfEdge with properly typed `source` (enum) */
export interface ParentOfEdge extends Omit<ParentOfEdgeRaw, 'source'> {
  source: ParentOfSourceValue;
}

/** JSON structure for audit.fields_changed array items */
export interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

/** Audit with properly typed `fields_changed` (JSON array) */
export interface AuditWithChanges extends Omit<Audit, 'fields_changed'> {
  fields_changed: FieldChange[];
}

// ============================================================================
// FIELD VALIDATORS (business logic InstantDB can't express)
// ============================================================================

export const NonEmptyString = z.string().min(1);
export const IntNumber = z.number().int();

/** CIK: 1-10 digit numeric string, normalized to 10 digits with leading zeros */
export const CIKString = z.string()
  .regex(/^\d{1,10}$/, "CIK must be 1-10 digits")
  .transform((val) => val.trim().padStart(10, '0'));

/** 
 * Accession Number: SEC filing identifier
 * Format: XXXXXXXXXX-XX-XXXXXX (with dashes) or XXXXXXXXXXXXXXXXXX (without)
 * Normalized by removing dashes
 */
export const AccessionNumberString = z.string()
  .min(1, "Accession number is required")
  .transform((val) => val.replace(/-/g, ''));

/** Jurisdiction: rejects numbers/percentages (common parsing errors) */
export const JurisdictionString = z.string().refine(
  (val) => {
    const trimmed = val.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return false;
    if (/^\d+(\.\d+)?%$/.test(trimmed)) return false;
    return true;
  },
  { message: "Jurisdiction cannot be a number or percentage" }
);

// ============================================================================
// COMPANY VALIDATION (type-specific rules)
// ============================================================================

const PublicIssuerIdentitySchema = z.object({
  primaryCIK: CIKString,
  ciks: z.string().optional(),
  tickers: z.string().optional(),
  exchanges: z.string().optional(),
  sp500: z.boolean().optional(),
  lei: z.string().length(20).optional(),
  duns: z.string().length(9).optional(),
});

const PrivateUnknownIdentitySchema = z.object({
  primaryCIK: z.string().optional(),
  ciks: z.string().optional(),
  tickers: z.string().optional(),
  exchanges: z.string().optional(),
  sp500: z.boolean().optional(),
  lei: z.string().length(20).optional(),
  duns: z.string().length(9).optional(),
}).optional();

/** PUBLIC company: requires primaryCIK */
export const PublicCompanySchema = z.object({
  type: z.literal(CompanyType.PUBLIC),
  name: NonEmptyString,
  identity: PublicIssuerIdentitySchema,
  jurisdiction_raw: z.string().optional(),
});

/** PRIVATE company: requires name + jurisdiction */
export const PrivateCompanySchema = z.object({
  type: z.literal(CompanyType.PRIVATE),
  name: NonEmptyString,
  jurisdiction_raw: JurisdictionString,
  identity: PrivateUnknownIdentitySchema,
});

/** ISSUER company: requires primaryCIK */
export const IssuerCompanySchema = z.object({
  type: z.literal(CompanyType.ISSUER),
  name: NonEmptyString,
  identity: PublicIssuerIdentitySchema,
  jurisdiction_raw: z.string().optional(),
});

/** UNKNOWN company: requires name, jurisdiction optional */
export const UnknownCompanySchema = z.object({
  type: z.literal(CompanyType.UNKNOWN),
  name: NonEmptyString,
  jurisdiction_raw: JurisdictionString.optional(),
  identity: PrivateUnknownIdentitySchema,
});

/** TRUST company: requires name, optional CIK */
export const TrustCompanySchema = z.object({
  type: z.literal(CompanyType.TRUST),
  name: NonEmptyString,
  jurisdiction_raw: z.string().optional(),
  identity: PrivateUnknownIdentitySchema,
});

/** Company validation by type */
export const CompanySchema = z.discriminatedUnion("type", [
  PublicCompanySchema,
  PrivateCompanySchema,
  IssuerCompanySchema,
  UnknownCompanySchema,
  TrustCompanySchema,
]);

// ============================================================================
// ID GENERATION PARAMS (for composite key generation)
// ============================================================================

export const ParentOfParamsSchema = z.object({
  parentId: NonEmptyString,
  subsidiaryId: NonEmptyString,
  establishedDate: NonEmptyString.optional(),
});

export const SubsidiaryEnrichmentParamsSchema = z.object({
  companyId: NonEmptyString,
  filingId: NonEmptyString,
});

export const BusinessSegmentParamsSchema = z.object({
  companyId: NonEmptyString,
  segmentName: NonEmptyString,
  fiscalYear: IntNumber,
  fiscalQuarter: IntNumber.nullable(),
});

export const BrandParamsSchema = z.object({
  companyId: NonEmptyString,
  name: NonEmptyString,
});

export const OwnsParamsSchema = z.object({
  companyId: NonEmptyString,
  brandId: NonEmptyString,
});

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isPublicCompany(company: Company): boolean {
  return company.type === CompanyType.PUBLIC || company.type === CompanyType.ISSUER;
}

export function isPrivateCompany(company: Company): boolean {
  return company.type === CompanyType.PRIVATE;
}

export function isFromSecFiling(edge: ParentOfEdge): boolean {
  return edge.source === ParentOfSource.SEC_FILING;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  schemaName?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Validation failed${schemaName ? ` for ${schemaName}` : ""}: ${errors}`);
    }
    throw error;
  }
}

export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
