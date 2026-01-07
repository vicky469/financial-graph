/**
 * Utility script to inspect nested subsidiary structures from saved URLs
 * 
 * This script reads the nested_subsidiaries_urls.json file and provides
 * detailed analysis of the hierarchical structures found.
 */

import fs from "fs/promises";
import path from "path";
import { parseNestedSubsidiaries } from "../parsers/nested-subsidiary-parser";
import { createLogger } from "./logger";
import "dotenv/config";

const logger = createLogger("utils/inspect-nested");

interface NestedFilingInfo {
  accession_number: string;
  url: string;
  nested_subsidiaries_count: number;
  max_nesting_level: number;
  extraction_method: string;
  structure_confidence: number;
  table_count: number;
  row_count: number;
  analysis_timestamp: string;
}

interface NestedUrlsFile {
  summary: {
    total_filings_with_nested: number;
    total_nested_subsidiaries: number;
    max_nesting_level_found: number;
    generated_at: string;
  };
  filings: NestedFilingInfo[];
}

async function loadNestedUrlsFile(): Promise<NestedUrlsFile | null> {
  const filePath = path.resolve(__dirname, "../../nested_subsidiaries_urls.json");
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.error(`Failed to load nested URLs file: ${error}`);
    return null;
  }
}

async function fetchAndAnalyzeFiling(url: string, accession: string): Promise<void> {
  try {
    logger.info(`\n=== Analyzing ${accession} ===`);
    logger.info(`URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': process.env.SEC_USER_AGENT || 'Mozilla/5.0 (compatible; NestedSubsidiaryAnalyzer/1.0)'
      }
    });

    if (!response.ok) {
      logger.error(`Failed to fetch ${accession}: HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    const result = parseNestedSubsidiaries(html);

    if (!result) {
      logger.warn(`No nested structure found for ${accession}`);
      return;
    }

    logger.info(`Found ${result.subsidiaries.length} total subsidiaries`);
    logger.info(`Nested subsidiaries: ${result.subsidiaries.filter(s => s.isNestedSubsidiary).length}`);
    logger.info(`Maximum nesting level: ${result.maxNestingLevel}`);

    // Show hierarchy structure
    logger.info("\nHierarchy Structure:");
    const topLevel = result.subsidiaries.filter(s => s.nestingLevel === 0);
    
    topLevel.forEach(parent => {
      logger.info(`📁 ${parent.name} (${parent.jurisdiction})`);
      showChildren(result.subsidiaries, parent.name, 1);
    });

    // Show subsidiaries with footnotes
    const withFootnotes = result.subsidiaries.filter(s => s.footnotes.length > 0);
    if (withFootnotes.length > 0) {
      logger.info("\nSubsidiaries with Footnotes:");
      withFootnotes.forEach(sub => {
        logger.info(`  ${sub.name} - [${sub.footnotes.join(', ')}]`);
      });
    }

    // Show nesting level distribution
    const levelCounts = new Map<number, number>();
    result.subsidiaries.forEach(sub => {
      levelCounts.set(sub.nestingLevel, (levelCounts.get(sub.nestingLevel) || 0) + 1);
    });

    logger.info("\nNesting Level Distribution:");
    Array.from(levelCounts.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([level, count]) => {
        logger.info(`  Level ${level}: ${count} subsidiaries`);
      });

  } catch (error) {
    logger.error(`Error analyzing ${accession}: ${error}`);
  }
}

function showChildren(subsidiaries: any[], parentName: string, level: number): void {
  const children = subsidiaries.filter(s => s.parentCompany === parentName);
  const indent = "  ".repeat(level);
  
  children.forEach(child => {
    const footnoteStr = child.footnotes.length > 0 ? ` [${child.footnotes.join(', ')}]` : '';
    logger.info(`${indent}└─ ${child.name} (${child.jurisdiction})${footnoteStr}`);
    
    // Recursively show children of this child
    showChildren(subsidiaries, child.name, level + 1);
  });
}

async function inspectTopNestedFilings(limit: number = 5): Promise<void> {
  const data = await loadNestedUrlsFile();
  
  if (!data) {
    logger.error("Could not load nested URLs file. Run the analysis first.");
    return;
  }

  logger.info("=".repeat(60));
  logger.info("NESTED SUBSIDIARIES INSPECTION REPORT");
  logger.info("=".repeat(60));
  
  logger.info(`\nSummary from ${data.summary.generated_at}:`);
  logger.info(`  Total filings with nested structures: ${data.summary.total_filings_with_nested}`);
  logger.info(`  Total nested subsidiaries found: ${data.summary.total_nested_subsidiaries}`);
  logger.info(`  Maximum nesting level found: ${data.summary.max_nesting_level_found}`);

  // Sort by nested subsidiaries count (descending) and take top N
  const topFilings = data.filings
    .sort((a, b) => b.nested_subsidiaries_count - a.nested_subsidiaries_count)
    .slice(0, limit);

  logger.info(`\nInspecting top ${limit} filings with most nested subsidiaries:`);
  
  for (const filing of topFilings) {
    await fetchAndAnalyzeFiling(filing.url, filing.accession_number);
    
    // Add delay to be respectful to SEC servers
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function inspectSpecificFiling(accession: string): Promise<void> {
  const data = await loadNestedUrlsFile();
  
  if (!data) {
    logger.error("Could not load nested URLs file. Run the analysis first.");
    return;
  }

  const filing = data.filings.find(f => f.accession_number === accession);
  
  if (!filing) {
    logger.error(`Filing ${accession} not found in nested subsidiaries list`);
    return;
  }

  await fetchAndAnalyzeFiling(filing.url, filing.accession_number);
}

async function showNestedSummary(): Promise<void> {
  const data = await loadNestedUrlsFile();
  
  if (!data) {
    logger.error("Could not load nested URLs file. Run the analysis first.");
    return;
  }

  logger.info("=".repeat(50));
  logger.info("NESTED SUBSIDIARIES SUMMARY");
  logger.info("=".repeat(50));
  
  logger.info(`Generated: ${data.summary.generated_at}`);
  logger.info(`Total filings with nested structures: ${data.summary.total_filings_with_nested}`);
  logger.info(`Total nested subsidiaries: ${data.summary.total_nested_subsidiaries}`);
  logger.info(`Maximum nesting level: ${data.summary.max_nesting_level_found}`);

  // Show distribution by nesting level
  const levelDistribution = new Map<number, number>();
  data.filings.forEach(filing => {
    levelDistribution.set(
      filing.max_nesting_level, 
      (levelDistribution.get(filing.max_nesting_level) || 0) + 1
    );
  });

  logger.info("\nDistribution by Maximum Nesting Level:");
  Array.from(levelDistribution.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([level, count]) => {
      logger.info(`  Level ${level}: ${count} filings`);
    });

  // Show top 10 filings by nested count
  const top10 = data.filings
    .sort((a, b) => b.nested_subsidiaries_count - a.nested_subsidiaries_count)
    .slice(0, 10);

  logger.info("\nTop 10 Filings by Nested Subsidiary Count:");
  top10.forEach((filing, index) => {
    logger.info(`  ${index + 1}. ${filing.accession_number}: ${filing.nested_subsidiaries_count} nested (max level: ${filing.max_nesting_level})`);
  });
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'summary':
      await showNestedSummary();
      break;
    
    case 'inspect':
      const limit = parseInt(args[1]) || 5;
      await inspectTopNestedFilings(limit);
      break;
    
    case 'filing':
      const accession = args[1];
      if (!accession) {
        logger.error("Please provide an accession number: npm run inspect-nested filing <accession>");
        process.exit(1);
      }
      await inspectSpecificFiling(accession);
      break;
    
    default:
      logger.info("Usage:");
      logger.info("  npm run inspect-nested summary           - Show summary statistics");
      logger.info("  npm run inspect-nested inspect [N]       - Inspect top N filings (default: 5)");
      logger.info("  npm run inspect-nested filing <accession> - Inspect specific filing");
      break;
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error("Inspection failed:", error);
    process.exit(1);
  });
}

export { inspectTopNestedFilings, inspectSpecificFiling, showNestedSummary };