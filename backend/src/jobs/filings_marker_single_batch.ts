// Job: Execute marker_single for each filing row in a Markdown table and
// update row status in-place.
//
// Expected table columns:
//   cik | accession_number | company_name | date_filed | file_path | filing_url | [status]
//
// CLI examples:
//   bun run src/jobs/filings_marker_single_batch.ts -- --table=src/output/ObsidianVault/Filings/2025_10-K.md
//   bun run src/jobs/filings_marker_single_batch.ts -- --year=2025 --form-type=10-K
//   bun run src/jobs/filings_marker_single_batch.ts -- --table=... --retry-failed
//
// Optional template override:
//   --command-template='marker_single "{{file_path}}" --output_dir "{{marker_output_dir}}" ...'

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createLogger } from "../utils/logger";
import { getCliArg, hasCliFlag, parseCliYears } from "../utils/cli";

const logger = createLogger("jobs/filings_marker_single_batch");

const REQUIRED_COLUMNS = [
  "cik",
  "accession_number",
  "company_name",
  "date_filed",
  "file_path",
  "filing_url",
] as const;

const DEFAULT_TABLE_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "ObsidianVault",
  "Filings",
);

const DEFAULT_MARKER_OUTPUT_DIR = path.join(
  import.meta.dirname,
  "..",
  "output",
  "ObsidianVault",
  "Filings",
);

const DEFAULT_MARKER_BINARY = path.join(
  process.env.HOME || "/home/bun",
  "marker-env",
  "bin",
  "marker_single",
);

const DEFAULT_COMMAND_TEMPLATE = [
  '"{{marker_binary}}" "{{file_path}}"',
  '--output_dir "{{marker_output_dir}}"',
  "--disable_image_extraction",
  "--use_llm",
  "--llm_service marker.services.ollama.OllamaService",
  '--OllamaService_ollama_base_url "{{ollama_base_url}}"',
  '--OllamaService_ollama_model "{{ollama_model}}"',
].join(" ");
const DEFAULT_BATCH_SIZE = 10;

type ParsedMarkdownTable = {
  lines: string[];
  startLine: number;
  endLine: number;
  header: string[];
  rows: string[][];
};

type JobOptions = {
  tablePath: string;
  markerOutputDir: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  commandTemplate: string;
  markerBinary: string;
  torchDevice: string;
  gpuOnly: boolean;
  outputYear?: string;
  retryFailed: boolean;
  dryRun: boolean;
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function expandHomePath(inputPath: string): string {
  if (inputPath === "~") {
    return process.env.HOME || inputPath;
  }
  if (inputPath.startsWith("~/")) {
    return path.join(process.env.HOME || "~", inputPath.slice(2));
  }
  return inputPath;
}

function parsePipeRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    throw new Error(`Not a pipe-table row: "${line}"`);
  }
  const withoutLeading = trimmed.slice(1);
  const withoutTrailing = withoutLeading.endsWith("|")
    ? withoutLeading.slice(0, -1)
    : withoutLeading;
  return withoutTrailing.split("|").map((cell) => cell.trim());
}

function isDelimiterCell(cell: string): boolean {
  const normalized = cell.replace(/\s+/g, "");
  return /^:?-{3,}:?$/.test(normalized);
}

function isDelimiterRow(line: string, expectedColumns: number): boolean {
  if (!line.trim().startsWith("|")) return false;
  const cells = parsePipeRow(line);
  if (cells.length !== expectedColumns) return false;
  return cells.every(isDelimiterCell);
}

function findTable(
  content: string,
  requiredColumns: readonly string[],
): ParsedMarkdownTable {
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i];
    const dividerLine = lines[i + 1];
    if (!headerLine.trim().startsWith("|")) continue;

    const headerCells = parsePipeRow(headerLine).map(normalizeHeader);
    if (headerCells.length === 0) continue;
    if (!isDelimiterRow(dividerLine, headerCells.length)) continue;

    const hasAllRequired = requiredColumns.every((required) =>
      headerCells.includes(required),
    );
    if (!hasAllRequired) continue;

    const rows: string[][] = [];
    let endLine = i + 1;
    for (let j = i + 2; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim().startsWith("|")) break;
      const rowCells = parsePipeRow(line);
      if (rowCells.length > headerCells.length) {
        throw new Error(
          `Row ${j + 1} has more cells than header (${rowCells.length} > ${headerCells.length})`,
        );
      }
      while (rowCells.length < headerCells.length) {
        rowCells.push("");
      }
      rows.push(rowCells);
      endLine = j;
    }

    return {
      lines,
      startLine: i,
      endLine,
      header: headerCells,
      rows,
    };
  }

  throw new Error(
    `No markdown table found with required columns: ${requiredColumns.join(", ")}`,
  );
}

function ensureStatusColumn(table: ParsedMarkdownTable): boolean {
  const statusIdx = table.header.indexOf("status");
  if (statusIdx !== -1) {
    return false;
  }

  table.header.push("status");
  for (const row of table.rows) {
    row.push("");
  }
  return true;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderTableLines(table: ParsedMarkdownTable): string[] {
  const headerLine = `| ${table.header.join(" | ")} |`;
  const dividerLine = `| ${table.header.map(() => "---").join(" | ")} |`;
  const rowLines = table.rows.map((cells) => {
    const normalizedCells =
      cells.length === table.header.length
        ? cells
        : [...cells, ...new Array(table.header.length - cells.length).fill("")];
    return `| ${normalizedCells.map((cell) => escapeCell(cell)).join(" | ")} |`;
  });
  return [headerLine, dividerLine, ...rowLines];
}

function renderContentWithTable(table: ParsedMarkdownTable): string {
  const nextLines = [
    ...table.lines.slice(0, table.startLine),
    ...renderTableLines(table),
    ...table.lines.slice(table.endLine + 1),
  ];
  return `${nextLines.join("\n")}\n`;
}

function getColumnIndex(table: ParsedMarkdownTable, column: string): number {
  const idx = table.header.indexOf(column);
  if (idx === -1) {
    throw new Error(`Missing expected column: ${column}`);
  }
  return idx;
}

function getCell(table: ParsedMarkdownTable, rowIdx: number, column: string): string {
  const colIdx = getColumnIndex(table, column);
  return table.rows[rowIdx][colIdx] ?? "";
}

function setCell(
  table: ParsedMarkdownTable,
  rowIdx: number,
  column: string,
  value: string,
): void {
  const colIdx = getColumnIndex(table, column);
  table.rows[rowIdx][colIdx] = value;
}

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

function statusShouldRun(status: string, retryFailed: boolean): boolean {
  const normalized = normalizeStatus(status);
  if (normalized === "done") return false;
  if (normalized === "failed") return retryFailed;
  return true;
}

function deriveOutputYear(
  table: ParsedMarkdownTable,
  rowIdx: number,
  preferredYear?: string,
): string {
  if (preferredYear && /^\d{4}$/.test(preferredYear)) {
    return preferredYear;
  }

  const dateFiled = getCell(table, rowIdx, "date_filed").trim();
  const dateMatch = dateFiled.match(/^(\d{4})/);
  if (dateMatch?.[1]) {
    return dateMatch[1];
  }

  const filePath = getCell(table, rowIdx, "file_path").trim();
  if (filePath.length > 0) {
    const parts = filePath.split(/[\\/]+/);
    const filingsPdfIdx = parts.lastIndexOf("filings_pdf");
    if (filingsPdfIdx >= 0) {
      const yearFromPath = parts[filingsPdfIdx + 1];
      if (yearFromPath && /^\d{4}$/.test(yearFromPath)) {
        return yearFromPath;
      }
    }
  }

  return "unknown";
}

function deriveFormType(
  table: ParsedMarkdownTable,
  rowIdx: number,
  tablePath: string,
): string {
  const tableBase = path.basename(tablePath);
  const tableMatch = tableBase.match(/^\d{4}_(.+)\.md$/i);
  if (tableMatch?.[1]) {
    return tableMatch[1];
  }

  const filePath = getCell(table, rowIdx, "file_path").trim();
  if (filePath.length > 0) {
    const parts = filePath.split(/[\\/]+/);
    const filingsPdfIdx = parts.lastIndexOf("filings_pdf");
    if (filingsPdfIdx >= 0) {
      const formTypeFromPath = parts[filingsPdfIdx + 2];
      if (formTypeFromPath && formTypeFromPath.length > 0) {
        return formTypeFromPath;
      }
    }
  }

  return "unknown";
}

function resolveOutputYear(args: string[]): string | undefined {
  const yearArg = getCliArg(args, "year");
  if (yearArg && /^\d{4}$/.test(yearArg)) {
    return yearArg;
  }

  try {
    const parsedYears = parseCliYears(args);
    if (parsedYears.length === 1) {
      return String(parsedYears[0]);
    }
  } catch {
    // Ignore parse errors and fall back to row-derived year.
  }

  return undefined;
}

const TEMPLATE_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

function interpolateTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(TEMPLATE_PATTERN, (_full, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Unknown command template variable: ${key}`);
    }
    return variables[key];
  });
}

async function runShellCommand(command: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function resolveBinaryPath(binaryName: string): string | null {
  const result = spawnSync("bash", ["-lc", `command -v ${binaryName}`], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  if (value.length === 0) return null;
  const lines = value.split(/\r?\n/);
  return lines[lines.length - 1] ?? null;
}

function resolveMarkerPython(markerBinary: string): string | null {
  const markerPath = resolveBinaryPath(markerBinary);
  if (!markerPath) return null;

  try {
    const firstLine = fsSync.readFileSync(markerPath, "utf-8").split(/\r?\n/, 1)[0] ?? "";
    if (!firstLine.startsWith("#!")) return null;
    const shebang = firstLine.slice(2).trim();
    if (!shebang) return null;
    const [pythonExecutable] = shebang.split(/\s+/, 1);
    return pythonExecutable || null;
  } catch {
    return null;
  }
}

function assertCudaReady(options: JobOptions): void {
  if (!options.gpuOnly) return;

  const pythonExecutable = resolveMarkerPython(options.markerBinary);
  if (!pythonExecutable) {
    throw new Error(
      `Unable to resolve python interpreter for ${options.markerBinary}. Set a valid marker binary on PATH or use --allow-cpu to bypass GPU preflight.`,
    );
  }

  const probe = spawnSync(
    pythonExecutable,
    [
      "-c",
      [
        "import torch,sys",
        "print(f'torch={getattr(torch, \"__version__\", \"unknown\")}')",
        "print(f'cuda_available={torch.cuda.is_available()}')",
        "sys.exit(0 if torch.cuda.is_available() else 2)",
      ].join(";"),
    ],
    {
      encoding: "utf-8",
      env: {
        ...process.env,
        TORCH_DEVICE: options.torchDevice,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const out = (probe.stdout || "").trim();
  const err = (probe.stderr || "").trim();
  if (probe.status !== 0) {
    throw new Error(
      [
        `GPU-only mode is enabled, but CUDA is not available for ${options.markerBinary}.`,
        `python=${pythonExecutable}`,
        `TORCH_DEVICE=${options.torchDevice}`,
        out ? `stdout: ${out}` : "",
        err ? `stderr: ${err}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  logger.info("GPU preflight passed for marker", {
    markerBinary: options.markerBinary,
    pythonExecutable,
    torchDevice: options.torchDevice,
    probe: out,
  });
}

async function persistTable(tablePath: string, table: ParsedMarkdownTable): Promise<void> {
  const next = renderContentWithTable(table);
  await fs.writeFile(tablePath, next, "utf-8");
  table.lines = next.replace(/\n$/, "").split("\n");
  table.endLine = table.startLine + renderTableLines(table).length - 1;
}

function resolveTablePath(args: string[]): string {
  const explicit = getCliArg(args, "table");
  if (explicit) {
    return path.resolve(process.cwd(), expandHomePath(explicit));
  }

  let year = getCliArg(args, "year");
  let formType = getCliArg(args, "form-type");

  // Backward-compatible positional CLI support:
  //   bun run ... -- -2025 10-K
  if (!year || !formType) {
    const positionalForms = args.filter((arg) => {
      if (arg.startsWith("--")) return false;
      if (/^-?\d{4}(,\d{4})*$/.test(arg)) return false;
      return true;
    });

    const parsedYears = (() => {
      try {
        return parseCliYears(args);
      } catch {
        return [] as number[];
      }
    })();

    if (!year && parsedYears.length === 1) {
      year = String(parsedYears[0]);
    }
    if (!formType && positionalForms.length === 1) {
      formType = positionalForms[0];
    }

    if (!year && parsedYears.length > 1) {
      throw new Error(
        `Marker batch expects a single year. Received years: ${parsedYears.join(", ")}`,
      );
    }
    if (!formType && positionalForms.length > 1) {
      throw new Error(
        `Marker batch expects a single form type when --table is omitted. Received form types: ${positionalForms.join(", ")}`,
      );
    }
  }

  if (!year || !formType) {
    throw new Error(
      "Missing target table. Use --table=<path> OR --year=<year> --form-type=<formType> OR positional args like -2025 10-K.",
    );
  }
  return path.join(DEFAULT_TABLE_ROOT, `${year}_${formType}.md`);
}

function parseOptions(args: string[]): JobOptions {
  const tablePath = resolveTablePath(args);
  const markerOutputDir = expandHomePath(
    getCliArg(args, "output-dir") || DEFAULT_MARKER_OUTPUT_DIR,
  );
  const ollamaBaseUrl =
    getCliArg(args, "ollama-base-url") || "http://localhost:11434";
  const ollamaModel = getCliArg(args, "ollama-model") || "qwen3-coder:30b";
  const commandTemplate =
    getCliArg(args, "command-template") || DEFAULT_COMMAND_TEMPLATE;
  const markerBinaryInput =
    getCliArg(args, "marker-binary") ||
    process.env.MARKER_BINARY ||
    DEFAULT_MARKER_BINARY;
  const markerBinaryCandidate = expandHomePath(markerBinaryInput);
  const markerBinaryResolved =
    path.isAbsolute(markerBinaryCandidate) || markerBinaryCandidate.includes(path.sep)
      ? path.resolve(process.cwd(), markerBinaryCandidate)
      : resolveBinaryPath(markerBinaryCandidate) || markerBinaryCandidate;
  const torchDevice = getCliArg(args, "torch-device") || "cuda";
  const gpuOnly = !hasCliFlag(args, "allow-cpu");
  const outputYear = resolveOutputYear(args);
  const retryFailed = hasCliFlag(args, "retry-failed");
  const dryRun = hasCliFlag(args, "dry-run");

  return {
    tablePath,
    markerOutputDir,
    ollamaBaseUrl,
    ollamaModel,
    commandTemplate,
    markerBinary: markerBinaryResolved,
    torchDevice,
    gpuOnly,
    outputYear,
    retryFailed,
    dryRun,
  };
}

function buildVariablesForRow(
  table: ParsedMarkdownTable,
  rowIdx: number,
  options: JobOptions,
): Record<string, string> {
  const outputYear = deriveOutputYear(table, rowIdx, options.outputYear);
  const markerOutputDir = path.join(options.markerOutputDir, outputYear);

  const vars: Record<string, string> = {
    marker_binary: options.markerBinary,
    marker_output_dir: markerOutputDir,
    output_year: outputYear,
    ollama_base_url: options.ollamaBaseUrl,
    ollama_model: options.ollamaModel,
  };

  for (let colIdx = 0; colIdx < table.header.length; colIdx++) {
    const key = table.header[colIdx];
    vars[key] = table.rows[rowIdx][colIdx] ?? "";
  }

  const rawFilePath = vars.file_path;
  const resolvedFilePath = path.isAbsolute(rawFilePath)
    ? rawFilePath
    : path.resolve(process.cwd(), rawFilePath);
  vars.file_path = resolvedFilePath;

  return vars;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function stripImageMarkdownLines(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !/^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(line))
    .join("\n");
}

function stripExistingMetadataFrontmatter(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return markdown;
  }

  for (let i = 1; i < Math.min(lines.length, 40); i++) {
    if (lines[i]?.trim() !== "---") {
      continue;
    }
    const frontmatterBody = lines.slice(1, i).join("\n");
    const hasKnownMetadataSignature =
      /^\s*cik\s*:/m.test(frontmatterBody) &&
      (
        /^\s*accession_number\s*:/m.test(frontmatterBody) ||
        /^\s*company_name\s*:/m.test(frontmatterBody) ||
        /^\s*date_filed\s*:/m.test(frontmatterBody) ||
        /^\s*form_type\s*:/m.test(frontmatterBody) ||
        /^\s*filing_url\s*:/m.test(frontmatterBody) ||
        /^\s*companyName\s*:/m.test(frontmatterBody) ||
        /^\s*filingUrl\s*:/m.test(frontmatterBody)
      );

    if (!hasKnownMetadataSignature) {
      return markdown;
    }
    const rest = lines.slice(i + 1).join("\n").replace(/^\n+/, "");
    return rest;
  }

  return markdown;
}

function withMetadataFrontmatter(
  markdown: string,
  cik: string,
  accessionNumber: string,
  companyName: string,
  dateFiled: string,
  formType: string,
  filingUrl: string,
): string {
  const cleaned = stripExistingMetadataFrontmatter(markdown);
  const block = [
    "---",
    `cik: ${JSON.stringify(cik)}`,
    `accession_number: ${JSON.stringify(accessionNumber)}`,
    `company_name: ${JSON.stringify(companyName)}`,
    `date_filed: ${JSON.stringify(dateFiled)}`,
    `form_type: ${JSON.stringify(formType)}`,
    `filing_url: ${JSON.stringify(filingUrl)}`,
    "---",
    "",
  ].join("\n");
  return `${block}${cleaned}`.replace(/\s+$/, "\n");
}

async function finalizeMarkerOutput(
  table: ParsedMarkdownTable,
  rowIdx: number,
  vars: Record<string, string>,
  tablePath: string,
): Promise<string> {
  const pdfBaseName = path.parse(vars.file_path).name;
  const flatMarkdownPath = path.join(vars.marker_output_dir, `${pdfBaseName}.md`);
  const markerArtifactDir = path.join(vars.marker_output_dir, pdfBaseName);
  const defaultNestedMarkdownPath = path.join(markerArtifactDir, `${pdfBaseName}.md`);

  let sourceMarkdownPath: string | null = null;
  if (await pathExists(defaultNestedMarkdownPath)) {
    sourceMarkdownPath = defaultNestedMarkdownPath;
  } else if (await pathExists(flatMarkdownPath)) {
    sourceMarkdownPath = flatMarkdownPath;
  } else if (await pathExists(markerArtifactDir)) {
    const entries = await fs.readdir(markerArtifactDir, { withFileTypes: true });
    const firstMarkdown = entries.find(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"),
    );
    if (firstMarkdown) {
      sourceMarkdownPath = path.join(markerArtifactDir, firstMarkdown.name);
    }
  }

  if (!sourceMarkdownPath) {
    throw new Error(
      `No markdown output found for source PDF ${vars.file_path} in ${vars.marker_output_dir}`,
    );
  }

  const cik = getCell(table, rowIdx, "cik").trim();
  const accessionNumber = getCell(table, rowIdx, "accession_number").trim();
  const companyName = getCell(table, rowIdx, "company_name").trim();
  const dateFiled = getCell(table, rowIdx, "date_filed").trim();
  const formType = deriveFormType(table, rowIdx, tablePath);
  const filingUrl = getCell(table, rowIdx, "filing_url").trim();
  const sourceMarkdown = await fs.readFile(sourceMarkdownPath, "utf-8");
  const cleanedMarkdown = stripImageMarkdownLines(sourceMarkdown);
  const withMetadata = withMetadataFrontmatter(
    cleanedMarkdown,
    cik,
    accessionNumber,
    companyName,
    dateFiled,
    formType,
    filingUrl,
  );
  await fs.writeFile(flatMarkdownPath, withMetadata, "utf-8");

  if ((await pathExists(markerArtifactDir)) && markerArtifactDir !== flatMarkdownPath) {
    await fs.rm(markerArtifactDir, { recursive: true, force: true });
  }

  return flatMarkdownPath;
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const options = parseOptions(args);
    logger.info("Parsed CLI options", {
      tablePath: options.tablePath,
      markerOutputDir: options.markerOutputDir,
      ollamaBaseUrl: options.ollamaBaseUrl,
      ollamaModel: options.ollamaModel,
      markerBinary: options.markerBinary,
      torchDevice: options.torchDevice,
      gpuOnly: options.gpuOnly,
      outputYear: options.outputYear,
      retryFailed: options.retryFailed,
      dryRun: options.dryRun,
    });

    assertCudaReady(options);

    const raw = await fs.readFile(options.tablePath, "utf-8");
    const table = findTable(raw, REQUIRED_COLUMNS);
    const addedStatus = ensureStatusColumn(table);

    if (addedStatus) {
      await persistTable(options.tablePath, table);
      logger.info("Added status column to markdown table", {
        tablePath: options.tablePath,
      });
    }

    const statusColumn = "status";
    const selectedRowIndexes: number[] = [];
    let done = 0;
    let failed = 0;
    let skipped = 0;

    for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
      const currentStatus = getCell(table, rowIdx, statusColumn);
      if (!statusShouldRun(currentStatus, options.retryFailed)) {
        skipped += 1;
        continue;
      }

      selectedRowIndexes.push(rowIdx);
    }
    const eligible = selectedRowIndexes.length;
    let attempted = 0;

    const processRow = async (rowIdx: number): Promise<void> => {
      const accession = getCell(table, rowIdx, "accession_number");
      const rawFilePath = getCell(table, rowIdx, "file_path");
      const vars = buildVariablesForRow(table, rowIdx, options);

      if (!rawFilePath || rawFilePath.trim().length === 0) {
        setCell(table, rowIdx, statusColumn, "failed");
        await persistTable(options.tablePath, table);
        failed += 1;
        logger.error("Missing file_path; marked as failed", {
          row: rowIdx + 1,
          accession_number: accession,
        });
        return;
      }

      try {
        await fs.access(vars.file_path);
      } catch {
        setCell(table, rowIdx, statusColumn, "failed");
        await persistTable(options.tablePath, table);
        failed += 1;
        logger.error("file_path does not exist; marked as failed", {
          row: rowIdx + 1,
          accession_number: accession,
          file_path: vars.file_path,
        });
        return;
      }

      const command = interpolateTemplate(options.commandTemplate, vars);
      logger.info("Executing marker command", {
        row: rowIdx + 1,
        accession_number: accession,
        command,
      });

      if (options.dryRun) {
        skipped += 1;
        return;
      }

      await fs.mkdir(vars.marker_output_dir, { recursive: true });

      let exitCode = 1;
      try {
        exitCode = await runShellCommand(
          `TORCH_DEVICE=${options.torchDevice} ${command}`,
        );
      } catch (error) {
        logger.error("Marker command execution failed", {
          row: rowIdx + 1,
          accession_number: accession,
          error: (error as Error).message,
        });
      }

      if (exitCode === 0) {
        try {
          const finalMarkdownPath = await finalizeMarkerOutput(
            table,
            rowIdx,
            vars,
            options.tablePath,
          );
          setCell(table, rowIdx, statusColumn, "done");
          done += 1;
          logger.info("Finalized marker markdown output", {
            row: rowIdx + 1,
            accession_number: accession,
            markdown_path: finalMarkdownPath,
          });
        } catch (error) {
          setCell(table, rowIdx, statusColumn, "failed");
          failed += 1;
          logger.error("Marker output post-processing failed", {
            row: rowIdx + 1,
            accession_number: accession,
            error: (error as Error).message,
          });
        }
      } else {
        setCell(table, rowIdx, statusColumn, "failed");
        failed += 1;
      }
      await persistTable(options.tablePath, table);
    };

    const totalBatches = Math.ceil(eligible / DEFAULT_BATCH_SIZE);
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batchStart = batchIdx * DEFAULT_BATCH_SIZE;
      const batchRowIndexes = selectedRowIndexes.slice(
        batchStart,
        batchStart + DEFAULT_BATCH_SIZE,
      );
      logger.info("Starting marker batch chunk", {
        chunk: batchIdx + 1,
        chunks: totalBatches,
        size: batchRowIndexes.length,
      });

      for (const rowIdx of batchRowIndexes) {
        attempted += 1;
        await processRow(rowIdx);
      }
    }

    const deferred = Math.max(0, eligible - attempted);

    logger.info("Marker batch job complete", {
      tablePath: options.tablePath,
      totalRows: table.rows.length,
      batchSize: DEFAULT_BATCH_SIZE,
      eligible,
      attempted,
      deferred,
      done,
      failed,
      skipped,
      dryRun: options.dryRun,
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Marker batch job failed", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export {
  buildVariablesForRow,
  ensureStatusColumn,
  findTable,
  interpolateTemplate,
  renderContentWithTable,
  resolveTablePath,
  statusShouldRun,
};
