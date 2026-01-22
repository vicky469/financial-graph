/**
 * One-time migration script to update subsidiary companies from type 2 (PRIVATE) to type 6 (SUBSIDIARY)
 * 
 * Background:
 * Previously, we incorrectly classified all subsidiaries as PRIVATE companies (type 2).
 * Now we have a dedicated SUBSIDIARY type (type 6) that should be used instead.
 * 
 * This script identifies subsidiaries by checking if they have parent relationships
 * and updates their type from 2 to 6.
 * 
 * Usage:
 *   bun run src/scripts/migrate-subsidiaries-to-type-6.ts [--dry-run]
 */

import { db } from "../db/client";
import { createLogger } from "../utils/logger";
import { CompanyType } from "@financial-graph/shared/types";

const logger = createLogger("scripts/migrate-subsidiaries");

interface MigrationStats {
  totalPrivateCompanies: number;
  subsidiariesFound: number;
  subsidiariesUpdated: number;
  errors: number;
}

async function migrateSubsidiaries(dryRun: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalPrivateCompanies: 0,
    subsidiariesFound: 0,
    subsidiariesUpdated: 0,
    errors: 0,
  };

  try {
    logger.info(`Starting migration (dry-run: ${dryRun})...`);

    // Step 1: Fetch all PRIVATE companies WITH their parent relationships in one query
    logger.info("Fetching all PRIVATE companies with parent relationships...");
    const privateCompaniesResult = await db.query({
      company: {
        $: {
          where: {
            type: CompanyType.PRIVATE,
          },
        },
        parents: {}, // Fetch parent relationships for all companies at once
      },
    });

    const privateCompanies = privateCompaniesResult.company || [];
    stats.totalPrivateCompanies = privateCompanies.length;
    logger.info(`Found ${stats.totalPrivateCompanies} companies with type = 2 (PRIVATE)`);

    if (stats.totalPrivateCompanies === 0) {
      logger.info("No PRIVATE companies found. Exiting.");
      return stats;
    }

    // Step 2: Filter companies that have parent relationships (are subsidiaries)
    logger.info("Identifying subsidiaries (companies with parent relationships)...");
    
    const subsidiariesToUpdate: Array<{ id: string; name: string; jurisdiction: string }> = [];
    
    for (const company of privateCompanies) {
      const parentRelationships = company.parents || [];

      if (parentRelationships.length > 0) {
        subsidiariesToUpdate.push({
          id: company.id,
          name: company.name,
          jurisdiction: company.jurisdiction_raw || company.jurisdiction_iso || "Unknown",
        });
        stats.subsidiariesFound++;
      }
    }

    logger.info(`Found ${stats.subsidiariesFound} subsidiaries that need to be updated`);

    if (stats.subsidiariesFound === 0) {
      logger.info("No subsidiaries found to migrate. Exiting.");
      return stats;
    }

    // Step 3: Update subsidiaries to type 6 (SUBSIDIARY)
    if (dryRun) {
      logger.info("DRY RUN: Would update the following companies:");
      logger.info(`  - ${stats.subsidiariesFound} companies from type 2 (PRIVATE) to type 6 (SUBSIDIARY)`);
      
      // Show a sample of companies that would be updated
      const sampleSize = Math.min(10, subsidiariesToUpdate.length);
      const sampleCompanies = subsidiariesToUpdate.slice(0, sampleSize);
      
      logger.info("Sample companies that would be updated:");
      sampleCompanies.forEach(c => {
        logger.info(`  - ${c.name} (${c.jurisdiction}) [${c.id}]`);
      });
    } else {
      logger.info("Updating subsidiaries to type 6 (SUBSIDIARY) with parallel workers...");
      
      // Update with parallel workers for better performance
      const WORKER_COUNT = 20; // M1 with 64GB can handle this easily
      const companiesPerWorker = Math.ceil(subsidiariesToUpdate.length / WORKER_COUNT);
      
      logger.info(`Using ${WORKER_COUNT} parallel workers, ~${companiesPerWorker} companies per worker`);
      
      // Split companies into chunks for parallel processing
      const chunks: Array<typeof subsidiariesToUpdate> = [];
      for (let i = 0; i < subsidiariesToUpdate.length; i += companiesPerWorker) {
        chunks.push(subsidiariesToUpdate.slice(i, i + companiesPerWorker));
      }
      
      // Process chunks in parallel
      const updatePromises = chunks.map(async (chunk, workerIndex) => {
        let workerUpdated = 0;
        let workerErrors = 0;
        
        for (const company of chunk) {
          try {
            await db.transact([
              db.tx.company[company.id].update({
                type: CompanyType.SUBSIDIARY,
              }),
            ]);
            workerUpdated++;
            
            // Log progress every 50 updates per worker
            if (workerUpdated % 50 === 0) {
              logger.info(`Worker ${workerIndex + 1}: Updated ${workerUpdated}/${chunk.length} companies`);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Worker ${workerIndex + 1}: Error updating company ${company.id} (${company.name}): ${errorMsg}`);
            workerErrors++;
          }
        }
        
        logger.info(`Worker ${workerIndex + 1}: Completed - ${workerUpdated} updated, ${workerErrors} errors`);
        return { updated: workerUpdated, errors: workerErrors };
      });
      
      // Wait for all workers to complete
      const results = await Promise.all(updatePromises);
      
      // Aggregate results
      stats.subsidiariesUpdated = results.reduce((sum, r) => sum + r.updated, 0);
      stats.errors = results.reduce((sum, r) => sum + r.errors, 0);
      
      logger.info(`Migration complete! Updated ${stats.subsidiariesUpdated} subsidiaries with ${stats.errors} errors.`);
    }

    // Step 4: Verify the migration
    if (!dryRun) {
      logger.info("Verifying migration...");
      const remainingPrivateResult = await db.query({
        company: {
          $: {
            where: {
              type: CompanyType.PRIVATE,
            },
          },
          parents: {}, // Fetch parent relationships
        },
      });

      const remainingPrivateWithParents = remainingPrivateResult.company || [];

      let stillHaveParents = 0;
      for (const company of remainingPrivateWithParents) {
        const parents = company.parents || [];
        if (parents.length > 0) {
          stillHaveParents++;
        }
      }

      if (stillHaveParents > 0) {
        logger.warn(`Warning: ${stillHaveParents} PRIVATE companies still have parent relationships!`);
      } else {
        logger.info("✓ Verification passed: No PRIVATE companies have parent relationships");
      }

      // Count new SUBSIDIARY companies
      const subsidiaryResult = await db.query({
        company: {
          $: {
            where: { type: CompanyType.SUBSIDIARY },
          },
        },
      });
      const subsidiaryCount = (subsidiaryResult.company || []).length;
      logger.info(`Total SUBSIDIARY companies (type 6) in database: ${subsidiaryCount}`);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Migration failed: ${errorMsg}`);
    throw error;
  }

  return stats;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    logger.info("=== DRY RUN MODE ===");
    logger.info("No changes will be made to the database");
  } else {
    logger.warn("=== LIVE MODE ===");
    logger.warn("This will modify the database!");
    logger.warn("Press Ctrl+C within 5 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const stats = await migrateSubsidiaries(dryRun);

  logger.info("\n=== Migration Summary ===");
  logger.info(`Total PRIVATE companies (type 2): ${stats.totalPrivateCompanies}`);
  logger.info(`Subsidiaries found: ${stats.subsidiariesFound}`);
  logger.info(`Subsidiaries updated: ${stats.subsidiariesUpdated}`);
  logger.info(`Errors: ${stats.errors}`);

  if (dryRun) {
    logger.info("\nThis was a dry run. Run without --dry-run to apply changes.");
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  const errorMsg = error instanceof Error ? error.message : String(error);
  logger.error(`Fatal error: ${errorMsg}`);
  process.exit(1);
});
