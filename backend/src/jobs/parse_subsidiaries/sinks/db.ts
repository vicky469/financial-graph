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

export class SubsidiariesDBSink {
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
      let successful: ValidatedFiling[] = [];
      let empty: ValidatedFiling[] = [];
      let failed: ValidatedFiling[] = [];

      try {
        successful = filings.filter(
          (f) => f?.parseResult?.status === "success",
        );
        empty = filings.filter((f) => f?.parseResult?.status === "empty");
        failed = filings.filter((f) => f?.parseResult?.status === "failed");

        details.successFilings = successful.length;
        details.emptyFilings = empty.length;
        details.failedFilings = failed.length;

        console.log(
          `   DB Sink: Processing ${successful.length} successful filings, ${empty.length} empty, ${failed.length} failed`,
        );
      } catch (categorizationError) {
        console.error(
          "Error categorizing filings for DB:",
          categorizationError,
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

              if (!seenErrors.has(errorMsg)) {
                seenErrors.add(errorMsg);
                console.error(
                  `[${filing.accessionNumberNoDashes}] DB write error: ${errorMsg}`,
                );
              }

              const validSubsidiaries =
                filing.parseResult?.subsidiaries?.filter(
                  (sub) =>
                    sub?.name &&
                    sub.name.trim() &&
                    sub?.jurisdiction &&
                    sub.jurisdiction.trim(),
                ) || [];
              errors += validSubsidiaries.length;
            }
          }),
        );
      }

      details.enrichmentRecords = enrichmentRecords;
      details.uniqueErrors = seenErrors.size;
    } catch (criticalError) {
      console.error("Critical error in DB sink:", criticalError);
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
      const MAX_SUBS_PER_TX = 50;
      const subsidiaries = filing.parseResult?.subsidiaries || [];

      const validSubsidiaries = subsidiaries.filter((sub) => {
        if (
          !sub?.name ||
          !sub.name.trim() ||
          !sub?.jurisdiction ||
          !sub.jurisdiction.trim()
        ) {
          console.warn(
            `Skipping invalid subsidiary in DB: name="${sub?.name}", jurisdiction="${sub?.jurisdiction}" for filing ${filing.accessionNumberNoDashes}`,
          );
          return false;
        }
        return true;
      });

      if (validSubsidiaries.length === 0) {
        console.warn(
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
            console.error(
              `Error writing chunk ${i}-${i + chunk.length} for ${filing.accessionNumberNoDashes}:`,
              chunkError,
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
      console.error(
        `Critical error in writeFilingSubsidiaries for ${filing.accessionNumberNoDashes}:`,
        error,
      );
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
          if (
            !subsidiary.name ||
            !subsidiary.jurisdiction ||
            !subsidiary.parentId
          ) {
            console.warn(
              `Skipping subsidiary with missing data in DB: name="${subsidiary?.name}", jurisdiction="${subsidiary?.jurisdiction}", parentId="${subsidiary?.parentId}" for filing ${filing.accessionNumberNoDashes}`,
            );
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
          console.error(
            `Error processing company ${subsidiary.name} for ${filing.accessionNumberNoDashes}:`,
            companyError,
          );
        }
      }

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

          if (!subsidiaryIds.has(subsidiaryId)) continue;

          const parentId = subsidiary.parentId || filingCompanyId;
          const edgeId = generateParentOfId(parentId, subsidiaryId);
          if (createdLinks.has(edgeId)) continue;

          const edgeNode = {
            id: edgeId,
            created_at: now,
            updated_at: now,
            source: "SEC_EX_21",
          };

          txOps.push(db.tx.parent_of[edgeId].update(edgeNode));
          txOps.push(db.tx.company[parentId].link({ subsidiaries: edgeId }));
          txOps.push(db.tx.company[subsidiaryId].link({ parents: edgeId }));
          createdLinks.add(edgeId);

          const enrichmentId = generateSubsidiaryEnrichmentId(
            subsidiaryId,
            filingId,
          );

          const enrichmentNode = {
            id: enrichmentId,
            filing_id: filingId,
            subsidiary_id: subsidiaryId,
            company_id: filingCompanyId,
            source: "SEC_EX_21",
            footnotes_html: footnotesHtml || null,
            ownership_pct: subsidiary.ownership ?? null,
            parse_method: filing.parseResult.method || "unknown",
            llm_modified:
              filing.parseResult.telemetry?.fallback?.used ??
              filing.parseResult.method === "llm-fallback",
            updated_at: now,
          };

          txOps.push(
            db.tx.subsidiary_enrichment[enrichmentId].update(enrichmentNode),
          );
          enrichmentCount += 1;
        } catch (linkError) {
          console.error(
            `Error creating edge/enrichment for ${subsidiary.name} in ${filing.accessionNumberNoDashes}:`,
            linkError,
          );
        }
      }

      const filingNode = {
        id: filingId,
        accession_number: filing.accessionNumberNoDashes,
        company_id: filingCompanyId,
        source: "SEC",
        updated_at: now,
      };

      txOps.push(db.tx.filing[filingId].update(filingNode));
      txOps.push(db.tx.company[filingCompanyId].link({ filings: filingId }));

      if (txOps.length > 0) {
        await db.transact(txOps);
      }

      console.log(
        `   DB: Successfully wrote ${subsidiaryIds.size} subsidiaries for ${filing.accessionNumberNoDashes}`,
      );

      return {
        created: subsidiaryIds.size,
        enrichmentRecords: enrichmentCount,
      };
    } catch (error) {
      console.error(
        `Critical error in writeSubsidiariesBatch for ${filing.accessionNumberNoDashes}:`,
        error,
      );
      throw error;
    }
  }
}
