import { describe, expect, test } from "vitest";
import {
  getCliArg,
  getCliIntArg,
  getCliListArg,
  hasCliFlag,
  parseCliYears,
} from "../../src/utils/cli";

describe("parseCliYears", () => {
  test("parses single year string", () => {
    expect(parseCliYears("2025")).toEqual([2025]);
  });

  test("parses dash-prefixed single year string", () => {
    expect(parseCliYears("-2025")).toEqual([2025]);
  });

  test("parses comma-separated year string", () => {
    expect(parseCliYears("2024,2025")).toEqual([2024, 2025]);
  });

  test("parses year string with whitespace", () => {
    expect(parseCliYears(" 2024 , 2025 ")).toEqual([2024, 2025]);
  });

  test("parses from argv list", () => {
    const args = ["--use-cache", "-2025", "--foo=bar"];
    expect(parseCliYears(args)).toEqual([2025]);
  });

  test("parses from argv list with comma-separated years", () => {
    const args = ["--use-cache", "-2024,2025"];
    expect(parseCliYears(args)).toEqual([2024, 2025]);
  });

  test("throws on missing arg", () => {
    expect(() => parseCliYears()).toThrow("Missing years arg");
  });

  test("throws on argv list without years", () => {
    const args = ["--use-cache", "--foo=bar"];
    expect(() => parseCliYears(args)).toThrow("Missing years arg");
  });
});

describe("getCliArg", () => {
  test("returns value for --name=value", () => {
    const args = ["--year=2025", "--mode=fast"];
    expect(getCliArg(args, "year")).toBe("2025");
    expect(getCliArg(args, "mode")).toBe("fast");
  });

  test("returns undefined when missing", () => {
    const args = ["--year=2025"];
    expect(getCliArg(args, "limit")).toBeUndefined();
  });
});

describe("hasCliFlag", () => {
  test("true when flag exists", () => {
    const args = ["--dry-run", "--use-cache"];
    expect(hasCliFlag(args, "dry-run")).toBe(true);
    expect(hasCliFlag(args, "use-cache")).toBe(true);
  });

  test("false when flag missing", () => {
    const args = ["--dry-run"];
    expect(hasCliFlag(args, "sp500")).toBe(false);
  });
});

describe("getCliIntArg", () => {
  test("parses integer value", () => {
    const args = ["--limit=10"];
    expect(getCliIntArg(args, "limit")).toBe(10);
  });

  test("returns undefined for missing or invalid", () => {
    const args = ["--limit=abc"];
    expect(getCliIntArg(args, "limit")).toBeUndefined();
    expect(getCliIntArg(args, "missing")).toBeUndefined();
  });
});

describe("getCliListArg", () => {
  test("parses comma-separated list", () => {
    const args = ["--sink=db,excel"];
    expect(getCliListArg(args, "sink")).toEqual(["db", "excel"]);
  });

  test("trims whitespace and ignores empties", () => {
    const args = ["--sink= db , , excel  "];
    expect(getCliListArg(args, "sink")).toEqual(["db", "excel"]);
  });

  test("returns empty array when missing", () => {
    const args = ["--dry-run"];
    expect(getCliListArg(args, "sink")).toEqual([]);
  });
});
