/**
 * Tests for Zod validation schemas
 * 
 * Only tests business logic validation that InstantDB can't express:
 * - CIK format (1-10 digit numeric string)
 * - Jurisdiction format (not a number/percentage)
 * - Company type-specific rules (PUBLIC/ISSUER need primaryCIK, PRIVATE needs jurisdiction)
 */

import { describe, test, expect } from "bun:test";
import {
  CompanySchema,
  PublicCompanySchema,
  PrivateCompanySchema,
  IssuerCompanySchema,
  UnknownCompanySchema,
  CIKString,
  JurisdictionString,
  validate,
  safeValidate,
} from "../types/validation";
import { CompanyType } from "../types/types";

describe("CIK Validation", () => {
  test("accepts valid CIK formats", () => {
    expect(CIKString.safeParse("0000320193").success).toBe(true);
    expect(CIKString.safeParse("320193").success).toBe(true);
    expect(CIKString.safeParse("1").success).toBe(true);
    expect(CIKString.safeParse("1234567890").success).toBe(true);
  });

  test("rejects invalid CIK formats", () => {
    expect(CIKString.safeParse("").success).toBe(false);
    expect(CIKString.safeParse("12345678901").success).toBe(false); // Too long
    expect(CIKString.safeParse("abc").success).toBe(false); // Non-numeric
    expect(CIKString.safeParse("123-456").success).toBe(false); // Contains dash
  });
});

describe("Jurisdiction Validation", () => {
  test("accepts valid jurisdictions", () => {
    expect(JurisdictionString.safeParse("Delaware").success).toBe(true);
    expect(JurisdictionString.safeParse("New York").success).toBe(true);
    expect(JurisdictionString.safeParse("United Kingdom").success).toBe(true);
  });

  test("rejects numeric jurisdictions", () => {
    expect(JurisdictionString.safeParse("100").success).toBe(false);
    expect(JurisdictionString.safeParse("10.5").success).toBe(false);
  });

  test("rejects percentage jurisdictions", () => {
    expect(JurisdictionString.safeParse("10%").success).toBe(false);
    expect(JurisdictionString.safeParse("100%").success).toBe(false);
  });
});

describe("Company Validation", () => {
  describe("Public Companies (Type 1)", () => {
    test("validates public company with primaryCIK", () => {
      const company = {
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: {
          primaryCIK: "0000320193",
        },
      };

      const result = PublicCompanySchema.safeParse(company);
      expect(result.success).toBe(true);
    });

    test("rejects public company without primaryCIK", () => {
      const company = {
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: {},
      };

      const result = PublicCompanySchema.safeParse(company);
      expect(result.success).toBe(false);
    });

    test("rejects public company with invalid CIK", () => {
      const company = {
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: {
          primaryCIK: "invalid",
        },
      };

      const result = PublicCompanySchema.safeParse(company);
      expect(result.success).toBe(false);
    });
  });

  describe("Private Companies (Type 2)", () => {
    test("validates private company with name and jurisdiction", () => {
      const company = {
        type: CompanyType.PRIVATE,
        name: "Acme Corp",
        jurisdiction_raw: "Delaware",
      };

      const result = PrivateCompanySchema.safeParse(company);
      expect(result.success).toBe(true);
    });

    test("rejects private company without jurisdiction", () => {
      const company = {
        type: CompanyType.PRIVATE,
        name: "Acme Corp",
      };

      const result = PrivateCompanySchema.safeParse(company);
      expect(result.success).toBe(false);
    });

    test("rejects private company with numeric jurisdiction", () => {
      const company = {
        type: CompanyType.PRIVATE,
        name: "Acme Corp",
        jurisdiction_raw: "100",
      };

      const result = PrivateCompanySchema.safeParse(company);
      expect(result.success).toBe(false);
    });
  });

  describe("Issuer Companies (Type 3)", () => {
    test("validates issuer company with primaryCIK", () => {
      const company = {
        type: CompanyType.ISSUER,
        name: "Meta Platforms",
        identity: {
          primaryCIK: "0001326801",
        },
      };

      const result = IssuerCompanySchema.safeParse(company);
      expect(result.success).toBe(true);
    });
  });

  describe("Unknown Companies (Type 4)", () => {
    test("validates unknown company with name only", () => {
      const company = {
        type: CompanyType.UNKNOWN,
        name: "Mystery LLC",
      };

      const result = UnknownCompanySchema.safeParse(company);
      expect(result.success).toBe(true);
    });

    test("validates unknown company with optional jurisdiction", () => {
      const company = {
        type: CompanyType.UNKNOWN,
        name: "Mystery LLC",
        jurisdiction_raw: "Nevada",
      };

      const result = UnknownCompanySchema.safeParse(company);
      expect(result.success).toBe(true);
    });
  });

  describe("Discriminated Union", () => {
    test("validates based on type field", () => {
      const publicCompany = {
        type: CompanyType.PUBLIC,
        name: "Apple Inc.",
        identity: { primaryCIK: "0000320193" },
      };

      const privateCompany = {
        type: CompanyType.PRIVATE,
        name: "Acme Corp",
        jurisdiction_raw: "Delaware",
      };

      expect(CompanySchema.safeParse(publicCompany).success).toBe(true);
      expect(CompanySchema.safeParse(privateCompany).success).toBe(true);
    });

    test("rejects invalid type", () => {
      const company = {
        type: 99,
        name: "Invalid Type Inc.",
      };

      const result = CompanySchema.safeParse(company);
      expect(result.success).toBe(false);
    });
  });
});

describe("Validation Helper Functions", () => {
  test("validate() returns data on success", () => {
    const data = {
      type: CompanyType.PUBLIC,
      name: "Test",
      identity: { primaryCIK: "123" },
    };
    const result = validate(PublicCompanySchema, data);
    expect(result.name).toBe("Test");
  });

  test("validate() throws on failure", () => {
    const data = { type: CompanyType.PUBLIC, name: "Test" };
    expect(() => validate(PublicCompanySchema, data, "PublicCompany")).toThrow();
  });

  test("safeValidate() returns success result", () => {
    const data = {
      type: CompanyType.PUBLIC,
      name: "Test",
      identity: { primaryCIK: "123" },
    };
    const result = safeValidate(PublicCompanySchema, data);
    expect(result.success).toBe(true);
  });

  test("safeValidate() returns error result", () => {
    const data = { type: CompanyType.PUBLIC, name: "Test" };
    const result = safeValidate(PublicCompanySchema, data);
    expect(result.success).toBe(false);
  });
});
