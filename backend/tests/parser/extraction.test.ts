/**
 * Tests for extractSubsidiaries function
 *
 * Focuses on column detection and edge cases
 */

import { load } from "cheerio";
import { extractSubsidiaries } from "../../src/parser/subsidiary/data/extraction";
import { MissingColumnError } from "../../src/parser/subsidiary/data/errors";

describe("extractSubsidiaries", () => {
  const mockFiling = {
    accession_number: "000100263825000053",
    cik: "1002638",
    filingCompanyId: "company_test",
    filingCompanyName: "Test Parent Co",
  };

  describe("Column Detection", () => {
    it("should detect jurisdiction column with standard headers", () => {
      const html = `
        <table>
          <tr>
            <td>Corporation Name</td>
            <td>Jurisdiction</td>
          </tr>
          <tr>
            <td>Acme Corporation</td>
            <td>Delaware</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        0, // header row index
        ["Corporation Name", "Jurisdiction"],
        mockFiling,
        {}
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Acme Corporation");
      expect(result[0].jurisdiction).toBe("Delaware");
    });

    it("should use provided headers even if they don't match jurisdiction keywords", () => {
      const html = `
        <table>
          <tr>
            <td>Corporation Name</td>
            <td>Location</td>
          </tr>
          <tr>
            <td>Acme Corporation</td>
            <td>Delaware</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        0,
        ["Corporation Name", "Location"], // No jurisdiction keyword, but still valid headers
        mockFiling,
        {}
      );

      // Should still process using the provided column indices
      // The jurisdiction column detection happens at a higher level
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Acme Corporation");
      expect(result[0].jurisdiction).toBe("Delaware");
    });

    it("should not throw error when headers are provided (even without jurisdiction keyword)", () => {
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>Country</td>
          </tr>
          <tr>
            <td>Acme</td>
            <td>US</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      // When headers are provided, extractSubsidiaries should work
      // The jurisdiction column detection happens at the parseTable level
      const result = extractSubsidiaries(
        $,
        rows,
        0,
        ["Name", "Country"],
        mockFiling,
        {}
      );

      // Should process successfully
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should throw MissingColumnError only when no headers provided and no previous headers available", () => {
      // This simulates a continuation table when no previous headers are available
      const html = `
        <table>
          <tr>
            <td>Webroot, LLC</td>
            <td>Delaware, United States</td>
          </tr>
          <tr>
            <td>ZixCorp Systems, Inc.</td>
            <td>Delaware, United States</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      // When there's no header row and empty headers array, should throw error
      expect(() => {
        extractSubsidiaries(
          $,
          rows,
          -1, // No header row found
          [], // No headers provided
          mockFiling,
          {}
        );
      }).toThrow(MissingColumnError);
    });
  });

  describe("Inline Footnote Rows", () => {
    it("stops row extraction when inline footnote section starts in the same table", () => {
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>Jurisdiction</td>
            <td>Percentage of ownership</td>
          </tr>
          <tr>
            <td>Alpha Holdings Ltd.</td>
            <td>United Kingdom</td>
            <td>100%</td>
          </tr>
          <tr>
            <td>Beta LLC</td>
            <td>Delaware</td>
            <td>100%</td>
          </tr>
          <tr>
            <td><sup>2</sup> Formerly Intensity Holdings Limited</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td><sup>3</sup> Wholly-owned subsidiary of Alpha Holdings Ltd.</td>
            <td></td>
            <td></td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");
      const result = extractSubsidiaries(
        $,
        rows,
        0,
        ["Name", "Jurisdiction", "Percentage of ownership"],
        mockFiling,
      );

      expect(result).toHaveLength(2);
      expect(result.map((sub) => sub.name)).toEqual([
        "Alpha Holdings Ltd.",
        "Beta LLC",
      ]);
      expect(result.some((sub) => sub.name.includes("Formerly"))).toBe(false);
    });

    it("stops extraction for roman-numeral inline footnote rows", () => {
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>Jurisdiction</td>
            <td>Percentage of ownership</td>
          </tr>
          <tr>
            <td>Gamma Holdings Inc.</td>
            <td>Delaware</td>
            <td>100%</td>
          </tr>
          <tr>
            <td>Delta Ltd.</td>
            <td>United Kingdom</td>
            <td>100%</td>
          </tr>
          <tr>
            <td>IV. Formerly Delta Legacy Ltd.</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>V) Wholly-owned by Gamma Holdings Inc.</td>
            <td></td>
            <td></td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");
      const result = extractSubsidiaries(
        $,
        rows,
        0,
        ["Name", "Jurisdiction", "Percentage of ownership"],
        mockFiling,
      );

      expect(result).toHaveLength(2);
      expect(result.map((sub) => sub.name)).toEqual([
        "Gamma Holdings Inc.",
        "Delta Ltd.",
      ]);
    });

    it("stops extraction for 1), I), a) inline marker variants", () => {
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>Jurisdiction</td>
            <td>Percentage of ownership</td>
          </tr>
          <tr>
            <td>Epsilon Holdings Inc.</td>
            <td>Delaware</td>
            <td>100%</td>
          </tr>
          <tr>
            <td>Zeta Ltd.</td>
            <td>United Kingdom</td>
            <td>100%</td>
          </tr>
          <tr>
            <td>1) Numeric marker note row.</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>i) Roman marker note row.</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>A) Alphabetic marker note row.</td>
            <td></td>
            <td></td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");
      const result = extractSubsidiaries(
        $,
        rows,
        0,
        ["Name", "Jurisdiction", "Percentage of ownership"],
        mockFiling,
      );

      expect(result).toHaveLength(2);
      expect(result.map((sub) => sub.name)).toEqual([
        "Epsilon Holdings Inc.",
        "Zeta Ltd.",
      ]);
    });
  });
});
