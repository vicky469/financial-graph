/**
 * Tests for table-detection utilities
 */

import { isHeaderRow } from "../../src/parsers/subsidiary/table-detection";

describe("isHeaderRow", () => {
  describe("should return false for actual company names", () => {
    it("detects LLC companies", () => {
      expect(isHeaderRow("Liberty National Development Company, LLC (32.5%)", "Delaware")).toBe(false);
    });

    it("detects Inc. companies", () => {
      expect(isHeaderRow("Acme Corporation, Inc.", "Delaware")).toBe(false);
    });

    it("detects Corp companies", () => {
      expect(isHeaderRow("Global Corp", "New York")).toBe(false);
    });

    it("detects Ltd companies", () => {
      expect(isHeaderRow("Brink's Ltd", "UK")).toBe(false);
    });

    it("detects S.A. companies", () => {
      expect(isHeaderRow("Servicio Pan Americano S.A.", "Mexico")).toBe(false);
    });

    it("detects GmbH companies", () => {
      expect(isHeaderRow("Brink's Beteiligungsgesellschaft mbH", "Germany")).toBe(false);
    });

    it("detects B.V. companies", () => {
      expect(isHeaderRow("Brink's Holdings B.V.", "Netherlands")).toBe(false);
    });

    it("detects Pty companies", () => {
      expect(isHeaderRow("Brink's Australia Pty Ltd.", "Australia")).toBe(false);
    });
  });

  describe("should return true for header rows", () => {
    it("detects name + jurisdiction header", () => {
      expect(isHeaderRow("Company Name", "Jurisdiction")).toBe(true);
    });

    it("detects subsidiary keyword", () => {
      expect(isHeaderRow("Subsidiary", "State")).toBe(true);
    });

    it("detects subsidiaries keyword", () => {
      expect(isHeaderRow("Subsidiaries", "Location")).toBe(true);
    });

    it("detects entity keyword", () => {
      expect(isHeaderRow("Entity", "Country")).toBe(true);
    });

    it("detects incorporation keyword", () => {
      expect(isHeaderRow("Name", "State of Incorporation")).toBe(true);
    });

    it("detects ownership header (not data)", () => {
      expect(isHeaderRow("Name", "Percent Owned")).toBe(true);
    });

    it("detects organized keyword", () => {
      expect(isHeaderRow("Name", "Where Organized")).toBe(true);
    });
  });

  describe("should handle edge cases", () => {
    it("does not flag United States as state keyword", () => {
      expect(isHeaderRow("Acme LLC", "United States")).toBe(false);
    });

    it("does not flag Corporation in name as organization keyword", () => {
      expect(isHeaderRow("Acme Corporation", "Delaware")).toBe(false);
    });

    it("does not flag ownership percentage in name as header", () => {
      expect(isHeaderRow("New Liberty Company, LLC (17.5%)", "New Jersey")).toBe(false);
    });

    it("does not flag 100% ownership in name as header", () => {
      expect(isHeaderRow("Subsidiary Corp (100%)", "Delaware")).toBe(false);
    });
  });
});
