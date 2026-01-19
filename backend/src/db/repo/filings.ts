import { db } from "../client";
import { 
  generateFilingId,
  type Filing,
  AccessionNumberString,
  validate,
} from "@financial-graph/shared";

// Validation schema for filing data
import { z } from "zod";

const FilingDataSchema = z.object({
  accession_number: z.string()
    .min(20, "Accession number is required")
    .refine(
      (val) => val.includes('-'),
      { message: "Accession number must contain dashes (not the malformed format without dashes)" }
    ),
  company_id: z.string().min(1),
  form_type: z.string().min(1),
  filing_date: z.string(),
  file_url: z.string().url(),
  source_quarter: z.number().int().min(1).max(4),
  source_year: z.number().int().min(1990).max(2030),
});

export async function upsertFiling(
  filingData: Partial<Filing> & { company_id: string }
): Promise<string> {
  // Validate filing data format
  const validatedData = validate(FilingDataSchema, {
    accession_number: filingData.accession_number,
    company_id: filingData.company_id,
    form_type: filingData.form_type,
    filing_date: filingData.filing_date,
    file_url: filingData.file_url,
    source_quarter: filingData.source_quarter,
    source_year: filingData.source_year,
  }, "FilingData");

  const company_id = validatedData.company_id;
  const accession_number = validatedData.accession_number;
  const id = generateFilingId(accession_number);

  // Ensure accession_number_nodashes is properly formatted (18 digits)
  const accession_number_nodashes = accession_number.replace(/-/g, "");
  if (accession_number_nodashes.length !== 18) {
    throw new Error(`Invalid accession number format: ${accession_number}. Expected 18 digits when dashes removed, got ${accession_number_nodashes.length}`);
  }

  const node = {
    id,
    accession_number,
    accession_number_nodashes,
    form_type: validatedData.form_type,
    filing_date: validatedData.filing_date,
    file_name: filingData.file_name ?? undefined,
    file_url: validatedData.file_url,
    source_quarter: validatedData.source_quarter,
    source_year: validatedData.source_year,
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
