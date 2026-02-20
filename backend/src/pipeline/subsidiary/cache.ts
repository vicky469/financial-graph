/**
 * Cached exhibit loader for subsidiaries parsing.
 */

import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { createLogger } from "../../utils/logger";
import { loadPublicCompaniesLookup } from "../../db/queries/company-lookup";
import type { SECFilingTarget } from "./types";
import type { SubsidiaryExhibit } from "../../config/subsidiary-exhibits";
import type { CompanyLookupOptions } from "@financial-graph/shared/db";

const logger = createLogger("pipeline/subsidiary/cache");

const normalizeCik = (cik: string): string => cik.padStart(10, "0");

export const DEFAULT_CACHE_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "output",
  "data",
  "subsidiary_exhibits",
);

export type CacheFileParseResult = {
  cik: string; // raw from filename
  accessionNumberNoDashes: string;
  filename: string;
  url: string;
};

export function parseCacheFilename(
  filename: string,
): CacheFileParseResult | null {
  if (!filename.endsWith(".gz")) return null;
  const base = filename.replace(/\.gz$/, "");
  const parts = base.split("_");

  // Current format: {cik}_{accession}_{filename}.htm.gz
  // Example: 16859_000141057825001054_srl-20241231xex8d1.htm.gz
  if (parts.length >= 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    const cik = parts[0];
    const accessionNumberNoDashes = parts[1];
    const originalFilename = parts.slice(2).join("_");
    const cikUrl = cik.replace(/^0+/, "") || cik;
    const url = `https://www.sec.gov/Archives/edgar/data/${cikUrl}/${accessionNumberNoDashes}/${originalFilename}`;

    return {
      cik,
      accessionNumberNoDashes,
      filename: originalFilename,
      url,
    };
  }

  return null;
}


export type TargetsFileResult = {
  filePath: string;
  targetCount: number;
  scannedCount: number;
};

export function buildTargetsFilename(options: {
  quarters?: number[];
  companyLookup?: CompanyLookupOptions;
  limit?: number;
  timestampSuffix?: string;
}): string {
  const quarterLabel =
    options.quarters && options.quarters.length > 0
      ? `q-${options.quarters.map((quarter) => `q${quarter}`).join("-")}`
      : undefined;
  const filterLabel =
    options.companyLookup?.mode === "sp500-only"
      ? "sp500"
      : options.companyLookup?.mode === "exclude-sp500"
        ? "no-sp500"
        : undefined;
  const limitLabel = options.limit ? `limit-${options.limit}` : undefined;
  const suffixParts = [quarterLabel, filterLabel, limitLabel, options.timestampSuffix].filter(Boolean);
  const suffix = suffixParts.length > 0 ? `.${suffixParts.join(".")}` : "";
  return `targets${suffix}.jsonl`;
}

export async function writeCachedTargetsFile(options: {
  year: number;
  quarters?: number[];
  exhibitTypes: readonly SubsidiaryExhibit[];
  cacheRoot?: string;
  outputPath?: string;
  companyLookup?: CompanyLookupOptions;
  limit?: number;
  accessions?: string[];
  timestampSuffix?: string;
}): Promise<TargetsFileResult> {
  const {
    year,
    quarters = [],
    exhibitTypes,
    cacheRoot = DEFAULT_CACHE_ROOT,
    outputPath,
    companyLookup,
    limit,
    accessions,
    timestampSuffix,
  } = options;

  const companyMap = await loadPublicCompaniesLookup(companyLookup);
  const defaultFilename = buildTargetsFilename({
    quarters,
    companyLookup,
    limit,
    timestampSuffix,
  });
  const filePath =
    outputPath ?? path.join(cacheRoot, String(year), defaultFilename);

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Create file once for this run, then append lines as we scan cache entries.
  await fs.writeFile(filePath, "", { encoding: "utf8" });
  const stream = createWriteStream(filePath, { encoding: "utf8", flags: "a" });
  const writeLine = async (line: string) => {
    if (!stream.write(line)) {
      await once(stream, "drain");
    }
  };

  // Normalize accession filter (remove dashes)
  const accessionFilter = accessions && accessions.length > 0
    ? new Set(accessions.map(a => a.replace(/-/g, '')))
    : null;

  let scannedCount = 0;
  let targetCount = 0;
  const useQuarterSubdir = quarters.length > 0;

  let shouldStop = false;

  for (const exhibitType of exhibitTypes) {
    if (shouldStop) break;
    const cacheDirs =
      useQuarterSubdir
        ? quarters.map((quarter) => ({
            quarter,
            dir: path.join(cacheRoot, String(year), `Q${quarter}`, exhibitType),
          }))
        : [{ quarter: undefined, dir: path.join(cacheRoot, String(year), exhibitType) }];

    for (const cacheDirInfo of cacheDirs) {
      if (shouldStop) break;
      const { dir: cacheDir, quarter } = cacheDirInfo;

      try {
        await fs.access(cacheDir);
      } catch {
        logger.warn(`Cache directory not found: ${cacheDir}`);
        continue;
      }

      const entries = await fs.readdir(cacheDir, { withFileTypes: true });

      for (const entry of entries) {
        if (shouldStop) break;
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".gz")) continue;

        const parsed = parseCacheFilename(entry.name);
        if (!parsed) continue;

        scannedCount += 1;

        const company = companyMap.get(normalizeCik(parsed.cik));
        if (!company) continue;

        // Filter by accessions if provided
        if (accessionFilter && !accessionFilter.has(parsed.accessionNumberNoDashes)) {
          continue;
        }

        const target: SECFilingTarget = {
          accessionNumberNoDashes: parsed.accessionNumberNoDashes,
          cik: parsed.cik,
          exhibitType,
          cachePath: path.join(cacheDir, entry.name),
          url: parsed.url,
          companyId: company.id,
          companyName: company.name,
          isSp500: company.isSp500,
          metadata:
            quarter !== undefined
              ? { sourceQuarter: quarter, sourceYear: year }
              : undefined,
        };

        await writeLine(`${JSON.stringify(target)}\n`);
        targetCount += 1;

        if (limit && targetCount >= limit) {
          shouldStop = true;
        }
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.end(() => resolve());
  });

  logger.info(
    `Wrote ${targetCount} targets (from ${scannedCount} cached files) to ${filePath}`,
  );

  return {
    filePath,
    targetCount,
    scannedCount,
  };
}

export async function* readTargetsFromFile(options: {
  filePath: string;
  batchSize: number;
}): AsyncGenerator<SECFilingTarget[]> {
  const { filePath, batchSize } = options;

  const fileStream = await fs.open(filePath, "r");
  const rl = (await import("node:readline")).createInterface({
    input: fileStream.createReadStream(),
    crlfDelay: Infinity,
  });

  let batch: SECFilingTarget[] = [];
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      let target: SECFilingTarget | null = null;
      try {
        target = JSON.parse(line) as SECFilingTarget;
      } catch (error) {
        logger.warn("Failed to parse target line; skipping.", {
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      batch.push(target);

      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  } finally {
    rl.close();
    await fileStream.close();
  }
}
