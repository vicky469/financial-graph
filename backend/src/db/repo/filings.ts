import { db } from "../client";
import * as IDs from "../ids";
import type * as Types from "../../types";
import { FilingSchema, validate } from "../validation";

export async function upsertFiling(
  filingData: Partial<Types.Filing>
): Promise<string> {
  const id = IDs.generateFilingId(filingData);
  const company_id = filingData.company_id!;

  const node: Types.Filing = {
    id,
    company_id,
    accession_number: filingData.accession_number!,
    accession_number_nodashes:
      filingData.accession_number_nodashes ||
      filingData.accession_number!.replace(/-/g, ""),
    form_type: filingData.form_type!,
    filing_date: filingData.filing_date!,
    file_name: filingData.file_name!,
    file_url: filingData.file_url!,
    source_quarter: filingData.source_quarter!,
    source_year: filingData.source_year!,
    fiscal_year: filingData.fiscal_year || null,
    fiscal_quarter: filingData.fiscal_quarter || null,
    period_end_date: filingData.period_end_date || null,
    attachments: filingData.attachments || undefined,

    created_at: filingData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate the node before inserting
  const validatedNode = validate(FilingSchema, node, "FilingSchema");

  // Check if filing already exists
  const existing = await db.query({
    filings: {
      $: { where: { id } },
    },
  });

  const isNew = !existing.filings || existing.filings.length === 0;

  // Only link if it's a new filing to avoid "record-not-unique" error
  if (isNew) {
    await db.transact([
      db.tx.filings[id].update(validatedNode),
      db.tx.companies[company_id].link({ filings: id }),
    ]);
  } else {
    // Just update the filing without re-linking
    await db.transact([db.tx.filings[id].update(validatedNode)]);
  }

  return id;
}
