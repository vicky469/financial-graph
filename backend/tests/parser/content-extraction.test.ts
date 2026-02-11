/**
 * Unit tests for content extraction phase
 *
 * Tests the extractSubsidiaryRecords function to ensure correct row parsing,
 * record generation, and metadata calculation.
 */

import { extractSubsidiaryRecords } from "../../src/parser/subsidiary/content-extraction";
import { detectDocumentStructure } from "../../src/parser/subsidiary/structure-detection";
import { DEFAULT_CONFIG } from "../../src/parser/subsidiary/parser-types";
import type {
  ParserConfig,
  ContentExtractionInput,
} from "../../src/parser/subsidiary/parser-types";

function createInput(
  html: string,
  config: ParserConfig = DEFAULT_CONFIG
): ContentExtractionInput {
  const structure = detectDocumentStructure(html, config);
  return {
    structure,
    html,
    config,
    filing: {
      accession_number: "0001234567-24-000001",
      cik: "0001234567",
      filingCompanyId: "test-company-id",
    },
  };
}

describe("Content Extraction", () => {
  describe("Empty and no-table documents", () => {
    it("returns empty result for no-table document", () => {
      const html = "<html><body><p>No tables here</p></body></html>";
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(0);
      expect(result.maxNestingLevel).toBe(0);
    });

    it("returns empty result for tables without subsidiary keywords", () => {
      const html = `
        <html><body>
          <table>
            <tr><th>Item</th><th>Value</th></tr>
            <tr><td>Something</td><td>123</td></tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(0);
    });
  });

  describe("Single table extraction", () => {
    it("extracts subsidiaries from single table", () => {
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
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(2);

      const [acme, beta] = result.subsidiaries;
      expect(acme.name).toBe("Acme Corp");
      expect(acme.jurisdiction).toBe("Delaware");
      expect(acme.ownership).toBe(100);

      expect(beta.name).toBe("Beta LLC");
      expect(beta.jurisdiction).toBe("Nevada");
      expect(beta.ownership).toBe(80);
    });

    it("extracts subsidiaries without ownership column", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(1);
      expect(result.subsidiaries[0].name).toBe("Acme Corp");
      expect(result.subsidiaries[0].ownership).toBeUndefined();
    });
  });

  describe("Hierarchical extraction", () => {
    it("detects nesting levels from indentation", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Parent Corp</td>
              <td>Delaware</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;Child LLC</td>
              <td>Nevada</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;&nbsp;&nbsp;Grandchild Inc</td>
              <td>California</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;Another Child</td>
              <td>Texas</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(4);
      expect(result.maxNestingLevel).toBeGreaterThanOrEqual(2);

      // Check nesting levels
      const parent = result.subsidiaries.find((s) => s.name === "Parent Corp");
      expect(parent?.nestingLevel).toBe(0);
    });
  });

  describe("Multi-table extraction", () => {
    it("extracts from multiple subsidiary tables", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>First Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
          <table>
            <tr>
              <th>Company Name</th>
              <th>State</th>
            </tr>
            <tr>
              <td>Second LLC</td>
              <td>Nevada</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(2);
    });

    it("extracts from continuation tables", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>First Corp</td>
              <td>Delaware</td>
            </tr>
          </table>
          <table>
            <tr>
              <td>Second Corp</td>
              <td>Nevada</td>
            </tr>
            <tr>
              <td>Third Corp</td>
              <td>California</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(3);
    });
  });

  describe("Footnote extraction", () => {
    it("extracts footnote references when processFootnotes is true", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Acme Corp (1)</td>
              <td>Delaware</td>
            </tr>
            <tr>
              <td>Beta LLC (2)(3)</td>
              <td>Nevada</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html, {
        ...DEFAULT_CONFIG,
        processFootnotes: true,
      });
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(2);

      const [acme, beta] = result.subsidiaries;
      expect(acme.footnoteRefs).toContain("1");
      expect(beta.footnoteRefs).toContain("2");
      expect(beta.footnoteRefs).toContain("3");
    });

    it("skips footnotes HTML extraction when processFootnotes is false", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Acme Corp (1)</td>
              <td>Delaware</td>
            </tr>
          </table>
          <p>(1) This is a footnote</p>
        </body></html>
      `;
      const input = createInput(html, {
        ...DEFAULT_CONFIG,
        processFootnotes: false,
      });
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(1);
      // Inline footnote refs are still extracted (they're part of the name)
      // but the full footnotes HTML should be empty
      expect(result.footnotesHtml).toBe("");
    });
  });

  describe("Record completeness", () => {
    it("each record has all required fields", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Subsidiary Name</th>
              <th>Jurisdiction</th>
              <th>Ownership</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
              <td>100%</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(1);
      const record = result.subsidiaries[0];

      expect(record).toHaveProperty("id");
      expect(record).toHaveProperty("name");
      expect(record).toHaveProperty("jurisdiction");
      expect(record).toHaveProperty("nestingLevel");
      expect(record).toHaveProperty("footnoteRefs");

      expect(typeof record.id).toBe("string");
      expect(typeof record.name).toBe("string");
      expect(typeof record.jurisdiction).toBe("string");
      expect(typeof record.nestingLevel).toBe("number");
      expect(Array.isArray(record.footnoteRefs)).toBe(true);
    });

    it("calculates correct subsidiary count", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Name</th>
              <th>Jurisdiction</th>
            </tr>
            <tr><td>Corp1</td><td>DE</td></tr>
            <tr><td>Corp2</td><td>NV</td></tr>
            <tr><td>Corp3</td><td>CA</td></tr>
            <tr><td>Corp4</td><td>TX</td></tr>
            <tr><td>Corp5</td><td>FL</td></tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(5);
    });
  });

  describe("Column swapping handling", () => {
    it("handles jurisdiction and ownership columns in reversed order", () => {
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Name</th>
              <th>Ownership</th>
              <th>Jurisdiction</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>100%</td>
              <td>Delaware</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(1);
      expect(result.subsidiaries[0].jurisdiction).toBe("Delaware");
      expect(result.subsidiaries[0].ownership).toBe(100);
    });

    it("handles percentage in jurisdiction column position via fallback", () => {
      // When header detection fails or columns are mismatched,
      // parseColumns should scan backwards to find actual jurisdiction
      const html = `
        <html><body>
          <table>
            <tr>
              <th>Name</th>
              <th>State</th>
              <th>Percent</th>
            </tr>
            <tr>
              <td>Acme Corp</td>
              <td>Delaware</td>
              <td>100%</td>
            </tr>
          </table>
        </body></html>
      `;
      const input = createInput(html);
      const result = extractSubsidiaryRecords(input);

      expect(result.subsidiaries).toHaveLength(1);
      // Should extract Delaware as jurisdiction, not 100%
      expect(result.subsidiaries[0].jurisdiction).toBe("Delaware");
    });
  });
});
