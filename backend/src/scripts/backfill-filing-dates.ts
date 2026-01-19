#!/usr/bin/env bun

/**
 * Backfill Filing Dates Script
 * 
 * This script extracts correct filing dates and period of report from SEC filing URLs
 * and updates the filing records with the correct information.
 * 
 * Usage: bun run src/scripts/backfill-filing-dates.ts [--dry-run] [--limit=N]
 */

import { db } from "../db/client";
import { logger } from "../utils/logger";

interface FilingRecord {
  id: string;
  accession_number: string;
  file_url: string;
  form_type: string;
  filing_date?: string;
  period_of_report?: string;
  source_quarter?: number;
  source_year?: number;
}

interface ExtractedDates {
  filing_date: string;
  period_of_report: string | null;
  source_quarter: number;
  source_year: number;
}

/**
 * Extract filing date and period of report from SEC filing URL
 * SEC URLs contain the filing information in the HTML content
 */
async function extractDatesFromSecUrl(fileUrl: string): Promise<ExtractedDates | null> {
  try {
    logger.info(`Fetching filing data from: ${fileUrl}`);
    
    // Add delay to respect SEC rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const response = await fetch(fileUrl, {
      headers: {
        'User-Agent': 'Financial Graph Research Tool (contact@example.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    });

    if (!response.ok) {
      logger.warn(`Failed to fetch ${fileUrl}: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();
    
    // Extract filing date from SEC HTML
    // Look for patterns like "FILED AS OF DATE:" or "FILING DATE:"
    const filingDateMatch = html.match(/(?:FILED AS OF DATE|FILING DATE):\s*(\d{4}-\d{2}-\d{2}|\d{8})/i);
    let filingDate: string | null = null;
    
    if (filingDateMatch) {
      const dateStr = filingDateMatch[1];
      if (dateStr.length === 8) {
        // Convert YYYYMMDD to YYYY-MM-DD
        filingDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      } else {
        filingDate = dateStr;
      }
    }

    // Extract period of report (period end date)
    // Look for patterns like "CONFORMED PERIOD OF REPORT:" or "PERIOD OF REPORT:"
    const periodMatch = html.match(/(?:CONFORMED PERIOD OF REPORT|PERIOD OF REPORT):\s*(\d{4}-\d{2}-\d{2}|\d{8})/i);
    let periodOfReport: string | null = null;
    
    if (periodMatch) {
      const dateStr = periodMatch[1];
      if (dateStr.length === 8) {
        // Convert YYYYMMDD to YYYY-MM-DD
        periodOfReport = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      } else {
        periodOfReport = dateStr;
      }
    }

    if (!filingDate) {
      logger.warn(`Could not extract filing date from ${fileUrl}`);
      return null;
    }

    // Calculate source quarter and year from filing date
    const filingDateObj = new Date(filingDate);
    const sourceYear = filingDateObj.getFullYear();
    const sourceQuarter = Math.ceil((filingDateObj.getMonth() + 1) / 3);

    return {
      filing_date: filingDate,
      period_of_report: periodOfReport,
      source_quarter: sourceQuarter,
      source_year: sourceYear,
    };

  } catch (error) {
    logger.error(`Error extracting dates from ${fileUrl}:`, error);
    return null;
  }
}

/**
 * Update filing record with extracted dates
 */
async function updateFilingRecord(filingId: string, dates: ExtractedDates, dryRun: boolean): Promise<boolean> {
  try {
    if (dryRun) {
      logger.info(`[DRY RUN] Would update filing ${filingId} with:`);
      logger.info(`  - filing_date: ${dates.filing_date}`);
      logger.info(`  - period_of_report: ${dates.period_of_report || 'null'}`);
      logger.info(`  - source_quarter: ${dates.source_quarter}`);
      logger.info(`  - source_year: ${dates.source_year}`);
      return true;
    }

    await db.transact([
      db.tx.filing[filingId].update({
        filing_date: dates.filing_date,
        period_of_report: dates.period_of_report,
        source_quarter: dates.source_quarter,
        source_year: dates.source_year,
        updated_at: new Date().toISOString(),
      })
    ]);

    logger.info(`Updated filing ${filingId} with new dates`);
    return true;
  } catch (error) {
    logger.error(`Error updating filing ${filingId}:`, error);
    return false;
  }
}

/**
 * Main backfill function
 */
async function backfillFilingDates(options: { dryRun: boolean; limit?: number }) {
  const { dryRun, limit } = options;
  
  logger.info(`Starting filing dates backfill (dry-run: ${dryRun}, limit: ${limit || 'none'})`);

  try {
    // Query all filings that need date correction
    const query = {
      filing: {
        $: limit ? { limit } : {},
      }
    };

    logger.info('Querying filings from database...');
    const result = await db.query(query);
    
    if (!result || !result.filing) {
      logger.error('No filing data returned from database query');
      throw new Error('Failed to query filings from database');
    }

    const filings = result.filing as FilingRecord[];
    logger.info(`Found ${filings.length} filings to process`);

    if (filings.length === 0) {
      logger.warn('No filings found in database');
      return;
    }

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const filing of filings) {
      processed++;
      
      logger.info(`Processing ${processed}/${filings.length}: ${filing.accession_number} (${filing.form_type})`);

      if (!filing.file_url) {
        logger.warn(`Filing ${filing.id} has no file_url, skipping`);
        errors++;
        continue;
      }

      // Extract dates from SEC URL
      const extractedDates = await extractDatesFromSecUrl(filing.file_url);
      
      if (!extractedDates) {
        errors++;
        logger.warn(`Failed to extract dates for filing ${filing.id}`);
        continue;
      }

      // Check if we need to update (compare with existing data)
      const needsUpdate = (
        filing.filing_date !== extractedDates.filing_date ||
        filing.period_of_report !== extractedDates.period_of_report ||
        filing.source_quarter !== extractedDates.source_quarter ||
        filing.source_year !== extractedDates.source_year
      );

      if (!needsUpdate) {
        logger.info(`Filing ${filing.id} already has correct dates, skipping`);
        continue;
      }

      // Update the filing record
      const success = await updateFilingRecord(filing.id, extractedDates, dryRun);
      if (success) {
        updated++;
      } else {
        errors++;
      }

      // Add delay between requests to respect rate limits
      if (processed % 10 === 0) {
        logger.info(`Processed ${processed} filings, taking a short break...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Backfill completed:`);
    logger.info(`- Processed: ${processed} filings`);
    logger.info(`- Updated: ${updated} filings`);
    logger.info(`- Errors: ${errors} filings`);

  } catch (error) {
    logger.error('Error during backfill:', error);
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// Run the backfill
backfillFilingDates({ dryRun, limit })
  .then(() => {
    logger.info('Backfill script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Backfill script failed:', error);
    process.exit(1);
  });