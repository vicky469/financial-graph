import { db } from "../db/client";
import "dotenv/config";

async function checkFilings() {
  const companyId = "a4a5dc6c-aa01-5031-bdde-4e9c3cf39465";
  
  console.log("\n=== Checking Filings for Company ===");
  console.log(`Company ID: ${companyId}\n`);

  // 1. Check if company exists
  const companyResult = await db.query({
    companies: {
      $: { where: { id: companyId } },
    },
  });

  if (!companyResult.companies || companyResult.companies.length === 0) {
    console.log("❌ Company not found!");
    return;
  }

  console.log("✅ Company exists:");
  console.log(JSON.stringify(companyResult.companies[0], null, 2));

  // 2. Check filings with company_id filter
  console.log("\n=== Filings with company_id filter ===");
  const filingsById = await db.query({
    filings: {
      $: { where: { company_id: companyId } },
    },
  });

  console.log(`Found ${filingsById.filings?.length || 0} filings`);
  if (filingsById.filings && filingsById.filings.length > 0) {
    console.log("First filing:");
    console.log(JSON.stringify(filingsById.filings[0], null, 2));
  }

  // 3. Check filings via link
  console.log("\n=== Filings via link ===");
  const filingsViaLink = await db.query({
    companies: {
      $: { where: { id: companyId } },
      filings: {},
    },
  });

  const linkedFilings = filingsViaLink.companies?.[0]?.filings || [];
  console.log(`Found ${linkedFilings.length} linked filings`);
  if (linkedFilings.length > 0) {
    console.log("First linked filing:");
    console.log(JSON.stringify(linkedFilings[0], null, 2));
  }

  // 4. Check all filings (sample)
  console.log("\n=== All filings (first 5) ===");
  const allFilings = await db.query({
    filings: {
      $: { limit: 5 },
    },
  });

  console.log(`Total filings in DB: ${allFilings.filings?.length || 0}`);
  if (allFilings.filings && allFilings.filings.length > 0) {
    allFilings.filings.forEach((f: any, i: number) => {
      console.log(`\nFiling ${i + 1}:`);
      console.log(`  ID: ${f.id}`);
      console.log(`  Company ID: ${f.company_id}`);
      console.log(`  Accession: ${f.accession_number}`);
      console.log(`  Form: ${f.form_type}`);
    });
  }

  // 5. Check if any filings exist at all
  console.log("\n=== Total filings count ===");
  const countResult = await db.query({
    filings: {},
  });
  console.log(`Total filings: ${countResult.filings?.length || 0}`);
}

checkFilings()
  .then(() => {
    console.log("\n✅ Check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
