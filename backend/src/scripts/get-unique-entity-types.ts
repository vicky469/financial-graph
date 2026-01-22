/**
 * Script to get unique entityType values from company.identity
 * Run with: bun run src/scripts/get-unique-entity-types.ts
 */

import { db } from "../db/client";

interface CompanyIdentity {
  entityType?: string;
  [key: string]: any;
}

interface Company {
  id: string;
  identity?: CompanyIdentity;
  [key: string]: any;
}

async function getUniqueEntityTypes() {
  console.log("Fetching all companies with identity data...");

  // @ts-ignore - InstantDB query typing issue
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

  // Extract unique entityType values
  const entityTypes = new Set<string>();

  typedCompanies.forEach((company) => {
    if (company.identity?.entityType) {
      entityTypes.add(company.identity.entityType);
    }
  });

  // Convert to sorted array
  const sortedEntityTypes = Array.from(entityTypes).sort();

  console.log(`\nFound ${sortedEntityTypes.length} unique entityType values:\n`);
  sortedEntityTypes.forEach((entityType, index) => {
    console.log(`${index + 1}. ${entityType}`);
  });

  // Output as JSON for easy copying
  console.log("\n\nJSON format:");
  console.log(JSON.stringify(sortedEntityTypes, null, 2));

  // Count companies per entityType
  const counts: Record<string, number> = {};
  typedCompanies.forEach((company) => {
    const entityType = company.identity?.entityType;
    if (entityType) {
      counts[entityType] = (counts[entityType] || 0) + 1;
    }
  });

  console.log("\n\nCompanies per entityType:");
  sortedEntityTypes.forEach((entityType) => {
    console.log(`${entityType}: ${counts[entityType]} companies`);
  });

  process.exit(0);
}

getUniqueEntityTypes().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
