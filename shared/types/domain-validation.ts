/**
 * Domain Validation Schemas
 * 
 * Zod schemas for validating domain entities (companies, filings, etc.)
 */

import { z } from "zod";
import { CompanyType } from "./domain";

// ============================================================================
// FIELD VALIDATORS
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

// ============================================================================
// COMPANY VALIDATION
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
// ID GENERATION PARAMS
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
    (refs) => refs.every(ref => {
      // If it's purely numeric, check it doesn't exceed 3 digits
      if (/^\d+$/.test(ref)) {
        return ref.length <= 3;
      }
      // Non-numeric refs (like "iv", "a)", etc.) are allowed
      return true;
    }),
    { message: "Numeric footnoteRefs should not exceed 3 digits" }
  ),
  footnotesHtml: z.string().min(1, { message: "footnotesHtml should not be null or empty" }),
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
