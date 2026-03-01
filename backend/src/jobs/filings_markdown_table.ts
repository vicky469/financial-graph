// Job: Build filing metadata markdown tables from local PDFs + SEC index JSON.
//
// Output:
//   output/ObsidianVault/Filings/{year}_{formType}.md
//
// Required columns (in order):
//   cik | accession_number | company_name | date_filed | file_path | filing_url | status
//
// CLI examples:
//   bun run src/jobs/filings_markdown_table.ts -- -2025 10-K
//   bun run src/jobs/filings_markdown_table.ts -- -2025 10-K 20-F
//   bun run src/jobs/filings_markdown_table.ts -- -2025 10-K --quarters=Q1,Q2,Q3,Q4

import fs from "node:fs/promises";
import path from "node:path";
import { INDEX_DIR, SEC_QUARTERS } from "../config/config";
import { createLogger } from "../utils/logger";
import { getCliArg, parseCliQuarters, parseCliYears } from "../utils/cli";
import { RegistrantEntry, RegistrantIndexFile } from "./type";

const logger = createLogger("jobs/filings_markdown_table");

const PDF_ROOT = path.resolve(import.meta.dirname, "..", "output", "data", "filings_pdf");
const OBSIDIAN_FILINGS_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "ObsidianVault",
  "Filings",
);

type PdfIdentity = {
  fileName: string;
  cikNoPad: string;
  accessionNumberNoDashes: string;
  documentName: string;
};

type LookupEntry = {
  filing: RegistrantEntry;
  registrantName: string;
  quarter: number;
};

type TableRow = {
  cik: string;
  accession_number: string;
  company_name: string;
  date_filed: string;
  file_path: string;
  filing_url: string;
  status: string;
};

type JoinReport = {
  rows: TableRow[];
  unmatchedFiles: string[];
  invalidFiles: Array<{ fileName: string; reason: string }>;
  duplicateKeys: Array<{ key: string; existingQuarter: number; duplicateQuarter: number }>;
};

export function parseFormTypes(args: string[]): string[] {
  return args.filter((arg) => {
    if (arg.startsWith("--")) return false;
    if (/^-?\d{4}(,\d{4})*$/.test(arg)) return false;
    return true;
  });
}

export function parsePdfIdentity(fileName: string): PdfIdentity | null {
  if (!fileName.toLowerCase().endsWith(".pdf")) return null;
  const baseName = fileName.slice(0, -4);
  const parts = baseName.split("_");
  if (parts.length < 3) return null;

  const cikNoPad = parts[0]?.trim();
  const accessionNumberNoDashes = parts[1]?.trim();
  const documentName = parts.slice(2).join("_").trim();

  if (!cikNoPad || !/^\d+$/.test(cikNoPad)) return null;
  if (!accessionNumberNoDashes || !/^\d+$/.test(accessionNumberNoDashes)) return null;
  if (!documentName) return null;

  return {
    fileName,
    cikNoPad,
    accessionNumberNoDashes,
    documentName,
  };
}

export function buildFilingUrl(identity: PdfIdentity): string {
  return `https://www.sec.gov/Archives/edgar/data/${identity.cikNoPad}/${identity.accessionNumberNoDashes}/${identity.documentName}.htm`;
}

function normalizeCikNoPad(cik: string): string {
  const trimmed = cik.trim();
  const stripped = trimmed.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

function normalizeCikPadded(cik: string): string {
  const digits = cik.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

function makeLookupKey(cikNoPad: string, accessionNumberNoDashes: string): string {
  return `${cikNoPad}|${accessionNumberNoDashes}`;
}

function parseSelectedQuarters(args: string[]): number[] {
  const quartersArg = getCliArg(args, "quarters");
  if (!quartersArg) return [...SEC_QUARTERS];
  const parsed = parseCliQuarters(quartersArg);
  if (parsed.length === 0) return [...SEC_QUARTERS];
  return parsed;
}

function validateFormType(formType: string): void {
  if (formType.includes("/") || formType.includes("\\")) {
    throw new Error(
      `Invalid form type "${formType}". Use form types without "/" or "\\" for directory-safe output.`,
    );
  }
}

async function readQuarterIndex(
  year: number,
  quarter: number,
): Promise<RegistrantIndexFile> {
  const filePath = path.join(
    INDEX_DIR,
    `sec_registrant_index-${year}`,
    `${year}-Q${quarter}.json`,
  );
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as RegistrantIndexFile;
}

async function buildLookup(
  year: number,
  quarters: number[],
): Promise<{
  lookup: Map<string, LookupEntry>;
  duplicateKeys: Array<{ key: string; existingQuarter: number; duplicateQuarter: number }>;
}> {
  const lookup = new Map<string, LookupEntry>();
  const duplicateKeys: Array<{
    key: string;
    existingQuarter: number;
    duplicateQuarter: number;
  }> = [];

  for (const quarter of quarters) {
    const parsed = await readQuarterIndex(year, quarter);
    const registrants = Array.isArray(parsed.data) ? parsed.data : [];

    for (const registrant of registrants) {
      for (const filing of registrant.filings ?? []) {
        const key = makeLookupKey(
          normalizeCikNoPad(filing.cik),
          filing.accessionNumberNoDashes,
        );
        const existing = lookup.get(key);
        if (existing) {
          duplicateKeys.push({
            key,
            existingQuarter: existing.quarter,
            duplicateQuarter: quarter,
          });
          continue;
        }

        lookup.set(key, {
          filing,
          registrantName: registrant.name,
          quarter,
        });
      }
    }
  }

  return { lookup, duplicateKeys };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderMarkdownTable(rows: TableRow[]): string {
  const header =
    "| cik | accession_number | company_name | date_filed | file_path | filing_url | status |";
  const divider = "| --- | --- | --- | --- | --- | --- | --- |";
  const lines = rows.map((row) => {
    return `| ${escapeCell(row.cik)} | ${escapeCell(row.accession_number)} | ${escapeCell(
      row.company_name,
    )} | ${escapeCell(row.date_filed)} | ${escapeCell(row.file_path)} | ${escapeCell(
      row.filing_url,
    )} | ${escapeCell(row.status)} |`;
  });

  return `${[header, divider, ...lines].join("\n")}\n`;
}

async function joinPdfToIndex(
  year: number,
  formType: string,
  lookup: Map<string, LookupEntry>,
): Promise<JoinReport> {
  const sourceDir = path.join(PDF_ROOT, String(year), formType);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const rows: TableRow[] = [];
  const unmatchedFiles: string[] = [];
  const invalidFiles: Array<{ fileName: string; reason: string }> = [];

  for (const fileName of fileNames) {
    const identity = parsePdfIdentity(fileName);
    if (!identity) {
      invalidFiles.push({
        fileName,
        reason:
          "Expected {cikNoPadding}_{accessionNumberNoDashes}_{documentName}.pdf with numeric cik/accession tokens",
      });
      continue;
    }

    const key = makeLookupKey(identity.cikNoPad, identity.accessionNumberNoDashes);
    const matched = lookup.get(key);
    if (!matched) {
      unmatchedFiles.push(fileName);
      continue;
    }

    const filing = matched.filing;
    const companyName =
      filing.registrantName?.trim() || matched.registrantName?.trim() || "";
    const row: TableRow = {
      cik: normalizeCikPadded(filing.cik),
      accession_number: filing.accessionNumber,
      company_name: companyName,
      date_filed: filing.filingDate,
      file_path: path.resolve(sourceDir, fileName),
      filing_url: buildFilingUrl(identity),
      status: "",
    };

    rows.push(row);
  }

  return {
    rows,
    unmatchedFiles,
    invalidFiles,
    duplicateKeys: [],
  };
}

async function writeOutputs(
  year: number,
  formType: string,
  report: JoinReport,
): Promise<void> {
  await fs.mkdir(OBSIDIAN_FILINGS_ROOT, { recursive: true });
  const outputPath = path.join(OBSIDIAN_FILINGS_ROOT, `${year}_${formType}.md`);
  const markdown = renderMarkdownTable(report.rows);
  await fs.writeFile(outputPath, markdown, "utf-8");

  logger.info("Wrote filings markdown table", {
    outputPath,
    rows: report.rows.length,
  });

  if (report.unmatchedFiles.length > 0 || report.invalidFiles.length > 0) {
    const diagnosticsPath = path.join(
      OBSIDIAN_FILINGS_ROOT,
      `${year}_${formType}.diagnostics.json`,
    );
    const diagnostics = {
      year,
      formType,
      unmatchedFiles: report.unmatchedFiles,
      invalidFiles: report.invalidFiles,
    };
    await fs.writeFile(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf-8");
    logger.warn("Wrote markdown table diagnostics", {
      diagnosticsPath,
      unmatched: report.unmatchedFiles.length,
      invalid: report.invalidFiles.length,
    });
  }
}

async function processYearFormType(
  year: number,
  formType: string,
  quarters: number[],
): Promise<void> {
  validateFormType(formType);
  const { lookup, duplicateKeys } = await buildLookup(year, quarters);
  if (duplicateKeys.length > 0) {
    logger.warn("Detected duplicate filing lookup keys across quarters; kept first seen", {
      year,
      formType,
      duplicates: duplicateKeys.length,
      samples: duplicateKeys.slice(0, 10),
    });
  }

  const report = await joinPdfToIndex(year, formType, lookup);
  report.duplicateKeys = duplicateKeys;
  await writeOutputs(year, formType, report);

  logger.info("Filings markdown table generation complete", {
    year,
    formType,
    matched: report.rows.length,
    unmatched: report.unmatchedFiles.length,
    invalid: report.invalidFiles.length,
    duplicates: duplicateKeys.length,
  });
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const years = parseCliYears(args);
    const formTypes = parseFormTypes(args);
    if (formTypes.length === 0) {
      throw new Error(
        "No form types provided. Usage: bun run src/jobs/filings_markdown_table.ts -- -2025 10-K [20-F] [--quarters=Q1,Q2,Q3,Q4]",
      );
    }

    const quarters = parseSelectedQuarters(args);
    logger.info("Starting filings markdown table job", { years, formTypes, quarters });

    for (const year of years) {
      for (const formType of formTypes) {
        await processYearFormType(year, formType, quarters);
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Filings markdown table job failed", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
