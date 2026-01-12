/**
 * Mark Trust Companies
 * 
 * This script finds public companies with "trust" in their name that have no 10-K or 20-F filings
 * and marks them as trust companies (changes type from PUBLIC to a trust indicator).
 * 
 * Run: bun src/scripts/find-companies-without-filings.ts
 */

import { db } from "../db/client";
import type { Company } from "@financial-graph/shared";
import { CompanyType } from "@financial-graph/shared";
import { createLogger } from "../utils/logger";

const logger = createLogger("scripts/mark-trust-companies");
const BATCH_SIZE = 100;

async function main() {
  logger.info("🔍 Finding trust companies without 10-K/20-F filings...");

  // Fetch all public companies with their filings
  logger.info("Fetching companies from database...");
  const result = await db.query({
    company: {
      $: {
        where: {
          or: [
            { type: CompanyType.PUBLIC },
            { type: CompanyType.ISSUER }
          ]
        },
      },
      filings: {}, // Use the link to get filings
    },
  });

  const companies = (result.company || []) as Array<Company & { filings: any[] }>;
  logger.info(`Found ${companies.length.toLocaleString()} public/issuer companies`);

  // Filter companies with "trust" in name and no 10-K/20-F filings
  const trustCompaniesWithoutFilings = companies.filter((company) => {
    // Check if name contains "trust" (case-insensitive)
    const hasTrustInName = company.name.toLowerCase().includes('trust');
    if (!hasTrustInName) return false;

    // Check if has any 10-K or 20-F filings
    const has10Kor20F = company.filings && company.filings.some(
      (f: any) => f.form_type === '10-K' || f.form_type === '20-F'
    );

    return !has10Kor20F;
  });

  logger.info(`Found ${trustCompaniesWithoutFilings.length} trust companies without 10-K/20-F filings`);

  if (trustCompaniesWithoutFilings.length === 0) {
    logger.info("✅ No trust companies to mark!");
    return;
  }

  // Log company names
  logger.info("Trust companies to mark:");
  logger.info("=".repeat(80));
  
  trustCompaniesWithoutFilings.forEach((company, index) => {
    const cik = company.identity?.primaryCIK || "No CIK";
    const filingCount = company.filings?.length || 0;
    logger.info(`${index + 1}. ${company.name} (CIK: ${cik}) - ${filingCount} filings`);
  });

  // Mark companies by changing their type to TRUST
  logger.info("\nMarking companies as TRUST type...");
  
  let marked = 0;
  for (let i = 0; i < trustCompaniesWithoutFilings.length; i += BATCH_SIZE) {
    const batch = trustCompaniesWithoutFilings.slice(i, i + BATCH_SIZE);
    const transactions = batch.map((company) =>
      db.tx.company[company.id].update({
        type: CompanyType.TRUST,
        updated_at: new Date().toISOString(),
      })
    );

    await db.transact(transactions);
    marked += batch.length;
    logger.info(`Marked ${marked} / ${trustCompaniesWithoutFilings.length} companies...`);
  }

  // Summary statistics
  logger.info("\n=== Summary ===");
  logger.info(`Total public/issuer companies: ${companies.length}`);
  logger.info(`Trust companies marked: ${marked}`);
  logger.info(`Percentage marked as trusts: ${((marked / companies.length) * 100).toFixed(2)}%`);
}

main().catch((error) => {
  logger.error("Error marking trust companies", { error: error.message, stack: error.stack });
  process.exit(1);
});
