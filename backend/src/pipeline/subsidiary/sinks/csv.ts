/**
 * Subsidiaries CSV Sink
 *
 * Writes parsed subsidiary data to CSV files:
 * - SUCCESS.csv: All successfully parsed subsidiaries
 * - EMPTY.csv: Filings with no subsidiaries
 * - FAILED.csv: Failed filings with error details
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { SinkResult, ValidatedFiling } from "../types";
import { formatRunTimestamp } from "../util";

const SUCCESS_HEADER =
  "Accession,URL,SubsidiaryId,Subsidiary,Jurisdiction,NestingLevel,ParentName,ParentId,Ownership,Footnotes,StructureDetection,LLMModified,LLMChanges\n";
const EMPTY_HEADER =
  "Accession,URL,CachePath,Classification,StructureDetection,LLMAttempted\n";
const FAILED_HEADER =
  "Accession,URL,StructureDetection,LLMAttempted,ErrorMessage\n";

function normalizeClassification(classification?: string): string {
  return (classification || "")
    .replace(/\s*\(LLM enhanced\)\s*$/i, "")
    .trim();
}

function resolveStructureDetectionLabel(classification?: string): string {
  const normalized = normalizeClassification(classification);
  return normalized || "unknown";
}

function resolveLLMProviderLabel(filing: ValidatedFiling): string {
  const provider = filing.parseResult?.telemetry?.fallback?.provider?.trim();
  if (provider) return provider;
  if (filing.parseResult?.llmApplied) return "llm";
  return "none";
}

type OutputFiles = {
  successCsv: string;
  emptyCsv: string;
  failedCsv: string;
};

export class SubsidiariesCsvSink {
  name = "csv";
  private outputDir: string;
  private runTimestamp: string;
  private outputFiles: OutputFiles;
  private initialized = false;

  constructor(outputDir?: string, runTimestamp?: string) {
    this.outputDir =
      outputDir ||
      path.resolve(import.meta.dirname, "..", "..", "..", "output", "data");
    this.runTimestamp = runTimestamp ?? formatRunTimestamp();
    this.outputFiles = {
      successCsv: path.join(
        this.outputDir,
        `subsidiaries_SUCCESS.${this.runTimestamp}.csv`,
      ),
      emptyCsv: path.join(
        this.outputDir,
        `subsidiaries_EMPTY.${this.runTimestamp}.csv`,
      ),
      failedCsv: path.join(
        this.outputDir,
        `subsidiaries_FAILED.${this.runTimestamp}.csv`,
      ),
    };
  }

  async write(filings: ValidatedFiling[]): Promise<SinkResult> {
    let written = 0;
    let errors = 0;
    const details: Record<string, any> = {
      outputDir: this.outputDir,
      outputFiles: this.outputFiles,
    };

    try {
      await this.initialize();

      let successful: ValidatedFiling[] = [];
      let empty: ValidatedFiling[] = [];
      let failed: ValidatedFiling[] = [];

      try {
        for (const filing of filings) {
          const status = filing?.parseResult?.status;
          if (status === "success") {
            successful.push(filing);
          } else if (status === "empty") {
            empty.push(filing);
          } else {
            // Treat unknown/missing statuses as failed to avoid dropping records.
            failed.push(filing);
          }
        }

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
          await this.writeFailedCSV(failed);
        } catch (e) {
          console.error("Failed to write FAILED CSV:", e);
          errors++;
        }
      }
    } catch (criticalError) {
      console.error("Critical error in CSV sink:", criticalError);
      errors++;
    }

    return {
      written,
      errors,
      details,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.writeFile(this.outputFiles.successCsv, SUCCESS_HEADER, "utf8");
    await fs.writeFile(this.outputFiles.emptyCsv, EMPTY_HEADER, "utf8");
    await fs.writeFile(this.outputFiles.failedCsv, FAILED_HEADER, "utf8");
    this.initialized = true;
  }

  private async appendCsvRows(filePath: string, rows: string[]): Promise<void> {
    if (rows.length === 0) return;

    await fs.appendFile(filePath, `${rows.join("\n")}\n`);
  }

  private async writeSuccessCSV(filings: ValidatedFiling[]): Promise<number> {
    try {
      const filePath = this.outputFiles.successCsv;

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
              if (!sub?.name || !sub.name.trim()) {
                console.warn(
                  `Skipping invalid subsidiary in CSV output: name="${sub?.name}", jurisdiction="${sub?.jurisdiction}"`,
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
              const structureDetection = `"${resolveStructureDetectionLabel(
                f.parseResult?.classification,
              )}"`;

              const llmChanges = llmModMap.get(sub.id) || [];
              const llmProvider = `"${resolveLLMProviderLabel(f).replace(/"/g, '""')}"`;
              const escapedChanges = `"${llmChanges.join("; ").replace(/"/g, '""')}"`;

              rows.push(
                `"\`${f.accessionNumberNoDashes || ""}","${f.url || ""}",${sub.id || ""},${escapedName},${escapedJur},${sub.nestingLevel || 0},${escapedParent},${parentId},${ownership},${footnotes},${structureDetection},${llmProvider},${escapedChanges}`,
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

      await this.appendCsvRows(filePath, rows);
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
      const filePath = this.outputFiles.emptyCsv;

      const rows: string[] = [];
      for (const f of filings) {
        try {
          const llmAttempted =
            f.parseResult?.llmApplied === true ||
            f.parseResult?.telemetry?.fallback?.used === true
              ? "YES"
              : "NO";
          const structureDetection = resolveStructureDetectionLabel(
            f.parseResult?.classification,
          );
          const row = `"\`${f.accessionNumberNoDashes || ""}","${f.url || ""}","${f.cachePath || ""}","${f.parseResult?.classification || ""}","${structureDetection}","${llmAttempted}"`;
          rows.push(row);
        } catch (filingError) {
          console.warn(
            `Error processing empty filing ${f.accessionNumberNoDashes}:`,
            filingError,
          );
          rows.push(`"\`${f.accessionNumberNoDashes || "unknown"}","${f.url || ""}","","","","NO"`);
        }
      }

      await this.appendCsvRows(filePath, rows);
      console.log(
        `   Wrote EMPTY CSV: ${filePath} (${filings.length} filings with no subsidiaries)`,
      );
    } catch (error) {
      console.error("Critical error in writeEmptyCSV:", error);
      throw error;
    }
  }

  private async writeFailedCSV(filings: ValidatedFiling[]): Promise<void> {
    try {
      const filePath = this.outputFiles.failedCsv;
      const rows: string[] = [];

      filings.forEach((f) => {
        try {
          const llmAttempted =
            f.parseResult?.llmApplied === true ||
            f.parseResult?.telemetry?.fallback?.used === true
              ? "YES"
              : "NO";
          const structureDetection = resolveStructureDetectionLabel(
            f.parseResult?.classification,
          ).replace(/"/g, '""');
          const errorMessage = (
            f.parseResult?.errorMessage || f.issues?.join("; ") || "Unknown error"
          ).replace(/"/g, '""');

          rows.push(
            `"\`${f.accessionNumberNoDashes || "unknown"}","${(f.url || "").replace(/"/g, '""')}","${structureDetection}","${llmAttempted}","${errorMessage}"`,
          );
        } catch (filingError) {
          console.warn(
            `Error processing failed filing ${f.accessionNumberNoDashes}:`,
            filingError,
          );
          rows.push(
            `"\`${f.accessionNumberNoDashes || "unknown"}","${(f.url || "").replace(/"/g, '""')}","error","NO","${`Processing error: ${filingError instanceof Error ? filingError.message : String(filingError)}`.replace(/"/g, '""')}"`,
          );
        }
      });

      await this.appendCsvRows(filePath, rows);
      console.log(
        `   Wrote FAILED CSV: ${filePath} (${filings.length} failed filings)`,
      );
    } catch (error) {
      console.error("Critical error in writeFailedCSV:", error);
      throw error;
    }
  }
}
