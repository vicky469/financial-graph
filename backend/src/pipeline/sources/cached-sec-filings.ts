/**
 * Cached SEC Filings Source
 *
 * Loads SEC filing data from local cache (.htm.gz files).
 * Enriches targets with company IDs from DB.
 *
 * Filter options applied at load time:
 * - sp500Only: Only SP500 companies
 */

import fs from "fs/promises";
import path from "path";
import { Source, PipelineConfig } from "../core/types";
import { SECFilingTarget, SECFilingSourceConfig } from "./types";
import { getPublicCompaniesLookup } from "../../db";
import { createLogger } from "../../utils/logger";
import ExcelJS from "exceljs";

const logger = createLogger("pipeline/sources/cached-sec-filings");

export class CachedSECFilingsSource implements Source<SECFilingTarget> {
  name = "cached-sec-filings";

  constructor(
    private config: SECFilingSourceConfig,
    private filterConfig?: PipelineConfig["filters"]
  ) {}

  async load(): Promise<SECFilingTarget[]> {
    const companyLookup = await this.loadCompanyLookup();
    const allTargets = await this.scanCacheDirectories();
    const enriched = await this.matchFilesWithCompanies(allTargets, companyLookup);
    await this.exportTargetsToExcel(enriched);
    return enriched;
  }

  private async loadCompanyLookup(): Promise<Map<string, { id: string; name: string }>> {
    const companyLookup = await getPublicCompaniesLookup({
      sp500Only: this.filterConfig?.sp500Only ?? false, // Explicit filtering based on pipeline config
    });
    
    const filterDesc = this.filterConfig?.sp500Only ? " (SP500 only)" : "";
    logger.info(`Loaded ${companyLookup.size} companies${filterDesc}`);
    
    return companyLookup;
  }

  private async scanCacheDirectories(): Promise<Array<Omit<SECFilingTarget, "companyId">>> {
    const allTargets: Array<Omit<SECFilingTarget, "companyId">> = [];

    for (const exhibitType of this.config.exhibitTypes) {
      const cacheDir = path.join(
        this.config.cacheBaseDir,
        `${exhibitType.toLowerCase()}_${this.config.year}`
      );

      const targets = await this.scanDirectory(cacheDir, exhibitType);
      allTargets.push(...targets);
    }
    
    logger.info(`Scanned ${allTargets.length} cached files`);
    
    return allTargets;
  }

  private async matchFilesWithCompanies(
    allTargets: Array<Omit<SECFilingTarget, "companyId">>,
    companyLookup: Map<string, { id: string; name: string }>
  ): Promise<SECFilingTarget[]> {
    const enriched: SECFilingTarget[] = [];

    for (const target of allTargets) {
      const company = companyLookup.get(target.cik);
      if (company) {
        enriched.push({
          ...target,
          companyId: company.id,
          companyName: company.name,
        });
      }
    }
    
    logger.info(`Matched ${enriched.length} targets (skipped ${allTargets.length - enriched.length})`);
    
    return enriched;
  }

  private async scanDirectory(
    cacheDir: string,
    exhibitType: string
  ): Promise<Array<Omit<SECFilingTarget, "companyId">>> {
    const targets: Array<Omit<SECFilingTarget, "companyId">> = [];

    try {
      await fs.access(cacheDir);
    } catch {
      console.log(`   ⚠️  Cache directory not found: ${cacheDir}`);
      logger.warn(`Cache directory not found: ${cacheDir}`);
      return [];
    }

    const files = await fs.readdir(cacheDir);

    for (const filename of files) {
      if (!filename.endsWith(".htm.gz")) continue;

      const cachePath = path.join(cacheDir, filename);

      // Parse filename: Archives_edgar_data_{cik}_{accession}_{filename}.htm.gz
      const parts = filename.replace(".htm.gz", "").split("_");

      if (
        parts.length >= 6 &&
        parts[0] === "Archives" &&
        parts[1] === "edgar" &&
        parts[2] === "data"
      ) {
        const cik = parts[3].padStart(10, "0");
        const accession = parts[4];
        // Reconstruct URL: first 5 parts are path segments, rest is the filename
        const pathSegments = parts.slice(0, 5); // Archives, edgar, data, cik, accession
        const filenameParts = parts.slice(5); // Everything after accession is the filename
        const originalFilename = filenameParts.join("_") + ".htm";
        const url = `https://www.sec.gov/${pathSegments.join("/")}/${originalFilename}`;

        targets.push({
          accessionNumber: accession,
          cik,
          exhibitType,
          cachePath,
          url,
        });
      }
    }

    return targets;
  }

  private async exportTargetsToExcel(targets: SECFilingTarget[]): Promise<void> {
    const excelPath = path.join(__dirname, "../../../logs/pipeline-targets.xlsx");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Targets");

    worksheet.columns = [
      { header: "Accession Number", key: "accessionNumber", width: 25 },
      { header: "CIK", key: "cik", width: 15 },
      { header: "Company Name", key: "companyName", width: 40 },
      { header: "Exhibit Type", key: "exhibitType", width: 15 },
      { header: "URL", key: "url", width: 60 },
      { header: "Cache Path", key: "cachePath", width: 50 },
    ];

    targets.forEach((target) => {
      worksheet.addRow({
        accessionNumber: target.accessionNumber,
        cik: target.cik,
        companyName: target.companyName,
        exhibitType: target.exhibitType,
        cachePath: target.cachePath,
        url: target.url,
      });
    });
    
    await workbook.xlsx.writeFile(excelPath);
    logger.info(`Exported ${targets.length} targets to Excel: ${excelPath}`);
  }
}
