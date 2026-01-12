/**
 * Integration Tests for Heuristic-Only Ingestion
 * 
 * Verifies that the heuristic-only ingestion pipeline works correctly:
 * 1. Companies are created
 * 2. Enrichment records are created for subsidiaries with footnotes
 * 3. Parent_of edges are created for ALL subsidiaries (nested + non-nested)
 * 4. Footnotes HTML is preprocessed and stored
 * 5. Links are present and working (subsidiaries, filings)
 * 6. Public companies can find their subsidiaries via links
 */

import { db } from "../../../src/db/client";

describe("Heuristic-Only Ingestion Verification", () => {
  describe("Basic Data Existence", () => {
    test("should have companies in database", async () => {
      const result = await db.query({
        companies: {
          $: { limit: 10 },
        },
      });

      expect(result.companies).toBeDefined();
      expect(result.companies!.length).toBeGreaterThan(0);
    });

    test("should have enrichment records", async () => {
      const result = await db.query({
        subsidiary_enrichments: {
          $: { limit: 10 },
        },
      });

      expect(result.subsidiary_enrichments).toBeDefined();
      expect(result.subsidiary_enrichments!.length).toBeGreaterThan(0);
    });

    test("should have parent_of edges", async () => {
      const result = await db.query({
        parent_of: {
          $: { limit: 10 },
        },
      });

      expect(result.parent_of).toBeDefined();
      expect(result.parent_of!.length).toBeGreaterThan(0);
    });

    test("should have audit trail", async () => {
      const result = await db.query({
        audits: {
          $: { limit: 10 },
        },
      });

      expect(result.audits).toBeDefined();
      expect(result.audits!.length).toBeGreaterThan(0);
    });
  });

  describe("Enrichment Records", () => {
    test("should have enrichment records with required fields", async () => {
      const result = await db.query({
        subsidiary_enrichments: {
          $: { limit: 5 },
        },
      });

      const enrichments = result.subsidiary_enrichments!;
      expect(enrichments.length).toBeGreaterThan(0);

      const sample = enrichments[0];
      expect(sample.company_id).toBeDefined();
      expect(sample.filing_id).toBeDefined();
      expect(sample.footnoteRefs).toBeDefined();
      expect(sample.llmEnriched).toBe(false); // Should be false for heuristic-only
    });

    test("should have unenriched subsidiaries ready for LLM", async () => {
      const result = await db.query({
        subsidiary_enrichments: {
          $: {
            where: {
              llmEnriched: false,
            },
            limit: 10,
          },
        },
      });

      expect(result.subsidiary_enrichments).toBeDefined();
      expect(result.subsidiary_enrichments!.length).toBeGreaterThan(0);
    });

    test("should have preprocessed footnotes HTML", async () => {
      const result = await db.query({
        subsidiary_enrichments: {
          $: { limit: 10 },
        },
      });

      const withFootnotes = result.subsidiary_enrichments!.filter(
        (e) => e.footnotesHtml && e.footnotesHtml.length > 0
      );

      expect(withFootnotes.length).toBeGreaterThan(0);
    });
  });

  describe("Parent-Child Edges", () => {
    test("should have edges with required fields", async () => {
      const result = await db.query({
        parent_of: {
          $: { limit: 5 },
        },
      });

      const edges = result.parent_of!;
      expect(edges.length).toBeGreaterThan(0);

      const sample = edges[0];
      expect(sample.from_company_id).toBeDefined();
      expect(sample.to_company_id).toBeDefined();
      expect(sample.source).toBe("sec_filing");
      expect(sample.source_id).toBeDefined(); // Should have source_id for temporal tracking
    });

    test("should have edges with deterministic IDs including source_id", async () => {
      const result = await db.query({
        parent_of: {
          $: { limit: 10 },
        },
      });

      const edges = result.parent_of!;
      
      // All edges should have source_id (for temporal tracking)
      const edgesWithSource = edges.filter(e => e.source_id);
      expect(edgesWithSource.length).toBe(edges.length);
    });
  });

  describe("Audit Trail", () => {
    test("should have heuristic audit records", async () => {
      const result = await db.query({
        audits: {
          $: {
            where: {
              changed_by: "heuristic",
            },
            limit: 10,
          },
        },
      });

      expect(result.audits).toBeDefined();
      expect(result.audits!.length).toBeGreaterThan(0);
    });

    test("should NOT have LLM audit records (heuristic-only)", async () => {
      const result = await db.query({
        audits: {
          $: {
            where: {
              changed_by: "llm",
            },
            limit: 10,
          },
        },
      });

      // Should be empty for heuristic-only ingestion
      expect(result.audits?.length || 0).toBe(0);
    });
  });

  describe("Links Verification", () => {
    test("should have working subsidiaries links", async () => {
      // Find a public company
      const companiesResult = await db.query({
        companies: {
          $: {
            where: { type: "public" },
            limit: 5,
          },
        },
      });

      expect(companiesResult.companies).toBeDefined();
      expect(companiesResult.companies!.length).toBeGreaterThan(0);

      // Try to find one with subsidiaries
      let foundSubsidiaries = false;
      for (const company of companiesResult.companies!) {
        const result = await db.query({
          companies: {
            $: {
              where: { id: company.id },
            },
            subsidiaries: {
              $: { limit: 10 },
            },
          },
        });

        const companyWithSubs = result.companies?.[0];
        const subsidiaries = companyWithSubs?.subsidiaries || [];

        if (subsidiaries.length > 0) {
          foundSubsidiaries = true;
          expect(subsidiaries.length).toBeGreaterThan(0);
          
          // Verify subsidiary structure
          const sample = subsidiaries[0];
          expect(sample.id).toBeDefined();
          expect(sample.name).toBeDefined();
          break;
        }
      }

      // At least one company should have subsidiaries
      expect(foundSubsidiaries).toBe(true);
    });

    test("should have working filings links", async () => {
      // Find a public company
      const companiesResult = await db.query({
        companies: {
          $: {
            where: { type: "public" },
            limit: 1,
          },
        },
      });

      expect(companiesResult.companies).toBeDefined();
      expect(companiesResult.companies!.length).toBeGreaterThan(0);

      const company = companiesResult.companies![0];

      // Query with filings link
      const result = await db.query({
        companies: {
          $: {
            where: { id: company.id },
          },
          filings: {
            $: { limit: 5 },
          },
        },
      });

      const companyWithFilings = result.companies?.[0];
      const filings = companyWithFilings?.filings || [];

      expect(filings.length).toBeGreaterThan(0);

      // Verify filing structure
      const sample = filings[0];
      expect(sample.id).toBeDefined();
      expect(sample.form_type).toBeDefined();
      expect(sample.filing_date).toBeDefined();
    });

    test("should have reverse link from filing to company", async () => {
      // Get a filing
      const filingsResult = await db.query({
        filings: {
          $: { limit: 1 },
          company: {},
        },
      });

      expect(filingsResult.filings).toBeDefined();
      expect(filingsResult.filings!.length).toBeGreaterThan(0);

      const filing = filingsResult.filings![0];
      expect(filing.company).toBeDefined();
      expect(filing.company.id).toBeDefined();
      expect(filing.company.name).toBeDefined();
    });
  });

  describe("Specific Filing Verification", () => {
    const TARGET_ACCESSION = "0000824142-25-000039"; // Known filing with 536 subsidiaries

    test("should have target filing in database", async () => {
      const result = await db.query({
        filings: {
          $: {
            where: { accession_number: TARGET_ACCESSION },
          },
        },
      });

      expect(result.filings).toBeDefined();
      expect(result.filings!.length).toBe(1);

      const filing = result.filings![0];
      expect(filing.company_id).toBeDefined();
    });

    test("should have enrichment records for target filing", async () => {
      const filingResult = await db.query({
        filings: {
          $: {
            where: { accession_number: TARGET_ACCESSION },
          },
        },
      });

      const filing = filingResult.filings![0];

      const enrichmentsResult = await db.query({
        subsidiary_enrichments: {
          $: {
            where: { filing_id: filing.id },
            limit: 1000,
          },
        },
      });

      expect(enrichmentsResult.subsidiary_enrichments).toBeDefined();
      expect(enrichmentsResult.subsidiary_enrichments!.length).toBeGreaterThan(0);
    });

    test("should have parent_of edges for target filing", async () => {
      const filingResult = await db.query({
        filings: {
          $: {
            where: { accession_number: TARGET_ACCESSION },
          },
        },
      });

      const filing = filingResult.filings![0];

      const edgesResult = await db.query({
        parent_of: {
          $: {
            where: { source_id: filing.id },
            limit: 1000,
          },
        },
      });

      expect(edgesResult.parent_of).toBeDefined();
      expect(edgesResult.parent_of!.length).toBeGreaterThan(0);
    });
  });
});
