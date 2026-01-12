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

  it("extracts alphanumeric refs like (1A), (1a)", () => {
    expect(extractFootnoteRefFromName("Company (1A)")).toEqual(["1A"]);
    expect(extractFootnoteRefFromName("Company (1a)")).toEqual(["1a"]);
    expect(extractFootnoteRefFromName("Company (2B)(3C)")).toEqual(["2B", "3C"]);
    expect(extractFootnoteRefFromName("Company *1A *2b")).toEqual(["1A", "2b"]);
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

  it("extracts ownership with alphanumeric ref", () => {
    expect(parseOwnershipWithFootnoteRef("100%1A")).toEqual({
      ownership: 100,
      refs: ["1A"],
    });
    expect(parseOwnershipWithFootnoteRef("51%2b")).toEqual({
      ownership: 51,
      refs: ["2b"],
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
    const footnotesHtml = extractDocumentFootnotes($);

    expect(footnotesHtml).toContain("For purposes of this list");
    expect(footnotesHtml).toContain("Except as otherwise noted");
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
    const footnotesHtml = extractDocumentFootnotes($);

    expect(footnotesHtml).toContain("75% controlling interest");
    expect(footnotesHtml).toContain("Second tier subsidiary");
  });

  it("extracts footnotes with different formats", () => {
    // Note: The current implementation only looks for (n) patterns in paragraphs
    // and small tables with (n) in first cell. Other formats like "1." or "*3" 
    // are not extracted at document level (only at row level via extractFootnoteRefFromName)
    const html = `
      <html>
        <body>
          <p>(1) First footnote text here.</p>
          <p>(2) Second footnote text here.</p>
          <p>(3) Third footnote text here.</p>
        </body>
      </html>
    `;
    const $ = load(html);
    const footnotesHtml = extractDocumentFootnotes($);

    expect(footnotesHtml).toContain("First footnote text here");
    expect(footnotesHtml).toContain("Second footnote text here");
    expect(footnotesHtml).toContain("Third footnote text here");
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
    const footnotesHtml = extractDocumentFootnotes($);

    expect(footnotesHtml).toContain("Dual ownership");
    expect(footnotesHtml).toContain("Second tier subsidiary");
    expect(footnotesHtml).toContain("75% controlling interest");
    expect(footnotesHtml).toContain("50% interest");
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
    const footnotesHtml = extractDocumentFootnotes($);

    expect(footnotesHtml).toContain("Short footnote");
    // Long text should not be included (implementation filters text > 500 chars)
    expect(footnotesHtml).not.toContain("x".repeat(100));
  });
});

import { preprocessFootnotesHtml } from "../../src/parser/subsidiary/footnotes-preprocessor";

describe("preprocessFootnotesHtml", () => {
  it("removes script tags", () => {
    const html = `
      <div>
        <p>(1) Footnote text here.</p>
        <script>alert('malicious');</script>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Footnote text here");
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
  });

  it("removes style tags", () => {
    const html = `
      <div>
        <style>.class { color: red; }</style>
        <p>(1) Footnote text here.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Footnote text here");
    expect(result).not.toContain("style");
    expect(result).not.toContain("color: red");
  });

  it("removes navigation elements", () => {
    const html = `
      <div>
        <nav><a href="#">Home</a></nav>
        <header><h1>Header</h1></header>
        <footer><p>Footer</p></footer>
        <p>(1) Footnote text here.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Footnote text here");
    expect(result).not.toContain("nav");
    expect(result).not.toContain("header");
    expect(result).not.toContain("footer");
    expect(result).not.toContain("Home");
    expect(result).not.toContain("Header");
    expect(result).not.toContain("Footer");
  });

  it("preserves table elements", () => {
    const html = `
      <table>
        <tr>
          <td>(1)</td>
          <td>Company has 75% controlling interest.</td>
        </tr>
        <tr>
          <td>(2)</td>
          <td>Second tier subsidiary.</td>
        </tr>
      </table>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("table");
    expect(result).toContain("75% controlling interest");
    expect(result).toContain("Second tier subsidiary");
  });

  it("preserves paragraph elements", () => {
    const html = `
      <div>
        <p>(1) First footnote text.</p>
        <p>(2) Second footnote text.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("First footnote text");
    expect(result).toContain("Second footnote text");
  });

  it("preserves list elements", () => {
    const html = `
      <div>
        <ul>
          <li>(1) First item</li>
          <li>(2) Second item</li>
        </ul>
        <ol>
          <li>(3) Third item</li>
        </ol>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("First item");
    expect(result).toContain("Second item");
    expect(result).toContain("Third item");
  });

  it("preserves footnote markers", () => {
    const html = `
      <div>
        <p>(1) Footnote with marker.</p>
        <p>(2A) Alphanumeric marker.</p>
        <p>(3b) Lowercase alphanumeric.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("(1)");
    expect(result).toContain("(2A)");
    expect(result).toContain("(3b)");
  });

  it("preserves ownership percentages", () => {
    const html = `
      <div>
        <p>(1) Company has 75% controlling interest.</p>
        <p>(2) Subsidiary owns 51% of shares.</p>
        <p>(3) 100% owned by parent.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("75%");
    expect(result).toContain("51%");
    expect(result).toContain("100%");
  });

  it("preserves company names", () => {
    const html = `
      <div>
        <p>(1) Owned by Acme Corporation.</p>
        <p>(2) Parent company is XYZ Holdings Ltd.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Acme Corporation");
    expect(result).toContain("XYZ Holdings Ltd");
  });

  it("handles empty input", () => {
    expect(preprocessFootnotesHtml("")).toBe("");
    expect(preprocessFootnotesHtml("   ")).toBe("");
  });

  it("handles malformed HTML gracefully", () => {
    const html = "<div><p>Unclosed paragraph";
    const result = preprocessFootnotesHtml(html);

    // Should not throw and should return something
    expect(result).toBeDefined();
    expect(result).toContain("Unclosed paragraph");
  });

  it("removes images and SVGs", () => {
    const html = `
      <div>
        <img src="logo.png" alt="Logo" />
        <svg><circle r="10" /></svg>
        <p>(1) Footnote text.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Footnote text");
    expect(result).not.toContain("img");
    expect(result).not.toContain("svg");
    expect(result).not.toContain("logo.png");
  });

  it("cleans up excessive whitespace", () => {
    const html = `
      <div>
        <p>(1)    Multiple    spaces    here.</p>
        
        
        
        <p>(2) Another footnote.</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    // Should reduce multiple spaces to single space
    expect(result).not.toContain("    ");
    // Should reduce multiple newlines
    expect(result).not.toMatch(/\n\n\n+/);
  });

  it("preserves complex table structures", () => {
    const html = `
      <table>
        <tr>
          <th>Footnote</th>
          <th>Description</th>
        </tr>
        <tr>
          <td>(1)</td>
          <td>Company has 75% controlling interest.</td>
        </tr>
        <tr>
          <td>(2)</td>
          <td>Second tier subsidiary owned by Parent Corp.</td>
        </tr>
      </table>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Footnote");
    expect(result).toContain("Description");
    expect(result).toContain("75% controlling interest");
    expect(result).toContain("Parent Corp");
  });

  it("preserves &nbsp; entities for indentation", () => {
    const html = `
      <div>
        <p>(1) Parent Company</p>
        <p>&nbsp;&nbsp;(1a) Indented subsidiary</p>
        <p>&nbsp;&nbsp;&nbsp;&nbsp;(1b) Deeper nested subsidiary</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Parent Company");
    expect(result).toContain("Indented subsidiary");
    expect(result).toContain("Deeper nested subsidiary");
    // Check that nbsp entities are preserved as HTML entities
    expect(result).toContain("&nbsp;");
  });

  it("preserves &#160; numeric entities for indentation", () => {
    const html = `
      <div>
        <p>(1) Parent Company</p>
        <p>&#160;&#160;(1a) Indented subsidiary</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Parent Company");
    expect(result).toContain("Indented subsidiary");
    // Cheerio normalizes &#160; to &nbsp;
    expect(result).toContain("&nbsp;");
  });

  it("preserves CSS padding-left styles", () => {
    const html = `
      <table>
        <tr>
          <td>(1)</td>
          <td>Parent Company</td>
        </tr>
        <tr>
          <td>(1a)</td>
          <td style="padding-left: 12pt">Indented subsidiary</td>
        </tr>
        <tr>
          <td>(1b)</td>
          <td style="padding-left: 24pt">Deeper nested subsidiary</td>
        </tr>
      </table>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Parent Company");
    expect(result).toContain("Indented subsidiary");
    expect(result).toContain("Deeper nested subsidiary");
    expect(result).toContain("padding-left");
    expect(result).toContain("12pt");
    expect(result).toContain("24pt");
  });

  it("preserves CSS margin-left styles", () => {
    const html = `
      <div>
        <p style="margin-left: 0pt">(1) Parent Company</p>
        <p style="margin-left: 12pt">(1a) Indented subsidiary</p>
      </div>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Parent Company");
    expect(result).toContain("Indented subsidiary");
    expect(result).toContain("margin-left");
    expect(result).toContain("12pt");
  });

  it("preserves shorthand padding with indentation", () => {
    const html = `
      <table>
        <tr>
          <td style="padding: 2px 1pt 2px 13pt">(1a) Indented subsidiary</td>
        </tr>
      </table>
    `;
    const result = preprocessFootnotesHtml(html);

    expect(result).toContain("Indented subsidiary");
    expect(result).toContain("padding");
    expect(result).toContain("13pt");
  });
});
