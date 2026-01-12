/**
 * Integration tests for LLM enrichment module
 *
 * These tests require Ollama to be running locally with qwen2:7b model
 *
 * Setup:
 * 1. Install Ollama: https://ollama.ai
 * 2. Start Ollama: ollama serve
 * 3. Pull model: ollama pull qwen2:7b
 * 4. Run tests: npm test tests/parser/llm-enrichment.test.ts
 *
 * To skip these tests: npm test -- --testPathIgnorePatterns=llm-enrichment
 */

import { enrichWithLLM } from "../../src/parser/subsidiary/llm-enrichment";
import type {
  SubsidiaryRecord,
  FootnoteMap,
} from "../../src/parser/subsidiary/types";

describe("LLM Enrichment (Integration)", () => {
  // Skip all LLM tests if USE_LLM is not enabled or Ollama is not available
  const SKIP_LLM_TESTS = process.env.USE_LLM !== 'true';
  
  const createSubsidiary = (
    name: string,
    footnoteRefs: string[],
    ownership?: number,
    parentId?: string
  ): SubsidiaryRecord => ({
    id: `test-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    jurisdiction: "Delaware",
    nestingLevel: 0,
    ownership,
    footnoteRefs,
    indentationSpaces: 0,
    isNested: false,
    parentId,
  });

  describe("enrichWithLLM", () => {
    // Basic tests that don't require LLM
    (SKIP_LLM_TESTS ? it.skip : it)("should skip subsidiaries with existing ownership", async () => {
      const subsidiaries = [createSubsidiary("Company A", ["1"], 100)];
      const footnotes: FootnoteMap = {
        "1": "Wholly owned subsidiary",
      };

      const result = await enrichWithLLM(
        subsidiaries,
        footnotes,
        "test-accession"
      );

      expect(result[0].ownership).toBe(100); // Unchanged
    });

    (SKIP_LLM_TESTS ? it.skip : it)("should skip subsidiaries with no footnote refs", async () => {
      const subsidiaries = [createSubsidiary("Company B", [], undefined)];
      const footnotes: FootnoteMap = {};

      const result = await enrichWithLLM(
        subsidiaries,
        footnotes,
        "test-accession"
      );

      // Should default to 100% even with no footnotes
      expect(result[0].ownership).toBe(100);
    });

    // Integration tests with real Ollama
    (SKIP_LLM_TESTS ? describe.skip : describe)("with Ollama", () => {
      (SKIP_LLM_TESTS ? it.skip : it)("should extract ownership from 'wholly owned' footnote", async () => {
        const subsidiaries = [createSubsidiary("Company C", ["1"], undefined)];
        const footnotes: FootnoteMap = {
          "1": "This is a wholly owned subsidiary of the Company",
        };

        const result = await enrichWithLLM(
          subsidiaries,
          footnotes,
          "test-accession"
        );

        expect(result[0].ownership).toBe(100);
      });

      it("should extract percentage from footnote", async () => {
        const subsidiaries = [createSubsidiary("Company D", ["2"], undefined)];
        const footnotes: FootnoteMap = {
          "2": "The Company owns 75% of this subsidiary",
        };

        const result = await enrichWithLLM(
          subsidiaries,
          footnotes,
          "test-accession"
        );

        expect(result[0].ownership).toBe(75);
      });

      it("should handle majority owned pattern", async () => {
        const subsidiaries = [createSubsidiary("Company E", ["3"], undefined)];
        const footnotes: FootnoteMap = {
          "3": "Majority owned subsidiary",
        };

        const result = await enrichWithLLM(
          subsidiaries,
          footnotes,
          "test-accession"
        );

        // Should be 51 or higher (LLM might interpret as >50%)
        expect(result[0].ownership).toBeGreaterThanOrEqual(51);
        expect(result[0].ownership).toBeLessThanOrEqual(100);
      });

      it("should extract parent company name and match to ID", async () => {
        const subsidiaries = [
          createSubsidiary("EI Freight Co.", ["1"], 100, "filing-company-id"),
          createSubsidiary(
            "Subsidiary X",
            ["2"],
            undefined,
            "filing-company-id"
          ),
        ];
        const footnotes: FootnoteMap = {
          "1": "Wholly owned",
          "2": "Owned 100% by EI Freight Co.",
        };

        const result = await enrichWithLLM(
          subsidiaries,
          footnotes,
          "test-accession"
        );

        expect(result[1].ownership).toBe(100);
        // Should match to first subsidiary's ID
        expect(result[1].parentId).toBe("test-ei-freight-co.");
        expect(result[1].parentName).toContain("EI Freight");
      });

      it("should default to 100% when no ownership info found in footnote", async () => {
        const subsidiaries = [createSubsidiary("Company G", ["5"], undefined)];
        const footnotes: FootnoteMap = {
          "5": "Incorporated in Delaware in 2020",
        };

        const result = await enrichWithLLM(
          subsidiaries,
          footnotes,
          "test-accession"
        );

        // If no ownership info found, assume 100% (standard for Exhibit 21)
        expect(result[0].ownership).toBe(100);
      });

      it("should process multiple subsidiaries", async () => {
        const subsidiaries = [
          createSubsidiary("Company H", ["1"], undefined),
          createSubsidiary("Company J", ["3"], undefined),
        ];
        const footnotes: FootnoteMap = {
          "1": "Wholly owned",
          "3": "75% controlling interest",
        };

        const result = await enrichWithLLM(
          subsidiaries,
          footnotes,
          "test-accession"
        );

        expect(result[0].ownership).toBe(100);
        expect(result[1].ownership).toBe(75);
      });

      describe("HTML table footnotes", () => {
        it("should extract ownership from table footnote (entire table format)", async () => {
          const subsidiaries = [
            createSubsidiary("Nuovo Pignone Holding S.p.a.", ["1"], undefined),
            createSubsidiary("Baker Hughes Energy Europe B.V.", [], 100),
          ];

          // Option 1: Send entire footnote table
          const footnoteTableHTML = `
            <table>
              <tr><td>(1) Nuovo Pignone Holding S.p.a.</td></tr>
              <tr>
                <td></td>
                <td>Baker Hughes Energy Europe B.V.</td>
                <td>83.7387%</td>
              </tr>
              <tr>
                <td></td>
                <td>Other subsidiaries of Baker Hughes Holdings LLC</td>
                <td>16.2458%</td>
              </tr>
              <tr>
                <td></td>
                <td>Third Party</td>
                <td>0.0155%</td>
              </tr>
            </table>
          `;

          const footnotes: FootnoteMap = {
            "1": footnoteTableHTML,
          };

          const result = await enrichWithLLM(
            subsidiaries,
            footnotes,
            "test-accession"
          );

          // Should extract ownership breakdown
          const nuovoPignone = result.find(s => s.name === "Nuovo Pignone Holding S.p.a.");
          expect(nuovoPignone?.ownership).toBeDefined();
          // Could be 100% (total) or 83.7387% (primary owner's share)
          expect(nuovoPignone?.ownership).toBeGreaterThan(0);
        });

        it("should extract ownership from table footnote (specific rows format)", async () => {
          const subsidiaries = [
            createSubsidiary("Nuovo Pignone Holding S.p.a.", ["1"], undefined),
            createSubsidiary("Baker Hughes Energy Europe B.V.", [], 100),
          ];

          // Option 2: Send just the relevant rows
          const footnoteRowsHTML = `
            <tr><td>(1) Nuovo Pignone Holding S.p.a.</td></tr>
            <tr>
              <td></td>
              <td>Baker Hughes Energy Europe B.V.</td>
              <td>83.7387%</td>
            </tr>
            <tr>
              <td></td>
              <td>Other subsidiaries of Baker Hughes Holdings LLC</td>
              <td>16.2458%</td>
            </tr>
            <tr>
              <td></td>
              <td>Third Party</td>
              <td>0.0155%</td>
            </tr>
          `;

          const footnotes: FootnoteMap = {
            "1": footnoteRowsHTML,
          };

          const result = await enrichWithLLM(
            subsidiaries,
            footnotes,
            "test-accession"
          );

          const nuovoPignone = result.find(s => s.name === "Nuovo Pignone Holding S.p.a.");
          expect(nuovoPignone?.ownership).toBeDefined();
          expect(nuovoPignone?.ownership).toBeGreaterThan(0);
        });
      });
    });
  });
});
