import { db } from "../client";
import {
  generateFilingId,
  type Filing,
  validate,
  FilingDataSchema,
} from "@financial-graph/shared";

// Upsert filing and link to company (idempotent on filing id)
export async function upsertFiling(
  filingData: Partial<Filing> & { company_id: string },
): Promise<string> {
  // Validate filing data format
  const validatedData = validate(
    FilingDataSchema,
    {
      accession_number: filingData.accession_number,
      company_id: filingData.company_id,
      form_type: filingData.form_type,
      filing_date: filingData.filing_date,
      file_url: filingData.file_url,
      source_quarter: filingData.source_quarter,
      source_year: filingData.source_year,
    },
    "FilingData",
  );

  const normalizedAccession = validatedData.accession_number;
  const filingId = generateFilingId(normalizedAccession);
  const company_id = validatedData.company_id;

  // Ensure accession_number_nodashes is properly formatted (18 digits)
  const accession_number_nodashes = normalizedAccession.replace(/-/g, "");
  if (accession_number_nodashes.length !== 18) {
    throw new Error(
      `Invalid accession number format: ${normalizedAccession}. Expected 18 digits when dashes removed, got ${accession_number_nodashes.length}`,
    );
  }

  const node: Record<string, unknown> = {
    id: filingId,
    accession_number: normalizedAccession,
    accession_number_nodashes: accession_number_nodashes,
    form_type: validatedData.form_type,
    filing_date: validatedData.filing_date,
    file_url: validatedData.file_url,
    source_quarter: validatedData.source_quarter,
    source_year: validatedData.source_year,
    updated_at: new Date().toISOString(),
    file_name: filingData.file_name,
  };

  // Check if filing already exists
  const existing = await db.query({
    filing: {
      $: { where: { id: filingId } },
    },
  });
  const isNew = !existing.filing || existing.filing.length === 0;

  // Only link if it's a new filing to avoid "record-not-unique" error
  if (isNew) {
    await db.transact([
      db.tx.filing[filingId].update(node),
      db.tx.company[company_id].link({ filings: filingId }),
    ]);
  } else {
    // Just update the filing without re-linking
    await db.transact([db.tx.filing[filingId].update(node)]);
  }

  return filingId;
}
