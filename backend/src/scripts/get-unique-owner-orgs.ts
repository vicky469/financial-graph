/**
 * Script to get unique ownerOrg values from company.identity
 * Run with: bun run src/scripts/get-unique-owner-orgs.ts
 */

import { db } from "../db/client";

interface CompanyIdentity {
  category?: string;
  ownerOrg?: string;
  [key: string]: any;
}

interface Company {
  id: string;
  identity?: CompanyIdentity;
  [key: string]: any;
}

async function getUniqueOwnerOrgs() {
  console.log("Fetching all companies with identity data...");

  const { company } = await db.query({
    company: {
      $: {
        where: {
          identity: { $isNull: false },
        },
      },
    },
  });

  const typedCompanies = company as Company[];

  console.log(`Found ${typedCompanies.length} companies with identity data`);

  // Extract unique ownerOrg values
  const ownerOrgs = new Set<string>();

  typedCompanies.forEach((company) => {
    if (company.identity?.ownerOrg) {
      ownerOrgs.add(company.identity.ownerOrg);
    }
  });

  // Convert to sorted array
  const sortedOwnerOrgs = Array.from(ownerOrgs).sort();

  console.log(`\nFound ${sortedOwnerOrgs.length} unique ownerOrg values:\n`);
  sortedOwnerOrgs.forEach((org, index) => {
    console.log(`${index + 1}. ${org}`);
  });

  // Output as JSON for easy copying
  console.log("\n\nJSON format:");
  console.log(JSON.stringify(sortedOwnerOrgs, null, 2));

  // Count companies per ownerOrg
  const counts: Record<string, number> = {};
  typedCompanies.forEach((company) => {
    const org = company.identity?.ownerOrg;
    if (org) {
      counts[org] = (counts[org] || 0) + 1;
    }
  });

  console.log("\n\nCompanies per ownerOrg:");
  sortedOwnerOrgs.forEach((org) => {
    console.log(`${org}: ${counts[org]} companies`);
  });

  process.exit(0);
}

getUniqueOwnerOrgs().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
