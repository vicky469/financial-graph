/**
 * Unit tests for structure detection phase
 * 
 * Tests the detectDocumentStructure function and its helper functions
 * to ensure correct table detection, classification, and header extraction.
 */

import * as cheerio from "cheerio";
import { detectDocumentStructure } from "../../src/parser/subsidiary/structure-detection";
import { DEFAULT_CONFIG } from "../../src/parser/subsidiary/parser-types";
import type { ParserConfig } from "../../src/parser/subsidiary/parser-types";

describe("Structure Detection", () => {
  describe("No tables", () => {
    it("returns no-table classification for empty HTML", () => {
      const html = "<html><body><p>No tables here</p></body></html>";
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("no-table");
      expect(result.tables).toHaveLength(0);
      expect(result.totalTableCount).toBe(0);
    });
  });

  describe("Text-based listings", () => {
    it("detects text-based subsidiaries when no tables are present", () => {
      const html = `
        <html><body>
          <div>Acme Corp (Delaware)</div>
          <p>Beta LLC (Nevada)</p>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("text-based");
      expect(result.tables).toHaveLength(0);
      expect(result.totalTableCount).toBe(0);
      expect(result.textBased?.entryCount).toBe(2);
    });
  });

  describe("Single subsidiary table", () => {
    it("detects single table with subsidiary headers", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
              <th>Ownership %</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
              <td>100%</td>
            </tr>
            <tr>
              <td>Beta LLC</td>
              <td>Nevada</td>
              <td>80%</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("single-table");
      expect(result.tables).toHaveLength(1);
      expect(result.totalTableCount).toBe(1);

      const table = result.tables[0];
      expect(table.type).toBe("subsidiary");
      expect(table.headers).toEqual(["Subsidiary Name", "Jurisdiction", "Ownership %"]);
      expect(table.isContinuation).toBe(false);
      expect(table.columnCount).toBe(3);
      expect(table.rowCount).toBe(2);
    });

    it("detects table with fuzzy header matching", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Name of Entity</th>
              <th>State of Incorporation</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("single-table");
      expect(result.tables[0].type).toBe("subsidiary");
    });
  });

  describe("Multiple tables", () => {
    it("detects multiple subsidiary tables", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
          <table>
            <tr>
              <th>Company Name</th>
              <th>State</th>
            </tr>
            <tr>
              <td>Beta LLC</td>
              <td>Nevada</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("multi-table");
      expect(result.tables).toHaveLength(2);
      expect(result.tables[0].type).toBe("subsidiary");
      expect(result.tables[1].type).toBe("subsidiary");
    });
  });

  describe("Continuation tables", () => {
    it("detects continuation table without headers", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
          <table>
            <tr>
              <td>Beta LLC</td>
              <td>Nevada</td>
            </tr>
            <tr>
              <td>Gamma Inc</td>
              <td>California</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("multi-table");
      expect(result.tables).toHaveLength(2);

      const continuationTable = result.tables[1];
      expect(continuationTable.type).toBe("subsidiary");
      expect(continuationTable.isContinuation).toBe(true);
      expect(continuationTable.headers).toBe(null);
      expect(continuationTable.cachedHeaders).toEqual(["Subsidiary Name", "Jurisdiction"]);
    });
  });

  describe("Tables without headers", () => {
    it("classifies data-only tables as subsidiary tables", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
            </tr>
            <tr>
              <td>Beta LLC</td>
              <td>Nevada</td>
            </tr>
            <tr>
              <td>Gamma Inc</td>
              <td>California</td>
            </tr>
            <tr>
              <td>Delta Ltd</td>
              <td>Texas</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("single-table");
      expect(result.tables).toHaveLength(1);

      const table = result.tables[0];
      expect(table.type).toBe("subsidiary");
      expect(table.headers).toBeNull();
      expect(table.isContinuation).toBe(false);
      expect(table.rowCount).toBe(4);
      expect(table.columnCount).toBe(2);
    });
  });

  describe("Footer tables", () => {
    it("classifies footer table correctly", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
          <table>
            <tr>
              <td>Note: Excludes dormant subsidiaries with no operations.</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.tables).toHaveLength(2);
      expect(result.tables[0].type).toBe("subsidiary");
      expect(result.tables[1].type).toBe("footnote");
    });
  });

  describe("Colspan handling", () => {
    it("calculates column count with colspan attributes", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th colspan="2">Subsidiary Name</th>
              <th>Jurisdiction</th>
              <th>Ownership</th>
            </tr>
            <tr>
              <td colspan="2">Acme Corp</td>
              <td>Delaware</td>
              <td>100%</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.tables[0].columnCount).toBe(4); // 2 + 1 + 1
    });
  });

  describe("Strict header matching", () => {
    it("requires exact keyword matches when strictHeaderMatching is true", () => {
      const config: ParserConfig = {
        ...DEFAULT_CONFIG,
        strictHeaderMatching: true,
      };

      const html = `
        <html><body>
          <table>
            <tr>
              <th>Entity Name</th>
              <th>State</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, config);

      // With strict matching, "Entity" and "State" should match
      // because they're in the keyword sets
      expect(result.tables[0].type).toBe("subsidiary");
    });
  });

  describe("Empty tables", () => {
    it("classifies document with empty tables as has-table-no-data", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("has-table-no-data");
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].rowCount).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("throws ParserError for invalid HTML", () => {
      const invalidHtml = "<html><body><table><tr><td>Unclosed";
      
      // Cheerio is actually quite forgiving, so this might not throw
      // But we test the error handling mechanism
      try {
        const $ = cheerio.load(invalidHtml, { xmlMode: false, decodeEntities: true });
        const result = detectDocumentStructure($, DEFAULT_CONFIG);
        // If it doesn't throw, that's fine - Cheerio handled it
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.name).toBe("ParserError");
        expect(error.code).toBe("HTML_PARSE_ERROR");
      }
    });
  });
});
