/**
 * Failed Records Utility (Node.js)
 * 
 * Handles saving failed records during ingestion/processing.
 * Uses the shared interface for consistency.
 */

import fs from "fs/promises";
import path from "path";
import {
  type FailedRecord,
  type FailedRecordOptions,
  getFailedRecordPath,
  createFailedRecord,
} from "@financial-graph/shared";

const FAILED_RECORDS_BASE_DIR = path.resolve(__dirname, "../../logs/failed-records");

/**
 * Save a failed record to disk
 * 
 * @param context - Context/module name (e.g., 'ticker-ingestion')
 * @param identifier - Unique identifier for the record (e.g., CIK, accession number)
 * @param data - The data that failed to process
 * @param error - The error that occurred
 */
export async function saveFailedRecord<T>(
  context: string,
  identifier: string | number,
  data: T,
  error: Error | string
): Promise<string> {
  const record = createFailedRecord(context, identifier, data, error);
  
  const options: FailedRecordOptions = {
    baseDir: FAILED_RECORDS_BASE_DIR,
    context,
  };
  
  const filePath = getFailedRecordPath(options);
  const fullPath = path.resolve(filePath);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  
  // Save record
  await fs.writeFile(fullPath, JSON.stringify(record, null, 2));
  
  return fullPath;
}

/**
 * Save multiple failed records to a single file
 * 
 * @param context - Context/module name
 * @param records - Array of failed records
 */
export async function saveFailedRecordsBatch<T>(
  context: string,
  records: Array<{ identifier: string | number; data: T; error: Error | string }>
): Promise<string> {
  const failedRecords = records.map((r) =>
    createFailedRecord(context, r.identifier, r.data, r.error)
  );
  
  const options: FailedRecordOptions = {
    baseDir: FAILED_RECORDS_BASE_DIR,
    context,
  };
  
  const filePath = getFailedRecordPath(options);
  const fullPath = path.resolve(filePath);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  
  // Save records
  await fs.writeFile(fullPath, JSON.stringify(failedRecords, null, 2));
  
  return fullPath;
}

/**
 * Clean up old failed records (older than retention days)
 * 
 * @param retentionDays - Number of days to keep failed records (default: 7)
 */
export async function cleanupFailedRecords(retentionDays: number = 7): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  try {
    const contexts = await fs.readdir(FAILED_RECORDS_BASE_DIR);
    
    for (const context of contexts) {
      const contextDir = path.join(FAILED_RECORDS_BASE_DIR, context);
      const stat = await fs.stat(contextDir);
      
      if (!stat.isDirectory()) continue;
      
      const dates = await fs.readdir(contextDir);
      
      for (const dateStr of dates) {
        const dateDir = path.join(contextDir, dateStr);
        const dateStat = await fs.stat(dateDir);
        
        if (!dateStat.isDirectory()) continue;
        
        // Parse date from directory name (YYYY-MM-DD)
        const dirDate = new Date(dateStr);
        
        if (dirDate < cutoffDate) {
          await fs.rm(dateDir, { recursive: true, force: true });
          console.log(`Cleaned up old failed records: ${dateDir}`);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up failed records:", error);
  }
}
