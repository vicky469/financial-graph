## Quick Start (Full Ingestion)

### Option 1: Use the reload script (Recommended)

```bash
cd financial-graph/backend

# Reload dev database (default)
bun run reload:dev

# Or reload test database
bun run reload:test
```

The reload script automatically runs all steps in order:
1. Ingest tickers
2. Ingest filings (includes EX-21 and EX-8)
3. Ingest subsidiaries
4. Mark SP500 companies
5. Mark Trust companies

### Option 2: Run steps manually

```bash
cd financial-graph/backend

# 1. Clean slate
bun run wipe:database

# 2. Run all ingestion steps in order
bun run ingest:tickers
bun run ingest:filings  # includes ex21 and ex8 ingestion
bun run ingest:subsidiaries
bun run mark:sp500
bun run mark:trust

# 3. Verify
bun run test:integration
```

**Total time**: ~45-80 minutes
