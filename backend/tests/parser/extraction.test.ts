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
});
