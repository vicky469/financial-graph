/**
 * LLM Fallback for Subsidiary Parsing when rule-based parsing fails validation
 */

import {
  ParseResult,
  ParseTelemetry,
  SubsidiaryRecord,
} from "../../pipeline/subsidiary/types";
import { LLMModification } from "../../parser/subsidiary/footnote/llm-enrichment";
import { createLogger } from "../../utils/logger";
import { QwenError } from "../../integration/qwen";
import { DeepSeekError } from "../../integration/deepseek";
import { buildGroundingCorpus } from "./grounding";
import { requestFallbackLLMResult } from "./providers";
import { convertLLMSubsidiariesToRecords } from "./record-conversion";
import { buildCanonicalSourceText } from "./source-corpus";
import { FallbackProvider, FallbackProviderTelemetry, FilingContext } from "./types";

const logger = createLogger("validation/llm-fallback");

function resolveErrorCode(error: unknown): string {
  if (error instanceof QwenError || error instanceof DeepSeekError) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

function buildProviderMeta(
  filingInfo: FilingContext,
  fallbackProvider: FallbackProvider,
  telemetry: FallbackProviderTelemetry | null,
): Record<string, string> {
  return {
    accessionNumber: filingInfo.accession_number,
    provider: telemetry?.provider || fallbackProvider,
    model: telemetry?.model || "unknown",
    requestType: telemetry?.requestType || "unknown",
    fallbackFrom: telemetry?.fallbackFrom || "",
    fallbackReasonCode: telemetry?.fallbackReasonCode || "",
  };
}

function attachFallbackProviderTelemetry(
  result: ParseResult,
  fallbackProvider: FallbackProvider,
  telemetry: FallbackProviderTelemetry | null,
): ParseResult {
  const provider = telemetry?.provider || fallbackProvider;
  const fallbackMeta: ParseTelemetry["fallback"] = {
    policy: "llm",
    used: true,
    provider,
  };
  return {
    ...result,
    telemetry: {
      ...(result.telemetry || {}),
      fallback: fallbackMeta,
    },
  };
}

/**
 * Use DeepSeek V3.1 to re-parse HTML when validation fails
 * Use Qwen-VL (vision model) for pdf and image-based documents
 */
export async function llmFallbackParse(
  doc: string,
  originalResult: ParseResult,
  filingInfo: FilingContext,
): Promise<ParseResult> {
  let fallbackProvider: FallbackProvider = "deepseek";
  let fallbackTelemetry: FallbackProviderTelemetry | null = null;

  try {
    logger.info(`LLM fallback parsing for ${filingInfo.accession_number}`);

    const canonicalSourcePromise = buildCanonicalSourceText(
      doc,
      originalResult.classification,
      filingInfo.accession_number,
    );

    const fallbackExecution = await requestFallbackLLMResult(
      doc,
      originalResult.classification,
      filingInfo,
    );
    fallbackProvider = fallbackExecution.provider;
    fallbackTelemetry = fallbackExecution.telemetry;
    const llmResult = fallbackExecution.llmResult;
    const providerMeta = buildProviderMeta(
      filingInfo,
      fallbackProvider,
      fallbackTelemetry,
    );

    logger.info(
      `LLM fallback provider execution completed for ${filingInfo.accession_number}`,
      providerMeta,
    );

    if (!llmResult || !llmResult.subsidiaries || llmResult.subsidiaries.length === 0) {
      logger.warn(
        `LLM returned no subsidiaries for ${filingInfo.accession_number} (provider=${fallbackProvider})`,
        providerMeta,
      );
      return attachFallbackProviderTelemetry({
        ...originalResult,
        llmApplied: true,
        llmModified: false,
        status: "empty",
      }, fallbackProvider, fallbackTelemetry);
    }

    // Convert LLM results to SubsidiaryRecord format.
    const canonicalSource = await canonicalSourcePromise;
    const groundingCorpus = canonicalSource
      ? buildGroundingCorpus(canonicalSource)
      : null;
    if (!groundingCorpus) {
      logger.warn(
        `Canonical source is empty for ${filingInfo.accession_number}; applying relaxed LLM validation`,
      );
    }

    const validSubsidiaries = convertLLMSubsidiariesToRecords(
      llmResult.subsidiaries,
      filingInfo,
      groundingCorpus,
    );

    // If no valid subsidiaries were extracted, return failed status
    if (validSubsidiaries.length === 0) {
      logger.warn(
        `LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none were valid for ${filingInfo.accession_number} (provider=${fallbackProvider})`,
        providerMeta,
      );
      return attachFallbackProviderTelemetry({
        ...originalResult,
        llmApplied: true,
        llmModified: false,
        status: "failed",
        errorMessage: `LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none had valid names (provider=${fallbackProvider})`,
      }, fallbackProvider, fallbackTelemetry);
    }

    // Calculate modifications between original and LLM results
    const modifications = calculateModifications(originalResult.subsidiaries, validSubsidiaries);

    const enhancedResult: ParseResult = {
      subsidiaries: validSubsidiaries,
      llmApplied: true,
      llmModified: modifications.length > 0,
      status: "success",
      classification: originalResult.classification + " (LLM enhanced)",
      tableCount: originalResult.tableCount,
      expectedRowCount: originalResult.expectedRowCount,
      maxNestingLevel: validSubsidiaries.reduce(
        (maxLevel, sub) => Math.max(maxLevel, sub.nestingLevel),
        0,
      ),
      footnotesHtml: originalResult.footnotesHtml,
      llmModifications: modifications,
    };

    logger.info(
      `LLM fallback successful (provider=${fallbackProvider}): ${validSubsidiaries.length} valid subsidiaries extracted (${llmResult.subsidiaries.length - validSubsidiaries.length} invalid records skipped)`,
      providerMeta,
    );
    return attachFallbackProviderTelemetry(
      enhancedResult,
      fallbackProvider,
      fallbackTelemetry,
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = resolveErrorCode(error);
    logger.error(
      `LLM fallback failed for ${filingInfo.accession_number} (provider=${fallbackProvider}, code=${errorCode}): ${errorMessage}`,
      buildProviderMeta(filingInfo, fallbackProvider, fallbackTelemetry),
    );

    return attachFallbackProviderTelemetry({
      ...originalResult,
      llmApplied: true,
      llmModified: false,
      status: "failed",
      errorMessage: `LLM fallback failed (provider=${fallbackProvider}, code=${errorCode}): ${errorMessage}`,
    }, fallbackProvider, fallbackTelemetry);
  }
}

/**
 * Calculate modifications between original and LLM results
 */
function calculateModifications(
  original: SubsidiaryRecord[],
  llmResult: SubsidiaryRecord[],
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
          newValue: llmSub.name,
        }],
      });
    } else {
      // Compare fields for existing subsidiaries
      const fieldChanges: { field: string; oldValue: unknown; newValue: unknown }[] = [];

      if (originalSub.jurisdiction !== llmSub.jurisdiction) {
        fieldChanges.push({
          field: "jurisdiction",
          oldValue: originalSub.jurisdiction,
          newValue: llmSub.jurisdiction,
        });
      }

      if (originalSub.ownership !== llmSub.ownership) {
        fieldChanges.push({
          field: "ownership",
          oldValue: originalSub.ownership,
          newValue: llmSub.ownership,
        });
      }

      if (fieldChanges.length > 0) {
        modifications.push({
          subsidiaryId: llmSub.id,
          fieldChanges,
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
          newValue: null,
        }],
      });
    }
  });

  return modifications;
}
