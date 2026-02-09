import { describe, expect, test } from "vitest";
import { resolveSp500Flags } from "../../src/pipeline/subsidiary/cli";

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
