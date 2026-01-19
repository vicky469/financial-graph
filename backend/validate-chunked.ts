#!/usr/bin/env node

/**
 * Chunked Validation Tool
 * 
 * Processes subsidiaries in configurable chunks with progress tracking
 */

import * as fs from 'fs';
import { DeepSeekValidationService } from './src/validation/deepseek-validator';
import { createLogger } from './src/utils/logger';
import { validateSubsidiary } from './src/validation/subsidiary-validator';

const logger = createLogger('ChunkedValidator');

interface ValidationConfig {
  chunkSize: number;
  maxRecords?: number;
  startFrom?: number;
  outputFile: string;
}

async function validateChunked(config: ValidationConfig) {
  try {
    logger.info('🚀 Starting chunked validation');
    logger.info(`📊 Config: chunk=${config.chunkSize}, max=${config.maxRecords || 'all'}, start=${config.startFrom || 0}`);
    
    const validator = new DeepSeekValidationService();
    await validator.initializePatterns('subsidiaries_SUCCESS.csv');
    
    // Read and parse CSV
    const csvContent = fs.readFileSync('subsidiaries_SUCCESS.csv', 'utf-8');
    const lines = csvContent.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const totalRecords = lines.length - 1;
    const startIndex = (config.startFrom || 0) + 1; // +1 for header
    const maxRecords = config.maxRecords || totalRecords;
    const endIndex = Math.min(startIndex + maxRecords, lines.length);
    
    logger.info(`📊 Total records in CSV: ${totalRecords}`);
    logger.info(`📊 Processing records ${startIndex - 1} to ${endIndex - 2} (${endIndex - startIndex} records)`);
    
    // Estimate time
    const recordsToProcess = endIndex - startIndex;
    const estimatedMinutes = (recordsToProcess * 2 * 1.5) / 60; // 2 prompts per record, 1.5s per prompt
    logger.info(`⏱️  Estimated time: ${estimatedMinutes.toFixed(1)} minutes`);
    
    // Initialize output file with headers
    const outputHeaders = [...headers, 'qualityScore', 'needsReview', 'flaggedIssues', 'issueTypes'];
    fs.writeFileSync(config.outputFile, outputHeaders.join(',') + '\n');
    logger.info(`📄 Created output file: ${config.outputFile}`);
    
    // Process in chunks
    let processedCount = 0;
    let flaggedCount = 0;
    const startTime = Date.now();
    
    for (let i = startIndex; i < endIndex; i += config.chunkSize) {
      const chunkEnd = Math.min(i + config.chunkSize, endIndex);
      const chunkLines = lines.slice(i, chunkEnd);
      
      logger.info(`🔄 Chunk ${Math.floor((i - startIndex) / config.chunkSize) + 1}/${Math.ceil((endIndex - startIndex) / config.chunkSize)} - Records ${i - 1} to ${chunkEnd - 2}`);
      
      const chunkStartTime = Date.now();
      const chunkResults: string[] = [];
      
      for (let j = 0; j < chunkLines.length; j++) {
        const line = chunkLines[j];
        if (!line.trim()) continue;
        
        const columns = parseCSVLine(line);
        if (columns.length < 5) continue;
        
        const subsidiary = {
          name: columns[3] || '',
          jurisdiction: columns[4] || ''
        };
        
        // Check for header rows that got mixed into the data
        const isHeaderRow = 
          subsidiary.jurisdiction.toLowerCase().includes('jurisdiction of incorporation') ||
          subsidiary.jurisdiction.toLowerCase().includes('jurisdiction of organization') ||
          subsidiary.jurisdiction.toLowerCase().includes('state of incorporation') ||
          subsidiary.jurisdiction.toLowerCase().includes('country of incorporation');
          
        if (isHeaderRow) {
          logger.info(`🚨 FLAGGED: Header row detected - "${subsidiary.name}" | "${subsidiary.jurisdiction}"`);
          
          const enhancedColumns = [
            ...columns.map(formatCSVField),
            "0", // qualityScore
            "true", // needsReview
            formatCSVField("Header row detected in data - should be filtered during data processing"),
            formatCSVField("CRITICAL:data_quality")
          ];
          
          chunkResults.push(enhancedColumns.join(','));
          processedCount++;
          flaggedCount++;
          continue;
        }
        
        // Check for obvious data corruption: jurisdiction field contains company name
        const jurisdictionTooLong = subsidiary.jurisdiction.length > 50;
        const jurisdictionLooksLikeCompanyName = 
          subsidiary.jurisdiction.toLowerCase().includes('inc') ||
          subsidiary.jurisdiction.toLowerCase().includes('corp') ||
          subsidiary.jurisdiction.toLowerCase().includes('llc') ||
          subsidiary.jurisdiction.toLowerCase().includes('ltd') ||
          subsidiary.jurisdiction.toLowerCase().includes('limited') ||
          subsidiary.jurisdiction.toLowerCase().includes('company') ||
          subsidiary.jurisdiction.toLowerCase().includes('corporation');
          
        if (jurisdictionTooLong || jurisdictionLooksLikeCompanyName) {
          logger.info(`🚨 DATA CORRUPTION: "${subsidiary.name}" | Jurisdiction: "${subsidiary.jurisdiction}" (${subsidiary.jurisdiction.length} chars)`);
        }
        
        // Rule-based validation using abstracted logic
        const validationResult = validateSubsidiary({
          name: subsidiary.name,
          jurisdiction: subsidiary.jurisdiction
        });
        
        // Log flagged records
        if (validationResult.needsReview) {
          flaggedCount++;
          logger.info(`🚨 FLAGGED: "${subsidiary.name}" | "${subsidiary.jurisdiction}" | Score: ${validationResult.qualityScore}`);
          validationResult.issues.forEach(issue => {
            logger.info(`   ⚠️  ${issue}`);
          });
        }
        
        // Create enhanced record - ensure we match the header column count
        const flaggedIssues = validationResult.issues.join('; ');
        const issueTypesStr = validationResult.issueTypes.join('; ');
        
        // Pad columns to match header length (10 columns) if needed
        while (columns.length < 10) {
          columns.push('');
        }
        
        const enhancedColumns = [
          ...columns.map(formatCSVField), // Properly format each field
          validationResult.qualityScore.toString(),
          validationResult.needsReview.toString(),
          formatCSVField(flaggedIssues),
          formatCSVField(issueTypesStr)
        ];
        
        chunkResults.push(enhancedColumns.join(','));
        processedCount++;
        
        // Log progress every 25 records
        if (processedCount % 25 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = processedCount / elapsed;
          const remaining = recordsToProcess - processedCount;
          const eta = remaining / rate;
          
          logger.info(`📈 Progress: ${processedCount}/${recordsToProcess} (${((processedCount / recordsToProcess) * 100).toFixed(1)}%) - ETA: ${(eta / 60).toFixed(1)}min - Flagged: ${flaggedCount}`);
        }
      }
      
      // Append chunk results to file immediately
      if (chunkResults.length > 0) {
        fs.appendFileSync(config.outputFile, chunkResults.join('\n') + '\n');
      }
      
      const chunkDuration = (Date.now() - chunkStartTime) / 1000;
      logger.info(`✅ Chunk completed in ${chunkDuration.toFixed(1)}s - ${chunkResults.length} records appended`);
    }
    
    const totalDuration = (Date.now() - startTime) / 1000;
    logger.info(`\n🎉 Chunked validation completed!`);
    logger.info(`   📊 Total records processed: ${processedCount}`);
    logger.info(`   🚨 Total flagged records: ${flaggedCount} (${((flaggedCount / processedCount) * 100).toFixed(1)}%)`);
    logger.info(`   ⏱️  Total time: ${(totalDuration / 60).toFixed(1)} minutes`);
    logger.info(`   📈 Average rate: ${(processedCount / totalDuration).toFixed(2)} records/second`);
    logger.info(`   💾 Output: ${config.outputFile}`);
    
  } catch (error: any) {
    logger.error('❌ Chunked validation failed', { error: error.message });
    process.exit(1);
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  const config: ValidationConfig = {
    chunkSize: parseInt(args[0]) || 50,
    maxRecords: args[1] ? parseInt(args[1]) : undefined,
    startFrom: args[2] ? parseInt(args[2]) : undefined,
    outputFile: args[3] || 'subsidiaries_CHUNKED_VALIDATED.csv'
  };
  
  logger.info('🎯 Chunked Validation Tool');
  logger.info('Usage: bun validate-chunked.ts [chunkSize] [maxRecords] [startFrom] [outputFile]');
  logger.info('Example: bun validate-chunked.ts 100 1000 0 output.csv');
  logger.info('');
  
  await validateChunked(config);
}

// Helper method for proper CSV parsing
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result.map(field => field.replace(/^"|"$/g, '')); // Remove surrounding quotes
}

// Helper method for proper CSV writing - adds quotes when needed
function formatCSVField(field: string): string {
  // Add quotes if field contains comma, quote, or newline
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    // Escape any existing quotes by doubling them
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return field;
}

if (require.main === module) {
  main();
}