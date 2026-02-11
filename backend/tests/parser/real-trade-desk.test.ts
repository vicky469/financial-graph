/**
 * Real Trade Desk Filing Test
 *
 * Test with the actual HTML structure from the Trade Desk filing.
 */

import { describe, test, expect } from "vitest";
import { DEFAULT_CONFIG, parseExhibit } from "../../src/parser/subsidiary";

describe("Real Trade Desk Filing", () => {
  test("should detect Trade Desk text-based subsidiary listing", async () => {
    const config = { ...DEFAULT_CONFIG, fallbackPolicy: "none" as const };
    // This is the actual HTML structure from the Trade Desk filing
    const html = `
      <html><head>
      <!-- Document created using Wdesk -->
      <!-- Copyright 2025 Workiva -->
      <title>Document</title></head><body><div id="i03a0e922def44bce9c5b2c07c4d750b8_1"></div><div style="min-height:72pt;width:100%"><div style="margin-bottom:0.08pt"><font><br></font></div></div><div style="text-align:right"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:700;line-height:100%">EXHIBIT 21.1</font></div><div style="margin-top:12pt;text-align:center"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:700;line-height:100%">SUBSIDIARIES OF THE TRADE DESK, INC.</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Cayman (Cayman Islands)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk International Limited (United Kingdom)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The UK Trade Desk Ltd (United Kingdom)</font></div><div style="margin-bottom:0.08pt;margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk UK LLC</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Australia PTY LTD (Australia)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk GmbH (Germany)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Korea Yuhan Hoesa (South Korea)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk (Singapore) PTE. LTD. (Singapore)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Japan K.K. (Japan)</font></div><div style="margin-top:12pt"><font style="color:#000000;font-family:'Times New Roman',sans-serif;font-size:10pt;font-weight:400;line-height:120%">The Trade Desk Limited (Hong Kong)</font></div></body></html>
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

    // Should detect text-based format and defer parsing
    expect(result.subsidiaries).toHaveLength(0);
    expect(result.status).toBe("empty");
    expect(result.classification).toBe("text-based");

    expect(result.subsidiaries).toHaveLength(0);
  });
});
