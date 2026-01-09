/**
 * Tests for extractSubsidiaries function
 * 
 * Focuses on column detection and edge cases
 */

import { load } from "cheerio";
import { extractSubsidiaries } from "../../src/parsers/subsidiary/extraction";
import { MissingColumnError } from "../../src/parsers/subsidiary/errors";

// Mock uuid to avoid ESM issues
jest.mock("uuid", () => ({
  v5: jest.fn(() => "mock-uuid-12345"),
}));

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

  describe("Colspan Tables", () => {
    it("should handle tables with colspan and empty width-defining cells (Brink's filing pattern)", () => {
      // This reproduces the Brink's filing structure where:
      // - First row has 6 empty <td> for column widths
      // - Data rows have 2 <td colspan="3"> for actual content
      // - Nesting is indicated by CSS padding (e.g., padding:2px 1pt 2px 13pt)
      const html = `
        <table>
          <tr>
            <td style="width:1.0%"></td>
            <td style="width:78.930%"></td>
            <td style="width:0.1%"></td>
            <td style="width:1.0%"></td>
            <td style="width:18.870%"></td>
            <td style="width:0.1%"></td>
          </tr>
          <tr>
            <td colspan="3" style="padding:2px 1pt;text-align:left;vertical-align:bottom">Company</td>
            <td colspan="3" style="padding:2px 1pt;text-align:left;vertical-align:bottom">Jurisdiction</td>
          </tr>
          <tr>
            <td colspan="3" style="padding:2px 1pt;text-align:left;vertical-align:bottom">Glen Allen Development, Inc.</td>
            <td colspan="3" style="padding:2px 1pt 2px 7pt;text-align:left;vertical-align:bottom">Delaware</td>
          </tr>
          <tr>
            <td colspan="3" style="padding:2px 1pt 2px 13pt;text-align:left;vertical-align:bottom">Liberty National Development Company, LLC (32.5%)</td>
            <td colspan="3" style="padding:2px 1pt 2px 7pt;text-align:left;vertical-align:bottom">Delaware</td>
          </tr>
          <tr>
            <td colspan="3" style="padding:2px 1pt 2px 13pt;text-align:left;vertical-align:bottom">New Liberty Residential Urban Renewal Company, LLC (17.5%)</td>
            <td colspan="3" style="padding:2px 1pt 2px 7pt;text-align:left;vertical-align:bottom">New Jersey</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        1, // header row index (row 0 is width definitions)
        ["Company", "Jurisdiction"],
        mockFiling,
        {}
      );

      // Should extract all 3 subsidiaries
      expect(result).toHaveLength(3);
      
      // First subsidiary - no nesting
      expect(result[0].name).toBe("Glen Allen Development, Inc.");
      expect(result[0].jurisdiction).toBe("Delaware");
      expect(result[0].nestingLevel).toBe(0);
      
      // Second subsidiary - nested with ownership in name
      expect(result[1].name).toBe("Liberty National Development Company, LLC");
      expect(result[1].jurisdiction).toBe("Delaware");
      expect(result[1].ownership).toBe(32.5);
      expect(result[1].nestingLevel).toBeGreaterThan(0);
      expect(result[1].parentName).toBe("Glen Allen Development, Inc.");
      
      // Third subsidiary - nested with ownership in name
      expect(result[2].name).toBe("New Liberty Residential Urban Renewal Company, LLC");
      expect(result[2].jurisdiction).toBe("New Jersey");
      expect(result[2].ownership).toBe(17.5);
      expect(result[2].nestingLevel).toBeGreaterThan(0);
    });

    it("should handle tables with &nbsp; spacer cells between columns (Embraer filing pattern)", () => {
      // This reproduces the Embraer filing structure where:
      // - 3 cells per row: Name (80%), empty spacer with &nbsp; (2%), Jurisdiction (18%)
      // - The spacer cell has no colspan but contains only &nbsp;
      // - Without filtering, header detection uses 3 cells but extraction sees 2, causing index mismatch
      const html = `
        <table>
          <tr>
            <td style="width:80%"><b>Name</b></td>
            <td style="width:2%">&nbsp;&nbsp;</td>
            <td style="width:18%"><b>Jurisdiction</b></td>
          </tr>
          <tr>
            <td>Embraer Aircraft Holding, Inc.</td>
            <td>&nbsp;&nbsp;</td>
            <td>Delaware, U.S.A.</td>
          </tr>
          <tr>
            <td>Embraer Aviation International – EAI</td>
            <td>&nbsp;&nbsp;</td>
            <td>France</td>
          </tr>
          <tr>
            <td>OGMA – Indústria Aeronáutica de Portugal S.A.</td>
            <td>&nbsp;&nbsp;</td>
            <td>Portugal</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        0, // header row index
        ["Name", "Jurisdiction"], // Headers after filtering spacer cells
        mockFiling,
        {}
      );

      // Should extract all 3 subsidiaries with correct jurisdictions
      expect(result).toHaveLength(3);
      
      expect(result[0].name).toBe("Embraer Aircraft Holding, Inc.");
      expect(result[0].jurisdiction).toBe("Delaware, U.S.A.");
      
      expect(result[1].name).toBe("Embraer Aviation International – EAI");
      expect(result[1].jurisdiction).toBe("France");
      
      expect(result[2].name).toBe("OGMA – Indústria Aeronáutica de Portugal S.A.");
      expect(result[2].jurisdiction).toBe("Portugal");
    });

    it("should handle tables with empty colspan cells in header row (K-Infrax filing pattern)", () => {
      // This reproduces the K-Infrax filing structure where:
      // - Header row has 6 cells with colspan, but 4 are empty spacers
      // - Data rows have only 2 cells (name with colspan=45, jurisdiction with colspan=9)
      // - Without proper filtering, headers would be ['Name', 'Column_1', 'Column_2', 'Column_3', 'Column_4', 'Jurisdiction']
      //   but data only has 2 cells, causing jurisdiction index mismatch
      const html = `
        <table>
          <tr>
            <td style="width:1.0%"></td>
            <td style="width:35%"></td>
            <td style="width:0.1%"></td>
            <td style="width:1.0%"></td>
            <td style="width:35%"></td>
            <td style="width:0.1%"></td>
          </tr>
          <tr>
            <td colspan="9">Name</td>
            <td colspan="9"></td>
            <td colspan="9"></td>
            <td colspan="9"></td>
            <td colspan="9"></td>
            <td colspan="9">Jurisdiction</td>
          </tr>
          <tr>
            <td colspan="45">K-INFRA Denali Aggregator GP LLC</td>
            <td colspan="9">Delaware</td>
          </tr>
          <tr>
            <td colspan="45">K-INFRA Devonshire Aggregator GP Limited</td>
            <td colspan="9">Cayman Islands</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        1, // header row index (row 0 is width definitions)
        ["Name", "Jurisdiction"], // Headers after filtering empty colspan cells
        mockFiling,
        {}
      );

      // Should extract both subsidiaries with correct jurisdictions
      expect(result).toHaveLength(2);
      
      expect(result[0].name).toBe("KINFRA Denali Aggregator GP LLC");
      expect(result[0].jurisdiction).toBe("Delaware");
      
      expect(result[1].name).toBe("KINFRA Devonshire Aggregator GP Limited");
      expect(result[1].jurisdiction).toBe("Cayman Islands");
    });

    it("should skip rows with only empty width-defining cells", () => {
      const html = `
        <table>
          <tr>
            <td style="width:1.0%"></td>
            <td style="width:50%"></td>
            <td style="width:1.0%"></td>
            <td style="width:48%"></td>
          </tr>
          <tr>
            <td colspan="2">Name</td>
            <td colspan="2">Jurisdiction</td>
          </tr>
          <tr>
            <td colspan="2">Test Corp</td>
            <td colspan="2">Delaware</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        1,
        ["Name", "Jurisdiction"],
        mockFiling,
        {}
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test Corp");
    });
  });

  describe("Roman Numeral Nesting Indicators", () => {
    it("should handle Roman numerals as nesting level indicators (Fluor filing pattern - accession 000162828025005924)", () => {
      // This reproduces the Fluor filing structure where:
      // - Headers have 3 columns: Name, Ownership, Jurisdiction
      // - Data rows have 4 cells: [Roman Numeral, Name, Ownership, Jurisdiction]
      // - The Roman numeral column has no header (explained in a note row)
      // - The parser should detect the offset and skip Roman numerals
      const html = `
        <table>
          <tr>
            <td colspan="48">Subsidiary Name</td>
            <td colspan="3">Percent Holding</td>
            <td colspan="3">Organized Under Laws of</td>
          </tr>
          <tr>
            <td colspan="3">I</td>
            <td colspan="45">American Construction Equipment Company, Inc.</td>
            <td colspan="3">100.0000</td>
            <td colspan="3">California</td>
          </tr>
          <tr>
            <td colspan="3">II</td>
            <td colspan="45">AMECO Holdings, Inc.</td>
            <td colspan="3">100.0000</td>
            <td colspan="3">California</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td colspan="3">III</td>
            <td colspan="42">AMECO Caribbean, Inc.</td>
            <td colspan="3">100.0000</td>
            <td colspan="3">California</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td colspan="3">III</td>
            <td colspan="42">AMECO Project Services, Inc.</td>
            <td colspan="3">100.0000</td>
            <td colspan="3">Philippines</td>
          </tr>
          <tr>
            <td colspan="3">II</td>
            <td colspan="45">Fluor Management and Technical Services, Inc.</td>
            <td colspan="3">100.0000</td>
            <td colspan="3">California</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        0, // header row index
        ["Subsidiary Name", "Percent Holding", "Organized Under Laws of"],
        {
          accession_number: "000162828025005924",
          cik: "1124198",
        },
        {}
      );

      // Should extract all subsidiaries correctly without treating Roman numerals as names
      expect(result).toHaveLength(5);

      // MAIN ISSUE BEING TESTED: Roman numerals should NOT be treated as names
      // This was causing missing jurisdictions in accession 000162828025005924

      // First tier (I) - should have actual name, not "I"
      expect(result[0].name).toBe("American Construction Equipment Company, Inc.");
      expect(result[0].jurisdiction).toBe("California");
      // Note: Ownership parsing for "100.0000" format (decimal without %) is not currently supported
      // Note: Nesting level from Roman numerals (vs indentation) is not currently supported
      // These are separate issues from the Roman numeral detection

      // Second tier (II) - should have actual name, not "II"
      expect(result[1].name).toBe("AMECO Holdings, Inc.");
      expect(result[1].jurisdiction).toBe("California");

      // Third tier (III) - should have actual name, not "III"
      expect(result[2].name).toBe("AMECO Caribbean, Inc.");
      expect(result[2].jurisdiction).toBe("California");

      expect(result[3].name).toBe("AMECO Project Services, Inc.");
      expect(result[3].jurisdiction).toBe("Philippines");

      // Another second tier (II)
      expect(result[4].name).toBe("Fluor Management and Technical Services, Inc.");
      expect(result[4].jurisdiction).toBe("California");

      // CRITICAL: No subsidiary should have Roman numerals as names
      result.forEach((sub, idx) => {
        expect(sub.name).not.toMatch(/^I{1,3}$/); // Should not be "I", "II", or "III"
        expect(sub.name).not.toMatch(/^IV$/); // Should not be "IV"
        expect(sub.name).not.toMatch(/^V{1,3}$/); // Should not be "V", "VI", "VII", "VIII"
        expect(sub.jurisdiction).toBeTruthy(); // All should have jurisdictions
      });
    });

    it("should handle Roman numerals in first cell only (simpler pattern)", () => {
      // Simpler case where Roman numeral is always in first cell
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>Jurisdiction</td>
          </tr>
          <tr>
            <td>I</td>
            <td>First Tier Corp</td>
            <td>Delaware</td>
          </tr>
          <tr>
            <td>II</td>
            <td>Second Tier LLC</td>
            <td>California</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        0,
        ["Name", "Jurisdiction"],
        mockFiling,
        {}
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("First Tier Corp");
      expect(result[0].name).not.toBe("I");
      expect(result[0].jurisdiction).toBe("Delaware");

      expect(result[1].name).toBe("Second Tier LLC");
      expect(result[1].name).not.toBe("II");
      expect(result[1].jurisdiction).toBe("California");
    });
  });

  describe("Zero-Width Characters", () => {
    it("should filter out cells with only zero-width characters (Golden Minerals filing pattern - accession 000155837025004847)", () => {
      // This reproduces the Golden Minerals (AUMN) filing structure where:
      // - Header row has 3 cells: "NAME", zero-width space, "JURISDICTION OF FORMATION"
      // - Data rows have 2 cells: Name (colspan="2"), Jurisdiction
      // - The parser should filter out the zero-width space cell to avoid column misalignment
      const html = `
        <table>
          <tr>
            <td><b>NAME</b></td>
            <td>&#8203;</td>
            <td><b>JURISDICTION OF FORMATION</b></td>
          </tr>
          <tr>
            <td colspan="2">ASM Services S.a r.l.&#8204;</td>
            <td>Luxembourg</td>
          </tr>
          <tr>
            <td colspan="2">Silex Spain, S.L.&#8204;</td>
            <td>Spain</td>
          </tr>
          <tr>
            <td colspan="2">Golden Minerals Services Corp.&#8204;</td>
            <td>United States</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        0, // header row index
        ["NAME", "JURISDICTION OF FORMATION"], // Expected after filtering zero-width cell
        {
          accession_number: "000155837025004847",
          cik: "1011509",
        },
        {}
      );

      // MAIN ISSUE BEING TESTED: Zero-width characters should not create phantom columns
      // This was causing missing jurisdictions for ALL subsidiaries in accession 000155837025004847

      expect(result).toHaveLength(3);

      // All subsidiaries should have proper jurisdictions
      // Note: Names may have trailing zero-width characters, which is a separate issue
      // The critical issue here is that jurisdictions should NOT be empty
      expect(result[0].name).toContain("ASM Services S.a r.l.");
      expect(result[0].jurisdiction).toBe("Luxembourg");
      expect(result[0].jurisdiction).not.toBe(""); // Must not be empty!

      expect(result[1].name).toContain("Silex Spain, S.L.");
      expect(result[1].jurisdiction).toBe("Spain");
      expect(result[1].jurisdiction).not.toBe("");

      expect(result[2].name).toContain("Golden Minerals Services Corp.");
      expect(result[2].jurisdiction).toBe("United States");
      expect(result[2].jurisdiction).not.toBe("");

      // CRITICAL: No subsidiary should have empty jurisdiction
      result.forEach((sub) => {
        expect(sub.jurisdiction).toBeTruthy();
        expect(sub.jurisdiction).not.toBe("");
      });
    });

    it("should handle various zero-width characters in cells", () => {
      // Test all common zero-width characters
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>&#8203;</td>
            <td>&#8204;</td>
            <td>&#8205;</td>
            <td>&#65279;</td>
            <td>Jurisdiction</td>
          </tr>
          <tr>
            <td colspan="5">Test Corp</td>
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
        ["Name", "Jurisdiction"], // Should filter out all zero-width cells
        mockFiling,
        {}
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test Corp");
      expect(result[0].jurisdiction).toBe("Delaware");
    });
  });

  describe("Empty Column Cells", () => {
    it("should handle rows with empty first column (Provident Financial Services pattern - accession 000162828025008991)", () => {
      // This reproduces the Provident Financial Services filing structure where:
      // - Header row has 3 columns: Parent Company, Subsidiary Companies, State of Incorporation
      // - First data row has all 3 columns filled
      // - Subsequent rows have first column EMPTY (not just zero-width, actually empty)
      // - After filtering, subsequent rows only have 2 cells instead of 3
      // - The parser must handle jurisdiction index being out of bounds
      const html = `
        <table>
          <tr>
            <td colspan="3">Parent Company</td>
            <td colspan="3">Subsidiary Companies</td>
            <td colspan="3">State of Incorporation</td>
          </tr>
          <tr>
            <td colspan="3">Provident Financial Services, Inc.</td>
            <td colspan="3">Provident Bank</td>
            <td colspan="3">New Jersey</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td colspan="3">Sussex Capital Trust II (non-consolidated)</td>
            <td colspan="3">Delaware</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td colspan="3">1st Constitution Capital Trust II (non-consolidated)</td>
            <td colspan="3">Delaware</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td colspan="3">Lakeland Bancorp Capital Trust II (non-consolidated)</td>
            <td colspan="3">Delaware</td>
          </tr>
        </table>
      `;

      const $ = load(html);
      const rows = $("tr");

      const result = extractSubsidiaries(
        $,
        rows,
        0, // header row index
        ["Parent Company", "Subsidiary Companies", "State of Incorporation"],
        {
          accession_number: "000162828025008991",
          cik: "1178970",
        },
        {}
      );

      // MAIN ISSUE BEING TESTED: Empty first column causes cellCount < jurColIdx
      // This was causing missing jurisdictions for subsidiaries 2-4 in accession 000162828025008991

      // Note: The parser extracts one subsidiary per row from the first non-empty column
      expect(result).toHaveLength(4);

      // First row extracts from "Parent Company" column
      expect(result[0].name).toContain("Provident Financial Services");
      expect(result[0].jurisdiction).toBe("New Jersey");

      // Subsequent rows have empty first column - jurisdiction must still be found from last column
      // This is the KEY BUG: when first column is empty, cellCount=2 but jurColIdx=2 (out of bounds)
      expect(result[1].name).toContain("Sussex Capital Trust II");
      expect(result[1].jurisdiction).toBe("Delaware");
      expect(result[1].jurisdiction).not.toBe(""); // Must not be empty!

      expect(result[2].name).toContain("1st Constitution Capital Trust II");
      expect(result[2].jurisdiction).toBe("Delaware");
      expect(result[2].jurisdiction).not.toBe("");

      expect(result[3].name).toContain("Lakeland Bancorp Capital Trust II");
      expect(result[3].jurisdiction).toBe("Delaware");
      expect(result[3].jurisdiction).not.toBe("");

      // CRITICAL: No subsidiary should have empty jurisdiction
      result.forEach((sub) => {
        expect(sub.jurisdiction).toBeTruthy();
        expect(sub.jurisdiction).not.toBe("");
      });
    });
  });

  describe("Parent ID Assignment", () => {
    it("should assign filing company ID as default parent", () => {
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>Jurisdiction</td>
          </tr>
          <tr>
            <td>Alpha Holdings</td>
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
        ["Name", "Jurisdiction"],
        mockFiling,
        {}
      );

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBeDefined();
      // Parent ID is generated from CIK, but we mocked uuid so just check it exists
      expect(result[0].parentId).toBe("mock-uuid-12345");
    });

    it("should handle nested subsidiaries with parent relationships", () => {
      const html = `
        <table>
          <tr>
            <td>Name</td>
            <td>Jurisdiction</td>
          </tr>
          <tr>
            <td>Parent Corporation</td>
            <td>Delaware</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;&nbsp;&nbsp;Child Corporation</td>
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
        ["Name", "Jurisdiction"],
        mockFiling,
        {}
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Parent Corporation");
      expect(result[0].nestingLevel).toBe(0);
      
      expect(result[1].name).toBe("Child Corporation");
      expect(result[1].nestingLevel).toBeGreaterThan(0);
      expect(result[1].parentId).toBe(result[0].id);
    });
  });
});
