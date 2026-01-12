/**
 * Property-Based Tests for Company Upsert with primaryCIK Management
 * 
 * Feature: deterministic-id-generation
 * These tests validate the database behavior for company upserts.
 * 
 * NOTE: These tests require a live InstantDB connection and will modify data.
 * Run with: npm run test:integration
 */

import * as fc from "fast-check";
import { 
  upsertCompany, 
  findCompanyByAnyCik,
  getCompanyIdByCik,
} from "../../../src/db/repo/companies";
import { db } from "../../../src/db/client";
import { 
  CompanyType, 
  generateCompanyId,
  type Company,
} from "@financial-graph/shared";

// Skip these tests if not running integration tests
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === "true";

// ============================================================================
// GENERATORS
// ============================================================================

/**
 * Generator for valid CIK strings (1-10 digits)
 */
const cikArbitrary = fc.stringMatching(/^[0-9]{1,10}$/);

/**
 * Generator for non-empty company names
 */
const companyNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for comma-separated CIK list (1-3 CIKs)
 */
const cikListArbitrary = fc.array(cikArbitrary, { minLength: 1, maxLength: 3 })
  .map(ciks => ciks.join(","));

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe("Company Upsert - Property Tests", () => {
  // Clean up test data after each test
  afterEach(async () => {
    // Note: In a real test environment, you'd want to clean up test data
    // For now, we rely on deterministic IDs to overwrite test data
  });

  /**
   * Property 9: Primary CIK Stability
   * 
   * *For any* public/issuer company, once `identity.primaryCIK` is set, 
   * it SHALL never change even when `identity.ciks` is updated.
   * 
   * **Validates: Requirements 6.3, 6.4**
   */
  (SKIP_INTEGRATION ? test.skip : test)(
    "Property 9: primaryCIK remains stable when ciks list changes",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          companyNameArbitrary,
          cikArbitrary,
          cikArbitrary,
          async (name, cik1, cik2) => {
            // Skip if CIKs are the same
            if (cik1.padStart(10, "0") === cik2.padStart(10, "0")) return;

            const testName = `TEST_PROP9_${name}_${Date.now()}`;
            
            // First upsert - creates company with cik1
            const id1 = await upsertCompany({
              type: CompanyType.PUBLIC,
              name: testName,
              identity: { ciks: cik1 },
            });

            // Query to get the primaryCIK that was set
            const result1 = await db.query({
              company: {
                $: { where: { id: id1 } },
              },
            });
            const company1 = result1.company[0];
            const originalPrimaryCIK = (company1?.identity as any)?.primaryCIK;

            // Second upsert - adds cik2 to the list
            const id2 = await upsertCompany({
              type: CompanyType.PUBLIC,
              name: testName,
              identity: { ciks: `${cik1},${cik2}` },
            });

            // Query to get the updated company
            const result2 = await db.query({
              company: {
                $: { where: { id: id2 } },
              },
            });
            const company2 = result2.company[0];
            const updatedPrimaryCIK = (company2?.identity as any)?.primaryCIK;

            // The primaryCIK should remain the same
            expect(updatedPrimaryCIK).toBe(originalPrimaryCIK);
            
            // The ID should remain the same (since primaryCIK didn't change)
            expect(id2).toBe(id1);
          }
        ),
        { numRuns: 10 } // Reduced for integration tests
      );
    },
    60000 // 60 second timeout for integration tests
  );

  /**
   * Property 7: Database Upsert Idempotence
   * 
   * *For any* entity data, upserting the same data multiple times SHALL result 
   * in exactly one database record with the deterministic UUID v5 ID.
   * 
   * **Validates: Requirements 5.1, 5.6**
   */
  (SKIP_INTEGRATION ? test.skip : test)(
    "Property 7: Upserting same data multiple times produces same record",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          companyNameArbitrary,
          cikArbitrary,
          async (name, cik) => {
            const testName = `TEST_PROP7_${name}_${Date.now()}`;
            
            // Upsert the same company 3 times
            const id1 = await upsertCompany({
              type: CompanyType.PUBLIC,
              name: testName,
              identity: { ciks: cik },
            });

            const id2 = await upsertCompany({
              type: CompanyType.PUBLIC,
              name: testName,
              identity: { ciks: cik },
            });

            const id3 = await upsertCompany({
              type: CompanyType.PUBLIC,
              name: testName,
              identity: { ciks: cik },
            });

            // All IDs should be the same
            expect(id1).toBe(id2);
            expect(id2).toBe(id3);

            // Query to verify only one record exists
            const result = await db.query({
              company: {
                $: { where: { id: id1 } },
              },
            });

            expect(result.company.length).toBe(1);
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );

  /**
   * Property 10: Lookup by Any CIK
   * 
   * *For any* public/issuer company with multiple CIKs, querying by any CIK 
   * in `identity.ciks` or by `identity.primaryCIK` SHALL return the same company.
   * 
   * **Validates: Requirements 6.5**
   */
  (SKIP_INTEGRATION ? test.skip : test)(
    "Property 10: findCompanyByAnyCik returns company for any CIK in list",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          companyNameArbitrary,
          cikArbitrary,
          cikArbitrary,
          async (name, cik1, cik2) => {
            // Skip if CIKs are the same
            if (cik1.padStart(10, "0") === cik2.padStart(10, "0")) return;

            const testName = `TEST_PROP10_${name}_${Date.now()}`;
            
            // Create company with multiple CIKs
            const id = await upsertCompany({
              type: CompanyType.PUBLIC,
              name: testName,
              identity: { ciks: `${cik1},${cik2}` },
            });

            // Lookup by first CIK
            const found1 = await findCompanyByAnyCik([cik1]);
            
            // Lookup by second CIK
            const found2 = await findCompanyByAnyCik([cik2]);

            // Both lookups should find the same company
            expect(found1).not.toBeNull();
            expect(found2).not.toBeNull();
            expect(found1?.id).toBe(id);
            expect(found2?.id).toBe(id);
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );

  /**
   * Property 8: Query by Business Attributes
   * 
   * *For any* entity with business attributes (CIK), generating the UUID v5 
   * from those attributes and querying by that ID SHALL return the same entity.
   * 
   * **Validates: Requirements 5.4**
   */
  (SKIP_INTEGRATION ? test.skip : test)(
    "Property 8: getCompanyIdByCik generates correct ID for lookup",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          companyNameArbitrary,
          cikArbitrary,
          async (name, cik) => {
            const testName = `TEST_PROP8_${name}_${Date.now()}`;
            const normalizedCik = cik.padStart(10, "0");
            
            // Create company
            const createdId = await upsertCompany({
              type: CompanyType.PUBLIC,
              name: testName,
              identity: { ciks: cik },
            });

            // Generate ID from CIK using the utility function
            const generatedId = getCompanyIdByCik(cik);

            // The generated ID should match the created ID
            expect(generatedId).toBe(createdId);

            // Query by the generated ID should return the company
            const result = await db.query({
              company: {
                $: { where: { id: generatedId } },
              },
            });

            expect(result.company.length).toBe(1);
            expect(result.company[0].name).toBe(testName);
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );
});
