import { db } from "./src/db/client";

async function main() {
  // Check companies with "trust" in name that are still PUBLIC/ISSUER
  const result = await db.query({
    company: {
      $: {
        where: {
          or: [
            { type: 1 }, // PUBLIC
            { type: 3 }, // ISSUER
          ]
        },
      },
      filings: {},
    },
  });

  const companiesWithTrust = result.company?.filter((c: any) => 
    c.name.toLowerCase().includes('trust')
  );

  console.log(`Found ${companiesWithTrust?.length} PUBLIC/ISSUER companies with "trust" in name`);
  console.log("\nFirst 10:");
  companiesWithTrust?.slice(0, 10).forEach((c: any) => {
    const has10Kor20F = c.filings?.some((f: any) => f.form_type === '10-K' || f.form_type === '20-F');
    console.log(`- ${c.name}: type=${c.type}, has 10-K/20-F: ${has10Kor20F}, total filings: ${c.filings?.length || 0}`);
  });
}

main().catch(console.error);
