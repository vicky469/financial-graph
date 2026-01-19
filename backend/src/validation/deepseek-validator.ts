/**
 * Shared DeepSeek API Validation Service
 * 
 * Common validation logic used by both pipeline steps and standalone tools
 */

import { createLogger } from "../utils/logger";
import { ValidationIssue, QualityAssessment } from "../pipeline/subsidiaries/types";
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('DeepSeekValidator');

export interface ValidationPrompt {
  type: 'COMPANY_NAME' | 'JURISDICTION';
  value: string;
  context: string;
  prompt: string;
}

export interface ValidationResponse {
  isValid: boolean;
  confidence: number;
  reason: string;
}

export interface PatternContext {
  sampleNames: string[];
  sampleJurisdictions: string[];
  filingContext: string;
}

export interface LearnedPatterns {
  jurisdictions: {
    samples: string[];
    commonPatterns: string[];
    lengthStats: { min: number; max: number; avg: number };
  };
  companyNames: {
    samples: string[];
    commonSuffixes: string[];
    lengthStats: { min: number; max: number; avg: number };
  };
  qualityThresholds: {
    critical: number;
    warning: number;
  };
}

export class DeepSeekValidationService {
  private apiKey: string;
  private apiUrl: string = 'https://api.deepseek.com/v1/chat/completions';
  private modelName: string = 'deepseek-chat'; // DeepSeek-V3.2-Exp (non-thinking mode)
  private patterns: LearnedPatterns | null = null;
  private batchConfig = {
    chunkSize: 50,        // Process 50 subsidiaries per chunk
    maxConcurrency: 20,   // Increased for high performance (was 15)
    batchSize: 40,        // Larger batch size for efficiency (was 30)
    timeout: 20000,       // Reduced timeout for faster failure detection (was 25s)
  };

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('DEEPSEEK_API_KEY not found in environment variables');
    } else {
      logger.info('DeepSeek V3.2-Exp API client initialized successfully (deepseek-chat endpoint)');
    }
  }

  async initializePatterns(csvPath?: string): Promise<void> {
    if (this.patterns) return; // Already initialized

    try {
      if (csvPath && fs.existsSync(csvPath)) {
        this.patterns = await this.analyzeExistingData(csvPath);
        logger.info(`🧠 Learned patterns from ${csvPath}: ${this.patterns.jurisdictions.samples.length} jurisdiction samples, ${this.patterns.companyNames.samples.length} company name samples`);
      } else {
        this.patterns = this.getMinimalFallback();
        logger.info('🧠 Using minimal fallback patterns');
      }
    } catch (error: any) {
      logger.warn('Failed to learn patterns from existing data, using minimal fallback', { error: error.message });
      this.patterns = this.getMinimalFallback();
    }
  }

  private async analyzeExistingData(csvPath: string): Promise<LearnedPatterns> {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    
    const jurisdictions: string[] = [];
    const jurisdictionLengths: number[] = [];
    const companyNames: string[] = [];
    const companySuffixes: string[] = [];
    const nameLengths: number[] = [];

    // Parse CSV and extract patterns (sample for LLM context)
    for (const line of lines.slice(0, 10000)) { // Limit to first 10k for performance
      if (!line.trim()) continue;
      
      const columns = this.parseCSVLine(line);
      if (columns.length < 5) continue; // Need at least 5 columns for Subsidiary and Jurisdiction

      // Column indices: 0=Accession, 1=URL, 2=SubsidiaryId, 3=Subsidiary, 4=Jurisdiction
      const name = columns[3]; // Subsidiary column
      const jurisdiction = columns[4]; // Jurisdiction column
      
      if (name && name.trim()) {
        const trimmedName = name.trim();
        companyNames.push(trimmedName);
        nameLengths.push(trimmedName.length);
        
        // Extract suffixes for context
        const words = trimmedName.split(/\s+/);
        if (words.length > 1) {
          companySuffixes.push(words[words.length - 1]);
        }
      }

      if (jurisdiction && jurisdiction.trim()) {
        const trimmedJurisdiction = jurisdiction.trim();
        jurisdictions.push(trimmedJurisdiction);
        jurisdictionLengths.push(trimmedJurisdiction.length);
      }
    }

    // Calculate statistics
    const nameStats = this.calculateStats(nameLengths);
    const jurisdictionStats = this.calculateStats(jurisdictionLengths);

    // Build learned patterns for LLM context
    return {
      jurisdictions: {
        samples: this.getRandomSample(jurisdictions, 20), // Sample for LLM context
        commonPatterns: this.getMostCommon(jurisdictions, 10),
        lengthStats: jurisdictionStats,
      },
      companyNames: {
        samples: this.getRandomSample(companyNames, 20), // Sample for LLM context
        commonSuffixes: this.getMostCommon(companySuffixes, 10),
        lengthStats: nameStats,
      },
      qualityThresholds: {
        critical: 50,
        warning: 70
      }
    };
  }

  private getRandomSample<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getMostCommon<T>(array: T[], count: number): T[] {
    const frequency = new Map<T, number>();
    array.forEach(item => {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    });
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([item]) => item);
  }

  private calculateStats(lengths: number[]): { min: number; max: number; avg: number } {
    if (lengths.length === 0) return { min: 2, max: 200, avg: 25 };
    
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    const avg = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    
    return { min, max, avg };
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
    return result.map(field => field.replace(/^"|"$/g, '')); // Remove surrounding quotes
  }

  private getMinimalFallback(): LearnedPatterns {
    return {
      jurisdictions: {
        samples: ['Delaware', 'California', 'New York', 'United States'],
        commonPatterns: ['Delaware', 'California', 'New York', 'United States'],
        lengthStats: { min: 2, max: 50, avg: 10 }
      },
      companyNames: {
        samples: ['Apple Inc.', 'Microsoft Corporation', 'Google LLC', 'Amazon.com Inc.'],
        commonSuffixes: ['Inc', 'Corp', 'LLC', 'Ltd'],
        lengthStats: { min: 2, max: 200, avg: 25 }
      },
      qualityThresholds: { critical: 50, warning: 70 }
    };
  }

  getPatterns(): LearnedPatterns {
    if (!this.patterns) {
      throw new Error('DeepSeekValidationService not initialized. Call initializePatterns() first.');
    }
    return this.patterns;
  }

  buildContext(filingAccession: string, subsidiaries: any[]): PatternContext {
    const patterns = this.getPatterns();
    
    // Get sample names and jurisdictions from the same filing for context
    const filingNames = subsidiaries.map(sub => sub.name).filter(Boolean).slice(0, 5);
    const filingJurisdictions = subsidiaries.map(sub => sub.jurisdiction).filter(Boolean).slice(0, 5);
    
    return {
      sampleNames: [...filingNames, ...patterns.companyNames.samples.slice(0, 3)],
      sampleJurisdictions: [...filingJurisdictions, ...patterns.jurisdictions.samples.slice(0, 3)],
      filingContext: `Filing ${filingAccession} with ${subsidiaries.length} subsidiaries`
    };
  }

  createValidationPrompts(subsidiary: any, context: PatternContext): ValidationPrompt[] {
    const prompts: ValidationPrompt[] = [];

    // Jurisdiction validation prompt (more important - focus on data corruption)
    const jurisdictionPrompt = `Analyze if this is a valid jurisdiction: "${subsidiary.jurisdiction}"

Context: Other jurisdictions in this filing: ${context.sampleJurisdictions.join(', ')}
Additional context: ${context.filingContext}

CRITICAL: Check if this looks like a COMPANY NAME that was mistakenly copied to the jurisdiction field.
Valid jurisdictions are geographic locations like: Delaware, California, New York, United States, Canada, UK, Germany, etc.
Invalid: Company names, long descriptive text, corporate suffixes (Inc, Corp, LLC, Ltd).

Respond in JSON format:
{
  "valid": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation focusing on whether this is a geographic location or company name"
}`;

    prompts.push({
      type: 'JURISDICTION',
      value: subsidiary.jurisdiction,
      context: context.sampleJurisdictions.join(', '),
      prompt: jurisdictionPrompt
    });

    // Company name validation prompt (less strict - only flag obvious issues)
    const namePrompt = `Analyze if this is a reasonable company name: "${subsidiary.name}"

Context: Other company names in this filing: ${context.sampleNames.join(', ')}
Additional context: ${context.filingContext}

Only flag if the name is clearly suspicious (random characters, obvious errors, or header text).
Most legitimate company names should pass, even if they're unusual.

Respond in JSON format:
{
  "valid": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation - only flag obvious problems"
}`;

    prompts.push({
      type: 'COMPANY_NAME',
      value: subsidiary.name,
      context: context.sampleNames.join(', '),
      prompt: namePrompt
    });

    return prompts;
  }

  async validateBatch(prompts: ValidationPrompt[]): Promise<ValidationResponse[]> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY not found - DeepSeek API required for validation');
    }

    const startTime = Date.now();
    const responses: ValidationResponse[] = [];
    let processedCount = 0;
    
    // Process prompts in batches with concurrency control
    for (let i = 0; i < prompts.length; i += this.batchConfig.batchSize * this.batchConfig.maxConcurrency) {
      const megaBatch = prompts.slice(i, i + this.batchConfig.batchSize * this.batchConfig.maxConcurrency);
      
      // Split mega batch into concurrent batches
      const concurrentBatches: ValidationPrompt[][] = [];
      for (let j = 0; j < megaBatch.length; j += this.batchConfig.batchSize) {
        concurrentBatches.push(megaBatch.slice(j, j + this.batchConfig.batchSize));
      }
      
      // Process batches concurrently
      const batchPromises = concurrentBatches.map((batch, batchIndex) => 
        this.processBatch(batch, batchIndex + 1)
      );
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten results
      batchResults.forEach(batchResult => responses.push(...batchResult));
      
      processedCount += megaBatch.length;
    }

    return responses;
  }

  private async processBatch(batch: ValidationPrompt[], batchIndex?: number): Promise<ValidationResponse[]> {
    try {
      // Process each prompt in the batch
      const batchPromises = batch.map((prompt, promptIndex) => 
        this.validateSingleWithTimeout(prompt, `${batchIndex}-${promptIndex + 1}`)
      );
      const batchResponses = await Promise.all(batchPromises);
      
      return batchResponses;
      
    } catch (error: any) {
      logger.error(`❌ Batch ${batchIndex}: Processing failed`, { error: error.message });
      throw error;
    }
  }

  private async validateSingleWithTimeout(prompt: ValidationPrompt, promptId?: string): Promise<ValidationResponse> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      
      // Set timeout for individual prompt
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        logger.error(`⏰ Timeout after ${(duration / 1000).toFixed(1)}s: ${prompt.value.substring(0, 50)}`);
        reject(new Error(`Validation timeout for: ${prompt.value.substring(0, 50)}`));
      }, this.batchConfig.timeout);

      try {
        const response = await this.validateSingle(prompt);
        clearTimeout(timeoutId);
        resolve(response);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        clearTimeout(timeoutId);
        logger.error(`❌ Validation failed after ${(duration / 1000).toFixed(1)}s: ${prompt.value.substring(0, 50)}`, { error: error.message });
        reject(error);
      }
    });
  }

  private async validateSingle(prompt: ValidationPrompt): Promise<ValidationResponse> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: prompt.prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return this.parseDeepSeekResponse(content);
  }

  private parseDeepSeekResponse(response: string): ValidationResponse {
    try {
      const parsed = JSON.parse(response);
      return {
        isValid: parsed.valid === true,
        confidence: Math.min(1.0, Math.max(0.0, parseFloat(parsed.confidence) || 0.5)),
        reason: parsed.reason || 'No reason provided'
      };
    } catch (error) {
      // Fallback parsing if JSON fails
      const lowerResponse = response.toLowerCase();
      
      let isValid = true;
      let confidence = 0.5;
      let reason = 'No clear determination';

      if (lowerResponse.includes('invalid') || lowerResponse.includes('not valid') || lowerResponse.includes('suspicious')) {
        isValid = false;
      } else if (lowerResponse.includes('valid') || lowerResponse.includes('correct') || lowerResponse.includes('appropriate')) {
        isValid = true;
      }

      const confidenceMatch = response.match(/confidence[:\s]*([0-9.]+)/i);
      if (confidenceMatch) {
        confidence = Math.min(1.0, Math.max(0.0, parseFloat(confidenceMatch[1])));
      }

      const reasonMatch = response.match(/reason[:\s]*(.+?)(?:\n|$)/i);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
      }

      return { isValid, confidence, reason };
    }
  }

  calculateQualityScore(issues: ValidationIssue[]): number {
    let totalDeduction = 0;
    
    for (const issue of issues) {
      totalDeduction += issue.score;
    }
    
    return Math.max(0, 100 - totalDeduction);
  }

  async assessSubsidiaryQuality(subsidiary: any, context: PatternContext): Promise<QualityAssessment> {
    const issues: ValidationIssue[] = [];
    
    // Create validation prompts with learned context
    const prompts = this.createValidationPrompts(subsidiary, context);
    
    // Get LLM validation responses (batched internally)
    const responses = await this.validateBatch(prompts);
    
    // Convert LLM responses to validation issues
    responses.forEach((response, index) => {
      const prompt = prompts[index];
      
      if (!response.isValid) {
        const severity = response.confidence > 0.8 ? 'CRITICAL' : 
                       response.confidence > 0.5 ? 'WARNING' : 'INFO';
        
        const scoreImpact = severity === 'CRITICAL' ? 35 : 
                           severity === 'WARNING' ? 20 : 10;
        
        issues.push({
          type: severity,
          field: prompt.type === 'COMPANY_NAME' ? 'name' : 'jurisdiction',
          message: `${response.reason} (confidence: ${response.confidence.toFixed(2)})`,
          score: scoreImpact
        });
      }
    });
    
    // Calculate quality score
    const score = this.calculateQualityScore(issues);
    
    // Get learned patterns for threshold
    const patterns = this.getPatterns();
    
    // Determine if needs review
    const needsReview = score < patterns.qualityThresholds.warning ||
                       issues.some(issue => issue.type === 'CRITICAL');
    
    return { score, issues, needsReview };
  }
}