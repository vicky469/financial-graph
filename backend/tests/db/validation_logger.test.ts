import { validate, FilingSchema } from "../../src/db/validation";
import fs from "fs";
import path from "path";

describe("Validation Logger", () => {
  const logDir = path.resolve(__dirname, "../../logs");
  const logFile = path.join(logDir, "validation_failures.jsonl");

  beforeEach(() => {
    // Clean up log file before each test
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  });

  afterAll(() => {
    // Clean up log file after tests
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  });

  it("should log validation errors to a file", () => {
    const invalidFiling = {
      company_id: "not-a-uuid", // Invalid UUID
      accession_number: "invalid-format", // Invalid regex
      form_type: "10-K",
      filing_date: "not-a-date", // Invalid date
    };

    expect(() => {
      validate(FilingSchema, invalidFiling, "FilingSchema");
    }).toThrow();

    expect(fs.existsSync(logFile)).toBe(true);

    const content = fs.readFileSync(logFile, "utf-8");
    const logEntry = JSON.parse(content);

    expect(logEntry.schema).toBe("FilingSchema");
    expect(logEntry.error).toBeDefined();
    expect(logEntry.timestamp).toBeDefined();
    expect(logEntry.data).toEqual(invalidFiling);
  });
});
