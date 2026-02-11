/**
 * Cleanup script to remove parent_of edges and subsidiary companies
 * ONLY for a specific parent company ID
 */

import { db } from '../db/client';
import { createLogger } from './logger';

const logger = createLogger('utils/cleanup-specific-parent');

const PARENT_COMPANY_ID = 'e575a8b1-42c5-5e27-82f2-03dd5638d52c';

async function cleanupSpecificParent() {
  logger.info(`Starting cleanup for parent company: ${PARENT_COMPANY_ID}`);
  
  try {
    // Step 1: Query parent_of edges for this specific parent company
    logger.info('Querying parent_of edges for specific parent...');
    
    const { parent_of } = await db.query({
      parent_of: {
        $: {
          where: {
            'parentCompany.id': PARENT_COMPANY_ID,
          },
        },
        parentCompany: {},
        subsidiaryCompany: {},
      },
    });
    
    logger.info(`Found ${parent_of.length} parent_of edges for this parent company`);
    
    if (parent_of.length === 0) {
      logger.info('No edges found to delete. Exiting.');
      return;
    }
    
    // Step 2: Collect subsidiary company IDs and edge IDs
    const subsidiaryIds = new Set<string>();
    const edgesToDelete: string[] = [];
    
    for (const edge of parent_of) {
      edgesToDelete.push(edge.id);
      
      // Collect subsidiary company ID
      if (edge.subsidiaryCompany) {
        subsidiaryIds.add(edge.subsidiaryCompany.id);
      }
    }
    
    logger.info(`Found ${edgesToDelete.length} parent_of edges to delete`);
    logger.info(`Found ${subsidiaryIds.size} subsidiary companies to delete`);
    
    // Show parent company info
    if (parent_of[0]?.parentCompany) {
      logger.info(`Parent company: ${parent_of[0].parentCompany.name}`);
    }
    
    // Step 3: Delete parent_of edges in parallel batches
    logger.info('Deleting parent_of edges in parallel...');
    const DELETE_BATCH_SIZE = 100;
    const PARALLEL_DELETES = 5;
    let deletedEdges = 0;
    
    for (let i = 0; i < edgesToDelete.length; i += DELETE_BATCH_SIZE * PARALLEL_DELETES) {
      const deletePromises = [];
      
      for (let j = 0; j < PARALLEL_DELETES; j++) {
        const startIdx = i + (j * DELETE_BATCH_SIZE);
        if (startIdx >= edgesToDelete.length) break;
        
        const batch = edgesToDelete.slice(startIdx, startIdx + DELETE_BATCH_SIZE);
        const txs = batch.map(id => db.tx.parent_of[id].delete());
        deletePromises.push(db.transact(txs));
      }
      
      await Promise.all(deletePromises);
      deletedEdges += deletePromises.length * DELETE_BATCH_SIZE;
      deletedEdges = Math.min(deletedEdges, edgesToDelete.length);
      
      if (deletedEdges % 1000 === 0 || deletedEdges === edgesToDelete.length) {
        logger.info(`Deleted ${deletedEdges}/${edgesToDelete.length} parent_of edges`);
      }
    }
    
    // Step 4: Delete subsidiary companies in parallel batches
    logger.info('Deleting subsidiary companies in parallel...');
    const subsidiaryIdArray = Array.from(subsidiaryIds);
    let deletedCompanies = 0;
    
    for (let i = 0; i < subsidiaryIdArray.length; i += DELETE_BATCH_SIZE * PARALLEL_DELETES) {
      const deletePromises = [];
      
      for (let j = 0; j < PARALLEL_DELETES; j++) {
        const startIdx = i + (j * DELETE_BATCH_SIZE);
        if (startIdx >= subsidiaryIdArray.length) break;
        
        const batch = subsidiaryIdArray.slice(startIdx, startIdx + DELETE_BATCH_SIZE);
        const txs = batch.map(id => db.tx.company[id].delete());
        deletePromises.push(db.transact(txs));
      }
      
      await Promise.all(deletePromises);
      deletedCompanies += deletePromises.length * DELETE_BATCH_SIZE;
      deletedCompanies = Math.min(deletedCompanies, subsidiaryIdArray.length);
      
      if (deletedCompanies % 1000 === 0 || deletedCompanies === subsidiaryIdArray.length) {
        logger.info(`Deleted ${deletedCompanies}/${subsidiaryIdArray.length} subsidiary companies`);
      }
    }
    
    logger.info('\n=== Cleanup Summary ===');
    logger.info(`Parent company ID: ${PARENT_COMPANY_ID}`);
    logger.info(`Deleted ${deletedEdges} parent_of edges`);
    logger.info(`Deleted ${deletedCompanies} subsidiary companies`);
    logger.info('✅ Cleanup complete!');
    
  } catch (error) {
    logger.error('Cleanup failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the cleanup
cleanupSpecificParent()
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
