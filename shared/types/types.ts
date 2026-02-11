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
  SUBSIDIARY: 6,
} as const;

export type CompanyTypeValue = (typeof CompanyType)[keyof typeof CompanyType];

export const ParentOfSource = {
  MA_EVENT: 1,
  SPINOFF: 2,
  IPO: 3,
  MANUAL: 4,
  SUBSIDIARY_FILING: 5,
} as const;

export type ParentOfSourceValue =
  (typeof ParentOfSource)[keyof typeof ParentOfSource];

// ============================================================================
// RAW TYPES (from InstantDB - don't use directly, use interfaces below)
// ============================================================================

type CompanyRaw = InstaQLEntity<typeof schema, "company">;
type ParentOfEdgeRaw = InstaQLEntity<typeof schema, "parent_of">;

// These are fine to use directly (no enum/JSON fields needing better typing)
export type Filing = InstaQLEntity<typeof schema, "filing">;
export type FilingAttachments = Record<string, string>;
export type SubsidiaryEnrichment = InstaQLEntity<
  typeof schema,
  "subsidiary_enrichment"
>;
export type Audit = InstaQLEntity<typeof schema, "audit">;
export type NoteRaw = InstaQLEntity<typeof schema, "notes">;
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
// TIPTAP JSON TYPES
// ============================================================================

/** Tiptap mark (formatting like bold, italic, link) */
export interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

/** Tiptap node (content element like paragraph, text, custom nodes) */
export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

/** Tiptap JSON document structure */
export interface TiptapJSON {
  type: "doc";
  content?: TiptapNode[];
}

/** Note with properly typed `content` (Tiptap JSON) and `createdBy` */
export interface Note extends Omit<
  NoteRaw,
  "content" | "createdBy" | "createdAt" | "updatedAt"
> {
  content: TiptapJSON;
  createdBy: "user" | "system";
  createdAt: number; // InstantDB returns timestamps as numbers
  updatedAt: number; // InstantDB returns timestamps as numbers
  mentionedCompanyIds?: string[]; // Array of company IDs mentioned in the note
  visibility: "private" | "public"; // Note visibility setting, defaults to 'private'
  user?: {
    id: string;
    email?: string;
  };
  company?: {
    id: string;
    name: string;
  };
}

/** Extended type for displaying backlink notes */
export interface BacklinkNote extends Note {
  isBacklink: boolean; // True if this note mentions the current company
  sourceCompanyId: string; // The primary company this note belongs to
  sourceCompanyName: string; // Name of the source company
}

// ============================================================================
// FIELD VALIDATORS (business logic InstantDB can't express)
// ============================================================================

export const NonEmptyString = z.string().min(1);
export const IntNumber = z.number().int();

/** CIK: 1-10 digit numeric string, normalized to 10 digits with leading zeros */
export const CIKString = z
  .string()
  .regex(/^\d{1,10}$/, "CIK must be 1-10 digits")
  .transform((val) => val.trim().padStart(10, "0"));

/**
 * Accession Number: SEC filing identifier
 * Format: XXXXXXXXXX-XX-XXXXXX (with dashes) or XXXXXXXXXXXXXXXXXX (without)
 * Normalized by removing dashes
 */
export const AccessionNumberString = z
  .string()
  .min(1, "Accession number is required")
  .refine((val) => /^\d{10}-\d{2}-\d{6}$/.test(val) || /^\d{18}$/.test(val), {
    message:
      "Accession number must be 18 digits (NNNNNNNNNN-NN-NNNNNN or NNNNNNNNNNNNNNNNNN)",
  })
  .transform((val) => val.replace(/-/g, ""));

/** Jurisdiction: rejects numbers/percentages (common parsing errors) */
export const JurisdictionString = z.string().refine(
  (val) => {
    const trimmed = val.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return false;
    if (/^\d+(\.\d+)?%$/.test(trimmed)) return false;
    return true;
  },
  { message: "Jurisdiction cannot be a number or percentage" },
);

// Filing validation
export const FilingDataSchema = z.object({
  accession_number: z
    .string()
    .min(20, "Accession number is required")
    .refine((val) => val.includes("-"), {
      message:
        "Accession number must contain dashes (not the malformed format without dashes)",
    }),
  company_id: z.string().min(1),
  form_type: z.string().min(1),
  filing_date: z.string(),
  file_url: z.string(),
  source_quarter: z.number().int().min(1).max(4),
  source_year: z.number().int().min(1990).max(2030),
});

export * from "./featureFlags";

// ============================================================================
// COMPANY VALIDATION (type-specific rules)
// ============================================================================

const CompanyIdentitySchema = z.object({
  primaryCIK: CIKString.optional(),
  ciks: z.string().optional(),
  tickers: z.string().optional(),
  exchanges: z.string().optional(),
  sp500: z.boolean().optional(),
  lei: z.string().length(20).optional(),
  duns: z.string().length(9).optional(),
  entityType: z.string().optional(),
  sic: z.string().optional(),
  sicDescription: z.string().optional(),
  ein: z.string().optional(),
  category: z.string().optional(),
  ownerOrg: z.string().optional(),
});

/** PUBLIC company: requires name, identity required */
export const PublicCompanySchema = z.object({
  type: z.literal(CompanyType.PUBLIC),
  name: NonEmptyString,
  identity: CompanyIdentitySchema,
  jurisdiction_raw: z.string().optional(),
});

/** PRIVATE company: requires name + jurisdiction, identity optional */
export const PrivateCompanySchema = z.object({
  type: z.literal(CompanyType.PRIVATE),
  name: NonEmptyString,
  jurisdiction_raw: JurisdictionString,
  identity: CompanyIdentitySchema.optional(),
});

/** ISSUER company: requires name, identity required */
export const IssuerCompanySchema = z.object({
  type: z.literal(CompanyType.ISSUER),
  name: NonEmptyString,
  identity: CompanyIdentitySchema,
  jurisdiction_raw: z.string().optional(),
});

/** UNKNOWN company: requires name, jurisdiction optional, identity optional */
export const UnknownCompanySchema = z.object({
  type: z.literal(CompanyType.UNKNOWN),
  name: NonEmptyString,
  jurisdiction_raw: JurisdictionString.optional(),
  identity: CompanyIdentitySchema.optional(),
});

/** TRUST company: requires name, identity optional */
export const TrustCompanySchema = z.object({
  type: z.literal(CompanyType.TRUST),
  name: NonEmptyString,
  jurisdiction_raw: z.string().optional(),
  identity: CompanyIdentitySchema.optional(),
});

/** SUBSIDIARY company: requires name + jurisdiction, identity optional */
export const SubsidiaryCompanySchema = z.object({
  type: z.literal(CompanyType.SUBSIDIARY),
  name: NonEmptyString,
  jurisdiction_raw: JurisdictionString,
  identity: CompanyIdentitySchema.optional(),
});

/** Company validation by type */
export const CompanySchema = z.discriminatedUnion("type", [
  PublicCompanySchema,
  PrivateCompanySchema,
  IssuerCompanySchema,
  UnknownCompanySchema,
  TrustCompanySchema,
  SubsidiaryCompanySchema,
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

// Validation schema for subsidiary enrichment data
export const SubsidiaryEnrichmentDataSchema = z.object({
  footnoteRefs: z.array(z.string()).refine(
    (refs) =>
      refs.every((ref) => {
        // If it's purely numeric, check it doesn't exceed 3 digits
        if (/^\d+$/.test(ref)) {
          return ref.length <= 3;
        }
        // Non-numeric refs (like "iv", "a)", etc.) are allowed
        return true;
      }),
    { message: "Numeric footnoteRefs should not exceed 3 digits" },
  ),
  footnotesHtml: z
    .string()
    .min(1, { message: "footnotesHtml should not be null or empty" }),
  updated_at: z.string(),
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

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  schemaName?: string,
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new Error(
        `Validation failed${schemaName ? ` for ${schemaName}` : ""}: ${errors}`,
      );
    }
    throw error;
  }
}

export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
