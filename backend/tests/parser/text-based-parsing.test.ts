/**
 * Text-Based Subsidiary Detection Tests
 *
 * Text-based listings are detected but not parsed by heuristics.
 */

import { describe, test, expect } from "vitest";
import { DEFAULT_CONFIG, parseExhibit } from "../../src/parser/subsidiary";

describe("Text-Based Subsidiary Detection", () => {
  const config = { ...DEFAULT_CONFIG, fallbackPolicy: "none" as const };
  test("should detect text-based listing with parentheses format", async () => {
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

    const result = await parseExhibit(
      html,
      {
        accession_number: "test-001",
        cik: "1234567890",
        filingCompanyId: "test-company-id",
      },
      config,
    );

    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
    expect(result.classification).toBe("text-based");
  });

  test("should detect mixed formats in text-based listing", async () => {
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

    const result = await parseExhibit(
      html,
      {
        accession_number: "test-002",
        cik: "1234567890",
        filingCompanyId: "test-company-id",
      },
      config,
    );

    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
    expect(result.classification).toBe("text-based");
  });

  test("should detect Wdesk-style text list with company, jurisdiction clause", async () => {
    const html = `
      <html>
        <body>
          <div>Exhibit 21</div>
          <div>SCHEDULE OF SUBSIDIARIES</div>
          <div>Abacos Atlantic Holdings Ltd., a Bahamas international business company</div>
          <div>Abacus Capital Group LLC, a Delaware limited liability company</div>
        </body>
      </html>
    `;

    const result = await parseExhibit(
      html,
      {
        accession_number: "test-002b",
        cik: "1234567890",
        filingCompanyId: "test-company-id",
      },
      config,
    );

    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
    expect(result.classification).toBe("text-based");
  });

  test("should detect footnote references in text-based entries", async () => {
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

    const result = await parseExhibit(
      html,
      {
        accession_number: "test-003",
        cik: "1234567890",
        filingCompanyId: "test-company-id",
      },
      config,
    );

    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
    expect(result.classification).toBe("text-based");
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

    const result = await parseExhibit(
      html,
      {
        accession_number: "test-004",
        cik: "1234567890",
        filingCompanyId: "test-company-id",
      },
      config,
    );

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

    const result = await parseExhibit(
      html,
      {
        accession_number: "test-005",
        cik: "1234567890",
        filingCompanyId: "test-company-id",
      },
      config,
    );

    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
  });

  test("should detect real Trade Desk format", async () => {
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

    const result = await parseExhibit(
      html,
      {
        accession_number: "000167193325000029",
        cik: "1671933",
        filingCompanyId: "trade-desk-company-id",
      },
      config,
    );

    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
    expect(result.classification).toBe("text-based");
  });
});
