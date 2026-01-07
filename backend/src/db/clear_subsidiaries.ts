import { db } from "./client";
import { createLogger } from "../utils/logger";

const logger = createLogger("db/clear_subsidiaries");

async function main() {
  logger.info("Starting AGGRESSIVE Subsdiary Data Cleanup...");
  logger.info("Target: DELETE ALL 'parent_of' edges.");
  logger.info("Target: DELETE ALL 'private' companies.");

  let deletedTotalEdges = 0;
  let deletedTotalCompanies = 0;

  // --- Loop until no more records found ---
  while (true) {
    // 1. Fetch Batch
    const res = await db.query({
      parent_of: { $: { limit: 1000 } },
      companies: {
        $: {
          where: { type: "private" },
          limit: 1000,
        },
      },
    });

    const edges = res.parent_of;
    const companies = res.companies;

    const edgeCount = edges.length;
    const companyCount = companies.length;

    if (edgeCount === 0 && companyCount === 0) {
      logger.info("No more records found. Cleanup complete.");
      break;
    }

    logger.info(
      `Fetched batch: ${edgeCount} edges, ${companyCount} private companies.`
    );

    const txs: any[] = [];

    // Queue Edges for deletion
    for (const edge of edges) {
      txs.push(db.tx.parent_of[edge.id].delete());
    }

    // Queue Companies for deletion
    for (const comp of companies) {
      txs.push(db.tx.companies[comp.id].delete());
    }

    // Execute Transaction
    if (txs.length > 0) {
      // Chunking slightly to be safe with tx limits, though 1000 ops might fit
      // depending on InstantDB payload limits. standard is often 100 or so.
      // Let's do 100 blocks.
      const CHUNK_SIZE = 100;
      for (let i = 0; i < txs.length; i += CHUNK_SIZE) {
        const chunk = txs.slice(i, i + CHUNK_SIZE);
        await db.transact(chunk);
      }
    }

    deletedTotalEdges += edgeCount;
    deletedTotalCompanies += companyCount;

    logger.info(
      `Deleted batch. Total so far: ${deletedTotalEdges} edges, ${deletedTotalCompanies} companies.`
    );

    // Small pause to let DB breathe?
    await new Promise((r) => setTimeout(r, 500));
  }

  logger.info("🎉 Done!");
}

main().catch((e) => {
  logger.error(e.message);
});
