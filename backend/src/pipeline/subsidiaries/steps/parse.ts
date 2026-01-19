/**
 * Parse Step
 *
 * Parses HTML to extract subsidiary records using the two-phase refactored parser.
 * Includes validation and LLM fallback when validation fails.
 */

import { Step } from "../../core/types";
import { DecompressedFiling, ParsedFiling } from "../types";
import {
  parseExhibitRefactored,
  ParserError,
} from "../../../parser/subsidiary";
import type { ParseResult } from "../../../parser/subsidiary/types";
import { validateSubsidiaries } from "../../../validation/subsidiary-validator";
import { llmFallbackParse } from "../../../validation/llm-fallback";
import { createLogger } from "../../../utils/logger";

const logger = createLogger("pipeline/steps/parse");

/**
 * Ensures all subsidiaries have proper parent information.
 * Defaults to filing company if parentId/parentName are missing.
 */
function ensureParentInfo(
  parseResult: ParseResult,
  filingCompanyId: string,
  filingCompanyName: string
): ParseResult {
  if (!parseResult.subsidiaries || parseResult.subsidiaries.length === 0) {
    return parseResult;
  }

  const updatedSubsidiaries = parseResult.subsidiaries.map(sub => {
    // Default parentId to filing company if missing
    const parentId = sub.parentId || filingCompanyId;
    
    // Default parentName to filing company if missing
    const parentName = sub.parentName || filingCompanyName || 'Unknown';

    return {
      ...sub,
      parentId,
      parentName,
    };
  });

  return {
    ...parseResult,
    subsidiaries: updatedSubsidiaries,
  };
}

export const parseStep: Step<DecompressedFiling, ParsedFiling> = {
  name: "parse",

  async execute(file, _context) {
    try {
      // Step 1: Initial parsing with rule-based parser
      const parseResult = await parseExhibitRefactored(file.html, {
        accession_number: file.accessionNumber,
        cik: file.cik,
        filingCompanyId: file.companyId,
        filingCompanyName: file.companyName,
      });

      // Step 2: Check if we should use LLM fallback
      let shouldUseLLMFallback = false;
      let fallbackReason = "";

      if (parseResult.status === "failed") {
        shouldUseLLMFallback = true;
        fallbackReason = "parsing failed";
      } else if (parseResult.status === "empty" || parseResult.subsidiaries.length === 0) {
        shouldUseLLMFallback = true;
        fallbackReason = "no subsidiaries found";
      } else if (parseResult.status === "success" && parseResult.subsidiaries.length > 0) {
        // Validate parsed results
        const validationResult = validateSubsidiaries(
          parseResult.subsidiaries.map(sub => ({
            name: sub.name,
            jurisdiction: sub.jurisdiction
          }))
        );

        logger.info(`Validation for ${file.accessionNumber}: ${validationResult.validCount}/${parseResult.subsidiaries.length} valid (${(validationResult.validCount / parseResult.subsidiaries.length * 100).toFixed(1)}%)`);

        if (!validationResult.overallValid) {
          shouldUseLLMFallback = true;
          fallbackReason = "validation failed";
        }
      }

      // Step 3: Use LLM fallback if needed
      if (shouldUseLLMFallback) {
        logger.warn(`${fallbackReason} for ${file.accessionNumber}, attempting LLM fallback`);
        
        const llmResult = await llmFallbackParse(file.html, parseResult, {
          accession_number: file.accessionNumber,
          cik: file.cik,
          filingCompanyId: file.companyId,
          filingCompanyName: file.companyName || '',
        });

        // Ensure all subsidiaries have proper parent information
        const finalLlmResult = ensureParentInfo(llmResult, file.companyId, file.companyName || '');

        return {
          ...file,
          parseResult: finalLlmResult,
          success: finalLlmResult.status !== "failed",
        };
      }

      // Ensure all subsidiaries have proper parent information
      const finalParseResult = ensureParentInfo(parseResult, file.companyId, file.companyName || '');

      // Return original result if LLM fallback wasn't needed
      return {
        ...file,
        parseResult: finalParseResult,
        success: finalParseResult.status !== "failed",
      };

    } catch (error: unknown) {
      // Handle parser errors gracefully
      const errorMessage =
        error instanceof ParserError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);

      logger.error(`Parse step failed for ${file.accessionNumber}:`, { error: errorMessage });

      const failedResult: ParseResult = {
        subsidiaries: [],
        method: "failed",
        status: "failed",
        classification: "failed",
        tableCount: 0,
        maxNestingLevel: 0,
        footnotesHtml: "",
        errorMessage,
      };

      // Try LLM fallback even for parsing errors
      logger.warn(`Parsing error for ${file.accessionNumber}, attempting LLM fallback`);
      
      try {
        const llmResult = await llmFallbackParse(file.html, failedResult, {
          accession_number: file.accessionNumber,
          cik: file.cik,
          filingCompanyId: file.companyId,
          filingCompanyName: file.companyName || '',
        });

        // Ensure all subsidiaries have proper parent information
        const finalLlmResult = ensureParentInfo(llmResult, file.companyId, file.companyName || '');

        return {
          ...file,
          parseResult: finalLlmResult,
          success: finalLlmResult.status !== "failed",
        };
      } catch (llmError) {
        logger.error(`LLM fallback also failed for ${file.accessionNumber}:`, { error: llmError instanceof Error ? llmError.message : String(llmError) });
        
        return {
          ...file,
          parseResult: failedResult,
          success: false,
        };
      }
    }
  },
};
