import { db } from "../client";
import { 
  generateFilingId,
  type Filing,
} from "@financial-graph/shared";

export async function upsertFiling(
  filingData: Partial<Filing> & { company_id: string }
): Promise<string> {
  const company_id = filingData.company_id;
  const id = generateFilingId(filingData.accession_number!);

  const node = {
    id,
    accession_number: filingData.accession_number!,
    accession_number_nodashes:
      filingData.accession_number_nodashes ||
      filingData.accession_number!.replace(/-/g, ""),
    form_type: filingData.form_type!,
    filing_date: filingData.filing_date!,
    file_name: filingData.file_name ?? undefined,
    file_url: filingData.file_url!,
    source_quarter: filingData.source_quarter!,
    source_year: filingData.source_year!,
    fiscal_year: filingData.fiscal_year ?? undefined,
    fiscal_quarter: filingData.fiscal_quarter ?? undefined,
    period_end_date: filingData.period_end_date ?? undefined,
    attachments: filingData.attachments ?? undefined,
    updated_at: new Date().toISOString(),
  };

  // Check if filing already exists
  const existing = await db.query({
    filing: {
      $: { where: { id } },
    },
  });

  const isNew = !existing.filing || existing.filing.length === 0;

  // Only link if it's a new filing to avoid "record-not-unique" error
  if (isNew) {
    await db.transact([
      db.tx.filing[id].update(node),
      db.tx.company[company_id].link({ filings: id }),
    ]);
  } else {
    // Just update the filing without re-linking
    await db.transact([db.tx.filing[id].update(node)]);
  }

  return id;
}
