/**
 * Tests for CachedSECFilingsSource URL reconstruction
 *
 * The cached files use underscores to replace path separators, but filenames
 * may also contain underscores. We need to correctly reconstruct the original URL.
 */

describe("CachedSECFilingsSource URL reconstruction", () => {
  /**
   * Helper function that mirrors the URL reconstruction logic in cached-sec-filings.ts
   */
  function reconstructUrl(filename: string): string | null {
    const parts = filename.replace(".htm.gz", "").split("_");

    if (
      parts.length >= 6 &&
      parts[0] === "Archives" &&
      parts[1] === "edgar" &&
      parts[2] === "data"
    ) {
      // Reconstruct URL: first 5 parts are path segments, rest is the filename
      const pathSegments = parts.slice(0, 5); // Archives, edgar, data, cik, accession
      const filenameParts = parts.slice(5); // Everything after accession is the filename
      const originalFilename = filenameParts.join("_") + ".htm";
      return `https://www.sec.gov/${pathSegments.join("/")}/${originalFilename}`;
    }
    return null;
  }

  it("should correctly reconstruct URL with underscore in filename", () => {
    // This was the bug: ex_728187.htm was being converted to ex/728187.htm
    const filename = "Archives_edgar_data_1280452_000143774925005903_ex_728187.htm.gz";
    const url = reconstructUrl(filename);
    
    expect(url).toBe(
      "https://www.sec.gov/Archives/edgar/data/1280452/000143774925005903/ex_728187.htm"
    );
  });

  it("should correctly reconstruct URL with simple filename", () => {
    const filename = "Archives_edgar_data_1234567_000123456789012345_exhibit21.htm.gz";
    const url = reconstructUrl(filename);
    
    expect(url).toBe(
      "https://www.sec.gov/Archives/edgar/data/1234567/000123456789012345/exhibit21.htm"
    );
  });

  it("should correctly reconstruct URL with multiple underscores in filename", () => {
    const filename = "Archives_edgar_data_1234567_000123456789012345_ex_21_1_final.htm.gz";
    const url = reconstructUrl(filename);
    
    expect(url).toBe(
      "https://www.sec.gov/Archives/edgar/data/1234567/000123456789012345/ex_21_1_final.htm"
    );
  });

  it("should correctly reconstruct URL with hyphen in filename", () => {
    const filename = "Archives_edgar_data_1234567_000123456789012345_ex21-1.htm.gz";
    const url = reconstructUrl(filename);
    
    expect(url).toBe(
      "https://www.sec.gov/Archives/edgar/data/1234567/000123456789012345/ex21-1.htm"
    );
  });

  it("should return null for invalid filename format", () => {
    const filename = "invalid_filename.htm.gz";
    const url = reconstructUrl(filename);
    
    expect(url).toBeNull();
  });

  it("should return null for filename with wrong prefix", () => {
    const filename = "Wrong_edgar_data_1234567_000123456789012345_exhibit21.htm.gz";
    const url = reconstructUrl(filename);
    
    expect(url).toBeNull();
  });
});
