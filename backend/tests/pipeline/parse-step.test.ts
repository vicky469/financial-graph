/**
 * Parse Step Tests
 *
 * Tests for the pipeline parse step to ensure it correctly handles
 * the refactored parser and passes company names.
 */

import { describe, test, expect } from "vitest";
import { parseStep } from "../../src/pipeline/subsidiaries/steps/parse";
import type { DecompressedFiling } from "../../src/pipeline/subsidiaries/types";

describe("Parse Step", () => {
  test("should pass company name to parser", async () => {
    const mockFiling: DecompressedFiling = {
      accessionNumber: "0000123456-25-000001",
      cik: "0000123456",
      companyId: "test-company-id",
      companyName: "Test Company Inc.",
      exhibitType: "EX-21",
      cachePath: "/path/to/cache",
      url: "https://example.com/filing.htm",
      html: `
        <html>
          <body>
            <table>
              <tr><th>Subsidiary Name</th><th>Jurisdiction</th><th>Ownership</th></tr>
              <tr><td>Test Subsidiary LLC</td><td>Delaware</td><td>100%</td></tr>
            </table>
          </body>
        </html>
      `,
    };

    const result = await parseStep.execute(mockFiling, {});

    expect(result.success).toBe(true);
    expect(result.parseResult.subsidiaries).toHaveLength(1);
    expect(result.parseResult.subsidiaries[0].name).toBe("Test Subsidiary LLC");
    expect(result.parseResult.subsidiaries[0].jurisdiction).toBe("Delaware");
    expect(result.parseResult.subsidiaries[0].ownership).toBe(100);
    expect(result.parseResult.subsidiaries[0].parentId).toBe("test-company-id");
    // The parentName should be set to the company name when it's a root-level subsidiary
    expect(result.parseResult.subsidiaries[0].parentName).toBe("Test Company Inc.");
  });

  test("should handle missing company name gracefully", async () => {
    const mockFiling: DecompressedFiling = {
      accessionNumber: "0000123456-25-000001",
      cik: "0000123456",
      companyId: "test-company-id",
      // companyName is undefined
      exhibitType: "EX-21",
      cachePath: "/path/to/cache",
      url: "https://example.com/filing.htm",
      html: `
        <html>
          <body>
            <table>
              <tr><th>Subsidiary Name</th><th>Jurisdiction</th><th>Ownership</th></tr>
              <tr><td>Test Subsidiary LLC</td><td>Delaware</td><td>100%</td></tr>
            </table>
          </body>
        </html>
      `,
    };

    const result = await parseStep.execute(mockFiling, {});

    expect(result.success).toBe(true);
    expect(result.parseResult.subsidiaries).toHaveLength(1);
    expect(result.parseResult.subsidiaries[0].parentId).toBe("test-company-id");
    // parentName should be undefined when company name is not provided
    expect(result.parseResult.subsidiaries[0].parentName).toBeUndefined();
  });

  test("should handle empty HTML gracefully", async () => {
    const mockFiling: DecompressedFiling = {
      accessionNumber: "0000123456-25-000001",
      cik: "0000123456",
      companyId: "test-company-id",
      companyName: "Test Company Inc.",
      exhibitType: "EX-21",
      cachePath: "/path/to/cache",
      url: "https://example.com/filing.htm",
      html: "<html><body></body></html>",
    };

    const result = await parseStep.execute(mockFiling, {});

    expect(result.success).toBe(true);
    expect(result.parseResult.status).toBe("empty");
    expect(result.parseResult.subsidiaries).toHaveLength(0);
  });

  test("should handle parser errors gracefully", async () => {
    const mockFiling: DecompressedFiling = {
      accessionNumber: "0000123456-25-000001",
      cik: "0000123456",
      companyId: "test-company-id",
      companyName: "Test Company Inc.",
      exhibitType: "EX-21",
      cachePath: "/path/to/cache",
      url: "https://example.com/filing.htm",
      html: "invalid html content",
    };

    const result = await parseStep.execute(mockFiling, {});

    // The parser is robust and handles invalid HTML gracefully
    // It should succeed but return empty results
    expect(result.success).toBe(true);
    expect(result.parseResult.status).toBe("empty");
    expect(result.parseResult.subsidiaries).toHaveLength(0);
  });
});