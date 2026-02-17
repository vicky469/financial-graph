/**
 * Property-based tests for structure detection phase
 *
 * Uses fast-check to verify properties that should hold across all valid inputs.
 * Each test references a property from the design document.
 */

import fc from "fast-check";
import * as cheerio from "cheerio";
import { detectDocumentStructure } from "../../src/parser/subsidiary/shape/structure-detection";
import { DEFAULT_CONFIG } from "../../src/parser/subsidiary/parser-types";
import type { ParserConfig } from "../../src/parser/subsidiary/parser-types";

// ============================================================================
// Helper Functions for Generating Test HTML
// ============================================================================

/**
 * Generate a table row with the given cells
 */
function generateRow(cells: string[], isHeader: boolean = false): string {
  const tag = isHeader ? "th" : "td";
  return `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
}

/**
 * Generate a table with headers and data rows
 */
function generateTable(
  headers: string[],
  dataRows: string[][],
  options: { includeHeaderRow?: boolean } = {}
): string {
  const { includeHeaderRow = true } = options;
  const headerRow = includeHeaderRow ? generateRow(headers, true) : "";
  const rows = dataRows.map((row) => generateRow(row)).join("");
  return `<table>${headerRow}${rows}</table>`;
}

/**
 * Generate a subsidiary table with standard headers
 */
function generateSubsidiaryTable(dataRows: string[][]): string {
  return generateTable(
    ["Subsidiary Name", "Jurisdiction", "Ownership %"],
    dataRows
  );
}

/**
 * Generate HTML document with tables
 */
function generateHtml(tables: string[]): string {
  return `<html><body>${tables.join("")}</body></html>`;
}

/**
 * Generate a header row with specific colspan values
 */
function generateHeaderRowWithColspans(
  colspans: number[],
  headerTexts?: string[]
): string {
  const cells = colspans.map((colspan, i) => {
    const text = headerTexts?.[i] ?? `Header ${i + 1}`;
    return colspan > 1
      ? `<th colspan="${colspan}">${text}</th>`
      : `<th>${text}</th>`;
  });
  return `<tr>${cells.join("")}</tr>`;
}

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

/**
 * Generate a company name
 */
const companyNameArb = fc.oneof(
  fc.constantFrom(
    "Acme Corp",
    "Beta LLC",
    "Gamma Inc.",
    "Delta Ltd.",
    "Echo Holdings",
    "Foxtrot Industries"
  ),
  fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length > 0)
);

/**
 * Generate a jurisdiction
 */
const jurisdictionArb = fc.constantFrom(
  "Delaware",
  "Nevada",
  "California",
  "New York",
  "Texas",
  "United Kingdom",
  "Germany",
  "Japan"
);

/**
 * Generate an ownership percentage string
 */
const ownershipArb = fc.oneof(
  fc.integer({ min: 1, max: 100 }).map((n) => `${n}%`),
  fc.constantFrom("100%", "50%", "75%", "wholly owned")
);

/**
 * Generate a data row for a subsidiary table
 */
const subsidiaryRowArb = fc.tuple(companyNameArb, jurisdictionArb, ownershipArb);

/**
 * Generate an array of data rows
 */
const dataRowsArb = fc.array(subsidiaryRowArb, { minLength: 0, maxLength: 20 });

/**
 * Generate colspan values (array of positive integers)
 */
const colspansArb = fc.array(fc.integer({ min: 1, max: 5 }), {
  minLength: 1,
  maxLength: 10,
});

// ============================================================================
// Property Tests
// ============================================================================

describe("Structure Detection Property Tests", () => {
  // Feature: structured-subsidiary-parser, Property 1: Structure detection returns valid DocumentStructure
  // *For any* HTML content string, the Structure Detection Phase should return a DocumentStructure
  // object with a valid classification, a tables array, and a totalTableCount field.
  // **Validates: Requirements 1.1**
  it("Property 1: Structure detection returns valid DocumentStructure", () => {
    fc.assert(
      fc.property(
        fc.array(dataRowsArb, { minLength: 0, maxLength: 3 }),
        (tableDataSets) => {
          // Generate tables from data
          const tables = tableDataSets.map((dataRows) =>
            generateSubsidiaryTable(dataRows)
          );
          const html = generateHtml(tables);
          const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });

          // Detect structure
          const result = detectDocumentStructure($, DEFAULT_CONFIG);

          // Verify result has required fields
          expect(result).toHaveProperty("classification");
          expect(result).toHaveProperty("tables");
          expect(result).toHaveProperty("totalTableCount");

          // Verify classification is valid
          expect([
            "single-table",
            "multi-table",
            "no-table",
            "has-table-no-data",
            "text-based",
            "image-based",
            "pdf-based",
          ]).toContain(result.classification);

          // Verify tables is an array
          expect(Array.isArray(result.tables)).toBe(true);

          // Verify totalTableCount is a non-negative number
          expect(typeof result.totalTableCount).toBe("number");
          expect(result.totalTableCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: structured-subsidiary-parser, Property 2: Header extraction completeness
  // *For any* HTML document with tables, all detected tables in the DocumentStructure should have
  // either headers extracted or be marked as continuation tables with cached headers.
  // **Validates: Requirements 1.6**
  it("Property 2: Header extraction completeness", () => {
    fc.assert(
      fc.property(
        fc.array(dataRowsArb, { minLength: 1, maxLength: 3 }),
        (tableDataSets) => {
          // Generate tables with headers
          const tables = tableDataSets.map((dataRows) =>
            generateSubsidiaryTable(dataRows)
          );
          const html = generateHtml(tables);
          const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });

          const result = detectDocumentStructure($, DEFAULT_CONFIG);

          // For each detected table, verify header completeness
          result.tables.forEach((table) => {
            if (table.isContinuation) {
              // Continuation tables should have cachedHeaders
              expect(table.cachedHeaders).toBeDefined();
              expect(Array.isArray(table.cachedHeaders)).toBe(true);
            } else if (table.type !== "footnote") {
              // Non-continuation, non-footnote tables should have headers
              // (footnote tables may or may not have headers)
              if (table.headers !== null) {
                expect(Array.isArray(table.headers)).toBe(true);
              }
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: structured-subsidiary-parser, Property 3: Table type classification completeness
  // *For any* HTML document with tables, all detected tables in the DocumentStructure should have
  // a type classification of 'subsidiary', 'footnote', or 'unknown'.
  // **Validates: Requirements 1.7**
  it("Property 3: Table type classification completeness", () => {
    fc.assert(
      fc.property(
        fc.array(dataRowsArb, { minLength: 1, maxLength: 5 }),
        (tableDataSets) => {
          const tables = tableDataSets.map((dataRows) =>
            generateSubsidiaryTable(dataRows)
          );
          const html = generateHtml(tables);
          const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });

          const result = detectDocumentStructure($, DEFAULT_CONFIG);

          // Every detected table should have a valid type
          result.tables.forEach((table) => {
            expect(["subsidiary", "footnote", "unknown"]).toContain(table.type);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: structured-subsidiary-parser, Property 4: Continuation table header caching
  // *For any* HTML document with a subsidiary table followed by a headerless table, the headerless
  // table should be marked as a continuation table and should have cachedHeaders populated from
  // the previous subsidiary table.
  // **Validates: Requirements 1.8**
  it("Property 4: Continuation table header caching", () => {
    fc.assert(
      fc.property(
        dataRowsArb.filter((rows) => rows.length > 0),
        dataRowsArb.filter((rows) => rows.length > 0),
        (firstTableRows, secondTableRows) => {
          // First table: subsidiary table with headers
          const firstTable = generateSubsidiaryTable(firstTableRows);

          // Second table: continuation table (no headers)
          const secondTableHtml = `<table>${secondTableRows
            .map((row) => generateRow(row))
            .join("")}</table>`;

          const html = generateHtml([firstTable, secondTableHtml]);
          const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
          const result = detectDocumentStructure($, DEFAULT_CONFIG);

          // Find continuation tables
          const continuationTables = result.tables.filter((t) => t.isContinuation);

          // If there are continuation tables, they should have cached headers
          continuationTables.forEach((table) => {
            expect(table.cachedHeaders).toBeDefined();
            expect(Array.isArray(table.cachedHeaders)).toBe(true);
            expect(table.cachedHeaders!.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: structured-subsidiary-parser, Property 5: Subsidiary table keyword detection
  // *For any* table headers, if the headers contain both name keywords and jurisdiction keywords,
  // the table should be classified as type 'subsidiary'; otherwise it should be classified as
  // 'footnote' or 'unknown'.
  // **Validates: Requirements 2.1**
  it("Property 5: Subsidiary table keyword detection", () => {
    const nameKeywords = ["name", "subsidiary", "subsidiaries", "entity", "company"];
    const jurisdictionKeywords = [
      "jurisdiction",
      "state",
      "organization",
      "incorporation",
      "country",
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...nameKeywords),
        fc.constantFrom(...jurisdictionKeywords),
        fc.array(subsidiaryRowArb, { minLength: 1, maxLength: 5 }),
        (nameKw, jurKw, dataRows) => {
          // Create headers with the keywords
          const headers = [`${nameKw}`, `${jurKw}`, "Ownership"];
          const table = generateTable(headers, dataRows);
          const html = generateHtml([table]);
          const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });

          const result = detectDocumentStructure($, DEFAULT_CONFIG);

          // The table should be classified as subsidiary
          expect(result.tables.length).toBeGreaterThan(0);
          expect(result.tables[0].type).toBe("subsidiary");
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: structured-subsidiary-parser, Property 6: Footer table detection with column mismatch
  // *For any* continuation table candidate with a different column count than the previous table,
  // if the table matches footer patterns, it should be classified as type 'footnote' rather than
  // being treated as a continuation table.
  // **Validates: Requirements 2.4**
  it("Property 6: Footer table detection with column mismatch", () => {
    fc.assert(
      fc.property(
        dataRowsArb.filter((rows) => rows.length > 0),
        fc.constantFrom(
          "Note: Excludes dormant subsidiaries",
          "Excludes inactive entities",
          "Note: These subsidiaries are in liquidation"
        ),
        (dataRows, footerText) => {
          // First table: subsidiary table with 3 columns
          const firstTable = generateSubsidiaryTable(dataRows);

          // Second table: footer table with 1 column (different count)
          const footerTable = `<table><tr><td>${footerText}</td></tr></table>`;

          const html = generateHtml([firstTable, footerTable]);
          const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
          const result = detectDocumentStructure($, DEFAULT_CONFIG);

          // Find the footer table
          const footerTables = result.tables.filter((t) => t.type === "footnote");

          // There should be at least one footnote table
          expect(footerTables.length).toBeGreaterThanOrEqual(1);

          // It should NOT be marked as continuation
          footerTables.forEach((table) => {
            expect(table.isContinuation).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: structured-subsidiary-parser, Property 7: Colspan attribute handling
  // *For any* table header row with colspan attributes, the calculated column count should equal
  // the sum of all colspan values (treating missing colspan as 1).
  // **Validates: Requirements 2.5**
  it("Property 7: Colspan attribute handling", () => {
    fc.assert(
      fc.property(
        colspansArb.filter((arr) => arr.length >= 2), // Need at least 2 columns
        (colspans) => {
          // Create header texts that include name and jurisdiction keywords
          const headerTexts = colspans.map((_, i) => {
            if (i === 0) return "Subsidiary Name";
            if (i === 1) return "Jurisdiction";
            return `Col ${i}`;
          });

          // Generate header row with colspans
          const headerRow = generateHeaderRowWithColspans(colspans, headerTexts);

          // Generate a data row
          const totalCols = colspans.reduce((sum, v) => sum + v, 0);
          const dataRow = `<tr>${Array(totalCols)
            .fill(0)
            .map((_, i) => `<td>Data ${i}</td>`)
            .join("")}</tr>`;

          const html = `<html><body><table>${headerRow}${dataRow}</table></body></html>`;
          const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
          const result = detectDocumentStructure($, DEFAULT_CONFIG);

          // Expected column count is sum of all colspan values
          const expectedCount = colspans.reduce((sum, val) => sum + val, 0);

          // Verify column count
          if (result.tables.length > 0) {
            const actualCount = result.tables[0].columnCount;
            expect(actualCount).toBe(expectedCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
