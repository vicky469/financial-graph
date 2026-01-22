/**
 * Company Categories and Owner Organizations
 * Maps raw database values (with <br> tags) to clean display values
 */

/**
 * Company Category Definition
 */
interface CategoryDefinition {
  rank: number;
  raw: string;
  display: string;
}

/**
 * Company Categories (SEC Filer Status)
 * Ranked by company size and market significance (1 = largest/most important)
 */
const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  // Tier 1: Largest, most established public companies (2,311 companies)
  { rank: 1, raw: "Large accelerated filer", display: "Large accelerated filer" },
  { rank: 2, raw: "Large Accelerated<br>Well Known Seasoned Issuer", display: "Large Accelerated Well Known Seasoned Issuer" },
  { rank: 3, raw: "Large Accelerated", display: "Large Accelerated" },
  { rank: 4, raw: "Large accelerated filer<br>Smaller reporting company", display: "Large accelerated filer Smaller reporting company" },
  
  // Tier 2: Mid-sized public companies (837 companies)
  { rank: 5, raw: "Accelerated filer", display: "Accelerated filer" },
  { rank: 6, raw: "Accelerated filer<br>Emerging growth company", display: "Accelerated filer Emerging growth company" },
  { rank: 7, raw: "Accelerated filer<br>Smaller reporting company", display: "Accelerated filer Smaller reporting company" },
  { rank: 8, raw: "Accelerated filer<br>Smaller reporting company<br>Emerging growth company", display: "Accelerated filer Smaller reporting company Emerging growth company" },
  
  // Tier 3: Smaller public companies (2,676 companies)
  { rank: 9, raw: "Non-accelerated filer", display: "Non-accelerated filer" },
  { rank: 10, raw: "Non-accelerated filer<br>Emerging growth company", display: "Non-accelerated filer Emerging growth company" },
  { rank: 11, raw: "Non-accelerated filer<br>Smaller reporting company", display: "Non-accelerated filer Smaller reporting company" },
  { rank: 12, raw: "Non-accelerated filer<br>Smaller reporting company<br>Emerging growth company", display: "Non-accelerated filer Smaller reporting company Emerging growth company" },
  
  // Tier 4: Smallest reporting companies (926 companies)
  { rank: 13, raw: "Smaller reporting company", display: "Smaller reporting company" },
  { rank: 14, raw: "<br>Emerging growth company", display: "Emerging growth company" },
];

/**
 * Build lookup maps from definitions
 */
const CATEGORY_RANK = Object.fromEntries(
  CATEGORY_DEFINITIONS.map(def => [def.display, def.rank])
);

export const COMPANY_CATEGORIES = Object.fromEntries(
  CATEGORY_DEFINITIONS.map(def => [def.raw, def.display])
) as Record<string, string>;

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
 * Get all unique clean category values sorted by importance
 * @returns Array of clean category values in ranked order
 */
export function getAllCleanCategories(): string[] {
  const uniqueCategories = Array.from(new Set(Object.values(COMPANY_CATEGORIES)));
  
  // Sort by rank (lower number = higher importance)
  return uniqueCategories.sort((a, b) => {
    const rankA = CATEGORY_RANK[a] ?? 999;
    const rankB = CATEGORY_RANK[b] ?? 999;
    return rankA - rankB;
  });
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
