import { describe, it, expect, beforeEach } from "@jest/globals";
import { upsertFiling } from "../../../src/db/repo/filings";
import { db } from "../../../src/db/client";
import type * as Types from "../../../src/types";

describe("Filing Repository", () => {
  // Use a test company ID that should exist in your test DB
  const TEST_COMPANY_ID = "test-company-id-123";
  const TEST_ACCESSION = "0001234567-25-000001";

  const createTestFiling = (overrides?: Partial<Types.Filing>): Partial<Types.Filing> => ({
    company_id: TEST_COMPANY_ID,
    accession_number: TEST_ACCESSION,
    accession_number_nodashes: TEST_ACCESSION.replace(/-/g, ""),
    form_type: "10-K",
    filing_date: "2025-01-15T00:00:00.000Z",
    file_name: "test-filing.txt",
    file_url: "https://www.sec.gov/Archives/edgar/data/1234567/test-filing.txt",
    source_quarter: 1,
    source_year: 2025,
    fiscal_year: 2024,
    fiscal_quarter: 4,
    ...overrides,
  });

  describe("upsertFiling", () => {
    it("should create a new filing and link it to company", async () => {
      const filingData = createTestFiling();
      const filingId = await upsertFiling(filingData);

      expect(filingId).toBeDefined();
      expect(typeof filingId).toBe("string");

      // Verify the filing was created
      const result = await db.query({
        filings: {
          $: { where: { id: filingId } },
        },
      });

      expect(result.filings).toBeDefined();
      expect(result.filings.length).toBe(1);
      expect(result.filings[0].accession_number).toBe(TEST_ACCESSION);
      expect(result.filings[0].form_type).toBe("10-K");
    });

    it("should update existing filing without error when called twice", async () => {
      const filingData = createTestFiling();

      // First insert
      const filingId1 = await upsertFiling(filingData);
      expect(filingId1).toBeDefined();

      // Second insert with same accession number (should update, not error)
      const updatedData = createTestFiling({
        fiscal_year: 2025, // Changed value
      });
      const filingId2 = await upsertFiling(updatedData);

      // Should return the same ID (deterministic based on accession number)
      expect(filingId2).toBe(filingId1);

      // Verify the filing was updated
      const result = await db.query({
        filings: {
          $: { where: { id: filingId2 } },
        },
      });

      expect(result.filings).toBeDefined();
      expect(result.filings.length).toBe(1);
      expect(result.filings[0].fiscal_year).toBe(2025);
    });

    it("should not create duplicate links when upserting existing filing", async () => {
      const filingData = createTestFiling();

      // First insert
      const filingId = await upsertFiling(filingData);

      // Get initial link count
      const result1 = await db.query({
        companies: {
          $: { where: { id: TEST_COMPANY_ID } },
          filings: {},
        },
      });

      const initialFilingCount = result1.companies?.[0]?.filings?.length || 0;

      // Second insert (should not create duplicate link)
      await upsertFiling(filingData);

      // Verify link count hasn't increased
      const result2 = await db.query({
        companies: {
          $: { where: { id: TEST_COMPANY_ID } },
          filings: {},
        },
      });

      const finalFilingCount = result2.companies?.[0]?.filings?.length || 0;

      // Should be the same count (no duplicate link created)
      expect(finalFilingCount).toBe(initialFilingCount);
    });

    it("should handle multiple different filings for the same company", async () => {
      const filing1 = createTestFiling({
        accession_number: "0001234567-25-000001",
      });
      const filing2 = createTestFiling({
        accession_number: "0001234567-25-000002",
      });

      const id1 = await upsertFiling(filing1);
      const id2 = await upsertFiling(filing2);

      // Should have different IDs
      expect(id1).not.toBe(id2);

      // Verify both filings exist
      const result = await db.query({
        companies: {
          $: { where: { id: TEST_COMPANY_ID } },
          filings: {},
        },
      });

      const filings = result.companies?.[0]?.filings || [];
      const filingIds = filings.map((f: any) => f.id);

      expect(filingIds).toContain(id1);
      expect(filingIds).toContain(id2);
    });

    it("should validate required fields", async () => {
      const invalidFiling = {
        company_id: TEST_COMPANY_ID,
        // Missing required fields
      };

      await expect(upsertFiling(invalidFiling as any)).rejects.toThrow();
    });

    it("should handle attachments field", async () => {
      const filingWithAttachments = createTestFiling({
        attachments: {
          "EX-21": "https://www.sec.gov/Archives/edgar/data/1234567/ex21.htm",
          "EX-21.A": "https://www.sec.gov/Archives/edgar/data/1234567/ex21a.htm",
        },
      });

      const filingId = await upsertFiling(filingWithAttachments);

      const result = await db.query({
        filings: {
          $: { where: { id: filingId } },
        },
      });

      expect(result.filings[0].attachments).toBeDefined();
      expect(result.filings[0].attachments["EX-21"]).toBeDefined();
      expect(result.filings[0].attachments["EX-21.A"]).toBeDefined();
    });
  });
});
