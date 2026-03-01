# Job Order Cheatsheet

- Run `$ bun run job:tickers` to load tickers into the DB.
- Run `$ bun run job:registrant -- -2025` to fetch SEC registrant index (requires years).
- Run `$ bun run job:subsidiary_filings_metadata -- -2025` to load subsidiary-relevant filing metadata (10-K/20-F family) from SEC registrant index JSON files into the DB (requires years).
- Run `$ bun run job:subsidiary_filings -- -2025` to fetch subsidiary filings and extract EX-21/EX-8 URLs and period_of_report from filing TXT (requires years).
  - Add `--use-cache` to reuse cached filing text files instead of re-downloading (default: fresh download). 
  Example: `$ bun run job:subsidiary_filings -- -2025 --use-cache`
  - Add `--skip-processing` to download filing TXT but skip parsing and DB updates.
  Example: `$ bun run job:subsidiary_filings -- -2025 --skip-processing`
  - Add `--retry-failed-downloads` to retry only previously failed `file_url` downloads from `backend/logs/filings_failed` (no DB extraction/update).
  Example: `$ bun run job:subsidiary_filings -- --retry-failed-downloads`
  - Optional: `--failed-report=<path>` to target a specific failed report file (otherwise latest report is used).
- Run `$ bun run job:company_info_submissions` to ingest company info from SEC submissions JSON files.
- Run `$ bun run job:subsidiary_exhibits_download -- -2025` to download EX-21/EX-8 exhibit files (requires years).
- Run `$ bun run job:mark-sp500` to flag S&P 500 companies.
- Run `$ bun run pipeline:parse_subsidiaries -- --year=2025 --sink=all --sp500 --dry-run` to run the subsidiaries parsing pipeline (both DB + CSV sinks).
  - Run `$ bun run pipeline:parse_subsidiaries -- --year=2025 --sink=all --sp500 --fallback=none` to run without LLM fallback.
  - If you split the command across lines, use `\` at line end:
    `$ bun src/pipeline/subsidiary/run.ts \`
    `--year=2025 \`
    `--sink=csv \`
    `--accessions=000095017025090161`
- Run `$ bun src/utils/cleanup-specific-parent.ts <parentCompanyId>` to clear `parent_of` edges and subsidiary company nodes for one parent company.
  - Multiple IDs are supported: `$ bun src/utils/cleanup-specific-parent.ts <id1,id2,id3>`
  - Optional parent-level concurrency: `CLEANUP_PARENT_CONCURRENCY=5 bun src/utils/cleanup-specific-parent.ts <id1> <id2>`
- Run `$ bun run src/jobs/filings_download_htm_gz.ts -- -2025 10-K 20-F [--format=gz|htm]` to download primary HTM files from cached filing text (requires year and form types).
  - Reads from `filing_text/{year}/{formType}/` cache
  - Extracts primary HTM filename (SEQUENCE=1) from filing text
  - `--format=gz` (default): writes `output/data/filings_htm/{year}/{formType}/{cik}_{accession}_{filename}.gz`
  - `--format=htm`: writes `output/data/filings_htm/{year}/{formType}/{cik}_{accession}_{filename}.htm`
- Then run `$ bun run src/jobs/filings_htm_to_pdf.ts -- -2025 10-K 20-F` to convert downloaded HTM files to PDFs.
  - Script alias: `$ bun run job:filings_htm_to_pdf -- -2025 10-K 20-F`
  - Reads from `output/data/filings_htm/{year}/{formType}/*.htm`
  - Writes to `output/data/filings_pdf/{year}/{formType}/*.pdf`
  - Optional `--concurrency=<n>` to run conversions in parallel faster (auto-tuned when omitted)
  - Requires Playwright in backend (`bun add playwright`)
  - One-time browser install: `bunx playwright install chromium`
- Run `$ bun run job:filings_markdown_table -- -2025 10-K` to build the markdown filings table used as marker input.
  - Reads PDFs from `output/data/filings_pdf/{year}/{formType}`
  - Joins with SEC index JSON from `output/index/sec_registrant_index-{year}/{year}-Q*.json`
  - Writes markdown table to `output/ObsidianVault/Filings/{year}_{formType}.md`
  - Table columns: `cik`, `accession_number`, `company_name`, `date_filed`, `file_path`, `filing_url`, `status`
- Run `$ bun run job:filings_marker_batch -- -2025 10-K` to execute `marker_single` for each row in the filings Markdown table and update status per row.
  - GPU-only by default. The job preflights CUDA in marker's Python environment and fails fast if unavailable.
  - Default marker binary:
    - `/home/bun/marker-env/bin/marker_single`
  - Default marker output root:
    - `backend/src/output/ObsidianVault/Filings`
  - Actual per-row output directory:
    - `backend/src/output/ObsidianVault/Filings/{year}` (`--year` preferred; fallback from `date_filed`, then `file_path`)
  - Result markdown path per PDF:
    - `backend/src/output/ObsidianVault/Filings/{year}/{same-pdf-base-name}.md`
  - Markdown metadata header (frontmatter):
    - `cik`, `accession_number`, `company_name`, `date_filed`, `form_type`, `filing_url`
  - Image extraction:
    - Disabled (`--disable_image_extraction`), and image markdown lines are removed from output.
  - Output layout:
    - Final output is a flat file per filing (`{year}/{same-pdf-base-name}.md`), without nested per-filing folders.
  - Override marker binary if needed:
    - `--marker-binary=/path/to/marker_single`
  - Default command template:
    - `"{{marker_binary}}" "{{file_path}}" --output_dir "{{marker_output_dir}}" --disable_image_extraction --use_llm --llm_service marker.services.ollama.OllamaService --OllamaService_ollama_base_url "{{ollama_base_url}}" --OllamaService_ollama_model "{{ollama_model}}"`
  - Processing model:
    - Runs eligible rows sequentially, up to `10` rows per run.
  - Useful flags:
    - `--retry-failed` reruns rows with `status=failed`
    - `--dry-run` logs commands without executing
    - `--allow-cpu` disables GPU-only preflight (not recommended for large batches)
    - `--output-dir=<path>`, `--ollama-base-url=<url>`, `--ollama-model=<model>`
    - `--command-template='<custom command with {{file_path}} and table vars>'`

## Documentation

- Technical debt tracker: `technical debt.md`

## Logging

- Logs are written under date folders:
  - `backend/logs/YYYY-MM-DD/{entrypoint}.log`
- Running different jobs on the same date creates different files (for example `filings_markdown_table.log`, `filings_marker_single_batch.log`).
- `backend/logs/latest.log` is still maintained as the latest run snapshot.
- Optional override:
  - `LOG_FILE_NAME=<custom-name> bun run <job>`

## LLM Throttle Configuration

### Qwen SEC Throughput (vision/PDF)

Use these env vars in `backend/.env` to control Qwen request pace when parsing SEC image/PDF sources:

- `QWEN_SEC_REQUESTS_PER_SECOND`
  - Positive number (supports decimals), e.g. `0.5`, `1`, `2`.
  - Converted to `minIntervalMs = ceil(1000 / rps)`.

Default:
- If unset/invalid, falls back to `0.6667 req/s` (~`1500ms` interval).

Examples:
- `QWEN_SEC_REQUESTS_PER_SECOND=0.4` -> one request every `2500ms` (safer for large reruns)
- `QWEN_SEC_REQUESTS_PER_SECOND=1.0` -> one request every `1000ms`

The effective throttle is logged at startup under `integration/qwen`:
- `Configured Qwen SEC throttle`

## Utilities

### Worker Pool & Adaptive Workload Configuration

The backend provides two complementary utilities for efficient concurrent processing:

#### 1. Worker Pool (`src/utils/worker-pool.ts`)

Reusable abstraction for concurrent task processing with progress tracking and error handling.

```typescript
import { runWorkerPool } from "../utils/worker-pool";

const result = await runWorkerPool({
  concurrency: 4,
  tasks: items,
  worker: async (item, workerId) => {
    return processedResult;
  },
  onProgress: (stats) => {
    logger.info(`Progress: ${stats.completed}/${stats.total}`);
  },
  progressInterval: 50,
});
```

#### 2. Adaptive Workload Configuration (`src/utils/workload-config.ts`)

**Programmatically determines optimal batch size and concurrency** based on task count and workload characteristics.

**Why adaptive configuration?**

- Heavy operations (network I/O, large DB writes) need **smaller batches** to avoid timeouts
- Light operations (cached reads, simple queries) can use **larger batches** for efficiency
- Rate-limited APIs need **low concurrency** to respect limits
- Configuration scales automatically with input size

**Usage with Presets:**

```typescript
import { WORKLOAD_PRESETS } from "../utils/workload-config";
import { runWorkerPool } from "../utils/worker-pool";

// Automatically configure for SEC API downloads (rate limited)
const workload = WORKLOAD_PRESETS.secApi(filings.length);
logger.info(
  `Using concurrency=${workload.concurrency}, batchSize=${workload.batchSize}`,
);
logger.debug(workload.reasoning); // Explains why these values were chosen

await runWorkerPool({
  concurrency: workload.concurrency,
  tasks: filings,
  worker: async (filing) => await downloadFiling(filing),
});
```

**Available Presets:**

- `WORKLOAD_PRESETS.secApi(count)` - SEC API requests (10 req/s limit)
- `WORKLOAD_PRESETS.download(count)` - Network downloads, file operations
- `WORKLOAD_PRESETS.fastIO(count)` - Fast DB queries, cached reads

**Workload Types:**

- `io_light` - Fast I/O (high concurrency, large batches)
- `io_heavy` - Slow I/O (moderate concurrency, **small batches**)
- `cpu_bound` - CPU intensive (concurrency ≈ CPU cores)
- `memory_intensive` - Large memory usage (low concurrency, small batches)
- `rate_limited` - External API limits (very low concurrency)
