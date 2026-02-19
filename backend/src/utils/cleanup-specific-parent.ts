/**
 * Cleanup script to remove parent_of edges and subsidiary companies
 * for one or more parent company IDs provided via CLI args.
 */

import { db } from '../db/client';
import { createLogger } from './logger';

const logger = createLogger('utils/cleanup-specific-parent');

const DELETE_BATCH_SIZE = 100;
const PARALLEL_DELETES = 5;
const DEFAULT_PARENT_CONCURRENCY = 3;

type CleanupParentSummary = {
  parentCompanyId: string;
  parentCompanyName?: string;
  deletedEdges: number;
  deletedCompanies: number;
  status: 'success' | 'empty' | 'failed';
  error?: string;
};

function parseParentIdsFromArgs(argv: string[]): string[] {
  const ids = argv
    .flatMap((arg) => arg.split(','))
    .map((id) => id.trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function parseParentConcurrency(): number {
  const raw = process.env.CLEANUP_PARENT_CONCURRENCY?.trim();
  if (!raw) return DEFAULT_PARENT_CONCURRENCY;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_PARENT_CONCURRENCY;
  }
  return Math.min(value, 20);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let currentIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  async function runWorker() {
    for (;;) {
      const index = currentIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function deleteIdsInParallelBatches(
  ids: string[],
  txForId: (id: string) => unknown,
  progressLabel: string,
): Promise<number> {
  if (ids.length === 0) return 0;

  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE * PARALLEL_DELETES) {
    const batches: string[][] = [];
    for (let j = 0; j < PARALLEL_DELETES; j++) {
      const start = i + (j * DELETE_BATCH_SIZE);
      if (start >= ids.length) break;
      batches.push(ids.slice(start, start + DELETE_BATCH_SIZE));
    }

    await Promise.all(
      batches.map((batch) =>
        db.transact(batch.map((id) => txForId(id) as any)),
      ),
    );

    deleted += batches.reduce((sum, batch) => sum + batch.length, 0);
    if (deleted % 1000 === 0 || deleted === ids.length) {
      logger.info(`Deleted ${deleted}/${ids.length} ${progressLabel}`);
    }
  }

  return deleted;
}

async function cleanupSpecificParent(
  parentCompanyId: string,
): Promise<CleanupParentSummary> {
  logger.info(`[${parentCompanyId}] Starting cleanup`);

  try {
    logger.info(`[${parentCompanyId}] Querying parent_of edges`);
    const { parent_of } = await db.query({
      parent_of: {
        $: {
          where: {
            'parentCompany.id': parentCompanyId,
          },
        },
        parentCompany: {},
        subsidiaryCompany: {},
      },
    });

    logger.info(
      `[${parentCompanyId}] Found ${parent_of.length} parent_of edges`,
    );

    if (parent_of.length === 0) {
      return {
        parentCompanyId,
        deletedEdges: 0,
        deletedCompanies: 0,
        status: 'empty',
      };
    }

    const parentCompanyNameRaw = parent_of[0]?.parentCompany?.name;
    const parentCompanyName =
      typeof parentCompanyNameRaw === 'string' ? parentCompanyNameRaw : undefined;
    const subsidiaryIds = new Set<string>();
    const edgesToDelete: string[] = [];

    for (const edge of parent_of) {
      edgesToDelete.push(edge.id);
      if (edge.subsidiaryCompany?.id) {
        subsidiaryIds.add(edge.subsidiaryCompany.id);
      }
    }

    logger.info(
      `[${parentCompanyId}] Deleting ${edgesToDelete.length} edges and ${subsidiaryIds.size} subsidiary companies`,
    );

    const deletedEdges = await deleteIdsInParallelBatches(
      edgesToDelete,
      (id) => db.tx.parent_of[id].delete(),
      `parent_of edges for ${parentCompanyId}`,
    );

    const deletedCompanies = await deleteIdsInParallelBatches(
      Array.from(subsidiaryIds),
      (id) => db.tx.company[id].delete(),
      `subsidiary companies for ${parentCompanyId}`,
    );

    logger.info(
      `[${parentCompanyId}] Cleanup complete: ${deletedEdges} edges, ${deletedCompanies} companies`,
    );

    return {
      parentCompanyId,
      parentCompanyName,
      deletedEdges,
      deletedCompanies,
      status: 'success',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[${parentCompanyId}] Cleanup failed`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      parentCompanyId,
      deletedEdges: 0,
      deletedCompanies: 0,
      status: 'failed',
      error: errorMessage,
    };
  }
}

async function cleanupParents(parentCompanyIds: string[]): Promise<void> {
  const parentConcurrency = parseParentConcurrency();
  logger.info(
    `Starting cleanup for ${parentCompanyIds.length} parent company IDs (concurrency=${parentConcurrency})`,
  );

  const summaries = await runWithConcurrency(
    parentCompanyIds,
    parentConcurrency,
    cleanupSpecificParent,
  );

  const success = summaries.filter((s) => s.status === 'success');
  const empty = summaries.filter((s) => s.status === 'empty');
  const failed = summaries.filter((s) => s.status === 'failed');

  const totalDeletedEdges = summaries.reduce((sum, s) => sum + s.deletedEdges, 0);
  const totalDeletedCompanies = summaries.reduce(
    (sum, s) => sum + s.deletedCompanies,
    0,
  );

  logger.info('\n=== Cleanup Summary ===');
  logger.info(`Requested parent IDs: ${parentCompanyIds.length}`);
  logger.info(`Succeeded: ${success.length}`);
  logger.info(`No edges found: ${empty.length}`);
  logger.info(`Failed: ${failed.length}`);
  logger.info(`Total deleted parent_of edges: ${totalDeletedEdges}`);
  logger.info(`Total deleted subsidiary companies: ${totalDeletedCompanies}`);

  if (failed.length > 0) {
    failed.forEach((entry) => {
      logger.error(`Failed parent ID ${entry.parentCompanyId}: ${entry.error}`);
    });
    throw new Error(`Cleanup failed for ${failed.length} parent company IDs`);
  }
}

function printUsageAndExit(): never {
  logger.error(
    'Missing parent company ID(s). Usage: bun src/utils/cleanup-specific-parent.ts <parentId1> [parentId2] [parentId3,...]',
  );
  process.exit(1);
}

const parentIds = parseParentIdsFromArgs(process.argv.slice(2));
if (parentIds.length === 0) {
  printUsageAndExit();
}

cleanupParents(parentIds)
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  });
