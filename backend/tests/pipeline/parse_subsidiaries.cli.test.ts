import { describe, expect, test } from "vitest";
import { parsePipelineArgs, resolveSp500Flags } from "../../src/pipeline/subsidiary/cli";

describe("resolveSp500Flags", () => {
  test("defaults to false/false", () => {
    expect(resolveSp500Flags([])).toEqual({
      sp500Only: false,
      excludeSp500: false,
    });
  });

  test("sp500 flag enables sp500Only", () => {
    expect(resolveSp500Flags(["--sp500"])).toEqual({
      sp500Only: true,
      excludeSp500: false,
    });
  });

  test("exclude-sp500 overrides sp500", () => {
    expect(resolveSp500Flags(["--sp500", "--exclude-sp500"])).toEqual({
      sp500Only: false,
      excludeSp500: true,
    });
  });

  test("exclude-sp500 alone disables sp500Only", () => {
    expect(resolveSp500Flags(["--exclude-sp500"])).toEqual({
      sp500Only: false,
      excludeSp500: true,
    });
  });
});

describe("parsePipelineArgs", () => {
  test("sink=all expands to db + csv", () => {
    const args = ["--sink=all"];
    const parsed = parsePipelineArgs(args);
    expect(parsed.sinks).toEqual(["db", "csv"]);
  });

  test("sink=both expands to db + csv", () => {
    const args = ["--sink=both"];
    const parsed = parsePipelineArgs(args);
    expect(parsed.sinks).toEqual(["db", "csv"]);
  });

  test("sink=excel is rejected", () => {
    const args = ["--sink=excel"];
    expect(() => parsePipelineArgs(args)).toThrow(
      /Invalid sink value\(s\): excel/,
    );
  });
});
