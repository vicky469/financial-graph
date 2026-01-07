import { db } from "./client";

async function clearData() {
  console.log("🧹 Clearing existing data...");

  let hasMore = true;
  while (hasMore) {
    // Fetch all IDs to delete
    const result = await db.query({
      companies: {},
      brands: {},
      business_segments: {},
      public_company_details: {},
      ma_events: {},
      filings: {},
      parent_of: {},
      owns: {},
      has_public_details: {},
      has_segments: {},
      filed: {},
    });

    const txs: any[] = [];

    const entities = [
      ...result.companies.map((c: any) => db.tx.companies[c.id].delete()),
      ...result.brands.map((b: any) => db.tx.brands[b.id].delete()),
      ...result.business_segments.map((s: any) =>
        db.tx.business_segments[s.id].delete()
      ),
      ...result.public_company_details.map((d: any) =>
        db.tx.public_company_details[d.id].delete()
      ),
      ...(result.ma_events || []).map((e: any) =>
        db.tx.ma_events[e.id].delete()
      ),
      ...(result.filings || []).map((f: any) => db.tx.filings[f.id].delete()),

      ...(result.parent_of || []).map((e: any) =>
        db.tx.parent_of[e.id].delete()
      ),
      ...(result.owns || []).map((e: any) => db.tx.owns[e.id].delete()),
      ...(result.has_public_details || []).map((e: any) =>
        db.tx.has_public_details[e.id].delete()
      ),
      ...(result.has_segments || []).map((e: any) =>
        db.tx.has_segments[e.id].delete()
      ),
      ...(result.filed || []).map((e: any) => db.tx.filed[e.id].delete()),
    ];

    if (entities.length > 0) {
      console.log(`Deleting batch of ${entities.length} items...`);
      // Batch in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < entities.length; i += chunkSize) {
        await db.transact(entities.slice(i, i + chunkSize));
      }
      // Wait a bit for propagation
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      hasMore = false;
    }
  }
  console.log("✨ Data cleared.");
}

clearData().catch(console.error);
