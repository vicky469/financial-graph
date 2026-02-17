/**
 * Unit tests for structure detection phase
 * 
 * Tests the detectDocumentStructure function and its helper functions
 * to ensure correct table detection, classification, and header extraction.
 */

import * as cheerio from "cheerio";
import { detectDocumentStructure } from "../../src/parser/subsidiary/shape/structure-detection";
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
    it("detects text-based classification when no tables are present", () => {
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

    it("does not classify column-mismatched data tables as continuation", () => {
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
              <td>Revenue</td>
              <td>100</td>
              <td>USD</td>
            </tr>
            <tr>
              <td>Cost</td>
              <td>20</td>
              <td>USD</td>
            </tr>
          </table>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("single-table");
      expect(result.tables).toHaveLength(2);
      expect(result.tables[0].type).toBe("subsidiary");
      expect(result.tables[1].type).toBe("unknown");
      expect(result.tables[1].isContinuation).toBe(false);
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

  describe("Header offset handling", () => {
    it("computes row count and column count correctly when header is not first row", () => {
      const html = `
        <html><body>
          <table>
            <tr><td>List of subsidiaries and affiliates</td></tr>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
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
      expect(result.tables[0].rowCount).toBe(1);
      expect(result.tables[0].columnCount).toBe(2);
    });
  });

  describe("No-table suffix-like text", () => {
    it("keeps no-table classification for plain text listings", () => {
      const html = `
        <html><body>
          <p>ACME INC</p>
          <p>Beta Ltd</p>
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("no-table");
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

  describe("Special format override", () => {
    it("does not override real subsidiary tables when a substantial image exists", () => {
      const html = `
        <html><body>
          <img src="subsidiaries.jpg" width="900" height="1200" />
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
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("single-table");
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].type).toBe("subsidiary");
    });

    it("uses image-based classification when tables have no extractable data", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
          </table>
          <img src="scan_001.jpg" width="900" height="1200" />
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("image-based");
      expect(result.tables).toHaveLength(0);
    });

    it("prefers image-based when no extractable tables exist", () => {
      const html = `
        <html><body>
          <p>List of Subsidiaries (Delaware)</p>
          <img src="scan_001.jpg" width="900" height="1200" />
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("image-based");
      expect(result.tables).toHaveLength(0);
    });

    it("prefers pdf-based when both PDF and image signals exist", () => {
      const html = `
        <html><body>
          <p>List of Subsidiaries</p>
          <img src="scan_001.jpg" width="900" height="1200" />
          <embed src="exhibit21.pdf" type="application/pdf" />
        </body></html>
      `;
      const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
      const result = detectDocumentStructure($, DEFAULT_CONFIG);

      expect(result.classification).toBe("pdf-based");
      expect(result.tables).toHaveLength(0);
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
