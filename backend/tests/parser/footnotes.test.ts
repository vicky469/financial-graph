/**
 * Tests for footnote extraction utilities
 *
 * Test cases based on real SEC filings:
 * - https://www.sec.gov/Archives/edgar/data/746515/000110465902001275/j3135_ex21d1.htm (Expeditors)
 * - https://www.sec.gov/Archives/edgar/data/946394/000121390025037643/ea023851301ex8_ellomay.htm (Ellomay)
 */

import { load } from "cheerio";
import {
  extractDocumentFootnotes,
  extractFootnoteRefFromName,
  parseOwnershipWithFootnoteRef,
} from "../../src/parser/subsidiary/footnotes";

describe("extractFootnoteRefFromName", () => {
  it("extracts (n) style refs from name", () => {
    expect(
      extractFootnoteRefFromName("EI Freight Forwarding Co. Ltd. (12)")
    ).toEqual(["12"]);
    expect(
      extractFootnoteRefFromName("Expeditors (Thailand) Ltd. (4)")
    ).toEqual(["4"]);
  });

  it("extracts multiple refs", () => {
    expect(extractFootnoteRefFromName("Subsidiary (1)(2)(3)")).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(extractFootnoteRefFromName("Company Name (1)(4)")).toEqual([
      "1",
      "4",
    ]);
  });

  it("extracts *n style refs", () => {
    expect(extractFootnoteRefFromName("Company *1")).toEqual(["1"]);
    expect(extractFootnoteRefFromName("Company *1 *2")).toEqual(["1", "2"]);
  });

  it("returns empty for no refs", () => {
    expect(extractFootnoteRefFromName("Normal Company Name")).toEqual([]);
    expect(extractFootnoteRefFromName("Company (LLC)")).toEqual([]); // LLC is not a number
  });
});

describe("parseOwnershipWithFootnoteRef", () => {
  it("extracts ownership and ref from 100%1 pattern", () => {
    expect(parseOwnershipWithFootnoteRef("100%1")).toEqual({
      ownership: 100,
      refs: ["1"],
    });
    expect(parseOwnershipWithFootnoteRef("51%2")).toEqual({
      ownership: 51,
      refs: ["2"],
    });
    expect(parseOwnershipWithFootnoteRef("83.33%22")).toEqual({
      ownership: 83.33,
      refs: ["22"],
    });
  });

  it("extracts ownership without ref", () => {
    expect(parseOwnershipWithFootnoteRef("100%")).toEqual({
      ownership: 100,
      refs: [],
    });
    expect(parseOwnershipWithFootnoteRef("51%")).toEqual({
      ownership: 51,
      refs: [],
    });
  });

  it("returns undefined for non-ownership text", () => {
    expect(parseOwnershipWithFootnoteRef("Delaware")).toEqual({
      ownership: undefined,
      refs: [],
    });
    expect(parseOwnershipWithFootnoteRef("")).toEqual({
      ownership: undefined,
      refs: [],
    });
  });
});

describe("extractDocumentFootnotes", () => {
  it("extracts footnotes from paragraph elements", () => {
    const html = `
      <html>
        <body>
          <table><tr><td>Main content</td></tr></table>
          <p>(1) For purposes of this list, the Company owns 100%.</p>
          <p>(2) Except as otherwise noted, each subsidiary does business in its own name.</p>
        </body>
      </html>
    `;
    const $ = load(html);
    const footnotes = extractDocumentFootnotes($);

    expect(footnotes["1"]).toContain("For purposes of this list");
    expect(footnotes["2"]).toContain("Except as otherwise noted");
  });

  it("extracts footnotes from table cells", () => {
    const html = `
      <html>
        <body>
          <table>
            <tr><td>(1)</td><td>Company has 75% controlling interest.</td></tr>
            <tr><td>(2)</td><td>Second tier subsidiary.</td></tr>
          </table>
        </body>
      </html>
    `;
    const $ = load(html);
    const footnotes = extractDocumentFootnotes($);

    expect(footnotes["1"]).toBe("Company has 75% controlling interest.");
    expect(footnotes["2"]).toBe("Second tier subsidiary.");
  });

  it("extracts footnotes with different formats", () => {
    const html = `
      <html>
        <body>
          <p>1. First footnote text here.</p>
          <p>2) Second footnote text here.</p>
          <div>*3 Third footnote text here.</div>
        </body>
      </html>
    `;
    const $ = load(html);
    const footnotes = extractDocumentFootnotes($);

    expect(footnotes["1"]).toBe("First footnote text here.");
    expect(footnotes["2"]).toBe("Second footnote text here.");
    expect(footnotes["3"]).toBe("Third footnote text here.");
  });

  it("handles Expeditors-style footnotes", () => {
    // Real pattern from Expeditors filing
    const html = `
      <html>
        <body>
          <p>(4) Dual ownership; of the 100%, 49% is owned by the Company and 51% is owned by EI Holdings, Ltd.</p>
          <p>(5) Second tier subsidiary.</p>
          <p>(8) Company has 75% controlling interest in subsidiary.</p>
          <p>(12) Company has 50% interest via a second tier subsidiary.</p>
        </body>
      </html>
    `;
    const $ = load(html);
    const footnotes = extractDocumentFootnotes($);

    expect(footnotes["4"]).toContain("Dual ownership");
    expect(footnotes["5"]).toBe("Second tier subsidiary.");
    expect(footnotes["8"]).toContain("75% controlling interest");
    expect(footnotes["12"]).toContain("50% interest");
  });

  it("skips very long text (not footnotes)", () => {
    const html = `
      <html>
        <body>
          <p>(1) Short footnote.</p>
          <p>${"x".repeat(600)}</p>
        </body>
      </html>
    `;
    const $ = load(html);
    const footnotes = extractDocumentFootnotes($);

    expect(footnotes["1"]).toBe("Short footnote.");
    expect(Object.keys(footnotes).length).toBe(1);
  });
});
