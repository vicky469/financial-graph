/**
 * Subsidiaries Excel Sink
 *
 * Writes parsed subsidiary data to Excel/CSV files:
 * - SUCCESS.csv: All successfully parsed subsidiaries
 * - EMPTY.csv: Filings with no subsidiaries
 * - FAILED.xlsx: Failed filings with error details
 */

import fs from "fs/promises";
import path from "path";
import { Sink, SinkResult } from "../../core/types";
import { ValidatedFiling } from "../types";

export class SubsidiariesExcelSink implements Sink<ValidatedFiling> {
  name = "excel";
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || path.resolve(__dirname, "../../../../");
  }

  async write(filings: ValidatedFiling[]): Promise<SinkResult> {
    // Categorize filings
    const successful = filings.filter(
      (f) => f.success && f.parseResult.subsidiaries.length > 0
    );
    const empty = filings.filter(
      (f) => f.success && f.parseResult.subsidiaries.length === 0
    );
    const failed = filings.filter((f) => !f.success);

    let written = 0;
    let errors = 0;

    // Write SUCCESS CSV
    if (successful.length > 0) {
      try {
        const count = await this.writeSuccessCSV(successful);
        written += count;
      } catch (e) {
        console.error("Failed to write SUCCESS CSV:", e);
        errors++;
      }
    }

    // Write EMPTY CSV
    if (empty.length > 0) {
      try {
        await this.writeEmptyCSV(empty);
      } catch (e) {
        console.error("Failed to write EMPTY CSV:", e);
        errors++;
      }
    }

    // Write FAILED Excel
    if (failed.length > 0) {
      try {
        await this.writeFailedExcel(failed);
      } catch (e) {
        console.error("Failed to write FAILED Excel:", e);
        errors++;
      }
    }

    return {
      written,
      errors,
      details: {
        successFilings: successful.length,
        emptyFilings: empty.length,
        failedFilings: failed.length,
        outputDir: this.outputDir,
      },
    };
  }

  private async writeSuccessCSV(filings: ValidatedFiling[]): Promise<number> {
    const filePath = path.join(this.outputDir, "subsidiaries_SUCCESS.csv");
    const header =
      "Accession,URL,SubsidiaryId,Subsidiary,Jurisdiction,NestingLevel,ParentName,ParentId,Ownership,Footnotes\n";

    const rows: string[] = [];

    for (const f of filings) {
      for (const sub of f.parseResult.subsidiaries) {
        const escapedName = `"${sub.name.replace(/"/g, '""')}"`;
        const escapedJur = `"${sub.jurisdiction.replace(/"/g, '""')}"`;
        const escapedParent = sub.parentName
          ? `"${sub.parentName.replace(/"/g, '""')}"`
          : "";
        const parentId = sub.parentId || "";
        const ownership = sub.ownership ?? "";
        const footnotes = `"${sub.footnoteRefs.join(", ")}"`;

        rows.push(
          `"\`${f.accessionNumber}","${f.url}",${sub.id},${escapedName},${escapedJur},${sub.nestingLevel},${escapedParent},${parentId},${ownership},${footnotes}`
        );
      }
    }

    await fs.writeFile(filePath, header + rows.join("\n"));
    console.log(
      `   Wrote SUCCESS CSV: ${filePath} (${rows.length} subsidiaries from ${filings.length} filings)`
    );

    return rows.length;
  }

  private async writeEmptyCSV(filings: ValidatedFiling[]): Promise<void> {
    const filePath = path.join(this.outputDir, "subsidiaries_EMPTY.csv");
    const header = "Accession,URL\n";
    const rows = filings
      .map((f) => `"\`${f.accessionNumber}","${f.url}"`)
      .join("\n");

    await fs.writeFile(filePath, header + rows);
    console.log(
      `   Wrote EMPTY CSV: ${filePath} (${filings.length} filings with no subsidiaries)`
    );
  }

  private async writeFailedExcel(filings: ValidatedFiling[]): Promise<void> {
    const filePath = path.join(this.outputDir, "subsidiaries_FAILED.xlsx");
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Failed");
    sheet.columns = [
      { header: "Accession", key: "accession", width: 20 },
      { header: "URL", key: "url", width: 60 },
      { header: "ErrorMessage", key: "errorMessage", width: 80 },
    ];

    filings.forEach((f) => {
      sheet.addRow({
        accession: `\`${f.accessionNumber}`,
        url: f.url,
        errorMessage: f.parseResult.errorMessage || "Unknown error",
      });
    });

    await workbook.xlsx.writeFile(filePath);
    console.log(
      `   Wrote FAILED Excel: ${filePath} (${filings.length} failed filings)`
    );
  }
}
