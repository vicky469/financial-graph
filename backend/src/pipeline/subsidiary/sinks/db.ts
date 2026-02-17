/**
 * Subsidiaries DB Sink
 *
 * Writes parsed subsidiary data to InstantDB.
 * Creates company nodes and parent_of edges with provenance tracking.
 */

import type { SinkResult, ValidatedFiling } from "../types";
import { db } from "../../../db/client";
import {
  generateCompanyId,
  generateParentOfId,
  generateSubsidiaryEnrichmentId,
  generateFilingId,
  CompanyType,
} from "@financial-graph/shared";
import { createLogger } from "../../../utils/logger";

const logger = createLogger("pipeline/subsidiary/sinks/db");
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

function toLogMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      error: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  if (typeof error === "object" && error !== null) {
    return { error };
  }
  return { error: String(error) };
}
function classifyError(error: Error): 'TIMEOUT' | 'RATE_LIMIT' | 'VALIDATION' | 'UNKNOWN' {
  const errorMsg = error.message.toLowerCase();

  if (errorMsg.includes("took too long") || errorMsg.includes("timeout")) {
    return 'TIMEOUT';
  }

  if (errorMsg.includes("rate limit") || (error as any)?.status === 429) {
    return 'RATE_LIMIT';
  }

  if (errorMsg.includes("validation") || errorMsg.includes("invalid")) {
    return 'VALIDATION';
  }

  return 'UNKNOWN';
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMsg.includes("took too long") || errorMsg.includes("timeout");
      const isRateLimit = errorMsg.includes("rate limit") || (error as any)?.status === 429;

      if (!isTimeout && !isRateLimit) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        logger.warn(
          `${context}: Retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxRetries}) - ${errorMsg}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export class SubsidiariesDBSink {
  name = "instantdb";

  async write(filings: ValidatedFiling[]): Promise<SinkResult> {
    logger.info(`🔄 DB Sink: Starting write for ${filings.length} filings`);

    let written = 0;
    let errors = 0;
    let enrichmentRecords = 0;
    const seenErrors = new Set<string>();
    const details: Record<string, any> = {
      enrichmentRecords: 0,
      uniqueErrors: 0,
    };

    try {
      let successful: ValidatedFiling[] = [];
      let empty: ValidatedFiling[] = [];
      let failed: ValidatedFiling[] = [];

      try {
        for (const filing of filings) {
          const status = filing?.parseResult?.status;
          if (status === "success") {
            successful.push(filing);
          } else if (status === "empty") {
            empty.push(filing);
          } else {
            // Keep unknown/missing runtime statuses visible as failures.
            failed.push(filing);
          }
        }

        details.successFilings = successful.length;
        details.emptyFilings = empty.length;
        details.failedFilings = failed.length;

        logger.info(
          `   DB Sink: Processing ${successful.length} successful filings, ${empty.length} empty, ${failed.length} failed`,
        );
      } catch (categorizationError) {
        logger.error(
          "Error categorizing filings for DB:",
          toLogMeta(categorizationError),
        );
        failed = filings || [];
        details.successFilings = 0;
        details.emptyFilings = 0;
        details.failedFilings = failed.length;
      }

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

              const validSubsidiaries =
                filing.parseResult?.subsidiaries?.filter(
                  (sub) =>
                    sub?.name &&
                    sub.name.trim().length > 0,
                ) || [];

              // Log error with subsidiary details
              const subsidiaryDetails = validSubsidiaries.slice(0, 5).map(sub => ({
                id: generateCompanyId({
                  name: sub.name.trim(),
                  type: CompanyType.SUBSIDIARY,
                  jurisdiction_raw: sub.jurisdiction,
                }),
                name: sub.name.trim(),
                jurisdiction: sub.jurisdiction,
              }));

              if (!seenErrors.has(errorMsg)) {
                seenErrors.add(errorMsg);
                const errorType = classifyError(error as Error);
                logger.error(
                  `[${filing.accessionNumberNoDashes}] DB write failed after ${MAX_RETRIES} retries: ${errorMsg}`,
                  {
                    module: "pipeline/subsidiary/sinks/db",
                    errorType,
                    subsidiaryCount: validSubsidiaries.length,
                    subsidiaries: subsidiaryDetails,
                  }
                );
              }

              errors += validSubsidiaries.length;
            }
          }),
        );
      }

      details.enrichmentRecords = enrichmentRecords;
      details.uniqueErrors = seenErrors.size;
    } catch (criticalError) {
      logger.error("Critical error in DB sink:", toLogMeta(criticalError));
      errors++;

      details.criticalError =
        criticalError instanceof Error
          ? criticalError.message
          : String(criticalError);
    }

    return {
      written,
      errors,
      details,
    };
  }

  private async writeFilingSubsidiaries(
    filing: ValidatedFiling,
  ): Promise<{ created: number; enrichmentRecords: number }> {
    try {
      const MAX_SUBS_PER_TX = 25; // Reduced from 50 to avoid timeouts
      const subsidiaries = filing.parseResult?.subsidiaries || [];

      const validSubsidiaries = subsidiaries.filter((sub) => {
        if (!sub?.name || !sub.name.trim()) {
          logger.warn(
            `Skipping invalid subsidiary in DB: name="${sub?.name}", jurisdiction="${sub?.jurisdiction}" for filing ${filing.accessionNumberNoDashes}`,
          );
          return false;
        }
        return true;
      });

      if (validSubsidiaries.length === 0) {
        logger.warn(
          `No valid subsidiaries found for filing ${filing.accessionNumberNoDashes}`,
        );
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
              filing.parseResult.footnotesHtml,
            );
            totalCreated += stats.created;
            totalEnrichments += stats.enrichmentRecords;
          } catch (chunkError) {
            logger.error(
              `Error writing chunk ${i}-${i + chunk.length} for ${filing.accessionNumberNoDashes}:`,
              toLogMeta(chunkError),
            );
          }
        }

        return { created: totalCreated, enrichmentRecords: totalEnrichments };
      }

      return this.writeSubsidiariesBatch(
        filing,
        validSubsidiaries,
        filing.parseResult.footnotesHtml,
      );
    } catch (error) {
      // Error will be logged in write() batch catch block
      throw error;
    }
  }

  private async writeSubsidiariesBatch(
    filing: ValidatedFiling,
    subsidiaries: ValidatedFiling["parseResult"]["subsidiaries"],
    footnotesHtml?: string,
  ): Promise<{ created: number; enrichmentRecords: number }> {
    try {
      const filingId = generateFilingId(filing.accessionNumberNoDashes);
      const filingCompanyId = filing.companyId;
      const now = new Date().toISOString();

      const txOps: any[] = [];
      let enrichmentCount = 0;
      const subsidiaryIds = new Set<string>();
      const createdLinks = new Set<string>();

      for (const subsidiary of subsidiaries) {
        try {
          if (!subsidiary.name || !subsidiary.name.trim()) {
            logger.warn(
              `Skipping subsidiary with missing data in DB: name="${subsidiary?.name}", jurisdiction="${subsidiary?.jurisdiction}", parentId="${subsidiary?.parentId}" for filing ${filing.accessionNumberNoDashes}`,
            );
            continue;
          }

          const subsidiaryId = generateCompanyId({
            name: subsidiary.name.trim(),
            type: CompanyType.SUBSIDIARY,
            jurisdiction_raw: subsidiary.jurisdiction?.trim() || undefined,
          });

          const companyNode = {
            id: subsidiaryId,
            name: subsidiary.name.trim(),
            type: CompanyType.SUBSIDIARY,
            jurisdiction_iso: null,
            jurisdiction_raw: subsidiary.jurisdiction?.trim() || null,
            identity: {},
            updated_at: now,
          };

          txOps.push(db.tx.company[subsidiaryId].update(companyNode));
          subsidiaryIds.add(subsidiaryId);
        } catch (companyError) {
          logger.error(
            `Error processing company ${subsidiary.name} for ${filing.accessionNumberNoDashes}:`,
            toLogMeta(companyError),
          );
        }
      }

      for (const subsidiary of subsidiaries) {
        try {
          if (!subsidiary.name || !subsidiary.name.trim()) {
            continue;
          }

          const subsidiaryId = generateCompanyId({
            name: subsidiary.name.trim(),
            type: CompanyType.SUBSIDIARY,
            jurisdiction_raw: subsidiary.jurisdiction?.trim() || undefined,
          });

          if (!subsidiaryIds.has(subsidiaryId)) continue;

          const parentId = subsidiary.parentId || filingCompanyId;
          const edgeId = generateParentOfId(parentId, subsidiaryId);
          if (createdLinks.has(edgeId)) continue;

          const edgeNode = {
            id: edgeId,
            updated_at: now,
            source: 5, // ParentOfSource.SUBSIDIARY_FILING
          };

          txOps.push(db.tx.parent_of[edgeId].update(edgeNode));
          txOps.push(db.tx.company[parentId].link({ subsidiaries: edgeId }));
          txOps.push(db.tx.company[subsidiaryId].link({ parents: edgeId }));
          txOps.push(db.tx.filing[filingId].link({ parentOfEdges: edgeId })); // Link parent_of edge to source filing
          createdLinks.add(edgeId);

          // Only create enrichment rows when this subsidiary has explicit footnote refs.
          const hasFootnoteRefs =
            subsidiary.footnoteRefs && subsidiary.footnoteRefs.length > 0;

          if (hasFootnoteRefs) {
            const enrichmentId = generateSubsidiaryEnrichmentId(
              subsidiaryId,
              filingId,
            );

            const enrichmentNode = {
              id: enrichmentId,
              footnoteRefs: JSON.stringify(subsidiary.footnoteRefs ?? []),
              footnotesHtml: footnotesHtml || "",
              updated_at: now,
            };

            txOps.push(
              db.tx.subsidiary_enrichment[enrichmentId].update(enrichmentNode),
            );
            txOps.push(
              db.tx.company[subsidiaryId].link({
                subsidiaryEnrichments: enrichmentId,
              }),
            );
            txOps.push(
              db.tx.filing[filingId].link({ subsidiaryEnrichments: enrichmentId }),
            );
            enrichmentCount += 1;
          }
        } catch (linkError) {
          logger.error(
            `Error creating edge/enrichment for ${subsidiary.name} in ${filing.accessionNumberNoDashes}:`,
            toLogMeta(linkError),
          );
        }
      }

      const filingNode = {
        id: filingId,
        accession_number: filing.accessionNumberNoDashes,
        updated_at: now,
      };

      txOps.push(db.tx.filing[filingId].update(filingNode));
      txOps.push(db.tx.company[filingCompanyId].link({ filings: filingId }));

      if (txOps.length > 0) {
        await retryWithBackoff(
          () => db.transact(txOps),
          `Filing ${filing.accessionNumberNoDashes}`,
        );
      }

      logger.info(
        `   DB: Successfully wrote ${subsidiaryIds.size} subsidiaries for ${filing.accessionNumberNoDashes}`,
      );

      return {
        created: subsidiaryIds.size,
        enrichmentRecords: enrichmentCount,
      };
    } catch (error) {
      logger.error(
        `Critical error in writeSubsidiariesBatch for ${filing.accessionNumberNoDashes}:`,
        toLogMeta(error),
      );
      throw error;
    }
  }
}
