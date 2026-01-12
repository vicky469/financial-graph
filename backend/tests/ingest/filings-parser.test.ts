import { describe, it, expect } from "vitest";

/**
 * Unit tests for filings ingestion parsing logic
 */

describe("Filings Ingestion - Source Quarter Parsing", () => {
  /**
   * Helper function that mimics the parsing logic in filings.ts
   */
  function parseSourceQuarter(sourceQuarterStr: string): {
    year: number;
    quarter: number;
  } | null {
    // Handle both formats: "2025-Q1", "2025-Q4", "2025q1", etc.
    // Match: year, then either "-Q" or "q", then quarter number
    const match = sourceQuarterStr.match(/(\d{4})(?:-Q|q)(\d+)/i);
    if (!match) {
      return null;
    }
    return {
      year: parseInt(match[1]),
      quarter: parseInt(match[2]),
    };
  }

  describe("Valid formats", () => {
    it("should parse 2025-Q1 format", () => {
      const result = parseSourceQuarter("2025-Q1");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.quarter).toBe(1);
    });

    it("should parse 2025-Q4 format", () => {
      const result = parseSourceQuarter("2025-Q4");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.quarter).toBe(4);
    });

    it("should parse 2025q1 format (lowercase)", () => {
      const result = parseSourceQuarter("2025q1");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.quarter).toBe(1);
    });

    it("should parse 2025q4 format (lowercase)", () => {
      const result = parseSourceQuarter("2025q4");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.quarter).toBe(4);
    });

    it("should parse 2024-Q2 format", () => {
      const result = parseSourceQuarter("2024-Q2");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2024);
      expect(result?.quarter).toBe(2);
    });

    it("should parse 2026-Q3 format", () => {
      const result = parseSourceQuarter("2026-Q3");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2026);
      expect(result?.quarter).toBe(3);
    });
  });

  describe("Invalid formats", () => {
    it("should return null for invalid format without Q", () => {
      const result = parseSourceQuarter("2025-1");
      expect(result).toBeNull();
    });

    it("should return null for invalid format without year", () => {
      const result = parseSourceQuarter("Q1");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = parseSourceQuarter("");
      expect(result).toBeNull();
    });

    it("should return null for malformed string", () => {
      const result = parseSourceQuarter("invalid");
      expect(result).toBeNull();
    });

    it("should return null for year only", () => {
      const result = parseSourceQuarter("2025");
      expect(result).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle different year values", () => {
      const result = parseSourceQuarter("2023-Q1");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2023);
      expect(result?.quarter).toBe(1);
    });

    it("should parse quarters beyond 4 (even if invalid business logic)", () => {
      // The regex allows it, validation should happen elsewhere
      const result = parseSourceQuarter("2025-Q5");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.quarter).toBe(5);
    });
  });
});

describe("Filings Ingestion - CSV Parsing", () => {
  /**
   * Helper function that mimics the CSV parsing logic in filings.ts
   */
  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let start = 0;
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === "," && !inQuotes) {
        let field = line.substring(start, i);
        if (field.startsWith('"') && field.endsWith('"')) {
          field = field.slice(1, -1).replace(/""/g, '"');
        }
        result.push(field);
        start = i + 1;
      }
    }
    // Last field
    let field = line.substring(start);
    if (field.startsWith('"') && field.endsWith('"')) {
      field = field.slice(1, -1).replace(/""/g, '"');
    }
    result.push(field);

    return result;
  }

  it("should parse simple CSV line", () => {
    const line = "value1,value2,value3";
    const result = parseCsvLine(line);
    expect(result).toEqual(["value1", "value2", "value3"]);
  });

  it("should parse CSV line with quoted values", () => {
    const line = '"value1","value2","value3"';
    const result = parseCsvLine(line);
    expect(result).toEqual(["value1", "value2", "value3"]);
  });

  it("should parse CSV line with comma inside quotes", () => {
    const line = '"value1, with comma","value2","value3"';
    const result = parseCsvLine(line);
    expect(result).toEqual(["value1, with comma", "value2", "value3"]);
  });

  it("should parse CSV line with escaped quotes", () => {
    const line = '"value1 ""quoted""","value2","value3"';
    const result = parseCsvLine(line);
    expect(result).toEqual(['value1 "quoted"', "value2", "value3"]);
  });

  it("should handle mixed quoted and unquoted values", () => {
    const line = 'value1,"value2, with comma",value3';
    const result = parseCsvLine(line);
    expect(result).toEqual(["value1", "value2, with comma", "value3"]);
  });

  it("should handle empty fields", () => {
    const line = "value1,,value3";
    const result = parseCsvLine(line);
    expect(result).toEqual(["value1", "", "value3"]);
  });

  it("should handle empty quoted fields", () => {
    const line = '"value1","","value3"';
    const result = parseCsvLine(line);
    expect(result).toEqual(["value1", "", "value3"]);
  });
});
