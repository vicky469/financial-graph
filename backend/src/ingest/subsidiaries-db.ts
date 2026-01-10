/**
 * Subsidiary DB Writer
 *
 * Writes parsed subsidiary data to InstantDB with audit trail.
 * Creates company nodes and parent_of edges with provenance tracking.
 */

import { createLogger } from "../utils/logger";
import { upsertCompany, linkParentChild } from "../db/repo/companies";
import { recordAudit } from "../db/repo/audits";
import { generateFilingId } from "../db/ids";
import type { FieldChange } from "../types";
import type { SubsidiaryRecord, LLMModification } from "../parser/subsidiary/types";

const logger = createLogger("ingest/subsidiaries-db");

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
  llmModifications?: LLMModification[]; // Modifications made by LLM
}

/**
 * Write parsed subsidiaries to InstantDB with audit trail
 */
export async function writeSubsidiariesToDB(
  results: ParseOutput[]
): Promise<{ created: number; errors: number }> {
  let created = 0;
  let errors = 0;

  for (const result of results) {
    if (!result.success || result.subsidiaries.length === 0) {
      continue;
    }

    const filingId = result.cik
      ? generateFilingId({ accession_number: result.accession })
      : undefined;

    // Build lookup map of LLM modifications by subsidiary ID
    const llmModsMap = new Map<string, LLMModification>();
    if (result.llmModifications) {
      for (const mod of result.llmModifications) {
        llmModsMap.set(mod.subsidiaryId, mod);
      }
    }

    for (const subsidiary of result.subsidiaries) {
      try {
        // 1. Upsert subsidiary company
        const subsidiaryId = await upsertCompany({
          name: subsidiary.name,
          type: "private",
          jurisdiction_raw: subsidiary.jurisdiction,
        });

        // 2. Record CREATE audit for company (always heuristic)
        const companyFields: FieldChange[] = [
          { field: "name", old_value: null, new_value: subsidiary.name },
          {
            field: "jurisdiction_raw",
            old_value: null,
            new_value: subsidiary.jurisdiction,
          },
        ];

        await recordAudit({
          entity_type: "companies",
          entity_id: subsidiaryId,
          operation: "CREATE",
          changed_by: "heuristic",
          fields_changed: companyFields,
          source_id: filingId,
        });

        // 3. Skip if no parentId
        if (!subsidiary.parentId) {
          logger.warn(`Skipping subsidiary ${subsidiary.name} - no parentId`);
          continue;
        }

        // 4. Get LLM modifications for this subsidiary
        const llmMod = llmModsMap.get(subsidiaryId);

        // 5. Determine ORIGINAL heuristic values (before LLM changes)
        const ownershipChange = llmMod?.fieldChanges.find(
          (f) => f.field === "ownership"
        );
        const originalOwnership =
          (ownershipChange?.oldValue as number | undefined) ??
          subsidiary.ownership;

        const parentIdChange = llmMod?.fieldChanges.find(
          (f) => f.field === "parentId"
        );
        const originalParentId =
          (parentIdChange?.oldValue as string | undefined) ??
          subsidiary.parentId;

        // 6. Create parent_of edge with FINAL values
        const edgeId = await linkParentChild(
          subsidiary.parentId, // Use final value (possibly LLM-modified)
          subsidiaryId,
          {
            ownership_percent: subsidiary.ownership, // Use final value
            source: "sec_filing",
            source_id: filingId,
            established_date: new Date().toISOString(),
          }
        );

        // 7. Record CREATE audit for edge (with HEURISTIC values)
        const edgeFields: FieldChange[] = [
          {
            field: "from_company_id",
            old_value: null,
            new_value: originalParentId, // Use original heuristic value
          },
          { field: "to_company_id", old_value: null, new_value: subsidiaryId },
        ];

        if (originalOwnership !== undefined) {
          edgeFields.push({
            field: "ownership_percent",
            old_value: null,
            new_value: originalOwnership, // Use original heuristic value
          });
        }

        await recordAudit({
          entity_type: "parent_of",
          entity_id: edgeId,
          operation: "CREATE",
          changed_by: "heuristic",
          fields_changed: edgeFields,
          source_id: filingId,
        });

        // 8. If LLM modified fields, create UPDATE audit
        if (llmMod && llmMod.fieldChanges.length > 0) {
          const llmEdgeFields: FieldChange[] = llmMod.fieldChanges.map(
            (change) => ({
              field:
                change.field === "parentId"
                  ? "from_company_id"
                  : "ownership_percent",
              old_value: change.oldValue,
              new_value: change.newValue,
            })
          );

          await recordAudit({
            entity_type: "parent_of",
            entity_id: edgeId,
            operation: "UPDATE",
            changed_by: "llm",
            fields_changed: llmEdgeFields,
            source_id: filingId,
          });
        }

        created++;
      } catch (error) {
        logger.error(`Failed to write subsidiary ${subsidiary.name}: ${error}`);
        errors++;
      }
    }
  }

  logger.info(`DB write complete: ${created} created, ${errors} errors`);
  return { created, errors };
}
