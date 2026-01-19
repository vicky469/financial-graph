#!/usr/bin/env node

/**
 * Standalone CSV Validation Tool with DeepSeek API
 * 
 * Processes subsidiaries_SUCCESS.csv using DeepSeek API with pattern learning to flag suspicious entries.
 * Usage: npm run validate-csv [input-file] [output-file]
 */

import * as fs from 'fs';
import { DeepSeekValidationService } from '../validation/deepseek-validator';
import { createLogger } from '../utils/logger';

const logger = createLogger('CSVValidator');

interface SubsidiaryRecord {
  name: string;
  jurisdiction: string;
  parentId?: string;
  [key: string]: any; // Allow additional CSV columns
}

interface ValidationSummary {
  totalRecords: number;
  validRecords: number;
  flaggedRecords: number;
  avgQualityScore: number;
  issueBreakdown: Record<string, number>;
  llmUsed: boolean;
}

class DeepSeekCSVValidator {
  private validationService: DeepSeekValidationService;

  constructor() {
    this.validationService = new DeepSeekValidationService();
  }

  async validateCSV(inputPath: string, outputPath: string): Promise<ValidationSummary> {
    logger.info('🧠 Learning patterns from existing data...');
    await this.validationService.initializePatterns(inputPath);

    const csvContent = fs.readFileSync(inputPath, 'utf-8');
    const lines = csvContent.split('\n');
    const headers = this.parseCSVLine(lines[0]);
    
    // Add new columns for validation results
    const enhancedHeaders = [...headers, 'qualityScore', 'needsReview', 'flaggedIssues', 'issueTypes'];
    
    const enhancedRecords: string[] = [enhancedHeaders.join(',')];
    const summary: ValidationSummary = {
      totalRecords: 0,
      validRecords: 0,
      flaggedRecords: 0,
      avgQualityScore: 0,
      issueBreakdown: {},
      llmUsed: true // Always true since we use the shared service
    };

    let totalQualityScore = 0;
    const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
    const jurisdictionIndex = headers.findIndex(h => h.toLowerCase().includes('jurisdiction'));

    logger.info(`🚀 Processing records with DeepSeek API...`);
    
    // Process in chunks for better performance
    const chunkSize = 100;
    for (let i = 1; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      const chunkRecords: SubsidiaryRecord[] = [];
      const originalLines: string[] = [];
      
      for (const line of chunk) {
        if (!line.trim()) continue;
        
        const columns = this.parseCSVLine(line);
        if (columns.length <= Math.max(nameIndex, jurisdictionIndex)) continue;

        chunkRecords.push({
          name: columns[nameIndex] || '',
          jurisdiction: columns[jurisdictionIndex] || ''
        });
        originalLines.push(line);
      }

      // Validate chunk with shared validation service
      const assessments = await this.validateChunk(chunkRecords);
      
      // Process results
      for (let j = 0; j < assessments.length; j++) {
        const assessment = assessments[j];
        const originalColumns = this.parseCSVLine(originalLines[j]);
        
        summary.totalRecords++;
        totalQualityScore += assessment.score;
        
        if (assessment.needsReview) {
          summary.flaggedRecords++;
        } else {
          summary.validRecords++;
        }

        // Count issue types
        for (const issue of assessment.issues) {
          const key = `${issue.type}_${issue.field}`;
          summary.issueBreakdown[key] = (summary.issueBreakdown[key] || 0) + 1;
        }

        // Create enhanced record
        const flaggedIssues = assessment.issues.map(i => i.message).join('; ');
        const issueTypes = assessment.issues.map(i => `${i.type}:${i.field}`).join('; ');
        
        const enhancedColumns = [
          ...originalColumns,
          assessment.score.toString(),
          assessment.needsReview.toString(),
          `"${flaggedIssues}"`,
          `"${issueTypes}"`
        ];
        
        enhancedRecords.push(enhancedColumns.join(','));
      }

      if (i % 1000 === 0) {
        logger.info(`📈 Processed ${i} records...`);
      }
    }

    summary.avgQualityScore = summary.totalRecords > 0 ? totalQualityScore / summary.totalRecords : 0;

    // Write enhanced CSV
    fs.writeFileSync(outputPath, enhancedRecords.join('\n'));
    
    logger.info('📊 Validation Summary:');
    logger.info(`   LLM Used: ${summary.llmUsed ? 'Yes (DeepSeek API)' : 'No (Fallback)'}`);
    logger.info(`   Total Records: ${summary.totalRecords}`);
    logger.info(`   Valid Records: ${summary.validRecords}`);
    logger.info(`   Flagged Records: ${summary.flaggedRecords}`);
    logger.info(`   Average Quality Score: ${summary.avgQualityScore.toFixed(2)}`);
    logger.info(`   Output written to: ${outputPath}`);

    return summary;
  }

  private async validateChunk(records: SubsidiaryRecord[]) {
    const assessments = [];
    
    // Create a simple context for CSV validation
    const patterns = this.validationService.getPatterns();
    const context = {
      sampleNames: patterns.companyNames.samples,
      sampleJurisdictions: patterns.jurisdictions.samples,
      filingContext: `CSV validation batch with ${records.length} records`
    };
    
    // Validate each record using the shared service
    for (const record of records) {
      const assessment = await this.validationService.assessSubsidiaryQuality(record, context);
      assessments.push(assessment);
    }

    return assessments;
  }

  private parseCSVLine(line: string): string[] {
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
    return result.map(field => field.replace(/^"|"$/g, ''));
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || 'subsidiaries_SUCCESS.csv';
  const outputFile = args[1] || 'subsidiaries_VALIDATED.csv';

  if (!fs.existsSync(inputFile)) {
    logger.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    logger.info(`🚀 Starting CSV validation`);
    logger.info(`   Input: ${inputFile}`);
    logger.info(`   Output: ${outputFile}`);
    
    const validator = new DeepSeekCSVValidator();
    await validator.validateCSV(inputFile, outputFile);
    
    logger.info('✅ Validation completed successfully');
  } catch (error: any) {
    logger.error('❌ Validation failed', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DeepSeekCSVValidator };