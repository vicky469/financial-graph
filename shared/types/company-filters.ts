/**
 * Company Categories and Owner Organizations
 * Maps raw database values (with <br> tags) to clean display values
 */

/**
 * Company Categories (SEC Filer Status)
 * Raw values from database may contain <br> tags
 */
export const COMPANY_CATEGORIES = {
  // Empty/leading br tag
  "<br>Emerging growth company": "Emerging growth company",
  
  // Accelerated filer variations
  "Accelerated filer": "Accelerated filer",
  "Accelerated filer<br>Emerging growth company": "Accelerated filer Emerging growth company",
  "Accelerated filer<br>Smaller reporting company": "Accelerated filer Smaller reporting company",
  "Accelerated filer<br>Smaller reporting company<br>Emerging growth company": "Accelerated filer Smaller reporting company Emerging growth company",
  
  // Large accelerated filer variations
  "Large Accelerated": "Large Accelerated",
  "Large Accelerated<br>Well Known Seasoned Issuer": "Large Accelerated Well Known Seasoned Issuer",
  "Large accelerated filer": "Large accelerated filer",
  "Large accelerated filer<br>Smaller reporting company": "Large accelerated filer Smaller reporting company",
  
  // Non-accelerated filer variations
  "Non-accelerated filer": "Non-accelerated filer",
  "Non-accelerated filer<br>Emerging growth company": "Non-accelerated filer Emerging growth company",
  "Non-accelerated filer<br>Smaller reporting company": "Non-accelerated filer Smaller reporting company",
  "Non-accelerated filer<br>Smaller reporting company<br>Emerging growth company": "Non-accelerated filer Smaller reporting company Emerging growth company",
  
  // Smaller reporting company
  "Smaller reporting company": "Smaller reporting company",
} as const;

/**
 * Owner Organizations (SEC Division/Office)
 * These values are clean and don't need mapping
 */
export const OWNER_ORGS = [
  "01 Energy & Transportation",
  "02 Finance",
  "03 Life Sciences",
  "04 Manufacturing",
  "05 Real Estate & Construction",
  "06 Technology",
  "07 Trade & Services",
  "08 Industrial Applications and Services",
  "09 Crypto Assets",
  "International Corp Fin",
  "Office of Structured Finance",
] as const;

/**
 * Entity Types
 * Types of business entities
 */
export const ENTITY_TYPES = [
  "investment",
  "operating",
  "other",
] as const;

/**
 * Type for raw category values (as stored in database)
 */
export type RawCompanyCategory = keyof typeof COMPANY_CATEGORIES;

/**
 * Type for clean category values (for display)
 */
export type CleanCompanyCategory = typeof COMPANY_CATEGORIES[RawCompanyCategory];

/**
 * Type for owner organization values
 */
export type OwnerOrg = typeof OWNER_ORGS[number];

/**
 * Type for entity type values
 */
export type EntityType = typeof ENTITY_TYPES[number];

/**
 * Get clean category display value from raw database value
 * @param rawCategory - Raw category value from database (may contain <br> tags)
 * @returns Clean category value for display
 */
export function getCleanCategory(rawCategory: string | undefined | null): string | undefined {
  if (!rawCategory) return undefined;
  
  // Direct mapping if exists
  if (rawCategory in COMPANY_CATEGORIES) {
    return COMPANY_CATEGORIES[rawCategory as RawCompanyCategory];
  }
  
  // Fallback: clean up any <br> tags dynamically
  return rawCategory
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get all unique clean category values
 * @returns Array of clean category values
 */
export function getAllCleanCategories(): string[] {
  return Array.from(new Set(Object.values(COMPANY_CATEGORIES))).sort();
}

/**
 * Get all owner organization values
 * @returns Array of owner organization values
 */
export function getAllOwnerOrgs(): OwnerOrg[] {
  return [...OWNER_ORGS];
}

/**
 * Check if a value is a valid owner organization
 * @param value - Value to check
 * @returns True if valid owner org
 */
export function isValidOwnerOrg(value: string): value is OwnerOrg {
  return OWNER_ORGS.includes(value as OwnerOrg);
}

/**
 * Get all entity type values
 * @returns Array of entity type values
 */
export function getAllEntityTypes(): EntityType[] {
  return [...ENTITY_TYPES];
}

/**
 * Check if a value is a valid entity type
 * @param value - Value to check
 * @returns True if valid entity type
 */
export function isValidEntityType(value: string): value is EntityType {
  return ENTITY_TYPES.includes(value as EntityType);
}
