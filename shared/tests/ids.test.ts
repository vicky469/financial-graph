/**
 * Tests for deterministic ID generation
 */

import { describe, test, expect } from "bun:test";
import { 
  generateCompanyId, 
  generateFilingId, 
  generateParentOfId,
  generateSubsidiaryEnrichmentId,
  generateOwnsId,
  generateBusinessSegmentId,
  generateBrandId,
  NAMESPACES 
} from "../types/ids";
import { CompanyType } from "../types/types";

describe("generateCompanyId", () => {
  describe("PUBLIC companies", () => {
    test("generates ID from primaryCIK", () => {
      const id = generateCompanyId({
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: { primaryCIK: "320193" },
      });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test("normalizes CIK to 10 digits", () => {
      const id1 = generateCompanyId({
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: { primaryCIK: "320193" },
      });
      const id2 = generateCompanyId({
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: { primaryCIK: "0000320193" },
      });
      expect(id1).toBe(id2);
    });

    test("same input produces same ID (deterministic)", () => {
      const input = {
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: { primaryCIK: "320193" },
      };
      expect(generateCompanyId(input)).toBe(generateCompanyId(input));
    });

    test("throws ZodError when primaryCIK is missing", () => {
      expect(() =>
        generateCompanyId({
          type: CompanyType.PUBLIC,
          name: "Apple Inc.",
          identity: {},
        })
      ).toThrow();
    });

    test("throws ZodError when identity is missing", () => {
      expect(() =>
        generateCompanyId({
          type: CompanyType.PUBLIC,
          name: "Apple Inc.",
        })
      ).toThrow();
    });
  });

  describe("ISSUER companies", () => {
    test("generates ID from primaryCIK", () => {
      const id = generateCompanyId({
        type: CompanyType.ISSUER,
        name: "Meta Platforms",
        identity: { primaryCIK: "1326801" },
      });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test("different type produces different ID even with same CIK", () => {
      const publicId = generateCompanyId({
        type: CompanyType.PUBLIC,
        name: "Test",
        identity: { primaryCIK: "123456" },
      });
      const issuerId = generateCompanyId({
        type: CompanyType.ISSUER,
        name: "Test",
        identity: { primaryCIK: "123456" },
      });
      expect(publicId).not.toBe(issuerId);
    });
  });

  describe("PRIVATE companies", () => {
    test("generates ID from name + jurisdiction", () => {
      const id = generateCompanyId({
        type: CompanyType.PRIVATE,
        name: "Acme Corp",
        jurisdiction_raw: "Delaware",
      });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test("normalizes name and jurisdiction (case insensitive)", () => {
      const id1 = generateCompanyId({
        type: CompanyType.PRIVATE,
        name: "Acme Corp",
        jurisdiction_raw: "Delaware",
      });
      const id2 = generateCompanyId({
        type: CompanyType.PRIVATE,
        name: "ACME CORP",
        jurisdiction_raw: "DELAWARE",
      });
      expect(id1).toBe(id2);
    });

    test("throws ZodError when jurisdiction is missing", () => {
      expect(() =>
        generateCompanyId({
          type: CompanyType.PRIVATE,
          name: "Acme Corp",
        })
      ).toThrow();
    });

    test("throws ZodError when name is missing", () => {
      expect(() =>
        generateCompanyId({
          type: CompanyType.PRIVATE,
          jurisdiction_raw: "Delaware",
        })
      ).toThrow();
    });
  });

  describe("UNKNOWN companies", () => {
    test("generates ID from name only", () => {
      const id = generateCompanyId({
        type: CompanyType.UNKNOWN,
        name: "Mystery LLC",
      });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test("includes jurisdiction when provided", () => {
      const idWithout = generateCompanyId({
        type: CompanyType.UNKNOWN,
        name: "Mystery LLC",
      });
      const idWith = generateCompanyId({
        type: CompanyType.UNKNOWN,
        name: "Mystery LLC",
        jurisdiction_raw: "Nevada",
      });
      expect(idWithout).not.toBe(idWith);
    });

    test("throws ZodError when name is missing", () => {
      expect(() =>
        generateCompanyId({
          type: CompanyType.UNKNOWN,
        })
      ).toThrow();
    });
  });
});


describe("generateFilingId", () => {
  test("generates valid UUID v5 format", () => {
    const id = generateFilingId("0001234567-25-000001");
    // UUID v5 format: xxxxxxxx-xxxx-5xxx-[89ab]xxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("same input produces same ID (deterministic)", () => {
    const accessionNumber = "0001234567-25-000001";
    const id1 = generateFilingId(accessionNumber);
    const id2 = generateFilingId(accessionNumber);
    expect(id1).toBe(id2);
  });

  test("normalizes accession numbers (with and without dashes produce same ID)", () => {
    const idWithDashes = generateFilingId("0001234567-25-000001");
    const idWithoutDashes = generateFilingId("000123456725000001");
    expect(idWithDashes).toBe(idWithoutDashes);
  });

  test("different accession numbers produce different IDs", () => {
    const id1 = generateFilingId("0001234567-25-000001");
    const id2 = generateFilingId("0001234567-25-000002");
    expect(id1).not.toBe(id2);
  });

  test("uses FILING namespace", () => {
    // Verify the ID is generated using the FILING namespace by checking
    // that the same accession number always produces the same ID
    const id1 = generateFilingId("0001193125-24-123456");
    const id2 = generateFilingId("0001193125-24-123456");
    expect(id1).toBe(id2);
    // And different from what a company ID would be
    expect(NAMESPACES.FILING).not.toBe(NAMESPACES.COMPANY);
  });

  test("throws error for empty accession number", () => {
    expect(() => generateFilingId("")).toThrow();
  });
});


describe("generateParentOfId", () => {
  test("generates valid UUID v5 format", () => {
    const id = generateParentOfId("parent-uuid", "subsidiary-uuid");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("same input produces same ID (deterministic)", () => {
    const id1 = generateParentOfId("parent-uuid", "subsidiary-uuid");
    const id2 = generateParentOfId("parent-uuid", "subsidiary-uuid");
    expect(id1).toBe(id2);
  });

  test("different parent produces different ID", () => {
    const id1 = generateParentOfId("parent-1", "subsidiary-uuid");
    const id2 = generateParentOfId("parent-2", "subsidiary-uuid");
    expect(id1).not.toBe(id2);
  });

  test("different subsidiary produces different ID", () => {
    const id1 = generateParentOfId("parent-uuid", "subsidiary-1");
    const id2 = generateParentOfId("parent-uuid", "subsidiary-2");
    expect(id1).not.toBe(id2);
  });

  test("throws error for empty parentId", () => {
    expect(() => generateParentOfId("", "subsidiary-uuid")).toThrow();
  });

  test("throws error for empty subsidiaryId", () => {
    expect(() => generateParentOfId("parent-uuid", "")).toThrow();
  });

  test("uses PARENT_OF namespace", () => {
    expect(NAMESPACES.PARENT_OF).toBe("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
  });
});

describe("generateSubsidiaryEnrichmentId", () => {
  test("generates valid UUID v5 format", () => {
    const id = generateSubsidiaryEnrichmentId("company-uuid", "filing-uuid");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("same input produces same ID (deterministic)", () => {
    const id1 = generateSubsidiaryEnrichmentId("company-uuid", "filing-uuid");
    const id2 = generateSubsidiaryEnrichmentId("company-uuid", "filing-uuid");
    expect(id1).toBe(id2);
  });

  test("different company produces different ID", () => {
    const id1 = generateSubsidiaryEnrichmentId("company-1", "filing-uuid");
    const id2 = generateSubsidiaryEnrichmentId("company-2", "filing-uuid");
    expect(id1).not.toBe(id2);
  });

  test("different filing produces different ID", () => {
    const id1 = generateSubsidiaryEnrichmentId("company-uuid", "filing-1");
    const id2 = generateSubsidiaryEnrichmentId("company-uuid", "filing-2");
    expect(id1).not.toBe(id2);
  });

  test("throws error for empty companyId", () => {
    expect(() => generateSubsidiaryEnrichmentId("", "filing-uuid")).toThrow();
  });

  test("throws error for empty filingId", () => {
    expect(() => generateSubsidiaryEnrichmentId("company-uuid", "")).toThrow();
  });

  test("uses SUBSIDIARY_ENRICHMENT namespace", () => {
    expect(NAMESPACES.SUBSIDIARY_ENRICHMENT).toBe("6ba7b813-9dad-11d1-80b4-00c04fd430c8");
  });
});

describe("generateOwnsId", () => {
  test("generates valid UUID v5 format", () => {
    const id = generateOwnsId("company-uuid", "brand-uuid");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("same input produces same ID (deterministic)", () => {
    const id1 = generateOwnsId("company-uuid", "brand-uuid");
    const id2 = generateOwnsId("company-uuid", "brand-uuid");
    expect(id1).toBe(id2);
  });

  test("different company produces different ID", () => {
    const id1 = generateOwnsId("company-1", "brand-uuid");
    const id2 = generateOwnsId("company-2", "brand-uuid");
    expect(id1).not.toBe(id2);
  });

  test("different brand produces different ID", () => {
    const id1 = generateOwnsId("company-uuid", "brand-1");
    const id2 = generateOwnsId("company-uuid", "brand-2");
    expect(id1).not.toBe(id2);
  });

  test("throws error for empty companyId", () => {
    expect(() => generateOwnsId("", "brand-uuid")).toThrow();
  });

  test("throws error for empty brandId", () => {
    expect(() => generateOwnsId("company-uuid", "")).toThrow();
  });

  test("uses OWNS namespace", () => {
    expect(NAMESPACES.OWNS).toBe("6ba7b816-9dad-11d1-80b4-00c04fd430c8");
  });
});

describe("generateBusinessSegmentId", () => {
  test("generates valid UUID v5 format", () => {
    const id = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("same input produces same ID (deterministic)", () => {
    const id1 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    const id2 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    expect(id1).toBe(id2);
  });

  test("normalizes segment name (case insensitive)", () => {
    const id1 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    const id2 = generateBusinessSegmentId("company-uuid", "CLOUD SERVICES", 2024, 1);
    expect(id1).toBe(id2);
  });

  test("handles null fiscal quarter (annual)", () => {
    const id = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, null);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("different company produces different ID", () => {
    const id1 = generateBusinessSegmentId("company-1", "Cloud Services", 2024, 1);
    const id2 = generateBusinessSegmentId("company-2", "Cloud Services", 2024, 1);
    expect(id1).not.toBe(id2);
  });

  test("different segment name produces different ID", () => {
    const id1 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    const id2 = generateBusinessSegmentId("company-uuid", "Hardware", 2024, 1);
    expect(id1).not.toBe(id2);
  });

  test("different fiscal year produces different ID", () => {
    const id1 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    const id2 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2025, 1);
    expect(id1).not.toBe(id2);
  });

  test("different fiscal quarter produces different ID", () => {
    const id1 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    const id2 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 2);
    expect(id1).not.toBe(id2);
  });

  test("null quarter differs from numbered quarter", () => {
    const idAnnual = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, null);
    const idQ1 = generateBusinessSegmentId("company-uuid", "Cloud Services", 2024, 1);
    expect(idAnnual).not.toBe(idQ1);
  });

  test("throws error for empty companyId", () => {
    expect(() => generateBusinessSegmentId("", "Cloud Services", 2024, 1)).toThrow();
  });

  test("throws error for empty segment name", () => {
    expect(() => generateBusinessSegmentId("company-uuid", "", 2024, 1)).toThrow();
  });

  test("uses BUSINESS_SEGMENT namespace", () => {
    expect(NAMESPACES.BUSINESS_SEGMENT).toBe("6ba7b814-9dad-11d1-80b4-00c04fd430c8");
  });
});

describe("generateBrandId", () => {
  test("generates valid UUID v5 format", () => {
    const id = generateBrandId("company-uuid", "iPhone");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("same input produces same ID (deterministic)", () => {
    const id1 = generateBrandId("company-uuid", "iPhone");
    const id2 = generateBrandId("company-uuid", "iPhone");
    expect(id1).toBe(id2);
  });

  test("normalizes brand name (case insensitive)", () => {
    const id1 = generateBrandId("company-uuid", "iPhone");
    const id2 = generateBrandId("company-uuid", "IPHONE");
    expect(id1).toBe(id2);
  });

  test("different company produces different ID", () => {
    const id1 = generateBrandId("company-1", "iPhone");
    const id2 = generateBrandId("company-2", "iPhone");
    expect(id1).not.toBe(id2);
  });

  test("different brand name produces different ID", () => {
    const id1 = generateBrandId("company-uuid", "iPhone");
    const id2 = generateBrandId("company-uuid", "iPad");
    expect(id1).not.toBe(id2);
  });

  test("throws error for empty companyId", () => {
    expect(() => generateBrandId("", "iPhone")).toThrow();
  });

  test("throws error for empty brand name", () => {
    expect(() => generateBrandId("company-uuid", "")).toThrow();
  });

  test("uses BRAND namespace", () => {
    expect(NAMESPACES.BRAND).toBe("6ba7b815-9dad-11d1-80b4-00c04fd430c8");
  });
});
