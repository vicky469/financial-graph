import { id } from '@instantdb/react';
/**
 * Subsidiary DB Writer
 *
 * Writes parsed subsidiary data to InstantDB with audit trail.
 * Creates company nodes and parent_of edges with provenance tracking.
 * 
 * Two-Phase Ingestion:
 * - Phase 1 (Heuristic): Creates companies, parent_of edges for ALL subsidiaries, and enrichment metadata
 * - Phase 2 (LLM Enrichment): Separate script updates/creates parent_of edges with LLM-derived data
 */

import { createLogger } from "../utils/logger";
import { db } from "../db/client";
import { 
  generateCompanyId, 
  generateParentOfId, 
  generateSubsidiaryEnrichmentId,
  generateFilingId,
  CompanyType,
} from "@financial-graph/shared";
import type { SubsidiaryRecord } from "../parser/subsidiary/types";

const logger = createLogger("ingest/subsidiaries-db");

// Check if audit trail is enabled
const ENABLE_AUDIT_TRAIL = process.env.ENABLE_AUDIT_TRAIL !== "false";

if (!ENABLE_AUDIT_TRAIL) {
  logger.info("Audit trail disabled - skipping audit record creation");
}

// Track unique error messages
const seenErrors = new Set<string>();

interface ParseOutput {
  accession: string;
  cik?: string;
  exhibitType: string;
  url: string;
  method: string;
  success: boolean;
  subsidiaryCount: number;
  maxNestingLevel: number;
  hasNestedStructure: boolean;
  errorMessage?: string;
  subsidiaries: SubsidiaryRecord[];
  footnotesHtml?: string; // Preprocessed footnotes HTML for LLM enrichment
}

/**
 * Write parsed subsidiaries to InstantDB with audit trail
 * 
 * OPTIMIZED: Batches all operations per filing into a single transaction
 * 
 * Two-Phase Ingestion:
 * 1. Creates company records for all subsidiaries
 * 2. Creates parent_of edges for ALL subsidiaries:
 *    - Nested subsidiaries: parent = subsidiary at previous nesting level
 *    - Non-nested subsidiaries: parent = filing company (default)
 * 3. Creates enrichment metadata ONLY for subsidiaries with footnotes
 */
export async function writeSubsidiariesToDB(
  results: ParseOutput[]
): Promise<{ created: number; errors: number; enrichmentRecords: number }> {
  let created = 0;
  let errors = 0;
  let enrichmentRecords = 0;

  // Process filings in parallel batches (small batches to avoid timeouts)
  const BATCH_SIZE = 5;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (result) => {
        if (!result.success || result.subsidiaries.length === 0) {
          return;
        }

        try {
          const stats = await writeFilingSubsidiaries(result);
          created += stats.created;
          enrichmentRecords += stats.enrichmentRecords;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`[${result.accession}] Failed to write filing (${result.subsidiaries.length} subs): ${errorMsg}`);
          
          // Log first occurrence of each unique error type
          if (!seenErrors.has(errorMsg)) {
            seenErrors.add(errorMsg);
            logger.error(`[${result.accession}] First occurrence of error: ${errorMsg}`);
            if (error instanceof Error && error.stack) {
              logger.error(`[${result.accession}] Stack trace: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
            }
          }
          
          errors += result.subsidiaries.length;
        }
      })
    );
  }

  logger.info(
    `DB write complete: ${created} subsidiaries created, ${enrichmentRecords} enrichment records created, ${errors} errors`
  );
  
  if (seenErrors.size > 0) {
    logger.info(`\nUnique error types encountered: ${seenErrors.size}`);
    logger.info("Error types:");
    Array.from(seenErrors).forEach((err, i) => {
      logger.info(`  ${i + 1}. ${err}`);
    });
  }
  
  return { created, errors, enrichmentRecords };
}

/**
 * Write all subsidiaries from a single filing in ONE batched transaction
 * For large filings (>50 subsidiaries), splits into multiple transactions
 */
async function writeFilingSubsidiaries(
  result: ParseOutput
): Promise<{ created: number; enrichmentRecords: number }> {
  const MAX_SUBS_PER_TX = 50; // Limit to avoid transaction timeouts
  
  if (result.subsidiaries.length > MAX_SUBS_PER_TX) {
    // Split large filings into chunks
    let totalCreated = 0;
    let totalEnrichments = 0;
    
    for (let i = 0; i < result.subsidiaries.length; i += MAX_SUBS_PER_TX) {
      const chunk = result.subsidiaries.slice(i, i + MAX_SUBS_PER_TX);
      const chunkResult = { ...result, subsidiaries: chunk };
      const stats = await writeFilingSubsidiariesBatch(chunkResult);
      totalCreated += stats.created;
      totalEnrichments += stats.enrichmentRecords;
    }
    
    return { created: totalCreated, enrichmentRecords: totalEnrichments };
  }
  
  return writeFilingSubsidiariesBatch(result);
}

/**
 * Write a batch of subsidiaries in a single transaction
 */
async function writeFilingSubsidiariesBatch(
  result: ParseOutput
): Promise<{ created: number; enrichmentRecords: number }> {
  // Look up the filing by accession number to get the correct company_id
  // This is more reliable than using CIK lookup, especially for companies with multiple CIKs
  const filingId = generateFilingId(result.accession);
  
  const filingResult = await db.query({
    filing: {
      $: {
        where: {
          id: filingId,
        },
      },
      company: {},
    },
  });

  const filing = filingResult.filing?.[0];
  
  if (!filing || !filing.company) {
    logger.error(
      `[${result.accession}] Filing or filing company not found in database - skipping subsidiary ingestion`
    );
    return { created: 0, enrichmentRecords: 0 };
  }

  const filingCompanyId = filing.company.id;

  // Check if the filing company is public
  const companyResult = await db.query({
    company: {
      $: {
        where: {
          id: filingCompanyId,
        },
      },
    },
  });

  const company = companyResult.company?.[0];
  
  if (!company) {
    logger.error(
      `[${result.accession}] Company ${filingCompanyId} not found in database - skipping`
    );
    return { created: 0, enrichmentRecords: 0 };
  }

  // Only process if company is public
  if (company.type !== CompanyType.PUBLIC) {
    logger.info(
      `[${result.accession}] Company ${company.name} is type "${company.type}" (not public) - skipping subsidiary ingestion`
    );
    return { created: 0, enrichmentRecords: 0 };
  }

  logger.info(
    `[${result.accession}] Found public company ${company.name} (${filingCompanyId})`
  );

  // Collect all database operations for this filing
  const txOps: any[] = [];
  let enrichmentCount = 0;
  const now = new Date().toISOString();

  // PHASE 1: Create all companies first
  const subsidiaryIds = new Set<string>();
  
  for (const subsidiary of result.subsidiaries) {
    // Type validation: ensure required fields exist
    if (!subsidiary.name || !subsidiary.jurisdiction) {
      logger.error(
        `[${result.accession}] Subsidiary missing required fields (name or jurisdiction) - skipping`
      );
      continue;
    }

    // Validate name is not empty after trimming
    if (subsidiary.name.trim() === "") {
      logger.error(
        `[${result.accession}] Subsidiary has empty name after trimming - skipping`,
        { subsidiaryData: subsidiary }
      );
      continue;
    }

    if (!subsidiary.parentId) {
      logger.error(
        `[${result.accession}] Subsidiary "${subsidiary.name}" missing parentId - skipping`,
        { 
          subsidiaryData: {
            name: subsidiary.name,
            nestingLevel: subsidiary.nestingLevel,
            isNested: subsidiary.isNested,
            parentName: subsidiary.parentName,
            parentId: subsidiary.parentId
          }
        }
      );
      continue;
    }

    const subsidiaryId = generateCompanyId({
      name: subsidiary.name,
      type: CompanyType.PRIVATE,
      jurisdiction_raw: subsidiary.jurisdiction,
    });

    const parentId = subsidiary.parentId;

    // Create company record
    const companyNode = {
      id: subsidiaryId,
      name: subsidiary.name,
      aliases: [],
      type: CompanyType.PRIVATE,
      founded_date: null,
      jurisdiction_iso: null,
      jurisdiction_raw: subsidiary.jurisdiction ?? null,
      identity: {},
      created_at: now,
      updated_at: now,
    };

    txOps.push(db.tx.company[subsidiaryId].update(companyNode));
    subsidiaryIds.add(subsidiaryId);

    // Create company audit record (if enabled)
    if (ENABLE_AUDIT_TRAIL) {
      const companyAudit = {
        entity_type: "company",
        entity_id: subsidiaryId,
        operation: "CREATE",
        changed_by: "heuristic",
        changed_at: now,
        source_id: filingId || null,
        fields_changed: [
          { field: "name", old_value: null, new_value: subsidiary.name },
          {
            field: "jurisdiction_raw",
            old_value: null,
            new_value: subsidiary.jurisdiction,
          },
        ],
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      txOps.push(db.tx.audit[id()].create(companyAudit));
    }
  }

  // PHASE 2: Create all edges and links (now all companies exist)
  // Track created links to avoid duplicates within the same transaction
  const createdLinks = new Set<string>();
  
  for (const subsidiary of result.subsidiaries) {
    // Skip validation failures (same checks as phase 1)
    if (!subsidiary.name || !subsidiary.jurisdiction || !subsidiary.parentId) {
      continue;
    }

    const subsidiaryId = generateCompanyId({
      name: subsidiary.name,
      type: CompanyType.PRIVATE,
      jurisdiction_raw: subsidiary.jurisdiction,
    });

    const parentId = subsidiary.parentId;
    
    // Skip if we've already created this link in this transaction
    const linkKey = `${parentId}->${subsidiaryId}`;
    if (createdLinks.has(linkKey)) {
      logger.warn(
        `[${result.accession}] Skipping duplicate link in transaction: ${linkKey} for subsidiary "${subsidiary.name}"`
      );
      continue;
    }
    createdLinks.add(linkKey);
    
    // Validate parent exists: must be either in this batch, the filing company, or already in DB
    const parentExistsInBatch = subsidiaryIds.has(parentId);
    const parentIsFilingCompany = parentId === filingCompanyId;
    
    if (!parentExistsInBatch && !parentIsFilingCompany) {
      // Check if parent exists in database
      const parentCheck = await db.query({
        company: {
          $: {
            where: {
              id: parentId,
            },
          },
        },
      });
      
      if (!parentCheck.company || parentCheck.company.length === 0) {
        logger.error(
          `[${result.accession}] Parent company ${parentId} not found for subsidiary "${subsidiary.name}" - skipping edge creation`,
          {
            subsidiaryDetails: {
              name: subsidiary.name,
              nestingLevel: subsidiary.nestingLevel,
              parentName: subsidiary.parentName,
              parentId: subsidiary.parentId,
              isNested: subsidiary.isNested,
            },
          }
        );
        continue; // Skip this edge - parent doesn't exist
      }
    }
    
    const established_date = now;

    const edgeId = generateParentOfId(parentId, subsidiaryId);

    const edge = {
      id: edgeId,
      ownership_percent: subsidiary.ownership || null,
      established_date,
      ended_date: null,
      source: 5, // SEC_FILING
      created_at: now,
      updated_at: now,
    };

    txOps.push(db.tx.parent_of[edgeId].update(edge));
    
    // Link parent and subsidiary companies through the parent_of edge
    txOps.push(db.tx.parent_of[edgeId].link({ parentCompany: parentId }));
    txOps.push(db.tx.parent_of[edgeId].link({ subsidiaryCompany: subsidiaryId }));

    // Edge audit (if enabled)
    if (ENABLE_AUDIT_TRAIL) {
      const edgeAudit = {
        entity_type: "parent_of",
        entity_id: edgeId,
        operation: "CREATE",
        changed_by: "heuristic",
        changed_at: now,
        source_id: filingId || null,
        fields_changed: [
          { field: "from_company_id", old_value: null, new_value: parentId },
          { field: "to_company_id", old_value: null, new_value: subsidiaryId },
          ...(subsidiary.ownership !== undefined
            ? [{ field: "ownership_percent", old_value: null, new_value: subsidiary.ownership }]
            : []),
        ],
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      txOps.push(db.tx.audit[id()].create(edgeAudit));
    }

    // Create enrichment metadata
    if (subsidiary.footnoteRefs.length > 0 && filingId) {
      const enrichmentId = generateSubsidiaryEnrichmentId(subsidiaryId, filingId);
      const enrichment = {
        id: enrichmentId,
        footnoteRefs: subsidiary.footnoteRefs,
        footnotesHtml: result.footnotesHtml || null,
        llmEnriched: false,
        llmEnrichedAt: null,
        created_at: now,
        updated_at: now,
      };

      txOps.push(db.tx.subsidiary_enrichment[enrichmentId].update(enrichment));
      txOps.push(db.tx.subsidiary_enrichment[enrichmentId].link({ company: subsidiaryId }));
      txOps.push(db.tx.subsidiary_enrichment[enrichmentId].link({ filing: filingId }));
      enrichmentCount++;
    }
  }

  // Execute all operations in a single transaction
  await db.transact(txOps);

  return {
    created: result.subsidiaries.length,
    enrichmentRecords: enrichmentCount,
  };
}
