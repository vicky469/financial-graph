import { db } from "../client";
import * as IDs from "../ids";
import type * as Types from "../../types";
import { FilingSchema, FiledEdgeSchema, validate } from "../validation";

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
    fiscal_year: filingData.fiscal_year || null,
    fiscal_quarter: filingData.fiscal_quarter || null,
    period_end_date: filingData.period_end_date || null,
    attachments: filingData.attachments || undefined,

    created_at: filingData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate the node before inserting
  const validatedNode = validate(FilingSchema, node, "FilingSchema");

  const edgeId = IDs.generateFiledEdgeId({
    from_company_id: company_id,
    to_filing_id: id,
  });

  const edge: Types.FiledEdge = {
    id: edgeId,
    from_company_id: company_id,
    to_filing_id: id,
    created_at: new Date().toISOString(),
  };

  // Validate the edge before inserting
  const validatedEdge = validate(FiledEdgeSchema, edge, "FiledEdgeSchema");

  await db.transact([
    db.tx.filings[id].update(validatedNode),
    db.tx.filed[edgeId].update(validatedEdge),
    // Link companies -> filings (One-to-Many).
    // This defines the relationship. InstantDB may auto-infer the reverse as 'companies' if not specified.
    db.tx.companies[company_id].link({ filings: id }),
  ]);

  return id;
}
