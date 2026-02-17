import {
  parseNameCell,
  parseOwnershipCell,
  parseJurisdictionCell,
} from "../../src/parser/subsidiary/data/cells";

describe("Cell Parsing", () => {
  describe("parseNameCell", () => {
    it("should extract clean name", () => {
      const result = parseNameCell("Company Name");
      expect(result.cleanName).toBe("Company Name");
    });

    it("should clean whitespace", () => {
      const result = parseNameCell("  Company   Name  ");
      expect(result.cleanName).toBe("Company Name");
    });

    it("should remove footnotes", () => {
      const result = parseNameCell("Company Name (1) (2)");
      expect(result.cleanName).toBe("Company Name");
    });

    it("should extract embedded ownership", () => {
      const result = parseNameCell("Company Name (32.5%)");
      expect(result.cleanName).toBe("Company Name");
      expect(result.ownershipFromName).toBe(32.5);
    });

    it("should extract multiple footnote refs", () => {
      const result = parseNameCell("Company Name (1)(2)");
      expect(result.footnoteRefs).toEqual(["1", "2"]);
    });
  });

  describe("parseOwnershipCell", () => {
    it("should parse percentage", () => {
      const result = parseOwnershipCell("100%");
      expect(result.ownership).toBe(100);
    });

    it("should parse percentage with decimal", () => {
      const result = parseOwnershipCell("38.5%");
      expect(result.ownership).toBe(38.5);
    });

    it("should parse percentage without percent sign", () => {
      const result = parseOwnershipCell("51");
      expect(result.ownership).toBe(51);
    });

    it("should parse percentage with footnote ref", () => {
      const result = parseOwnershipCell("100%1");
      expect(result.ownership).toBe(100);
      expect(result.footnoteRefs).toEqual(["1"]);
    });

    it("should extract footnote refs when ownership is undefined", () => {
      const result = parseOwnershipCell("Note (1)");
      expect(result.ownership).toBeUndefined();
      expect(result.footnoteRefs).toEqual(["1"]);
    });
  });

  describe("parseJurisdictionCell", () => {
    it("should extract raw jurisdiction", () => {
      const result = parseJurisdictionCell("Delaware");
      expect(result.jurisdiction_raw).toBe("Delaware");
    });

    it("should preserve original casing and format", () => {
      const result = parseJurisdictionCell("New York");
      expect(result.jurisdiction_raw).toBe("New York");
    });

    it("should NOT normalize abbreviations (as per user request)", () => {
      const result = parseJurisdictionCell("Del.");
      expect(result.jurisdiction_raw).toBe("Del.");
    });

    it("should clean numeric values (likely shifted ownership)", () => {
      const result = parseJurisdictionCell("38.5");
      expect(result.jurisdiction_raw).toBe("");
    });

    it("should clean percentages from jurisdiction (shouldn't happen but cleanup)", () => {
      const result = parseJurisdictionCell("New York 100%");
      expect(result.jurisdiction_raw).toBe("New York");
    });

    it("should trim leading bullets and dashes", () => {
      const result = parseJurisdictionCell("● Westwind School of Aeronautics, Phoenix, LLC");
      expect(result.jurisdiction_raw).toBe("Westwind School of Aeronautics, Phoenix, LLC");

      const dashed = parseJurisdictionCell("- Delaware");
      expect(dashed.jurisdiction_raw).toBe("Delaware");
    });
  });
});
