/**
 * Subsidiaries DB Sink
 *
 * Writes parsed subsidiary data to InstantDB.
 * Creates company nodes and parent_of edges with provenance tracking.
 */

import { id } from "@instantdb/admin";
import { Sink, SinkResult } from "../../core/types";
import { ValidatedFiling } from "../types";
import { db } from "../../../db/client";
import {
  generateCompanyId,
  generateParentOfId,
  generateSubsidiaryEnrichmentId,
  generateFilingId,
  CompanyType,
} from "@financial-graph/shared";


export class SubsidiariesDBSink implements Sink<ValidatedFiling> {
  name = "instantdb";

  async write(filings: ValidatedFiling[]): Promise<SinkResult> {
    console.log(`🔄 DB Sink: Starting write for ${filings.length} filings`);
    
    let written = 0;
    let errors = 0;
    let enrichmentRecords = 0;
    const seenErrors = new Set<string>();
    const details: Record<string, any> = {
      enrichmentRecords: 0,
      uniqueErrors: 0,
    };

    try {
      // Safely categorize filings with error handling
      let successful: ValidatedFiling[] = [];
      let empty: ValidatedFiling[] = [];
      let failed: ValidatedFiling[] = [];

      try {
        successful = filings.filter(
          (f) => f?.success && f?.parseResult?.subsidiaries?.length > 0
        );
        empty = filings.filter(
          (f) => f?.success && (!f?.parseResult?.subsidiaries || f.parseResult.subsidiaries.length === 0)
        );
        failed = filings.filter((f) => !f?.success);
        
        details.successFilings = successful.length;
        details.emptyFilings = empty.length;
        details.failedFilings = failed.length;

        console.log(`   DB Sink: Processing ${successful.length} successful filings, ${empty.length} empty, ${failed.length} failed`);
      } catch (categorizationError) {
        console.error("Error categorizing filings for DB:", categorizationError);
        // Fallback: treat all as failed
        failed = filings || [];
        details.successFilings = 0;
        details.emptyFilings = 0;
        details.failedFilings = failed.length;
      }

      // Process successful filings in parallel batches
      const BATCH_SIZE = 5;

      for (let i = 0; i < successful.length; i += BATCH_SIZE) {
        const batch = successful.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (filing) => {
            try {
              const stats = await this.writeFilingSubsidiaries(filing);
              written += stats.created;
              enrichmentRecords += stats.enrichmentRecords;
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);

              if (!seenErrors.has(errorMsg)) {
                seenErrors.add(errorMsg);
                console.error(
                  `[${filing.accessionNumber}] DB write error: ${errorMsg}`
                );
              }

              // Count actual subsidiaries that failed, not the filing
              const validSubsidiaries = filing.parseResult?.subsidiaries?.filter(sub => 
                sub?.name && sub.name.trim() && sub?.jurisdiction && sub.jurisdiction.trim()
              ) || [];
              errors += validSubsidiaries.length;
            }
          })
        );
      }

      details.enrichmentRecords = enrichmentRecords;
      details.uniqueErrors = seenErrors.size;

    } catch (criticalError) {
      console.error("Critical error in DB sink:", criticalError);
      errors++;
      
      details.criticalError = criticalError instanceof Error ? criticalError.message : String(criticalError);
    }

    return {
      written,
      errors,
      details,
    };
  }

  /**
   * Write subsidiaries from a single filing
   */
  private async writeFilingSubsidiaries(
    filing: ValidatedFiling
  ): Promise<{ created: number; enrichmentRecords: number }> {
    try {
      const MAX_SUBS_PER_TX = 50;
      const subsidiaries = filing.parseResult?.subsidiaries || [];

      // Filter out invalid subsidiaries (null name/jurisdiction)
      const validSubsidiaries = subsidiaries.filter(sub => {
        if (!sub?.name || !sub.name.trim() || !sub?.jurisdiction || !sub.jurisdiction.trim()) {
          console.warn(`Skipping invalid subsidiary in DB: name="${sub?.name}", jurisdiction="${sub?.jurisdiction}" for filing ${filing.accessionNumber}`);
          return false;
        }
        return true;
      });

      if (validSubsidiaries.length === 0) {
        console.warn(`No valid subsidiaries found for filing ${filing.accessionNumber}`);
        return { created: 0, enrichmentRecords: 0 };
      }

      if (validSubsidiaries.length > MAX_SUBS_PER_TX) {
        let totalCreated = 0;
        let totalEnrichments = 0;

        for (let i = 0; i < validSubsidiaries.length; i += MAX_SUBS_PER_TX) {
          const chunk = validSubsidiaries.slice(i, i + MAX_SUBS_PER_TX);
          try {
            const stats = await this.writeSubsidiariesBatch(
              filing,
              chunk,
              filing.parseResult.footnotesHtml
            );
            totalCreated += stats.created;
            totalEnrichments += stats.enrichmentRecords;
          } catch (chunkError) {
            console.error(`Error writing chunk ${i}-${i + chunk.length} for ${filing.accessionNumber}:`, chunkError);
            // Continue with other chunks
          }
        }

        return { created: totalCreated, enrichmentRecords: totalEnrichments };
      }

      return this.writeSubsidiariesBatch(
        filing,
        validSubsidiaries,
        filing.parseResult.footnotesHtml
      );

    } catch (error) {
      console.error(`Critical error in writeFilingSubsidiaries for ${filing.accessionNumber}:`, error);
      throw error; // Re-throw to be caught by the main write method
    }
  }

  /**
   * Write a batch of subsidiaries in a single transaction
   */
  private async writeSubsidiariesBatch(
    filing: ValidatedFiling,
    subsidiaries: ValidatedFiling["parseResult"]["subsidiaries"],
    footnotesHtml?: string
  ): Promise<{ created: number; enrichmentRecords: number }> {
    try {
      const filingId = generateFilingId(filing.accessionNumber);
      const filingCompanyId = filing.companyId;
      const now = new Date().toISOString();

      const txOps: any[] = [];
      let enrichmentCount = 0;
      const subsidiaryIds = new Set<string>();
      const createdLinks = new Set<string>();

      // PHASE 1: Create all companies
      for (const subsidiary of subsidiaries) {
        try {
          if (
            !subsidiary.name ||
            !subsidiary.jurisdiction ||
            !subsidiary.parentId
          ) {
            console.warn(`Skipping subsidiary with missing data in DB: name="${subsidiary?.name}", jurisdiction="${subsidiary?.jurisdiction}", parentId="${subsidiary?.parentId}" for filing ${filing.accessionNumber}`);
            continue;
          }

          const subsidiaryId = generateCompanyId({
            name: subsidiary.name,
            type: CompanyType.SUBSIDIARY,
            jurisdiction_raw: subsidiary.jurisdiction,
          });

          const companyNode = {
            id: subsidiaryId,
            name: subsidiary.name,
            aliases: [],
            type: CompanyType.SUBSIDIARY,
            jurisdiction_iso: null,
            jurisdiction_raw: subsidiary.jurisdiction ?? null,
            identity: {},
            updated_at: now,
          };

          txOps.push(db.tx.company[subsidiaryId].update(companyNode));
          subsidiaryIds.add(subsidiaryId);

        } catch (companyError) {
          console.error(`Error processing company ${subsidiary.name} for ${filing.accessionNumber}:`, companyError);
          // Continue with other subsidiaries
        }
      }

      // PHASE 2: Create edges and links
      for (const subsidiary of subsidiaries) {
        try {
          if (
            !subsidiary.name ||
            !subsidiary.jurisdiction ||
            !subsidiary.parentId
          ) {
            continue;
          }

          const subsidiaryId = generateCompanyId({
            name: subsidiary.name,
            type: CompanyType.SUBSIDIARY,
            jurisdiction_raw: subsidiary.jurisdiction,
          });

          const parentId = subsidiary.parentId;
          const linkKey = `${parentId}->${subsidiaryId}`;

          if (createdLinks.has(linkKey)) {
            continue;
          }
          createdLinks.add(linkKey);

          const edgeId = generateParentOfId(parentId, subsidiaryId);

          const edge = {
            id: edgeId,
            ownership_percent: subsidiary.ownership || null,
            established_date: now,
            ended_date: null,
            source: 5, // SEC_FILING
            updated_at: now,
          };

          txOps.push(db.tx.parent_of[edgeId].update(edge));
          txOps.push(db.tx.parent_of[edgeId].link({ parentCompany: parentId }));
          txOps.push(
            db.tx.parent_of[edgeId].link({ subsidiaryCompany: subsidiaryId })
          );
          // Link to source filing
          if (filingId) {
            txOps.push(db.tx.parent_of[edgeId].link({ sourceFiling: filingId }));
          }

          // Enrichment metadata with LLM tracking
          if (subsidiary.footnoteRefs.length > 0 && filingId) {
            try {
              const enrichmentId = generateSubsidiaryEnrichmentId(
                subsidiaryId,
                filingId
              );

              // Check if this subsidiary was modified by LLM
              const llmModifications = filing.parseResult?.llmModifications?.filter(
                mod => mod.subsidiaryId === subsidiary.id
              ) || [];

              const wasLlmEnriched = llmModifications.length > 0 || filing.parseResult?.method?.includes('LLM');

              const enrichment = {
                id: enrichmentId,
                footnoteRefs: subsidiary.footnoteRefs,
                footnotesHtml: footnotesHtml || null,
                llmEnriched: wasLlmEnriched,
                llmEnrichedAt: wasLlmEnriched ? now : null,
                updated_at: now,
              };

              txOps.push(
                db.tx.subsidiary_enrichment[enrichmentId].update(enrichment)
              );
              txOps.push(
                db.tx.subsidiary_enrichment[enrichmentId].link({ company: subsidiaryId })
              );
              txOps.push(
                db.tx.subsidiary_enrichment[enrichmentId].link({ filing: filingId })
              );
              enrichmentCount++;
            } catch (enrichmentError) {
              console.warn(`Error creating enrichment record for subsidiary ${subsidiary.name}:`, enrichmentError);
              // Continue without enrichment - don't fail the whole operation
            }
          }
        } catch (subsidiaryError) {
          console.error(`Error processing subsidiary ${subsidiary.name} for ${filing.accessionNumber}:`, subsidiaryError);
          // Continue with other subsidiaries
        }
      }

      // Execute transaction
      if (txOps.length > 0) {
        try {
          await db.transact(txOps);
          console.log(`   DB: Successfully wrote ${subsidiaries.length} subsidiaries for ${filing.accessionNumber}`);
        } catch (transactionError) {
          console.error(`Transaction failed for ${filing.accessionNumber}:`, transactionError);
          throw transactionError; // Re-throw to be caught by the main error handler
        }
      } else {
        console.warn(`No transaction operations generated for ${filing.accessionNumber}`);
      }

      return {
        created: subsidiaries.length,
        enrichmentRecords: enrichmentCount,
      };

    } catch (error) {
      console.error(`Critical error in writeSubsidiariesBatch for ${filing.accessionNumber}:`, error);
      throw error; // Re-throw to be caught by the main write method
    }
  }
}
