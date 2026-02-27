import * as cheerio from "cheerio";
import { describe, expect, test } from "vitest";
import { parseExhibit, DEFAULT_CONFIG } from "../../src/parser/subsidiary";
import { detectDocumentStructure } from "../../src/parser/subsidiary/shape/structure-detection";
import { TableType } from "../../src/parser/subsidiary/parser-types";

const filing = {
  accession_number: "000000881825000003",
  cik: "8818",
  filingCompanyId: "avery-dennison-company-id",
};

const noFallbackConfig = { ...DEFAULT_CONFIG, fallbackPolicy: "none" as const };

function buildWdeskLikeContinuationHtml(): string {
  return `
    <html><body>
      <table>
        <tr>
          <td style="width:1%"></td>
          <td style="width:67%"></td>
          <td style="width:0.1%"></td>
          <td style="width:0.1%"></td>
          <td style="width:1%"></td>
          <td style="width:0.1%"></td>
          <td style="width:1%"></td>
          <td style="width:29%"></td>
          <td style="width:0.1%"></td>
        </tr>
        <tr>
          <td colspan="3">SUBSIDIARY(1)</td>
          <td colspan="3"></td>
          <td colspan="3">U.S. STATE OR COUNTRY IN<br>WHICH ORGANIZED</td>
        </tr>
      </table>

      <table>
        <tr>
          <td style="width:1%"></td><td style="width:68%"></td><td style="width:0.1%"></td>
          <td style="width:1%"></td><td style="width:29%"></td><td style="width:0.1%"></td>
        </tr>
        <tr>
          <td colspan="3">ADC PHILIPPINES, INC.</td>
          <td colspan="3">PHILIPPINES</td>
        </tr>
        <tr>
          <td colspan="3">ADESPAN S.R.L.</td>
          <td colspan="3">ITALY</td>
        </tr>
      </table>

      <hr style="page-break-after:always">

      <table>
        <tr>
          <td style="width:1%"></td><td style="width:68%"></td><td style="width:0.1%"></td>
          <td style="width:1%"></td><td style="width:29%"></td><td style="width:0.1%"></td>
        </tr>
        <tr>
          <td colspan="3">PAXAR FAR EAST LIMITED</td>
          <td colspan="3">HONG KONG</td>
        </tr>
        <tr>
          <td colspan="3">PAXAR DE MEXICO S. A. DE C. V.</td>
          <td colspan="3">MEXICO</td>
        </tr>
      </table>

      <table>
        <tr>
          <td style="width:1%"></td><td style="width:98.9%"></td><td style="width:0.1%"></td>
        </tr>
        <tr>
          <td>(1)</td>
          <td>Each subsidiary listed on this Exhibit 21 is a Consolidated Subsidiary</td>
        </tr>
      </table>
    </body></html>
  `;
}

describe("Wdesk continuation-table regression", () => {
  test("classifies continuation data tables and excludes footnote reference table", () => {
    const html = buildWdeskLikeContinuationHtml();
    const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
    const structure = detectDocumentStructure($, DEFAULT_CONFIG);

    const subsidiaryTables = structure.tables.filter(
      (table) => table.type === TableType.SUBSIDIARY,
    );

    expect(subsidiaryTables.map((table) => table.index)).toEqual([0, 1, 2]);
    expect(subsidiaryTables[1]?.isContinuation).toBe(true);
    expect(subsidiaryTables[2]?.isContinuation).toBe(true);
    expect(structure.tables[3]?.type).toBe(TableType.FOOTNOTE);
  });

  test.skip("parses subsidiaries from continuation tables without LLM fallback", async () => {
    const html = buildWdeskLikeContinuationHtml();
    const result = await parseExhibit(html, filing, noFallbackConfig);

    expect(result.classification).toBe("multi-table");
    expect(result.status).toBe("success");
    expect(result.subsidiaries).toHaveLength(4);

    const names = result.subsidiaries.map((sub) => sub.name);
    expect(names).toContain("ADC PHILIPPINES, INC.");
    expect(names).toContain("ADESPAN S.R.L.");
    expect(names).toContain("PAXAR FAR EAST LIMITED");
    expect(names).toContain("PAXAR DE MEXICO S. A. DE C. V.");
  });
});
