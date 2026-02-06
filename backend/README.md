# Job Order Cheatsheet

- Run `$ bun run job:tickers` to load tickers into the DB.
- Run `$ bun run job:mark-sp500` to flag S&P 500 companies.
- Run `$ bun run job:registrant -- -2025` to fetch SEC registrant index (requires years).
- Run `$ bun run job:subsidiary_filings -- -2025` to fetch subsidiary filings (requires years).
- Run `$ bun run job:subsidiary_exhibits -- -2025` to extract EX-21/EX-8 URLs and period_of_report from filing TXT (requires years).
  - Add `--use-cache` to reuse cached filing text files instead of re-downloading (default: fresh download).
  - Example: `$ bun run job:subsidiary_exhibits -- -2025 --use-cache`
- Run `$ bun run job:company_info_submissions` to ingest company info from SEC submissions JSON files.

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
