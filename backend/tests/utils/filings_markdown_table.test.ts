import { describe, expect, test } from "vitest";
import {
  buildFilingUrl,
  parseFormTypes,
  parsePdfIdentity,
  renderMarkdownTable,
} from "../../src/jobs/filings_markdown_table";

describe("parseFormTypes", () => {
  test("extracts form types from argv-style args", () => {
    expect(parseFormTypes(["-2025", "10-K", "20-F"])).toEqual(["10-K", "20-F"]);
  });

  test("ignores flags and year tokens", () => {
    expect(parseFormTypes(["-2025", "10-K", "--quarters=Q1,Q2"])).toEqual(["10-K"]);
  });
});

describe("parsePdfIdentity", () => {
  test("parses valid pdf filename", () => {
    const parsed = parsePdfIdentity("100826_000100291025000055_aee-20241231.pdf");
    expect(parsed).toEqual({
      fileName: "100826_000100291025000055_aee-20241231.pdf",
      cikNoPad: "100826",
      accessionNumberNoDashes: "000100291025000055",
      documentName: "aee-20241231",
    });
  });

  test("returns null for invalid shape", () => {
    expect(parsePdfIdentity("bad.pdf")).toBeNull();
    expect(parsePdfIdentity("abc_0001_doc.pdf")).toBeNull();
    expect(parsePdfIdentity("100826_abc_doc.pdf")).toBeNull();
  });
});

describe("buildFilingUrl", () => {
  test("constructs SEC archives URL from parsed identity", () => {
    const identity = parsePdfIdentity("100826_000100291025000055_aee-20241231.pdf");
    expect(identity).not.toBeNull();
    if (!identity) return;

    expect(buildFilingUrl(identity)).toBe(
      "https://www.sec.gov/Archives/edgar/data/100826/000100291025000055/aee-20241231.htm",
    );
  });
});

describe("renderMarkdownTable", () => {
  test("renders required header and row values", () => {
    const md = renderMarkdownTable([
      {
        cik: "0000107136",
        accession_number: "0000107136-25-000003",
        company_name: "Sample Co",
        date_filed: "2025-01-15",
        file_path: "/tmp/a.pdf",
        filing_url: "https://www.sec.gov/Archives/edgar/data/107136/000010713625000003/a.htm",
        status: "",
      },
    ]);

    expect(md).toContain(
      "| cik | accession_number | company_name | date_filed | file_path | filing_url | status |",
    );
    expect(md).toContain(
      "| 0000107136 | 0000107136-25-000003 | Sample Co | 2025-01-15 | /tmp/a.pdf | https://www.sec.gov/Archives/edgar/data/107136/000010713625000003/a.htm |  |",
    );
  });
});
