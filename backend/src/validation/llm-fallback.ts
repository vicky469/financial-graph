/**
 * LLM Fallback for Subsidiary Parsing
 * 
 * When rule-based parsing fails validation, use DeepSeek V3.1 to re-parse
 * the HTML and extract subsidiary data with LLM assistance.
 */

import { SubsidiaryRecord, ParseResult } from "../parser/subsidiary/types";
import { LLMModification } from "../parser/subsidiary/llm-enrichment";
import { createLogger } from "../utils/logger";
import { generateCompanyId } from "@financial-graph/shared/ids";
import { CompanyType } from "@financial-graph/shared/types";
import { getLLMWorkerPool } from "./llm-worker-pool";

const logger = createLogger("validation/llm-fallback");

interface LLMSubsidiaryRecord {
  name: string;
  jurisdiction: string;
  ownership_percentage?: number | null;
}

interface LLMParseResponse {
  subsidiaries: LLMSubsidiaryRecord[];
}

/**
 * Use DeepSeek V3.1 to re-parse HTML when validation fails
 */
export async function llmFallbackParse(
  html: string,
  originalResult: ParseResult,
  filingInfo: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName: string;
  }
): Promise<ParseResult> {
  try {
    logger.info(`LLM fallback parsing for ${filingInfo.accession_number}`);

    const llmResult = await callDeepSeekAPI(html, filingInfo.accession_number);
    
    if (!llmResult || !llmResult.subsidiaries || llmResult.subsidiaries.length === 0) {
      logger.warn(`LLM returned no subsidiaries for ${filingInfo.accession_number}`);
      return {
        ...originalResult,
        method: "LLM - deepseek-chat (no results)",
        status: "empty"
      };
    }

    // Convert LLM results to SubsidiaryRecord format and filter out invalid records
    const validSubsidiaries: SubsidiaryRecord[] = [];

    for (const llmSub of llmResult.subsidiaries) {
      // Skip records with null/empty name or jurisdiction
      if (!llmSub.name || !llmSub.name.trim() || !llmSub.jurisdiction || !llmSub.jurisdiction.trim()) {
        logger.warn(`Skipping invalid LLM subsidiary: name="${llmSub.name}", jurisdiction="${llmSub.jurisdiction}"`);
        continue;
      }

      // Determine company type based on jurisdiction presence
      const companyType = !llmSub.jurisdiction || llmSub.jurisdiction.trim() === '' 
        ? CompanyType.UNKNOWN 
        : CompanyType.PRIVATE;

      const subsidiaryId = generateCompanyId({
        type: companyType,
        name: llmSub.name.trim(),
        jurisdiction_raw: llmSub.jurisdiction.trim(),
      });

      const record: SubsidiaryRecord = {
        id: subsidiaryId,
        name: llmSub.name.trim(),
        jurisdiction: llmSub.jurisdiction.trim(),
        nestingLevel: 0, // LLM doesn't provide nesting info
        ownership: llmSub.ownership_percentage || undefined,
        footnoteRefs: [],
        indentationSpaces: 0,
        isNested: false
      };
      validSubsidiaries.push(record);
    }

    // If no valid subsidiaries were extracted, return failed status
    if (validSubsidiaries.length === 0) {
      logger.warn(`LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none were valid for ${filingInfo.accession_number}`);
      return {
        ...originalResult,
        method: "LLM - deepseek-chat (no valid results)",
        status: "failed",
        errorMessage: `LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none had valid name and jurisdiction`
      };
    }

    // Calculate modifications between original and LLM results
    const modifications = calculateModifications(originalResult.subsidiaries, validSubsidiaries);

    const enhancedResult: ParseResult = {
      subsidiaries: validSubsidiaries,
      method: "LLM - deepseek-chat",
      status: "success",
      classification: originalResult.classification + " (LLM enhanced)",
      tableCount: originalResult.tableCount,
      maxNestingLevel: 0, // LLM doesn't preserve nesting
      footnotesHtml: originalResult.footnotesHtml,
      llmModifications: modifications
    };

    logger.info(`LLM fallback successful: ${validSubsidiaries.length} valid subsidiaries extracted (${llmResult.subsidiaries.length - validSubsidiaries.length} invalid records skipped)`);
    return enhancedResult;

  } catch (error) {
    logger.error(`LLM fallback failed for ${filingInfo.accession_number}: ${error instanceof Error ? error.message : String(error)}`);
    
    return {
      ...originalResult,
      method: "LLM - deepseek-chat (failed)",
      status: "failed",
      errorMessage: `LLM fallback failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Call DeepSeek V3.1 API to parse HTML using worker pool for parallel processing
 */
async function callDeepSeekAPI(html: string, accessionNumber: string): Promise<LLMParseResponse | null> {
  const workerPool = getLLMWorkerPool();
  
  try {
    logger.debug(`Queuing LLM request for ${accessionNumber}`);
    const result = await workerPool.processRequest(accessionNumber, html);
    logger.debug(`LLM request completed for ${accessionNumber}`);
    return result;
  } catch (error) {
    logger.error(`LLM worker pool request failed for ${accessionNumber}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Calculate modifications between original and LLM results
 */
function calculateModifications(
  original: SubsidiaryRecord[],
  llmResult: SubsidiaryRecord[]
): LLMModification[] {
  const modifications: LLMModification[] = [];

  // Create a map for easier comparison
  const originalMap = new Map(original.map(s => [s.name.toLowerCase().trim(), s]));
  const llmMap = new Map(llmResult.map(s => [s.name.toLowerCase().trim(), s]));

  // Check each LLM result against original
  llmResult.forEach(llmSub => {
    const key = llmSub.name.toLowerCase().trim();
    const originalSub = originalMap.get(key);
    
    if (!originalSub) {
      // New subsidiary added by LLM
      modifications.push({
        subsidiaryId: llmSub.id,
        fieldChanges: [{
          field: "subsidiary_added",
          oldValue: null,
          newValue: llmSub.name
        }]
      });
    } else {
      // Compare fields for existing subsidiaries
      const fieldChanges: { field: string; oldValue: unknown; newValue: unknown }[] = [];
      
      if (originalSub.jurisdiction !== llmSub.jurisdiction) {
        fieldChanges.push({
          field: "jurisdiction",
          oldValue: originalSub.jurisdiction,
          newValue: llmSub.jurisdiction
        });
      }
      
      if (originalSub.ownership !== llmSub.ownership) {
        fieldChanges.push({
          field: "ownership",
          oldValue: originalSub.ownership,
          newValue: llmSub.ownership
        });
      }
      
      if (fieldChanges.length > 0) {
        modifications.push({
          subsidiaryId: llmSub.id,
          fieldChanges
        });
      }
    }
  });

  // Check for subsidiaries removed by LLM
  original.forEach(originalSub => {
    const key = originalSub.name.toLowerCase().trim();
    if (!llmMap.has(key)) {
      modifications.push({
        subsidiaryId: originalSub.id,
        fieldChanges: [{
          field: "subsidiary_removed",
          oldValue: originalSub.name,
          newValue: null
        }]
      });
    }
  });

  return modifications;
}