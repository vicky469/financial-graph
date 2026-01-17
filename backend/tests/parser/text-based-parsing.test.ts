/**
 * Text-Based Subsidiary Parsing Tests
 *
 * Tests for parsing text-based subsidiary listings (non-table format).
 */

import { describe, test, expect } from "vitest";
import { parseExhibitRefactored } from "../../src/parser/subsidiary";

describe("Text-Based Subsidiary Parsing", () => {
  test("should parse text-based subsidiary listing with parentheses format", async () => {
    const html = `
      <html>
        <body>
          <div>EXHIBIT 21.1</div>
          <div>SUBSIDIARIES OF THE TRADE DESK, INC.</div>
          <div>The Trade Desk Cayman (Cayman Islands)</div>
          <div>The Trade Desk International Limited (United Kingdom)</div>
          <div>The UK Trade Desk Ltd (United Kingdom)</div>
          <div>The Trade Desk Australia PTY LTD (Australia)</div>
          <div>The Trade Desk GmbH (Germany)</div>
          <div>The Trade Desk Korea Yuhan Hoesa (South Korea)</div>
        </body>
      </html>
    `;

    const result = await parseExhibitRefactored(html, {
      accession_number: "test-001",
      cik: "1234567890",
      filingCompanyId: "test-company-id",
    });

    expect(result.subsidiaries).toHaveLength(6);
    expect(result.status).toBe("success");
    expect(result.maxNestingLevel).toBe(0); // Text-based entries are flat

    // Check specific entries
    const subsidiaries = result.subsidiaries;
    expect(subsidiaries[0].name).toBe("The Trade Desk Cayman");
    expect(subsidiaries[0].jurisdiction).toBe("Cayman Islands");
    
    expect(subsidiaries[1].name).toBe("The Trade Desk International Limited");
    expect(subsidiaries[1].jurisdiction).toBe("United Kingdom");
    
    expect(subsidiaries[4].name).toBe("The Trade Desk GmbH");
    expect(subsidiaries[4].jurisdiction).toBe("Germany");
  });

  test("should handle mixed formats in text-based listing", async () => {
    const html = `
      <html>
        <body>
          <div>SUBSIDIARIES LIST</div>
          <div>Company A (United States)</div>
          <div>Company B - Canada</div>
          <div>Company C, France</div>
          <div>Company D LLC</div>
        </body>
      </html>
    `;

    const result = await parseExhibitRefactored(html, {
      accession_number: "test-002",
      cik: "1234567890",
      filingCompanyId: "test-company-id",
    });

    expect(result.subsidiaries).toHaveLength(4);
    
    const subsidiaries = result.subsidiaries;
    expect(subsidiaries[0].name).toBe("Company A");
    expect(subsidiaries[0].jurisdiction).toBe("United States");
    
    expect(subsidiaries[1].name).toBe("Company B");
    expect(subsidiaries[1].jurisdiction).toBe("Canada");
    
    expect(subsidiaries[2].name).toBe("Company C");
    expect(subsidiaries[2].jurisdiction).toBe("France");
    
    expect(subsidiaries[3].name).toBe("Company D LLC");
    expect(subsidiaries[3].jurisdiction).toBe("Unknown");
  });

  test("should handle footnote references in text-based entries", async () => {
    const html = `
      <html>
        <body>
          <div>SUBSIDIARIES</div>
          <div>Company A (1) (United States)</div>
          <div>Company B (2) (Canada)</div>
          <div>(1) Wholly owned subsidiary</div>
          <div>(2) 75% owned subsidiary</div>
        </body>
      </html>
    `;

    const result = await parseExhibitRefactored(html, {
      accession_number: "test-003",
      cik: "1234567890",
      filingCompanyId: "test-company-id",
    });

    expect(result.subsidiaries).toHaveLength(2);
    
    const subsidiaries = result.subsidiaries;
    expect(subsidiaries[0].name).toBe("Company A");
    expect(subsidiaries[0].jurisdiction).toBe("United States");
    expect(subsidiaries[0].footnoteRefs).toContain("1");
    
    expect(subsidiaries[1].name).toBe("Company B");
    expect(subsidiaries[1].jurisdiction).toBe("Canada");
    expect(subsidiaries[1].footnoteRefs).toContain("2");
  });

  test("should fall back to table parsing when no text-based pattern found", async () => {
    const html = `
      <html>
        <body>
          <table>
            <tr><th>Subsidiary Name</th><th>Jurisdiction</th></tr>
            <tr><td>Test Company LLC</td><td>Delaware</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = await parseExhibitRefactored(html, {
      accession_number: "test-004",
      cik: "1234567890",
      filingCompanyId: "test-company-id",
    });

    expect(result.subsidiaries).toHaveLength(1);
    expect(result.subsidiaries[0].name).toBe("Test Company LLC");
    expect(result.subsidiaries[0].jurisdiction).toBe("Delaware");
  });

  test("should return empty tree for documents with no subsidiaries", async () => {
    const html = `
      <html>
        <body>
          <div>This document contains no subsidiaries</div>
          <div>Just some random text</div>
        </body>
      </html>
    `;

    const result = await parseExhibitRefactored(html, {
      accession_number: "test-005",
      cik: "1234567890",
      filingCompanyId: "test-company-id",
    });

    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
  });

  test("should handle real Trade Desk format", async () => {
    const html = `
      <html>
        <body>
          <div>EXHIBIT 21.1</div>
          <div>SUBSIDIARIES OF THE TRADE DESK, INC.</div>
          <div>The Trade Desk Cayman (Cayman Islands)</div>
          <div>The Trade Desk International Limited (United Kingdom)</div>
          <div>The UK Trade Desk Ltd (United Kingdom)</div>
          <div>The Trade Desk UK LLC</div>
          <div>The Trade Desk Australia PTY LTD (Australia)</div>
          <div>The Trade Desk GmbH (Germany)</div>
          <div>The Trade Desk Korea Yuhan Hoesa (South Korea)</div>
          <div>The Trade Desk (Singapore) PTE. LTD. (Singapore)</div>
          <div>The Trade Desk Japan K.K. (Japan)</div>
          <div>The Trade Desk Limited (Hong Kong)</div>
        </body>
      </html>
    `;

    const result = await parseExhibitRefactored(html, {
      accession_number: "000167193325000029",
      cik: "1671933",
      filingCompanyId: "trade-desk-company-id",
    });

    expect(result.subsidiaries.length).toBeGreaterThan(5);
    expect(result.status).toBe("success");
    
    // Check that we got the expected subsidiaries
    const names = result.subsidiaries.map(s => s.name);
    expect(names).toContain("The Trade Desk Cayman");
    expect(names).toContain("The Trade Desk International Limited");
    expect(names).toContain("The Trade Desk Australia PTY LTD");
    
    // Check jurisdictions
    const cayman = result.subsidiaries.find(s => s.name === "The Trade Desk Cayman");
    expect(cayman?.jurisdiction).toBe("Cayman Islands");
    
    const uk = result.subsidiaries.find(s => s.name === "The Trade Desk International Limited");
    expect(uk?.jurisdiction).toBe("United Kingdom");
  });
});