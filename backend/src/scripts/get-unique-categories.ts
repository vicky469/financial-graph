/**
 * Script to get unique category values from company.identity
 * Run with: bun run src/scripts/get-unique-categories.ts
 */

import { db } from "../db/client";
import { getCleanCategory } from "@financial-graph/shared";

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

async function getUniqueCategories() {
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

  // Extract unique category values
  const categories = new Set<string>();

  typedCompanies.forEach((company) => {
    const cleanCategory = getCleanCategory(company.identity?.category);
    if (cleanCategory) {
      categories.add(cleanCategory);
    }
  });

  // Convert to sorted array
  const sortedCategories = Array.from(categories).sort();

  console.log(`\nFound ${sortedCategories.length} unique category values:\n`);
  sortedCategories.forEach((category, index) => {
    console.log(`${index + 1}. ${category}`);
  });

  // Output as JSON for easy copying
  console.log("\n\nJSON format:");
  console.log(JSON.stringify(sortedCategories, null, 2));

  // Count companies per category
  const counts: Record<string, number> = {};
  typedCompanies.forEach((company) => {
    const cleanCategory = getCleanCategory(company.identity?.category);
    if (cleanCategory) {
      counts[cleanCategory] = (counts[cleanCategory] || 0) + 1;
    }
  });

  console.log("\n\nCompanies per category:");
  sortedCategories.forEach((category) => {
    console.log(`${category}: ${counts[category]} companies`);
  });

  process.exit(0);
}

getUniqueCategories().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
