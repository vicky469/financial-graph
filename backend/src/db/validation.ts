import { z } from "zod";

/**
 * Zod Validation Schemas
 *
 * These provide runtime validation for all database operations.
 * Use these to validate data before inserting into InstantDB.
 */

// Shared schemas
const ISODateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
const UUIDString = z.string().uuid();

// Company schemas
export const CompanyTypeSchema = z.enum(["public", "private", "issuer"]);

export const CompanyIdentitySchema = z.object({
  tickers: z.array(z.string()).optional(),
  cik: z.string().length(10).optional(), // 10 digits with leading zeros
  exchange: z.string().optional(),
  lei: z.string().length(20).optional(), // 20-char Legal Entity Identifier
  duns: z.string().length(9).optional(), // 9-digit DUNS number
});

export const CompanySchema = z.object({
  id: UUIDString,
  name: z.string().min(1),
  aliases: z.array(z.string()),
  type: CompanyTypeSchema,
  parent_company_id: UUIDString.nullable(),
  founded_date: ISODateString.nullable(),
  jurisdiction_iso: z.string().nullable(), // ISO 3166-2
  jurisdiction_raw: z.string().nullable(),
  identity: CompanyIdentitySchema,
  created_at: ISODateString,
  updated_at: ISODateString,
});

// Public Info
export const PublicInfoSchema = z.object({
  id: UUIDString,
  company_id: UUIDString,
  sic_code: z.string().length(4).nullable(), // 4-digit SIC code
  industry_sector: z.string().nullable(),
  fiscal_year_end: z.string().length(4).nullable(), // MMDD format
  created_at: ISODateString,
  updated_at: ISODateString,
});

// Business Segment
export const BusinessSegmentTypeSchema = z.enum([
  "operating",
  "geographic",
  "product",
]);

export const BusinessSegmentSchema = z.object({
  id: UUIDString,
  company_id: UUIDString,
  segment_name: z.string().min(1),
  segment_type: BusinessSegmentTypeSchema,
  description: z.string(),
  is_reportable: z.boolean(),
  fiscal_year: z.number().int().min(1900).max(2100),
  fiscal_quarter: z.number().int().min(1).max(4).nullable(),
  revenue: z.number().nullable(),
  operating_income: z.number().nullable(),
  assets: z.number().nullable(),
  created_at: ISODateString,
  updated_at: ISODateString,
});

// Brand
export const BrandStatusSchema = z.enum(["active", "discontinued"]);

export const BrandSchema = z.object({
  id: UUIDString,
  name: z.string().min(1),
  owning_company_id: UUIDString,
  category: z.string().nullable(),
  status: BrandStatusSchema,
  launch_date: ISODateString.nullable(),
  created_at: ISODateString,
  updated_at: ISODateString,
});

// Filing
export const FilingSchema = z.object({
  id: UUIDString,
  company_id: UUIDString,
  accession_number: z.string().regex(/^\d{10}-\d{2}-\d{6}$/), // Format: 0001214659-25-002647
  accession_number_nodashes: z.string().length(18), // Same without dashes
  form_type: z.string().min(1), // e.g., "10-K", "20-F", "EX-21"
  filing_date: ISODateString,
  file_name: z.string().min(1),
  file_url: z.string().url(),
  attachments: z.record(z.string(), z.string()).optional(),
  source_quarter: z.string().regex(/^\d{4}q[1-4]$/), // e.g., "2025q1"
  period_end_date: ISODateString.nullable(),
  fiscal_year: z.number().int().min(1900).max(2100).nullable(),
  fiscal_quarter: z.number().int().min(1).max(4).nullable(),
  created_at: ISODateString,
  updated_at: ISODateString,
});

// M&A Event
export const MaEventTypeSchema = z.enum([
  "acquisition",
  "merger",
  "spinoff",
  "divestiture",
]);
export const MaEventStatusSchema = z.enum([
  "pending",
  "completed",
  "terminated",
]);

export const MaEventSchema = z.object({
  id: UUIDString,
  acquirer_id: UUIDString,
  target_id: UUIDString,
  event_type: MaEventTypeSchema,
  announced_date: ISODateString.nullable(),
  effective_date: ISODateString,
  deal_value: z.number().nullable(),
  deal_value_currency: z.string().length(3), // ISO 4217 (USD, EUR, GBP)
  status: MaEventStatusSchema,
  created_at: ISODateString,
  updated_at: ISODateString,
});

// Company Snapshot
export const CompanySnapshotChangeReasonSchema = z.enum([
  "ma_event",
  "spinoff",
  "ipo",
  "delisting",
  "name_change",
  "manual_correction",
]);

export const CompanySnapshotSchema = z.object({
  id: UUIDString,
  company_id: UUIDString,
  valid_from: ISODateString,
  valid_to: ISODateString.nullable(),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  type: z.enum(["public", "private"]),
  identity: CompanyIdentitySchema,
  change_reason: CompanySnapshotChangeReasonSchema,
  ma_event_id: UUIDString.nullable(),
  created_at: ISODateString,
});

// Edge Schemas
export const ParentOfEdgeSourceSchema = z.enum([
  "ma_event",
  "spinoff",
  "ipo",
  "manual",
  "sec_filing",
]);

export const ParentOfEdgeSchema = z.object({
  id: UUIDString,
  from_company_id: UUIDString,
  to_company_id: UUIDString,
  ownership_percent: z.number().min(0).max(100).nullable(),
  established_date: ISODateString,
  ended_date: ISODateString.nullable(),
  source: ParentOfEdgeSourceSchema,
  source_id: UUIDString.nullable(),
  created_at: ISODateString,
  updated_at: ISODateString,
});

export const OwnsEdgeSchema = z.object({
  id: UUIDString,
  from_company_id: UUIDString,
  to_brand_id: UUIDString,
  acquired_date: ISODateString.nullable(),
  divested_date: ISODateString.nullable(),
  created_at: ISODateString,
  updated_at: ISODateString,
});

export const AcquiredEdgeSchema = z.object({
  id: UUIDString,
  from_company_id: UUIDString,
  to_company_id: UUIDString,
  ma_event_id: UUIDString,
  created_at: ISODateString,
});

export const WasAcquiredByEdgeSchema = z.object({
  id: UUIDString,
  from_company_id: UUIDString,
  to_company_id: UUIDString,
  ma_event_id: UUIDString,
  created_at: ISODateString,
});

export const FiledEdgeSchema = z.object({
  id: UUIDString,
  from_company_id: UUIDString,
  to_filing_id: UUIDString,
  created_at: ISODateString,
});

import { logValidationError } from "../utils/db/validation_logger";

/**
 * Validation helper function
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  schemaName?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as any;
      // Log to file
      logValidationError(schemaName || "UnknownSchema", zodError, data);

      console.error(
        "Validation error:",
        JSON.stringify(zodError.errors, null, 2)
      );
      throw new Error(
        `Validation failed: ${zodError.errors
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
}

/**
 * Partial validation schemas (for upsert operations where not all fields are required)
 */
export const PartialCompanySchema = CompanySchema.partial();
export const PartialFilingSchema = FilingSchema.partial();
export const PartialBrandSchema = BrandSchema.partial();
export const PartialBusinessSegmentSchema = BusinessSegmentSchema.partial();
export const PartialPublicInfoSchema = PublicInfoSchema.partial();
