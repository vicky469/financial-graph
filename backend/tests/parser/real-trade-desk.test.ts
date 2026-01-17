/**
 * Real Trade Desk Filing Test
 *
 * Test with the actual HTML structure from the Trade Desk filing.
 */

import { describe, test, expect } from "vitest";
import { parseExhibitRefactored } from "../../src/parser/subsidiary";

describe("Real Trade Desk Filing", () => {
  test("should parse Trade Desk text-based subsidiary listing", async () => {
    // This is the actual HTML structure from the Trade Desk filing
    const html = `
      <html><head>
      <!-- Document created using Wdesk -->
      <!-- Copyright 2025 Workiva -->
      <title>Document</title></head><body><div id="i03a0e922def44bce9c5b2c07c4d750b8_1"></div><div style="min-height:72pt;width:100%"><div style="margin-bottom:0.08pt"><font><br></font></div></div><div style="text-align:right"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:700;line-height:100%">EXHIBIT 21.1</font></div><div style="margin-top:12pt;text-align:center"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:700;line-height:100%">SUBSIDIARIES OF THE TRADE DESK, INC.</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Cayman (Cayman Islands)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk International Limited (United Kingdom)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The UK Trade Desk Ltd (United Kingdom)</font></div><div style="margin-bottom:0.08pt;margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk UK LLC</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Australia PTY LTD (Australia)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk GmbH (Germany)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Korea Yuhan Hoesa (South Korea)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk (Singapore) PTE. LTD. (Singapore)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Japan K.K. (Japan)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Limited (Hong Kong)</font></div></body></html>
    `;

    const result = await parseExhibitRefactored(html, {
      accession_number: "000167193325000029",
      cik: "1671933",
      filingCompanyId: "trade-desk-company-id",
    });

    // Should detect text-based format
    expect(result.subsidiaries.length).toBeGreaterThan(5);
    expect(result.status).toBe("success");
    expect(result.maxNestingLevel).toBe(0); // Text-based entries are flat

    // Check specific subsidiaries
    const names = result.subsidiaries.map(s => s.name);
    expect(names).toContain("The Trade Desk Cayman");
    expect(names).toContain("The Trade Desk International Limited");
    expect(names).toContain("The UK Trade Desk Ltd");
    expect(names).toContain("The Trade Desk UK LLC");
    expect(names).toContain("The Trade Desk Australia PTY LTD");

    // Check jurisdictions
    const cayman = result.subsidiaries.find(s => s.name === "The Trade Desk Cayman");
    expect(cayman?.jurisdiction).toBe("Cayman Islands");

    const uk = result.subsidiaries.find(s => s.name === "The Trade Desk International Limited");
    expect(uk?.jurisdiction).toBe("United Kingdom");

    const australia = result.subsidiaries.find(s => s.name === "The Trade Desk Australia PTY LTD");
    expect(australia?.jurisdiction).toBe("Australia");

    // Check that UK LLC has "Unknown" jurisdiction since no parentheses
    const ukLlc = result.subsidiaries.find(s => s.name === "The Trade Desk UK LLC");
    expect(ukLlc?.jurisdiction).toBe("Unknown");
  });
});