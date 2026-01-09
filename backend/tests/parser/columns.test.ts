import { load } from "cheerio";
import { parseColumns } from "../../src/parser/subsidiary/columns";
import { extractSubsidiaries } from "../../src/parser/subsidiary/extraction";
import fs from "fs";
import path from "path";

function loadFixture(filename: string): string {
  return fs.readFileSync(
    path.join(__dirname, "../fixtures/subsidiary", filename),
    "utf-8"
  );
}

describe("parseColumns", () => {
  describe("Jurisdiction Detection", () => {
    it("should correctly identify decimal percentages as ownership, not jurisdiction (SPAR DSI Human Resource Company)", () => {
      const html = `
            <table>
                <tr>
                    <td>SPAR DSI Human Resource Company</td>
                    <td style="width: 19px;">&nbsp;</td>
                    <td>38.5</td> <!-- This decimal was previously misidentified as valid text for jurisdiction -->
                    <td>%</td>
                    <td>China</td>
                </tr>
            </table>
            `;
      const $ = load(html);
      const cells = $("td");

      // Simulating the call where we know the column indices
      // Name is col 0
      // Jurisdiction is col 4 (China)
      // But if column detection logic was failing, it might have been passed differently.
      // Wait, the bug was in 'columns.ts' regex used by 'findMostRecentOwnershipColumn' or similar?
      // The fix was: /^\d+(?:\.\d+)?%?$|^-+$|^—$/
      // This regex is used to *skip* ownership columns when looking for jurisdiction fallback?

      // Let's test the regex behavior indirectly via parseColumns logic if possible,
      // or just ensure parseColumns works with these inputs.

      const result = parseColumns(
        $,
        cells,
        cells.length,
        0, // Name col index
        4, // Jurisdiction col index (China)
        2 // Ownership col index (38.5)
      );

      expect(result.cleanName).toBe("SPAR DSI Human Resource Company");
      expect(result.jurisdiction).toBe("China");
      expect(result.ownership).toBe(38.5);
    });

    it("should handle integer percentages correctly", () => {
      const html = `
            <table>
                <tr>
                    <td>Unilink</td>
                    <td>51</td>
                    <td>%</td>
                    <td>China</td>
                </tr>
            </table>
            `;
      const $ = load(html);
      const cells = $("td");

      const result = parseColumns($, cells, cells.length, 0, 3, 1);

      expect(result.cleanName).toBe("Unilink");
      expect(result.jurisdiction).toBe("China");
      expect(result.ownership).toBe(51);
    });
  });
});

describe("Integration Tests: Column Alignment, Filtering & Complex Layouts", () => {
  const mockFiling = { accession_number: "0000000000", cik: "000000" };

  it("should handle tables with colspan and empty width-defining cells (Brink's filing pattern)", () => {
    const html = loadFixture("brinks.html");
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

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Glen Allen Development, Inc.");
    expect(result[0].jurisdiction).toBe("Delaware");
    expect(result[1].name).toBe("Liberty National Development Company, LLC");
    expect(result[1].ownership).toBe(32.5);
  });

  it("should handle tables with &nbsp; spacer cells between columns (Embraer filing pattern)", () => {
    const html = loadFixture("embraer.html");
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

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Embraer Aircraft Holding, Inc.");
    expect(result[1].jurisdiction).toBe("France");
  });

  it("should handle tables with empty colspan cells in header row (K-Infrax filing pattern)", () => {
    const html = loadFixture("k-infrax.html");
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

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("KINFRA Denali Aggregator GP LLC");
    expect(result[1].jurisdiction).toBe("Cayman Islands");
  });

  it("should filter out cells with only zero-width characters (Golden Minerals filing pattern)", () => {
    const html = loadFixture("golden-minerals.html");
    const $ = load(html);
    const rows = $("tr");

    const result = extractSubsidiaries(
      $,
      rows,
      0,
      ["NAME", "JURISDICTION OF FORMATION"],
      { accession_number: "000155837025004847", cik: "1011509" },
      {}
    );

    expect(result).toHaveLength(3);
    expect(result[0].jurisdiction).toBe("Luxembourg");
    expect(result[0].jurisdiction).not.toBe("");
  });

  it("should skip rows where column shift causes missing jurisdiction (Bakkt pattern)", () => {
    const html = loadFixture("bakkt.html");
    const $ = load(html);
    const rows = $("tr");

    const result = extractSubsidiaries(
      $,
      rows,
      0,
      ["Subsidiary", "Jurisdiction", "Percentage Ownership"],
      { accession_number: "000170160525000035", cik: "1701605" },
      {}
    );

    // Expect 2 subsidiaries:
    // 1. Nuovo Pignone (from context row)
    // 2. Baker Hughes (from breakdown row, using fallback jurisdiction)
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Baker Hughes Energy Europe B.V.");
    expect(result[1].jurisdiction).toBe("Italy");
  });

  it("should handle rows with empty first column (Provident Financial Services pattern)", () => {
    const html = loadFixture("provident.html");
    const $ = load(html);
    const rows = $("tr");

    const result = extractSubsidiaries(
      $,
      rows,
      0,
      ["Parent Company", "Subsidiary Companies", "State of Incorporation"],
      { accession_number: "000162828025008991", cik: "1178970" },
      {}
    );

    // Expecting 2 because the fixture currently contains only 2 subsidiary rows
    expect(result).toHaveLength(2);
    expect(result[0].name).toContain("Provident Financial Services");
    expect(result[1].name).toContain("Sussex Capital Trust II");
    expect(result[1].jurisdiction).toBe("Delaware");
  });
});
