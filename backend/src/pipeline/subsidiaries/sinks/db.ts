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

// Check if audit trail is enabled
const ENABLE_AUDIT_TRAIL = process.env.ENABLE_AUDIT_TRAIL !== "false";

export class SubsidiariesDBSink implements Sink<ValidatedFiling> {
  name = "instantdb";

  async write(filings: ValidatedFiling[]): Promise<SinkResult> {
    let written = 0;
    let errors = 0;
    let enrichmentRecords = 0;
    const seenErrors = new Set<string>();

    // Process filings in parallel batches
    const BATCH_SIZE = 5;

    for (let i = 0; i < filings.length; i += BATCH_SIZE) {
      const batch = filings.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (filing) => {
          // Skip invalid or empty filings
          if (
            !filing.success ||
            !filing.valid ||
            filing.parseResult.subsidiaries.length === 0
          ) {
            return;
          }

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

            errors += filing.parseResult.subsidiaries.length;
          }
        })
      );
    }

    return {
      written,
      errors,
      details: {
        enrichmentRecords,
        uniqueErrors: seenErrors.size,
      },
    };
  }

  /**
   * Write subsidiaries from a single filing
   */
  private async writeFilingSubsidiaries(
    filing: ValidatedFiling
  ): Promise<{ created: number; enrichmentRecords: number }> {
    const MAX_SUBS_PER_TX = 50;
    const subsidiaries = filing.parseResult.subsidiaries;

    if (subsidiaries.length > MAX_SUBS_PER_TX) {
      let totalCreated = 0;
      let totalEnrichments = 0;

      for (let i = 0; i < subsidiaries.length; i += MAX_SUBS_PER_TX) {
        const chunk = subsidiaries.slice(i, i + MAX_SUBS_PER_TX);
        const stats = await this.writeSubsidiariesBatch(
          filing,
          chunk,
          filing.parseResult.footnotesHtml
        );
        totalCreated += stats.created;
        totalEnrichments += stats.enrichmentRecords;
      }

      return { created: totalCreated, enrichmentRecords: totalEnrichments };
    }

    return this.writeSubsidiariesBatch(
      filing,
      subsidiaries,
      filing.parseResult.footnotesHtml
    );
  }

  /**
   * Write a batch of subsidiaries in a single transaction
   */
  private async writeSubsidiariesBatch(
    filing: ValidatedFiling,
    subsidiaries: ValidatedFiling["parseResult"]["subsidiaries"],
    footnotesHtml?: string
  ): Promise<{ created: number; enrichmentRecords: number }> {
    const filingId = generateFilingId(filing.accessionNumber);
    const filingCompanyId = filing.companyId;
    const now = new Date().toISOString();

    const txOps: any[] = [];
    let enrichmentCount = 0;
    const subsidiaryIds = new Set<string>();
    const createdLinks = new Set<string>();

    // PHASE 1: Create all companies
    for (const subsidiary of subsidiaries) {
      if (
        !subsidiary.name ||
        !subsidiary.jurisdiction ||
        !subsidiary.parentId
      ) {
        continue;
      }

      const subsidiaryId = generateCompanyId({
        name: subsidiary.name,
        type: CompanyType.PRIVATE,
        jurisdiction_raw: subsidiary.jurisdiction,
      });

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

      // Audit trail
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
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
        txOps.push(db.tx.audit[id()].create(companyAudit));
      }
    }

    // PHASE 2: Create edges and links
    for (const subsidiary of subsidiaries) {
      if (
        !subsidiary.name ||
        !subsidiary.jurisdiction ||
        !subsidiary.parentId
      ) {
        continue;
      }

      const subsidiaryId = generateCompanyId({
        name: subsidiary.name,
        type: CompanyType.PRIVATE,
        jurisdiction_raw: subsidiary.jurisdiction,
      });

      const parentId = subsidiary.parentId;
      const linkKey = `${parentId}->${subsidiaryId}`;

      if (createdLinks.has(linkKey)) {
        continue;
      }
      createdLinks.add(linkKey);

      // Validate parent exists
      const parentExistsInBatch = subsidiaryIds.has(parentId);
      const parentIsFilingCompany = parentId === filingCompanyId;

      if (!parentExistsInBatch && !parentIsFilingCompany) {
        const parentCheck = await db.query({
          company: {
            $: { where: { id: parentId } },
          },
        });

        if (!parentCheck.company || parentCheck.company.length === 0) {
          continue; // Parent doesn't exist
        }
      }

      const edgeId = generateParentOfId(parentId, subsidiaryId);

      const edge = {
        id: edgeId,
        ownership_percent: subsidiary.ownership || null,
        established_date: now,
        ended_date: null,
        source: 5, // SEC_FILING
        created_at: now,
        updated_at: now,
      };

      txOps.push(db.tx.parent_of[edgeId].update(edge));
      txOps.push(db.tx.parent_of[edgeId].link({ parentCompany: parentId }));
      txOps.push(
        db.tx.parent_of[edgeId].link({ subsidiaryCompany: subsidiaryId })
      );

      // Edge audit
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
            {
              field: "to_company_id",
              old_value: null,
              new_value: subsidiaryId,
            },
            ...(subsidiary.ownership !== undefined
              ? [
                  {
                    field: "ownership_percent",
                    old_value: null,
                    new_value: subsidiary.ownership,
                  },
                ]
              : []),
          ],
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
        txOps.push(db.tx.audit[id()].create(edgeAudit));
      }

      // Enrichment metadata
      if (subsidiary.footnoteRefs.length > 0 && filingId) {
        const enrichmentId = generateSubsidiaryEnrichmentId(
          subsidiaryId,
          filingId
        );
        const enrichment = {
          id: enrichmentId,
          footnoteRefs: subsidiary.footnoteRefs,
          footnotesHtml: footnotesHtml || null,
          llmEnriched: false,
          llmEnrichedAt: null,
          created_at: now,
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
      }
    }

    // Execute transaction
    if (txOps.length > 0) {
      await db.transact(txOps);
    }

    return {
      created: subsidiaries.length,
      enrichmentRecords: enrichmentCount,
    };
  }
}
