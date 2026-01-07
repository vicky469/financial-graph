import { db } from "../../../db/client";
import { Filing } from "../../../types";
import { createLogger } from "../../../utils/logger";
import fs from "fs/promises";
import path from "path";
import { gzip } from "zlib";
import { promisify } from "util";
import "dotenv/config";

const gzipAsync = promisify(gzip);

// Get year from environment variable (SEC_YEARS in .env)
const TARGET_YEAR = parseInt(process.env.SEC_YEARS!);
const SEC_USER_AGENT = process.env.SEC_USER_AGENT!;
const CACHE_BASE_DIR = path.resolve(__dirname, "../output");

// SEC rate limiting: max 10 requests per second
const DELAY_BETWEEN_REQUESTS_MS = 150; // ~6-7 requests/second to be safe

interface ExhibitConfig {
  exhibitType: string; // "EX-21" or "EX-8"
  description: string; // "subsidiaries" or "foreign subsidiaries"
  formTypes: string[]; // ["10-K"] or ["10-K", "20-F"]
}

const EXHIBIT_CONFIGS: Record<string, ExhibitConfig> = {
  "EX-21": {
    exhibitType: "EX-21",
    description: "subsidiaries",
    formTypes: ["10-K"]
  },
  "EX-8": {
    exhibitType: "EX-8", 
    description: "foreign subsidiaries",
    formTypes: ["20-F"]
  }
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCacheFilePath(url: string, cacheDir: string): string {
  const urlObj = new URL(url);
  // Use the path as filename: Archives_edgar_data_{cik}_{accession}_{filename}.gz
  const pathWithoutLeadingSlash = urlObj.pathname.substring(1); // Remove leading /
  const fileName = pathWithoutLeadingSlash.replace(/\//g, '_') + '.gz';

  return path.join(cacheDir, fileName);
}

async function downloadFile(url: string): Promise<Buffer> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": SEC_USER_AGENT } });

      if (res.status === 429) {
        // Rate limited - wait longer
        const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        console.warn(
          `Rate limited, waiting ${waitTime}ms before retry ${
            attempt + 1
          }/${maxRetries}`
        );
        await sleep(waitTime);
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      
      // Compress the content with gzip
      return await gzipAsync(Buffer.from(text, 'utf-8'));
    } catch (e: any) {
      if (attempt === maxRetries - 1) throw e;
      const waitTime = Math.pow(2, attempt) * 1000;
      console.warn(
        `Download failed (attempt ${attempt + 1}/${maxRetries}): ${
          e.message
        }, retrying in ${waitTime}ms`
      );
      await sleep(waitTime);
    }
  }
  throw new Error("Failed after retries");
}

async function downloadExhibitFiles(config: ExhibitConfig, logger: ReturnType<typeof createLogger>) {
  const exhibitType = config.exhibitType;
  const exhibitTypeLower = exhibitType.toLowerCase();
  const CACHE_DIR = path.join(CACHE_BASE_DIR, `${exhibitTypeLower}_${TARGET_YEAR}`);
  const startTime = performance.now();

  logger.info(`Starting ${exhibitType} file download for year ${TARGET_YEAR}...`);
  logger.info(`Target: ${config.description} from ${config.formTypes.join(', ')} filings`);
  
  await fs.mkdir(CACHE_DIR, { recursive: true });
  logger.info(`Cache directory: ${CACHE_DIR}`);

  // Load existing cache inventory
  const existingFiles = new Set<string>();
  try {
    const files = await fs.readdir(CACHE_DIR);
    files.forEach((f) => existingFiles.add(path.join(CACHE_DIR, f)));
    logger.info(`Found ${existingFiles.size} already cached files`);
  } catch (e) {
    logger.info("Cache directory is empty");
  }

  // Fetch filings for all specified form types
  logger.info(`Querying database for ${config.formTypes.join(' and ')} filings...`);
  
  const allFilings: Filing[] = [];
  
  for (const formType of config.formTypes) {
    const filings = (
      await db.query({
        filings: {
          $: {
            where: {
              form_type: formType,
              fiscal_year: TARGET_YEAR,
            },
            limit: 10000,
          },
        },
      })
    ).filings as unknown as Filing[];
    
    allFilings.push(...filings);
  }

  const filingsWithExhibit = allFilings.filter(
    (f) =>
      f.attachments &&
      Object.keys(f.attachments).some((k) => k.startsWith(exhibitType))
  );

  logger.info(`Found ${filingsWithExhibit.length} filings with ${exhibitType} attachments`);

  // Extract URLs
  const downloadTargets = filingsWithExhibit.map((f) => {
    const exhibitKey = Object.keys(f.attachments!).find((k) =>
      k.startsWith(exhibitType)
    )!;
    const url = f.attachments![exhibitKey];
    const cachePath = getCacheFilePath(url, CACHE_DIR);
    return {
      accession: f.accession_number,
      url,
      cachePath,
      isCached: existingFiles.has(cachePath),
    };
  });

  const toDownload = downloadTargets.filter((t) => !t.isCached);
  const alreadyCached = downloadTargets.length - toDownload.length;

  logger.info(`Total: ${downloadTargets.length} files`);
  logger.info(`Already cached: ${alreadyCached} files`);
  logger.info(`To download: ${toDownload.length} files`);

  if (toDownload.length === 0) {
    logger.info("All files already cached! Nothing to download.");
    return;
  }

  // Download missing files with rate limiting
  let downloaded = 0;
  let failed = 0;
  const failedFiles: { accession: string; url: string; error: string }[] = [];

  for (let i = 0; i < toDownload.length; i++) {
    const target = toDownload[i];
    const progress = `${i + 1}/${toDownload.length}`;

    try {
      logger.info(`[${progress}] Downloading ${target.accession}...`);
      const compressedContent = await downloadFile(target.url);

      // Save compressed content to cache
      await fs.writeFile(target.cachePath, compressedContent);
      downloaded++;

      if (downloaded % 10 === 0) {
        logger.info(`Progress: ${downloaded}/${toDownload.length} downloaded`);
      }

      // Rate limiting delay
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    } catch (e: any) {
      failed++;
      logger.error(
        `[${progress}] Failed to download ${target.accession}: ${e.message}`
      );
      failedFiles.push({
        accession: target.accession,
        url: target.url,
        error: e.message,
      });
    }
  }

  const totalTime = performance.now() - startTime;

  logger.info("Download Summary", {
    exhibitType,
    total: downloadTargets.length,
    alreadyCached,
    downloaded,
    failed,
    totalTimeSeconds: (totalTime / 1000).toFixed(2),
  });

  if (failedFiles.length > 0) {
    logger.warn("Failed downloads:", failedFiles);

    // Write failed list to file for retry
    const failedPath = path.join(CACHE_DIR, "download_failures.json");
    await fs.writeFile(failedPath, JSON.stringify(failedFiles, null, 2));
    logger.info(`Failed downloads list saved to: ${failedPath}`);
  }

  logger.info(
    `${exhibitType} download complete! Total time: ${(totalTime / 1000).toFixed(2)}s`
  );
}

// CLI interface
async function main() {
  const exhibitTypeArg = process.argv[2];

  if (!exhibitTypeArg) {
    console.error("Usage: ts-node download_exhibit_files.ts <EX-21|EX-8>");
    console.error("Available exhibit types:");
    Object.entries(EXHIBIT_CONFIGS).forEach(([type, config]) => {
      console.error(`  ${type}: ${config.description} (${config.formTypes.join(', ')})`);
    });
    process.exit(1);
  }

  const exhibitType = exhibitTypeArg.toUpperCase();
  const config = EXHIBIT_CONFIGS[exhibitType];

  if (!config) {
    console.error(`Unknown exhibit type: ${exhibitType}. Supported: ${Object.keys(EXHIBIT_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  const logger = createLogger(`sec/download_${exhibitType.toLowerCase()}`);

  try {
    await downloadExhibitFiles(config, logger);
    console.log(`${exhibitType} download finished successfully.`);
    process.exit(0);
  } catch (error: any) {
    console.error(`${exhibitType} download failed:`, error.message);
    process.exit(1);
  }
}

// Export for programmatic use
export { downloadExhibitFiles, EXHIBIT_CONFIGS };

// Run if called directly
if (require.main === module) {
  main();
}