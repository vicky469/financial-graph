import { describe, expect, test } from "vitest";
import {
  buildVariablesForRow,
  ensureStatusColumn,
  findTable,
  interpolateTemplate,
  resolveTablePath,
  renderContentWithTable,
  statusShouldRun,
} from "../../src/jobs/filings_marker_single_batch";

const REQUIRED_COLUMNS = [
  "cik",
  "accession_number",
  "company_name",
  "date_filed",
  "file_path",
  "filing_url",
] as const;

describe("findTable + status rendering", () => {
  test("adds status column and preserves surrounding markdown", () => {
    const content = [
      "# Filings 2025 10-K",
      "",
      "| cik | accession_number | company_name | date_filed | file_path | filing_url |",
      "| --- | --- | --- | --- | --- | --- |",
      "| 0000107136 | 0000107136-25-000003 | Sample Co | 2025-02-01 | /tmp/a.pdf | https://sec/a.htm |",
      "| 0000200000 | 0000200000-25-000010 | Other Co | 2025-02-02 | /tmp/b.pdf | https://sec/b.htm |",
      "",
      "Footer note",
    ].join("\n");

    const table = findTable(content, REQUIRED_COLUMNS);
    const added = ensureStatusColumn(table);
    expect(added).toBe(true);

    expect(table.header).toEqual([
      "cik",
      "accession_number",
      "company_name",
      "date_filed",
      "file_path",
      "filing_url",
      "status",
    ]);

    const statusIdx = table.header.indexOf("status");
    table.rows[0][statusIdx] = "done";
    table.rows[1][statusIdx] = "failed";

    const rendered = renderContentWithTable(table);
    expect(rendered).toContain(
      "| cik | accession_number | company_name | date_filed | file_path | filing_url | status |",
    );
    expect(rendered).toContain("| 0000107136 | 0000107136-25-000003 | Sample Co | 2025-02-01 | /tmp/a.pdf | https://sec/a.htm | done |");
    expect(rendered).toContain("| 0000200000 | 0000200000-25-000010 | Other Co | 2025-02-02 | /tmp/b.pdf | https://sec/b.htm | failed |");
    expect(rendered).toContain("# Filings 2025 10-K");
    expect(rendered).toContain("Footer note");
  });
});

describe("interpolateTemplate", () => {
  test("replaces known template variables", () => {
    const command = interpolateTemplate(
      'marker_single "{{file_path}}" --output_dir "{{marker_output_dir}}"',
      {
        file_path: "/tmp/a.pdf",
        marker_output_dir: "/tmp/out",
      },
    );

    expect(command).toBe('marker_single "/tmp/a.pdf" --output_dir "/tmp/out"');
  });

  test("throws for unknown variables", () => {
    expect(() =>
      interpolateTemplate("marker_single {{missing_var}}", {
        file_path: "/tmp/a.pdf",
      }),
    ).toThrow(/Unknown command template variable/);
  });
});

describe("statusShouldRun", () => {
  test("skips done rows", () => {
    expect(statusShouldRun("done", false)).toBe(false);
  });

  test("skips failed rows unless retry-failed is set", () => {
    expect(statusShouldRun("failed", false)).toBe(false);
    expect(statusShouldRun("failed", true)).toBe(true);
  });

  test("runs pending or empty rows", () => {
    expect(statusShouldRun("", false)).toBe(true);
    expect(statusShouldRun("pending", false)).toBe(true);
  });
});

describe("resolveTablePath", () => {
  test("resolves from --year/--form-type flags", () => {
    const resolved = resolveTablePath(["--year=2025", "--form-type=10-K"]);
    expect(resolved.endsWith("output/ObsidianVault/Filings/2025_10-K.md")).toBe(
      true,
    );
  });

  test("resolves from positional args (-year formType)", () => {
    const resolved = resolveTablePath(["-2025", "10-K"]);
    expect(resolved.endsWith("output/ObsidianVault/Filings/2025_10-K.md")).toBe(
      true,
    );
  });
});

describe("buildVariablesForRow", () => {
  test("routes marker output into year folder from date_filed", () => {
    const content = [
      "| cik | accession_number | company_name | date_filed | file_path | filing_url |",
      "| --- | --- | --- | --- | --- | --- |",
      "| 0000107136 | 0000107136-25-000003 | Sample Co | 2025-02-01 | /tmp/a.pdf | https://sec/a.htm |",
    ].join("\n");
    const table = findTable(content, REQUIRED_COLUMNS);

    const vars = buildVariablesForRow(table, 0, {
      tablePath: "/tmp/2025_10-K.md",
      markerOutputDir: "/repo/backend/src/output/ObsidianVault/Filings",
      ollamaBaseUrl: "http://localhost:11434",
      ollamaModel: "qwen3-coder:30b",
      commandTemplate: "{{marker_binary}}",
      markerBinary: "/home/bun/marker-env/bin/marker_single",
      torchDevice: "cuda",
      gpuOnly: true,
      retryFailed: false,
      dryRun: true,
    });

    expect(vars.output_year).toBe("2025");
    expect(vars.marker_output_dir).toBe(
      "/repo/backend/src/output/ObsidianVault/Filings/2025",
    );
  });

  test("falls back to file_path year when date_filed is empty", () => {
    const content = [
      "| cik | accession_number | company_name | date_filed | file_path | filing_url |",
      "| --- | --- | --- | --- | --- | --- |",
      "| 0000107136 | 0000107136-25-000003 | Sample Co |  | /data/filings_pdf/2024/10-K/100_000_x.pdf | https://sec/a.htm |",
    ].join("\n");
    const table = findTable(content, REQUIRED_COLUMNS);

    const vars = buildVariablesForRow(table, 0, {
      tablePath: "/tmp/2024_10-K.md",
      markerOutputDir: "/repo/backend/src/output/ObsidianVault/Filings",
      ollamaBaseUrl: "http://localhost:11434",
      ollamaModel: "qwen3-coder:30b",
      commandTemplate: "{{marker_binary}}",
      markerBinary: "/home/bun/marker-env/bin/marker_single",
      torchDevice: "cuda",
      gpuOnly: true,
      retryFailed: false,
      dryRun: true,
    });

    expect(vars.output_year).toBe("2024");
    expect(vars.marker_output_dir).toBe(
      "/repo/backend/src/output/ObsidianVault/Filings/2024",
    );
  });

  test("prefers CLI/output year over row-derived year", () => {
    const content = [
      "| cik | accession_number | company_name | date_filed | file_path | filing_url |",
      "| --- | --- | --- | --- | --- | --- |",
      "| 0000107136 | 0000107136-25-000003 | Sample Co | 2025-02-01 | /data/filings_pdf/2025/10-K/100_000_x.pdf | https://sec/a.htm |",
    ].join("\n");
    const table = findTable(content, REQUIRED_COLUMNS);

    const vars = buildVariablesForRow(table, 0, {
      tablePath: "/tmp/2025_10-K.md",
      markerOutputDir: "/repo/backend/src/output/ObsidianVault/Filings",
      ollamaBaseUrl: "http://localhost:11434",
      ollamaModel: "qwen3-coder:30b",
      commandTemplate: "{{marker_binary}}",
      markerBinary: "/home/bun/marker-env/bin/marker_single",
      torchDevice: "cuda",
      gpuOnly: true,
      outputYear: "2026",
      retryFailed: false,
      dryRun: true,
    });

    expect(vars.output_year).toBe("2026");
    expect(vars.marker_output_dir).toBe(
      "/repo/backend/src/output/ObsidianVault/Filings/2026",
    );
  });
});
