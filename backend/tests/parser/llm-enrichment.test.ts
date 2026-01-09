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

import { enrichWithLLM } from "../../src/parsers/subsidiary/llm-enrichment";
import type { SubsidiaryRecord, FootnoteMap } from "../../src/parsers/subsidiary/types";

// Mock logger to reduce noise
jest.mock("../../src/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe("LLM Enrichment (Integration)", () => {
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
    it("should skip subsidiaries with existing ownership", async () => {
      const subsidiaries = [
        createSubsidiary("Company A", ["1"], 100),
      ];
      const footnotes: FootnoteMap = {
        "1": "Wholly owned subsidiary",
      };

      const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

      expect(result[0].ownership).toBe(100); // Unchanged
    });

    it("should skip subsidiaries with no footnote refs", async () => {
      const subsidiaries = [
        createSubsidiary("Company B", [], undefined),
      ];
      const footnotes: FootnoteMap = {};

      const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

      // Should default to 100% even with no footnotes
      expect(result[0].ownership).toBe(100);
    });

    // Integration tests with real Ollama
    describe("with Ollama", () => {
      // Increase timeout for LLM calls
      jest.setTimeout(30000);

      it("should extract ownership from 'wholly owned' footnote", async () => {
        const subsidiaries = [
          createSubsidiary("Company C", ["1"], undefined),
        ];
        const footnotes: FootnoteMap = {
          "1": "This is a wholly owned subsidiary of the Company",
        };

        const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

        expect(result[0].ownership).toBe(100);
      });

      it("should extract percentage from footnote", async () => {
        const subsidiaries = [
          createSubsidiary("Company D", ["2"], undefined),
        ];
        const footnotes: FootnoteMap = {
          "2": "The Company owns 75% of this subsidiary",
        };

        const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

        expect(result[0].ownership).toBe(75);
      });

      it("should handle majority owned pattern", async () => {
        const subsidiaries = [
          createSubsidiary("Company E", ["3"], undefined),
        ];
        const footnotes: FootnoteMap = {
          "3": "Majority owned subsidiary",
        };

        const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

        // Should be 51 or higher (LLM might interpret as >50%)
        expect(result[0].ownership).toBeGreaterThanOrEqual(51);
        expect(result[0].ownership).toBeLessThanOrEqual(100);
      });

      it("should extract parent company name and match to ID", async () => {
        const subsidiaries = [
          createSubsidiary("EI Freight Co.", ["1"], 100, "filing-company-id"),
          createSubsidiary("Subsidiary X", ["2"], undefined, "filing-company-id"),
        ];
        const footnotes: FootnoteMap = {
          "1": "Wholly owned",
          "2": "Owned 100% by EI Freight Co.",
        };

        const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

        expect(result[1].ownership).toBe(100);
        // Should match to first subsidiary's ID
        expect(result[1].parentId).toBe("test-ei-freight-co.");
        expect(result[1].parentName).toContain("EI Freight");
      });

      it("should default to 100% when no ownership info found in footnote", async () => {
        const subsidiaries = [
          createSubsidiary("Company G", ["5"], undefined),
        ];
        const footnotes: FootnoteMap = {
          "5": "Incorporated in Delaware in 2020",
        };

        const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

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

        const result = await enrichWithLLM(subsidiaries, footnotes, "test-accession");

        expect(result[0].ownership).toBe(100);
        expect(result[1].ownership).toBe(75);
      });
    });
  });
});
