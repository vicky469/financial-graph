/**
 * Deterministic ID Generation for InstantDB
 *
 * Benefits:
 * - Deterministic: Same input always produces the same UUID
 * - Idempotent: Upserts with identical data update the same record
 * - No redundancy: No need for separate composite_key column
 * - Compatible: UUID v5 format works with InstantDB's ID requirements
 */

import { v5 as uuidv5 } from 'uuid';
import { 
  CompanyType, 
  type CompanyIdentity,
  PublicCompanySchema,
  IssuerCompanySchema,
  PrivateCompanySchema,
  SubsidiaryCompanySchema,
  UnknownCompanySchema,
  AccessionNumberString,
  ParentOfParamsSchema,
  SubsidiaryEnrichmentParamsSchema,
  BusinessSegmentParamsSchema,
  BrandParamsSchema,
  OwnsParamsSchema,
} from './types';

/**
 * Namespace UUIDs for each entity type.
 * These are used with UUID v5 to generate deterministic IDs.
 * Each namespace ensures IDs are unique within their entity type.
 */
export const NAMESPACES = {
  /** Namespace for company entity IDs */
  COMPANY: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  /** Namespace for filing entity IDs */
  FILING: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  /** Namespace for parent_of relationship IDs */
  PARENT_OF: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  /** Namespace for subsidiary_enrichment entity IDs */
  SUBSIDIARY_ENRICHMENT: '6ba7b813-9dad-11d1-80b4-00c04fd430c8',
  /** Namespace for business_segment entity IDs */
  BUSINESS_SEGMENT: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
  /** Namespace for brand entity IDs */
  BRAND: '6ba7b815-9dad-11d1-80b4-00c04fd430c8',
  /** Namespace for owns relationship IDs */
  OWNS: '6ba7b816-9dad-11d1-80b4-00c04fd430c8',
  /** Namespace for company_info entity IDs */
  COMPANY_INFO: '6ba7b817-9dad-11d1-80b4-00c04fd430c8',
} as const;

export type NamespaceKey = keyof typeof NAMESPACES;

// ============================================================================
// COMPANY ID GENERATION
// ============================================================================

/**
 * Company data required for ID generation
 */
export interface CompanyIdInput {
  type: number;
  name?: string;
  jurisdiction_raw?: string;
  identity?: CompanyIdentity;
}

/**
 * Generate a deterministic UUID v5 ID for a company.
 * @param company - Company data with type and required fields
 * @returns UUID v5 string
 */
export function generateCompanyId(company: CompanyIdInput): string {
  switch (company.type) {
    case CompanyType.PUBLIC: {
      const validated = PublicCompanySchema.parse(company);
      return uuidv5(`${company.type}:${validated.identity.primaryCIK}`, NAMESPACES.COMPANY);
    }

    case CompanyType.ISSUER: {
      const validated = IssuerCompanySchema.parse(company);
      return uuidv5(`${company.type}:${validated.identity.primaryCIK}`, NAMESPACES.COMPANY);
    }

    case CompanyType.PRIVATE: {
      const validated = PrivateCompanySchema.parse(company);
      const normalizedName = validated.name.trim().toLowerCase();
      const normalizedJurisdiction = validated.jurisdiction_raw.trim().toLowerCase();
      return uuidv5(
        `${company.type}:${normalizedName}:${normalizedJurisdiction}`,
        NAMESPACES.COMPANY,
      );
    }

    case CompanyType.SUBSIDIARY: {
      const validated = SubsidiaryCompanySchema.parse(company);
      const normalizedName = validated.name.trim().toLowerCase();
      const normalizedJurisdiction = validated.jurisdiction_raw?.trim().toLowerCase();
      const compositeString = normalizedJurisdiction
        ? `${company.type}:${normalizedName}:${normalizedJurisdiction}`
        : `${company.type}:${normalizedName}`;
      return uuidv5(compositeString, NAMESPACES.COMPANY);
    }

    default: {
      const validated = UnknownCompanySchema.parse(company);
      const normalizedName = validated.name.trim().toLowerCase();
      const normalizedJurisdiction = validated.jurisdiction_raw?.trim().toLowerCase() || '';
      const compositeString = normalizedJurisdiction
        ? `${company.type}:${normalizedName}:${normalizedJurisdiction}`
        : `${company.type}:${normalizedName}`;
      return uuidv5(compositeString, NAMESPACES.COMPANY);
    }
  }
}

// ============================================================================
// FILING ID GENERATION
// ============================================================================

/**
 * Generate a deterministic UUID v5 ID for a filing.
 * 
 * @param accessionNumber - SEC accession number (e.g., "0001193125-24-123456" or "0001193125241234567")
 * @returns UUID v5 string
 * @throws ZodError if accession number is invalid
 * 
 * @example
 * generateFilingId("0001193125-24-123456") // Returns UUID v5
 * generateFilingId("0001193125241234567")  // Returns same UUID v5 (normalized)
 */
export function generateFilingId(accessionNumber: string): string {
  const normalized = AccessionNumberString.parse(accessionNumber);
  return uuidv5(normalized, NAMESPACES.FILING);
}

// ============================================================================
// RELATIONSHIP ENTITY ID GENERATION
// ============================================================================

/**
 * Generate a deterministic UUID v5 ID for a parent_of relationship.
 * 
 * @param parentId - UUID of the parent company
 * @param subsidiaryId - UUID of the subsidiary company
 * @returns UUID v5 string
 * @throws ZodError if parentId or subsidiaryId is empty
 * 
 * @example
 * generateParentOfId("parent-uuid", "subsidiary-uuid")
 */
export function generateParentOfId(
  parentId: string,
  subsidiaryId: string
): string {
  ParentOfParamsSchema.parse({ parentId, subsidiaryId });
  const compositeString = `${parentId}:${subsidiaryId}`;
  return uuidv5(compositeString, NAMESPACES.PARENT_OF);
}

/**
 * Generate a deterministic UUID v5 ID for a subsidiary_enrichment.
 * 
 * @param companyId - UUID of the company
 * @param filingId - UUID of the filing
 * @returns UUID v5 string
 * @throws ZodError if companyId or filingId is empty
 * 
 * @example
 * generateSubsidiaryEnrichmentId("company-uuid", "filing-uuid")
 */
export function generateSubsidiaryEnrichmentId(
  companyId: string,
  filingId: string
): string {
  SubsidiaryEnrichmentParamsSchema.parse({ companyId, filingId });
  const compositeString = `${companyId}:${filingId}`;
  return uuidv5(compositeString, NAMESPACES.SUBSIDIARY_ENRICHMENT);
}

/**
 * Generate a deterministic UUID v5 ID for an owns relationship.
 * 
 * @param companyId - UUID of the owning company
 * @param brandId - UUID of the brand
 * @returns UUID v5 string
 * @throws ZodError if companyId or brandId is empty
 * 
 * @example
 * generateOwnsId("company-uuid", "brand-uuid")
 */
export function generateOwnsId(
  companyId: string,
  brandId: string
): string {
  OwnsParamsSchema.parse({ companyId, brandId });
  const compositeString = `${companyId}:${brandId}`;
  return uuidv5(compositeString, NAMESPACES.OWNS);
}

/**
 * Generate a deterministic UUID v5 ID for a business_segment.
 * 
 * @param companyId - UUID of the company
 * @param segmentName - Name of the business segment
 * @param fiscalYear - Fiscal year (integer)
 * @param fiscalQuarter - Fiscal quarter (1-4) or null for annual
 * @returns UUID v5 string
 * @throws ZodError if required fields are invalid
 * 
 * @example
 * generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1)
 * generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, null) // Annual
 */
export function generateBusinessSegmentId(
  companyId: string,
  segmentName: string,
  fiscalYear: number,
  fiscalQuarter: number | null
): string {
  BusinessSegmentParamsSchema.parse({ companyId, segmentName, fiscalYear, fiscalQuarter });
  const normalizedName = segmentName.trim().toLowerCase();
  const quarter = fiscalQuarter !== null ? fiscalQuarter.toString() : 'null';
  const compositeString = `${companyId}:${normalizedName}:${fiscalYear}:${quarter}`;
  return uuidv5(compositeString, NAMESPACES.BUSINESS_SEGMENT);
}

/**
 * Generate a deterministic UUID v5 ID for a brand.
 * 
 * @param companyId - UUID of the owning company
 * @param name - Name of the brand
 * @returns UUID v5 string
 * @throws ZodError if companyId or name is empty
 * 
 * @example
 * generateBrandId("company-uuid", "iPhone")
 */
export function generateBrandId(
  companyId: string,
  name: string
): string {
  BrandParamsSchema.parse({ companyId, name });
  const normalizedName = name.trim().toLowerCase();
  const compositeString = `${companyId}:${normalizedName}`;
  return uuidv5(compositeString, NAMESPACES.BRAND);
}

/**
 * Generate a deterministic UUID v5 ID for company_info.
 * 
 * @param companyId - UUID of the company
 * @returns UUID v5 string
 * 
 * @example
 * generateCompanyInfoId("company-uuid")
 */
export function generateCompanyInfoId(companyId: string): string {
  if (!companyId || companyId.trim().length === 0) {
    throw new Error("companyId is required for company_info ID generation");
  }
  return uuidv5(companyId, NAMESPACES.COMPANY_INFO);
}
