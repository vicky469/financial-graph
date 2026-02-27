# Job Order Cheatsheet

- Run `$ bun run job:tickers` to load tickers into the DB.
- Run `$ bun run job:registrant -- -2025` to fetch SEC registrant index (requires years).
- Run `$ bun run job:subsidiary_filings_metadata -- -2025` to load subsidiary-relevant filing metadata (10-K/20-F family) from SEC registrant index JSON files into the DB (requires years).
- Run `$ bun run job:subsidiary_filings -- -2025` to fetch subsidiary filings and extract EX-21/EX-8 URLs and period_of_report from filing TXT (requires years).
  - Add `--use-cache` to reuse cached filing text files instead of re-downloading (default: fresh download). 
  Example: `$ bun run job:subsidiary_filings -- -2025 --use-cache`
  - Add `--skip-processing` to download filing TXT but skip parsing and DB updates.
  Example: `$ bun run job:subsidiary_filings -- -2025 --skip-processing`
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
- Run `$ bun run src/jobs/filings_download_htm_gz.ts -- -2025 10-K 20-F` to download primary HTM files from cached filing text (requires year and form types).
  - Reads from `filing_text/{year}/{formType}/` cache
  - Extracts primary HTM filename (SEQUENCE=1) from filing text
  - Downloads and compresses to `output/data/filings_htm/{year}/{formType}/{cik}_{accession}_{filename}.gz`

## Documentation

- Technical debt tracker: `technical debt.md`

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
