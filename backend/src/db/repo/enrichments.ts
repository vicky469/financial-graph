import { db } from "../client";
import { 
  generateSubsidiaryEnrichmentId,
  type SubsidiaryEnrichment,
} from "@financial-graph/shared";

/**
 * Create enrichment metadata record for a subsidiary
 */
export async function createEnrichment(data: {
  company_id: string;
  filing_id: string;
  footnoteRefs: string[];
  footnotesHtml: string | null;
}): Promise<string> {
  const id = generateSubsidiaryEnrichmentId(data.company_id, data.filing_id);
  const now = new Date().toISOString();

  const enrichment = {
    id,
    footnoteRefs: data.footnoteRefs,
    footnotesHtml: data.footnotesHtml ?? undefined,
    llmEnriched: false,
    updated_at: now,
  };

  await db.transact([
    db.tx.subsidiary_enrichment[id].update(enrichment),
    db.tx.company[data.company_id].link({ subsidiaryEnrichments: id }),
    db.tx.filing[data.filing_id].link({ subsidiaryEnrichments: id }),
  ]);

  return id;
}

/**
 * Query unenriched subsidiaries
 */
export async function queryUnenriched(options?: {
  limit?: number;
  filing_id?: string;
}): Promise<SubsidiaryEnrichment[]> {
  const query = await db.query({
    subsidiary_enrichment: {
      $: {
        where: {
          llmEnriched: false,
        },
        ...(options?.limit ? { limit: options.limit } : {}),
      },
    },
  });

  const enrichments = query.subsidiary_enrichment || [];

  // Filter to only include records with footnotesHtml
  return enrichments.filter(
    (e: any) => e.footnotesHtml !== null && e.footnotesHtml !== undefined
  ) as SubsidiaryEnrichment[];
}

/**
 * Mark enrichment as completed
 */
export async function markEnriched(enrichment_id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transact([
    db.tx.subsidiary_enrichment[enrichment_id].update({
      llmEnriched: true,
      llmEnrichedAt: now,
      updated_at: now,
    }),
  ]);
}

/**
 * Clear enrichment status (reset to unenriched)
 */
export async function clearEnrichment(enrichment_id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transact([
    db.tx.subsidiary_enrichment[enrichment_id].update({
      llmEnriched: false,
      llmEnrichedAt: undefined,
      updated_at: now,
    }),
  ]);
}
