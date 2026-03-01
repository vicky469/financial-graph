import { describe, expect, test } from "vitest";
import {
  parseFormTypes,
  parseRequestedConcurrency,
  resolveConversionConcurrency,
  toPdfFilename,
} from "../../src/jobs/filings_htm_to_pdf";

describe("parseFormTypes", () => {
  test("extracts form types from argv-style args", () => {
    expect(parseFormTypes(["-2025", "10-K", "20-F"])).toEqual(["10-K", "20-F"]);
  });

  test("ignores flags and year-like tokens", () => {
    expect(
      parseFormTypes(["-2025", "10-K", "--dry-run", "20-F", "--foo=bar"]),
    ).toEqual(["10-K", "20-F"]);
  });
});

describe("toPdfFilename", () => {
  test("converts .htm extension to .pdf", () => {
    expect(toPdfFilename("abc.htm")).toBe("abc.pdf");
  });

  test("throws when input is not .htm", () => {
    expect(() => toPdfFilename("abc.html")).toThrow(/Expected \.htm filename/);
  });
});

describe("parseRequestedConcurrency", () => {
  test("returns undefined when flag absent", () => {
    expect(parseRequestedConcurrency(["-2025", "10-K"])).toBeUndefined();
  });

  test("parses valid concurrency", () => {
    expect(parseRequestedConcurrency(["-2025", "10-K", "--concurrency=6"])).toBe(6);
  });

  test("throws for non-positive values", () => {
    expect(() =>
      parseRequestedConcurrency(["-2025", "10-K", "--concurrency=0"]),
    ).toThrow(/Invalid --concurrency value/);
  });
});

describe("resolveConversionConcurrency", () => {
  test("uses requested concurrency capped by task count", () => {
    expect(resolveConversionConcurrency(3, 10)).toBe(3);
  });

  test("returns at least 1 for empty task list", () => {
    expect(resolveConversionConcurrency(0)).toBe(1);
  });
});
