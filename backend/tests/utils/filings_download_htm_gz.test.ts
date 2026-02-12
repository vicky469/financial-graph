import { describe, expect, test } from "vitest";
import { extractPrimaryHtmFilename } from "../../src/jobs/filings_download_htm_gz";

function buildDocBlock(params: {
  type: string;
  sequence?: number;
  filename: string;
  description?: string;
}): string {
  const sequenceLine =
    params.sequence !== undefined ? `<SEQUENCE>${params.sequence}\n` : "";
  const descriptionLine = params.description
    ? `<DESCRIPTION>${params.description}\n`
    : "";
  return `<DOCUMENT>
<TYPE>${params.type}
${sequenceLine}<FILENAME>${params.filename}
${descriptionLine}<TEXT>
dummy
  </TEXT>
</DOCUMENT>`;
}

describe("extractPrimaryHtmFilename", () => {
  test("selects exact form type with sequence=1 and .htm filename", () => {
    const body = [
      buildDocBlock({ type: "10-K", sequence: 1, filename: "primary.htm" }),
      buildDocBlock({ type: "EX-21", sequence: 2, filename: "ex21.htm" }),
    ].join("\n");

    expect(extractPrimaryHtmFilename(body, "10-K")).toBe("primary.htm");
  });

  test("matches amended form types using startsWith (e.g. 10-K/A)", () => {
    const body = [
      buildDocBlock({ type: "10-K/A", sequence: 1, filename: "amended.htm" }),
      buildDocBlock({ type: "EX-31.1", sequence: 2, filename: "ex311.htm" }),
    ].join("\n");

    expect(extractPrimaryHtmFilename(body, "10-K")).toBe("amended.htm");
  });

  test("returns null when sequence is not 1", () => {
    const body = [
      buildDocBlock({ type: "10-K", sequence: 2, filename: "main.htm" }),
    ].join("\n");

    expect(extractPrimaryHtmFilename(body, "10-K")).toBeNull();
  });

  test("returns null when filename is not .htm", () => {
    const body = [
      buildDocBlock({ type: "10-K", sequence: 1, filename: "main.html" }),
    ].join("\n");

    expect(extractPrimaryHtmFilename(body, "10-K")).toBeNull();
  });
});
