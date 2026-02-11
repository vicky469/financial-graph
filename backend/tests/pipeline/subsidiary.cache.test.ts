import { describe, expect, test } from "vitest";
import { buildTargetsFilename } from "../../src/pipeline/subsidiary/cache";

describe("buildTargetsFilename", () => {
  test("defaults to targets.jsonl", () => {
    expect(buildTargetsFilename({})).toBe("targets.jsonl");
  });

  test("includes sp500 filter", () => {
    expect(
      buildTargetsFilename({ companyLookup: { mode: "sp500-only" } }),
    ).toBe("targets.sp500.jsonl");
  });

  test("includes exclude-sp500 filter", () => {
    expect(
      buildTargetsFilename({ companyLookup: { mode: "exclude-sp500" } }),
    ).toBe("targets.no-sp500.jsonl");
  });

  test("includes limit only", () => {
    expect(buildTargetsFilename({ limit: 500 })).toBe("targets.limit-500.jsonl");
  });

  test("includes filter and limit", () => {
    expect(
      buildTargetsFilename({
        companyLookup: { mode: "sp500-only" },
        limit: 250,
      }),
    ).toBe("targets.sp500.limit-250.jsonl");
  });
});
