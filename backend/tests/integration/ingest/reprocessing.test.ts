import { init } from "@instantdb/admin";
import dotenv from "dotenv";
import path from "path";

// Load .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const db = init({
  appId: process.env.INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_ADMIN_SECRET!,
});

describe("Reprocessing Verification", () => {
  // Example from the unknown list: "26North BDC, Inc." CIK 0001950976
  const TEST_CIK = "0001950976";
  const TEST_NAME = "26North BDC, Inc.";

  test("Should find the previously unknown company", async () => {
    const res = await db.query({
      companies: {
        $: { where: { name: TEST_NAME } },
      },
    });

    expect(res.companies.length).toBe(1);
    expect(res.companies[0].name).toBe(TEST_NAME);
    expect(res.companies[0].type).toBe("issuer");
  });

  test("Should find filings for this company", async () => {
    // Query via reverse link if possible, or just search filings by company_id
    // First get ID
    const compRes = await db.query({
      companies: { $: { where: { name: TEST_NAME } } },
    });
    const companyId = compRes.companies[0].id;

    const fileRes = await db.query({
      filings: {
        $: { where: { company_id: companyId } },
      },
    });

    // We expect at least one filing (the 10-K from 2025-03-03 mentioned in json)
    expect(fileRes.filings.length).toBeGreaterThan(0);
    const filing = fileRes.filings.find((f) => f.form_type === "10-K");
    expect(filing).toBeDefined();
  });

  test("Should search for Santander Trust and confirm it is an issuer", async () => {
    const TRUST_NAME = "Santander Drive Auto Receivables Trust 2022-3";
    const res = await db.query({
      companies: {
        $: { where: { name: TRUST_NAME } },
      },
    });

    expect(res.companies.length).toBe(1);
    expect(res.companies[0].name).toBe(TRUST_NAME);
    expect(res.companies[0].type).toBe("issuer");
  });
});
