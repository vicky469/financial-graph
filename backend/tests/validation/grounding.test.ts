import { describe, expect, test } from "vitest";
import {
  appearsInCorpus,
  buildGroundingCorpus,
  stripHtmlToTextWithLineBreaks,
} from "../../src/validation/llm-fallback/grounding";

describe("LLM grounding corpus", () => {
  test("matches name within a single row", () => {
    const source = "226HC 8me LLC (Delaware)\nAnother Company Ltd (Canada)";
    const corpus = buildGroundingCorpus(source);

    expect(appearsInCorpus("226HC 8me LLC", corpus)).toBe(true);
    expect(appearsInCorpus("Another Company Ltd", corpus)).toBe(true);
  });

  test("matches name when source row contains parentheses suffix", () => {
    const source = "Cui Yi Information Science and Technology (Shanghai) Company Limited";
    const corpus = buildGroundingCorpus(source);

    expect(
      appearsInCorpus(
        "Cui Yi Information Science and Technology Company Limited",
        corpus,
      ),
    ).toBe(true);
  });

  test("matches across adjacent wrapped lines via row window", () => {
    const source = [
      "NFE Power Comercializadora de Gás",
      "Natural Ltda. (Brazil)",
      "Independent Line",
    ].join("\n");
    const corpus = buildGroundingCorpus(source);

    expect(
      appearsInCorpus("NFE Power Comercializadora de Gas Natural Ltda.", corpus),
    ).toBe(true);
  });

  test("rejects names that do not appear in the source rows", () => {
    const source = "Known Subsidiary LLC (Delaware)\nKnown Parent Inc. (Nevada)";
    const corpus = buildGroundingCorpus(source);

    expect(appearsInCorpus("Hallucinated Company LLC", corpus)).toBe(false);
  });

  test("extracts row-like lines from HTML", () => {
    const html = `
      <table>
        <tr><td>Company A LLC</td><td>Delaware</td></tr>
        <tr><td>Company B Ltd</td><td>Canada</td></tr>
      </table>
    `;
    const source = stripHtmlToTextWithLineBreaks(html);
    const corpus = buildGroundingCorpus(source);

    expect(appearsInCorpus("Company A LLC", corpus)).toBe(true);
    expect(appearsInCorpus("Company B Ltd", corpus)).toBe(true);
  });
});

