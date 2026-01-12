/**
 * Property-Based Tests for ID Generation
 * 
 * Feature: deterministic-id-generation
 * Validates: Requirements 1.1, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { 
  generateCompanyId, 
  generateFilingId,
  generateParentOfId,
  generateSubsidiaryEnrichmentId,
  generateOwnsId,
  generateBusinessSegmentId,
  generateBrandId,
  NAMESPACES 
} from "../types/ids";
import { CompanyType } from "../types/types";

// UUID v5 regex pattern - version field is '5', variant is '8', '9', 'a', or 'b'
const UUID_V5_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ============================================================================
// GENERATORS
// ============================================================================

/**
 * Generator for valid CIK strings (1-10 digits)
 */
const cikArbitrary = fc.stringMatching(/^[0-9]{1,10}$/);

/**
 * Generator for non-empty company names (avoiding pure whitespace)
 */
const companyNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for valid jurisdiction strings (non-numeric, non-percentage)
 */
const jurisdictionArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => {
    const trimmed = s.trim();
    if (trimmed.length === 0) return false;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return false;
    if (/^\d+(\.\d+)?%$/.test(trimmed)) return false;
    return true;
  });

/**
 * Generator for PUBLIC company input
 */
const publicCompanyArbitrary = fc.record({
  type: fc.constant(CompanyType.PUBLIC),
  name: companyNameArbitrary,
  identity: fc.record({
    primaryCIK: cikArbitrary,
  }),
});

/**
 * Generator for ISSUER company input
 */
const issuerCompanyArbitrary = fc.record({
  type: fc.constant(CompanyType.ISSUER),
  name: companyNameArbitrary,
  identity: fc.record({
    primaryCIK: cikArbitrary,
  }),
});

/**
 * Generator for PRIVATE company input
 */
const privateCompanyArbitrary = fc.record({
  type: fc.constant(CompanyType.PRIVATE),
  name: companyNameArbitrary,
  jurisdiction_raw: jurisdictionArbitrary,
});

/**
 * Generator for UNKNOWN company input
 */
const unknownCompanyArbitrary = fc.record({
  type: fc.constant(CompanyType.UNKNOWN),
  name: companyNameArbitrary,
  jurisdiction_raw: fc.option(jurisdictionArbitrary, { nil: undefined }),
});

/**
 * Generator for any valid company input
 */
const anyCompanyArbitrary = fc.oneof(
  publicCompanyArbitrary,
  issuerCompanyArbitrary,
  privateCompanyArbitrary,
  unknownCompanyArbitrary,
);

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe("Company ID Generation - Property Tests", () => {
  /**
   * Property 1: Deterministic ID Generation (Idempotence)
   * 
   * *For any* entity data, calling the ID generator multiple times with 
   * identical input SHALL produce identical UUID v5 outputs.
   * 
   * **Validates: Requirements 1.4**
   */
  test("Property 1: Deterministic ID Generation - same input produces same ID", () => {
    fc.assert(
      fc.property(anyCompanyArbitrary, (company) => {
        const id1 = generateCompanyId(company);
        const id2 = generateCompanyId(company);
        const id3 = generateCompanyId(company);
        
        expect(id1).toBe(id2);
        expect(id2).toBe(id3);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: UUID v5 Format Validity
   * 
   * *For any* entity data, the generated ID SHALL be a valid UUID v5 in the 
   * format `xxxxxxxx-xxxx-5xxx-xxxx-xxxxxxxxxxxx` where the version field is `5`.
   * 
   * **Validates: Requirements 1.1**
   */
  test("Property 2: UUID v5 Format Validity - all IDs match UUID v5 format", () => {
    fc.assert(
      fc.property(anyCompanyArbitrary, (company) => {
        const id = generateCompanyId(company);
        
        expect(id).toMatch(UUID_V5_REGEX);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Uniqueness Property
   * 
   * *For any* two different entity data inputs, the generated UUID v5 IDs 
   * SHALL be different (with cryptographic probability).
   * 
   * **Validates: Requirements 1.5**
   */
  test("Property 3: Uniqueness Property - different inputs produce different IDs", () => {
    fc.assert(
      fc.property(
        anyCompanyArbitrary,
        anyCompanyArbitrary,
        (company1, company2) => {
          // Skip if inputs are semantically identical
          const isSameInput = areSemanticallyEqual(company1, company2);
          
          if (!isSameInput) {
            const id1 = generateCompanyId(company1);
            const id2 = generateCompanyId(company2);
            
            expect(id1).not.toBe(id2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Property: CIK Normalization
   * 
   * *For any* PUBLIC/ISSUER company, CIKs with different leading zeros 
   * should produce the same ID (normalized to 10 digits).
   * 
   * **Validates: Requirements 1.4 (deterministic after normalization)**
   */
  test("Property 1 (extended): CIK normalization produces consistent IDs", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(CompanyType.PUBLIC), fc.constant(CompanyType.ISSUER)),
        companyNameArbitrary,
        cikArbitrary,
        (type, name, cik) => {
          // Create two companies with same CIK but different padding
          const company1 = {
            type,
            name,
            identity: { primaryCIK: cik },
          };
          const company2 = {
            type,
            name,
            identity: { primaryCIK: cik.padStart(10, '0') },
          };
          
          const id1 = generateCompanyId(company1);
          const id2 = generateCompanyId(company2);
          
          expect(id1).toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Property: Case Insensitivity for PRIVATE/UNKNOWN
   * 
   * *For any* PRIVATE company, name and jurisdiction with different 
   * casing should produce the same ID.
   * 
   * **Validates: Requirements 1.4 (deterministic after normalization)**
   */
  test("Property 1 (extended): Case normalization produces consistent IDs for PRIVATE companies", () => {
    fc.assert(
      fc.property(
        companyNameArbitrary,
        jurisdictionArbitrary,
        (name, jurisdiction) => {
          const company1 = {
            type: CompanyType.PRIVATE,
            name: name.toLowerCase(),
            jurisdiction_raw: jurisdiction.toLowerCase(),
          };
          const company2 = {
            type: CompanyType.PRIVATE,
            name: name.toUpperCase(),
            jurisdiction_raw: jurisdiction.toUpperCase(),
          };
          
          const id1 = generateCompanyId(company1);
          const id2 = generateCompanyId(company2);
          
          expect(id1).toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if two company inputs are semantically equal (would produce same ID)
 */
function areSemanticallyEqual(c1: any, c2: any): boolean {
  if (c1.type !== c2.type) return false;
  
  if (c1.type === CompanyType.PUBLIC || c1.type === CompanyType.ISSUER) {
    // For PUBLIC/ISSUER, compare normalized CIKs
    const cik1 = c1.identity?.primaryCIK?.padStart(10, '0');
    const cik2 = c2.identity?.primaryCIK?.padStart(10, '0');
    return cik1 === cik2;
  }
  
  if (c1.type === CompanyType.PRIVATE) {
    // For PRIVATE, compare normalized name + jurisdiction
    const name1 = c1.name?.trim().toLowerCase();
    const name2 = c2.name?.trim().toLowerCase();
    const jur1 = c1.jurisdiction_raw?.trim().toLowerCase();
    const jur2 = c2.jurisdiction_raw?.trim().toLowerCase();
    return name1 === name2 && jur1 === jur2;
  }
  
  // For UNKNOWN, compare normalized name + optional jurisdiction
  const name1 = c1.name?.trim().toLowerCase();
  const name2 = c2.name?.trim().toLowerCase();
  const jur1 = c1.jurisdiction_raw?.trim().toLowerCase() || '';
  const jur2 = c2.jurisdiction_raw?.trim().toLowerCase() || '';
  return name1 === name2 && jur1 === jur2;
}


// ============================================================================
// RELATIONSHIP ID GENERATORS
// ============================================================================

/**
 * Generator for valid UUID strings (used as entity IDs)
 */
const uuidArbitrary = fc.uuid();

/**
 * Generator for non-empty strings (used for segment names, brand names)
 */
const nonEmptyStringArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for fiscal year (reasonable range)
 */
const fiscalYearArbitrary = fc.integer({ min: 1990, max: 2100 });

/**
 * Generator for fiscal quarter (1-4 or null for annual)
 */
const fiscalQuarterArbitrary = fc.oneof(
  fc.integer({ min: 1, max: 4 }),
  fc.constant(null)
);

// ============================================================================
// RELATIONSHIP ID PROPERTY TESTS
// ============================================================================

describe("Relationship ID Generation - Property Tests", () => {
  /**
   * Property 5: Component Inclusion - parent_of
   * 
   * *For any* parent_of relationship, changing any component of the composite key
   * (parentId, subsidiaryId) SHALL produce a different UUID v5.
   * 
   * **Validates: Requirements 2.1**
   */
  test("Property 5a: parent_of - changing parentId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        (parentId1, parentId2, subsidiaryId) => {
          // Skip if parentIds are the same
          if (parentId1 === parentId2) return;
          
          const id1 = generateParentOfId(parentId1, subsidiaryId);
          const id2 = generateParentOfId(parentId2, subsidiaryId);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5a: parent_of - changing subsidiaryId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        (parentId, subsidiaryId1, subsidiaryId2) => {
          // Skip if subsidiaryIds are the same
          if (subsidiaryId1 === subsidiaryId2) return;
          
          const id1 = generateParentOfId(parentId, subsidiaryId1);
          const id2 = generateParentOfId(parentId, subsidiaryId2);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Component Inclusion - subsidiary_enrichment
   * 
   * *For any* subsidiary_enrichment, changing any component of the composite key
   * (companyId, filingId) SHALL produce a different UUID v5.
   * 
   * **Validates: Requirements 2.2**
   */
  test("Property 5b: subsidiary_enrichment - changing companyId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        (companyId1, companyId2, filingId) => {
          // Skip if companyIds are the same
          if (companyId1 === companyId2) return;
          
          const id1 = generateSubsidiaryEnrichmentId(companyId1, filingId);
          const id2 = generateSubsidiaryEnrichmentId(companyId2, filingId);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5b: subsidiary_enrichment - changing filingId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        (companyId, filingId1, filingId2) => {
          // Skip if filingIds are the same
          if (filingId1 === filingId2) return;
          
          const id1 = generateSubsidiaryEnrichmentId(companyId, filingId1);
          const id2 = generateSubsidiaryEnrichmentId(companyId, filingId2);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Component Inclusion - owns
   * 
   * *For any* owns relationship, changing any component of the composite key
   * (companyId, brandId) SHALL produce a different UUID v5.
   * 
   * **Validates: Requirements 2.3**
   */
  test("Property 5c: owns - changing companyId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        (companyId1, companyId2, brandId) => {
          // Skip if companyIds are the same
          if (companyId1 === companyId2) return;
          
          const id1 = generateOwnsId(companyId1, brandId);
          const id2 = generateOwnsId(companyId2, brandId);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5c: owns - changing brandId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        (companyId, brandId1, brandId2) => {
          // Skip if brandIds are the same
          if (brandId1 === brandId2) return;
          
          const id1 = generateOwnsId(companyId, brandId1);
          const id2 = generateOwnsId(companyId, brandId2);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Component Inclusion - business_segment
   * 
   * *For any* business_segment, changing any component of the composite key
   * (companyId, segmentName, fiscalYear, fiscalQuarter) SHALL produce a different UUID v5.
   * 
   * **Validates: Requirements 2.4**
   */
  test("Property 5d: business_segment - changing companyId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        nonEmptyStringArbitrary,
        fiscalYearArbitrary,
        fiscalQuarterArbitrary,
        (companyId1, companyId2, segmentName, fiscalYear, fiscalQuarter) => {
          // Skip if companyIds are the same
          if (companyId1 === companyId2) return;
          
          const id1 = generateBusinessSegmentId(companyId1, segmentName, fiscalYear, fiscalQuarter);
          const id2 = generateBusinessSegmentId(companyId2, segmentName, fiscalYear, fiscalQuarter);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5d: business_segment - changing segmentName produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        nonEmptyStringArbitrary,
        nonEmptyStringArbitrary,
        fiscalYearArbitrary,
        fiscalQuarterArbitrary,
        (companyId, segmentName1, segmentName2, fiscalYear, fiscalQuarter) => {
          // Skip if segment names are semantically the same (after normalization)
          if (segmentName1.trim().toLowerCase() === segmentName2.trim().toLowerCase()) return;
          
          const id1 = generateBusinessSegmentId(companyId, segmentName1, fiscalYear, fiscalQuarter);
          const id2 = generateBusinessSegmentId(companyId, segmentName2, fiscalYear, fiscalQuarter);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5d: business_segment - changing fiscalYear produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        nonEmptyStringArbitrary,
        fiscalYearArbitrary,
        fiscalYearArbitrary,
        fiscalQuarterArbitrary,
        (companyId, segmentName, fiscalYear1, fiscalYear2, fiscalQuarter) => {
          // Skip if fiscal years are the same
          if (fiscalYear1 === fiscalYear2) return;
          
          const id1 = generateBusinessSegmentId(companyId, segmentName, fiscalYear1, fiscalQuarter);
          const id2 = generateBusinessSegmentId(companyId, segmentName, fiscalYear2, fiscalQuarter);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5d: business_segment - changing fiscalQuarter produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        nonEmptyStringArbitrary,
        fiscalYearArbitrary,
        fiscalQuarterArbitrary,
        fiscalQuarterArbitrary,
        (companyId, segmentName, fiscalYear, fiscalQuarter1, fiscalQuarter2) => {
          // Skip if fiscal quarters are the same
          if (fiscalQuarter1 === fiscalQuarter2) return;
          
          const id1 = generateBusinessSegmentId(companyId, segmentName, fiscalYear, fiscalQuarter1);
          const id2 = generateBusinessSegmentId(companyId, segmentName, fiscalYear, fiscalQuarter2);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Component Inclusion - brand
   * 
   * *For any* brand, changing any component of the composite key
   * (companyId, name) SHALL produce a different UUID v5.
   * 
   * **Validates: Requirements 2.5**
   */
  test("Property 5e: brand - changing companyId produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        nonEmptyStringArbitrary,
        (companyId1, companyId2, brandName) => {
          // Skip if companyIds are the same
          if (companyId1 === companyId2) return;
          
          const id1 = generateBrandId(companyId1, brandName);
          const id2 = generateBrandId(companyId2, brandName);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5e: brand - changing name produces different ID", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        nonEmptyStringArbitrary,
        nonEmptyStringArbitrary,
        (companyId, brandName1, brandName2) => {
          // Skip if brand names are semantically the same (after normalization)
          if (brandName1.trim().toLowerCase() === brandName2.trim().toLowerCase()) return;
          
          const id1 = generateBrandId(companyId, brandName1);
          const id2 = generateBrandId(companyId, brandName2);
          
          expect(id1).not.toBe(id2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// NAMESPACE CONSISTENCY PROPERTY TESTS
// ============================================================================

describe("Namespace Consistency - Property Tests", () => {
  /**
   * Property 4: Namespace Consistency
   * 
   * *For any* entity type, all IDs generated for that type SHALL use the same 
   * namespace UUID, and different entity types SHALL use different namespace UUIDs.
   * 
   * **Validates: Requirements 1.6, 2.6**
   */

  /**
   * Property 4a: All namespaces are unique
   * 
   * Each entity type has a distinct namespace UUID to prevent cross-type collisions.
   */
  test("Property 4: All namespace UUIDs are unique", () => {
    const namespaceValues = Object.values(NAMESPACES);
    const uniqueNamespaces = new Set(namespaceValues);
    
    expect(uniqueNamespaces.size).toBe(namespaceValues.length);
  });

  /**
   * Property 4b: Same composite key with different namespaces produces different IDs
   * 
   * *For any* composite key string, using different namespace UUIDs SHALL produce
   * different UUID v5 outputs.
   */
  test("Property 4: Same data with different entity types produces different IDs", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        (id1, id2) => {
          // Use the same pair of IDs for different relationship types
          // parent_of uses: parentId:subsidiaryId
          // subsidiary_enrichment uses: companyId:filingId
          // owns uses: companyId:brandId
          
          const parentOfId = generateParentOfId(id1, id2);
          const subsidiaryEnrichmentId = generateSubsidiaryEnrichmentId(id1, id2);
          const ownsId = generateOwnsId(id1, id2);
          
          // All three should be different because they use different namespaces
          expect(parentOfId).not.toBe(subsidiaryEnrichmentId);
          expect(parentOfId).not.toBe(ownsId);
          expect(subsidiaryEnrichmentId).not.toBe(ownsId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4c: Company IDs use COMPANY namespace consistently
   * 
   * *For any* company data, the generated ID uses the COMPANY namespace,
   * ensuring all company IDs are in the same namespace space.
   */
  test("Property 4: Company IDs are consistent within COMPANY namespace", () => {
    fc.assert(
      fc.property(
        anyCompanyArbitrary,
        anyCompanyArbitrary,
        (company1, company2) => {
          const id1 = generateCompanyId(company1);
          const id2 = generateCompanyId(company2);
          
          // Both IDs should be valid UUID v5 format
          expect(id1).toMatch(UUID_V5_REGEX);
          expect(id2).toMatch(UUID_V5_REGEX);
          
          // If inputs are semantically different, IDs should be different
          // This confirms the namespace is being used consistently
          if (!areSemanticallyEqual(company1, company2)) {
            expect(id1).not.toBe(id2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4d: Filing IDs use FILING namespace consistently
   * 
   * *For any* accession number, the generated ID uses the FILING namespace.
   */
  test("Property 4: Filing IDs are consistent within FILING namespace", () => {
    // Generator for valid accession numbers (format: NNNNNNNNNN-NN-NNNNNN or 18 digits)
    const accessionNumberArbitrary = fc.stringMatching(/^[0-9]{10}-[0-9]{2}-[0-9]{6}$/);
    
    fc.assert(
      fc.property(
        accessionNumberArbitrary,
        accessionNumberArbitrary,
        (accession1, accession2) => {
          const id1 = generateFilingId(accession1);
          const id2 = generateFilingId(accession2);
          
          // Both IDs should be valid UUID v5 format
          expect(id1).toMatch(UUID_V5_REGEX);
          expect(id2).toMatch(UUID_V5_REGEX);
          
          // Normalize accession numbers for comparison (remove dashes)
          const normalized1 = accession1.replace(/-/g, '');
          const normalized2 = accession2.replace(/-/g, '');
          
          // If normalized accession numbers are different, IDs should be different
          if (normalized1 !== normalized2) {
            expect(id1).not.toBe(id2);
          } else {
            // Same normalized accession should produce same ID
            expect(id1).toBe(id2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4e: Company ID and Filing ID with same underlying data are different
   * 
   * Even if the composite key string happens to be the same, different entity types
   * produce different IDs due to different namespaces.
   */
  test("Property 4: Company and Filing IDs are in different namespace spaces", () => {
    // This test verifies that even if we could construct the same composite string,
    // the different namespaces would produce different UUIDs.
    // We test this by checking that company IDs and filing IDs never collide
    // even when generated from similar-looking data.
    
    fc.assert(
      fc.property(
        publicCompanyArbitrary,
        fc.stringMatching(/^[0-9]{10}-[0-9]{2}-[0-9]{6}$/),
        (company, accessionNumber) => {
          const companyId = generateCompanyId(company);
          const filingId = generateFilingId(accessionNumber);
          
          // Company and filing IDs should never be the same
          // because they use different namespaces
          expect(companyId).not.toBe(filingId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4f: All relationship entity types use distinct namespaces
   * 
   * *For any* set of input parameters, relationship entities of different types
   * produce different IDs even with identical input structure.
   */
  test("Property 4: All relationship types produce distinct IDs for same inputs", () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        nonEmptyStringArbitrary,
        fiscalYearArbitrary,
        fiscalQuarterArbitrary,
        (companyId, name, fiscalYear, fiscalQuarter) => {
          // Generate a brand ID
          const brandId = generateBrandId(companyId, name);
          
          // Generate a business segment ID with same company and name
          const segmentId = generateBusinessSegmentId(companyId, name, fiscalYear, fiscalQuarter);
          
          // These should be different because:
          // 1. They use different namespaces (BRAND vs BUSINESS_SEGMENT)
          // 2. Business segment includes additional components
          expect(brandId).not.toBe(segmentId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
