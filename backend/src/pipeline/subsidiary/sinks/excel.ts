/**
 * Subsidiaries Excel Sink
 *
 * Writes parsed subsidiary data to Excel/CSV files:
 * - SUCCESS.csv: All successfully parsed subsidiaries
 * - EMPTY.csv: Filings with no subsidiaries
 * - FAILED.xlsx: Failed filings with error details
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { SinkResult, ValidatedFiling } from "../types";

export class SubsidiariesExcelSink {
  name = "excel";
  private outputDir: string;
  private initialized = false;

  constructor(outputDir?: string) {
    this.outputDir =
      outputDir ||
      path.resolve(import.meta.dirname, "..", "..", "..", "output", "data");
  }

  async write(filings: ValidatedFiling[]): Promise<SinkResult> {
    let written = 0;
    let errors = 0;
    const details: Record<string, any> = {
      outputDir: this.outputDir,
    };

    try {
      try {
        await fs.mkdir(this.outputDir, { recursive: true });
      } catch (mkdirError) {
        console.warn("Could not create output directory:", mkdirError);
      }

      await this.ensureCleanOutput();

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
      } catch (categorizationError) {
        console.error("Error categorizing filings:", categorizationError);
        failed = filings || [];
        details.successFilings = 0;
        details.emptyFilings = 0;
        details.failedFilings = failed.length;
      }

      if (successful.length > 0) {
        try {
          const count = await this.writeSuccessCSV(successful);
          written += count;
        } catch (e) {
          console.error("Failed to write SUCCESS CSV:", e);
          errors++;
        }
      }

      if (empty.length > 0) {
        try {
          await this.writeEmptyCSV(empty);
        } catch (e) {
          console.error("Failed to write EMPTY CSV:", e);
          errors++;
        }
      }

      if (failed.length > 0) {
        try {
          await this.writeFailedExcel(failed);
        } catch (e) {
          console.error("Failed to write FAILED Excel:", e);
          errors++;
        }
      }
    } catch (criticalError) {
      console.error("Critical error in Excel sink:", criticalError);
      errors++;

      try {
        await fs.mkdir(this.outputDir, { recursive: true });
        const errorFilePath = path.join(this.outputDir, "sink_error.txt");
        const errorMessage = `Excel Sink Error at ${new Date().toISOString()}\n\nError: ${criticalError instanceof Error ? criticalError.message : String(criticalError)}\n\nStack: ${criticalError instanceof Error ? criticalError.stack : "No stack trace"}\n\nFilings count: ${filings?.length || 0}`;
        await fs.writeFile(errorFilePath, errorMessage);
        console.log(`   Wrote error report: ${errorFilePath}`);
      } catch (errorReportError) {
        console.error("Could not write error report:", errorReportError);
      }
    }

    return {
      written,
      errors,
      details,
    };
  }

  private async ensureCleanOutput(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const files = [
      path.join(this.outputDir, "subsidiaries_SUCCESS.csv"),
      path.join(this.outputDir, "subsidiaries_EMPTY.csv"),
      path.join(this.outputDir, "subsidiaries_FAILED.xlsx"),
      path.join(this.outputDir, "sink_error.txt"),
    ];

    await Promise.all(
      files.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
        } catch {
          // ignore missing files
        }
      }),
    );
  }

  private async appendCsvRows(
    filePath: string,
    header: string,
    rows: string[],
  ): Promise<void> {
    if (rows.length === 0) return;

    let fileExists = false;
    try {
      await fs.access(filePath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      await fs.writeFile(filePath, header + rows.join("\n"));
      return;
    }

    const prefix = "\n";
    await fs.appendFile(filePath, prefix + rows.join("\n"));
  }

  private async writeSuccessCSV(filings: ValidatedFiling[]): Promise<number> {
    try {
      const filePath = path.join(this.outputDir, "subsidiaries_SUCCESS.csv");
      const header =
        "Accession,URL,SubsidiaryId,Subsidiary,Jurisdiction,NestingLevel,ParentName,ParentId,Ownership,Footnotes,ParseMethod,LLMModified,LLMChanges\n";

      const rows: string[] = [];

      for (const f of filings) {
        try {
          const llmModMap = new Map<string, string[]>();
          if (f.parseResult?.llmModifications) {
            for (const mod of f.parseResult.llmModifications) {
              try {
                const changes = mod.fieldChanges.map(
                  (change) => `${change.field}: ${change.oldValue} → ${change.newValue}`,
                );
                llmModMap.set(mod.subsidiaryId, changes);
              } catch (modError) {
                console.warn(
                  `Error processing LLM modification for ${f.accessionNumberNoDashes}:`,
                  modError,
                );
              }
            }
          }

          if (!f.parseResult?.subsidiaries || !Array.isArray(f.parseResult.subsidiaries)) {
            console.warn(
              `Skipping filing ${f.accessionNumberNoDashes}: no valid subsidiaries array`,
            );
            continue;
          }

          for (const sub of f.parseResult.subsidiaries) {
            try {
              if (
                !sub?.name ||
                !sub.name.trim() ||
                !sub?.jurisdiction ||
                !sub.jurisdiction.trim()
              ) {
                console.warn(
                  `Skipping invalid subsidiary in Excel output: name="${sub?.name}", jurisdiction="${sub?.jurisdiction}"`,
                );
                continue;
              }

              const escapedName = `"${(sub.name || "").replace(/"/g, '""')}"`;
              const escapedJur = `"${(sub.jurisdiction || "").replace(/"/g, '""')}"`;
              const escapedParent = sub.parentName
                ? `"${sub.parentName.replace(/"/g, '""')}"`
                : "";
              const parentId = sub.parentId || "";
              const ownership = sub.ownership ?? "";
              const footnotes = `"${(sub.footnoteRefs || []).join(", ")}"`;
              const parseMethod = `"${f.parseResult?.method || ""}"`;

              const llmChanges = llmModMap.get(sub.id) || [];
              const llmModified = llmChanges.length > 0 ? "YES" : "NO";
              const escapedChanges = `"${llmChanges.join("; ").replace(/"/g, '""')}"`;

              rows.push(
                `"\`${f.accessionNumberNoDashes || ""}","${f.url || ""}",${sub.id || ""},${escapedName},${escapedJur},${sub.nestingLevel || 0},${escapedParent},${parentId},${ownership},${footnotes},${parseMethod},${llmModified},${escapedChanges}`,
              );
            } catch (subError) {
              console.warn(
                `Error processing subsidiary for ${f.accessionNumberNoDashes}:`,
                subError,
              );
            }
          }
        } catch (filingError) {
          console.warn(
            `Error processing filing ${f.accessionNumberNoDashes}:`,
            filingError,
          );
        }
      }

      await this.appendCsvRows(filePath, header, rows);
      console.log(
        `   Wrote SUCCESS CSV: ${filePath} (${rows.length} subsidiaries from ${filings.length} filings)`,
      );

      return rows.length;
    } catch (error) {
      console.error("Critical error in writeSuccessCSV:", error);
      throw error;
    }
  }

  private async writeEmptyCSV(filings: ValidatedFiling[]): Promise<void> {
    try {
      const filePath = path.join(this.outputDir, "subsidiaries_EMPTY.csv");
      const header =
        "Accession,URL,CachePath,Classification,ParseMethod,LLMAttempted\n";

      const rows: string[] = [];
      for (const f of filings) {
        try {
          const llmAttempted =
            f.parseResult?.llmApplied === true ||
            f.parseResult?.telemetry?.fallback?.used === true
              ? "YES"
              : "NO";
          const row = `"\`${f.accessionNumberNoDashes || ""}","${f.url || ""}","${f.cachePath || ""}","${f.parseResult?.classification || ""}","${f.parseResult?.method || ""}","${llmAttempted}"`;
          rows.push(row);
        } catch (filingError) {
          console.warn(
            `Error processing empty filing ${f.accessionNumberNoDashes}:`,
            filingError,
          );
          rows.push(`"\`${f.accessionNumberNoDashes || "unknown"}","${f.url || ""}","","","","NO"`);
        }
      }

      await this.appendCsvRows(filePath, header, rows);
      console.log(
        `   Wrote EMPTY CSV: ${filePath} (${filings.length} filings with no subsidiaries)`,
      );
    } catch (error) {
      console.error("Critical error in writeEmptyCSV:", error);
      throw error;
    }
  }

  private async writeFailedExcel(filings: ValidatedFiling[]): Promise<void> {
    try {
      const filePath = path.join(this.outputDir, "subsidiaries_FAILED.xlsx");
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();

      let sheet = workbook.getWorksheet("Failed");
      let fileExists = false;

      try {
        await fs.access(filePath);
        fileExists = true;
      } catch {
        fileExists = false;
      }

      if (fileExists) {
        await workbook.xlsx.readFile(filePath);
        sheet = workbook.getWorksheet("Failed");
      }

      if (!sheet) {
        sheet = workbook.addWorksheet("Failed");
      }

      if (!sheet.columns || sheet.columns.length === 0) {
        sheet.columns = [
          { header: "Accession", key: "accession", width: 20 },
          { header: "URL", key: "url", width: 60 },
          { header: "ParseMethod", key: "parseMethod", width: 25 },
          { header: "LLMAttempted", key: "llmAttempted", width: 15 },
          { header: "ErrorMessage", key: "errorMessage", width: 80 },
        ];
      }

      filings.forEach((f) => {
        try {
          const llmAttempted =
            f.parseResult?.llmApplied === true ||
            f.parseResult?.telemetry?.fallback?.used === true
              ? "YES"
              : "NO";
          sheet.addRow({
            accession: `\`${f.accessionNumberNoDashes || "unknown"}`,
            url: f.url || "",
            parseMethod: f.parseResult?.method || "unknown",
            llmAttempted,
            errorMessage:
              f.parseResult?.errorMessage || f.issues?.join("; ") || "Unknown error",
          });
        } catch (filingError) {
          console.warn(
            `Error processing failed filing ${f.accessionNumberNoDashes}:`,
            filingError,
          );
          sheet.addRow({
            accession: `\`${f.accessionNumberNoDashes || "unknown"}`,
            url: f.url || "",
            parseMethod: "error",
            llmAttempted: "NO",
            errorMessage: `Processing error: ${filingError instanceof Error ? filingError.message : String(filingError)}`,
          });
        }
      });

      await workbook.xlsx.writeFile(filePath);
      console.log(
        `   Wrote FAILED Excel: ${filePath} (${filings.length} failed filings)`,
      );
    } catch (error) {
      console.error("Critical error in writeFailedExcel:", error);
      throw error;
    }
  }
}
