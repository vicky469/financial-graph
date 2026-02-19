/**
 * Subsidiary Parser Orchestrator
 *
 * End-to-end flow:
 * 1) Detect PDF payloads and short-circuit to LLM fallback path when needed.
 * 2) Run heuristic parsing (shape detection + row extraction).
 * 3) Validate heuristic output quality.
 * 4) Decide whether to invoke LLM fallback.
 * 5) Finalize output (backfill parent info, attach telemetry).
 */

import * as cheerio from "cheerio";
import { createLogger, withLogMetadata } from "../../utils/logger";

import type {
  ParseResult,
  ParseTelemetry,
  SubsidiaryFallbackPolicy,
  DroppedValidationSample,
} from "../../pipeline/subsidiary/types";
import {
  validateSubsidiaries,
  MIN_VALID_RATIO,
} from "../../validation/subsidiary-validator";
import { llmFallbackParse } from "../../validation/llm-fallback";

import { detectDocumentStructure } from "./shape/structure-detection";
import {
  extractSubsidiaryRecords,
  extractFootnotesHtml,
} from "./data/content-extraction";
import type { ParserConfig, DocumentStructure } from "./parser-types";
import { DocumentClassification, TableType } from "./parser-types";
import { DEFAULT_CONFIG, ParserError } from "./parser-types";

// Re-export parser types
export type {
  ParserConfig,
  DocumentStructure,
  TableInfo,
  DocumentClassification,
  TableType,
  ContentExtractionInput,
} from "./parser-types";
export { DEFAULT_CONFIG, ParserError } from "./parser-types";

// Re-export content extraction types
export type { ContentExtractionResult } from "./parser-types";

const logger = createLogger("parsers/subsidiary");

type ValidationSummary = ReturnType<typeof validateSubsidiaries> | null;

type ParseDecision = {
  shouldFallback: boolean;
  reason: string;
};

// ============================================================================
// Parse Orchestration Entry Point
// ============================================================================

/**
 * Parse a single SEC exhibit payload using heuristic parsing + optional LLM fallback.
 *
 * Returns a fully finalized ParseResult:
 * - Parent info is backfilled on all subsidiaries
 * - Telemetry is attached
 */
export async function parseExhibit(
  html: string,
  filing: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName?: string;
  },
  config: ParserConfig = DEFAULT_CONFIG,
): Promise<ParseResult> {
  return withLogMetadata({ correlationId: filing.accession_number }, () =>
    parseExhibitInternal(html, filing, config),
  );
}

  // Single orchestration function for all parse branches:
  // heuristic-only, heuristic+fallback, PDF+fallback, and error recovery fallback.
async function parseExhibitInternal(
  html: string,
  filing: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName?: string;
  },
  config: ParserConfig = DEFAULT_CONFIG,
): Promise<ParseResult> {
  const fallbackPolicy = config.fallbackPolicy ?? "llm";
  const startedAt = Date.now();
  const timingsMs: ParseTelemetry["timingsMs"] = {};
  let validation: ParseTelemetry["validation"];

  let fallback: ParseTelemetry["fallback"] = {
    policy: fallbackPolicy,
    used: false,
  };

  const assembleTelemetry = (): ParseTelemetry => ({
    timingsMs: { ...timingsMs, total: Date.now() - startedAt },
    validation,
    fallback,
  });

  const finalizeResult = (result: ParseResult): ParseResult =>
    finalize(result, filing, assembleTelemetry());

  // Detect PDF files early - they need vision model processing
  let isPDF = false;
  if (html.trim().startsWith("%PDF-")) {
    logger.info("PDF file detected - will use vision model for parsing");
    isPDF = true;
  }

  try {
    // For PDFs, skip heuristic parsing and go straight to fallback
    if (isPDF) {
      const pdfResult: ParseResult = {
        subsidiaries: [],
        status: "empty",
        classification: DocumentClassification.PDF_BASED,
        tableCount: 0,
        maxNestingLevel: 0,
        footnotesHtml: "",
        llmApplied: false,
        llmModified: false,
      };
      
      if (fallbackPolicy === "none") {
        return finalizeResult(pdfResult);
      }
      
      logger.warn("no_subsidiaries, attempting LLM fallback");
      const { result: fbResult, elapsedMs: fbMs } = await runFallback(
        html,
        filing,
        pdfResult,
        fallbackPolicy,
        "no_subsidiaries",
      );
      timingsMs.llmFallback = fbMs;
      const provider = fbResult.telemetry?.fallback?.provider;
      fallback = {
        policy: fallbackPolicy,
        used: true,
        reason: "no_subsidiaries",
        ...(provider ? { provider } : {}),
      };
      return finalizeResult(fbResult);
    }

    const { result: heuristicResult, elapsedMs: heuristicMs } =
      await runHeuristicParse(html, filing, config);
    timingsMs.heuristic = heuristicMs;

    const {
      summary: validationSummary,
      elapsedMs: validationMs,
      metrics: validationMetrics,
    } = validateHeuristicResult(heuristicResult);
    timingsMs.validation = validationMs;
    validation = validationMetrics;

    const decision = decideFallback(
      heuristicResult,
      validationSummary,
      validationMetrics,
    );

    if (fallbackPolicy === "none") {
      if (decision.reason === "validation_failed" && validationSummary) {
        const prunedHeuristicResult = pruneInvalidSubsidiaries(
          heuristicResult,
          validationSummary,
        );
        logger.warn(
          "validation_failed with fallback disabled, returning failed result",
        );
        return finalizeResult(
          markValidationFailed(prunedHeuristicResult, validationSummary),
        );
      }

      if (decision.reason === "low_coverage") {
        logger.warn(
          "low_coverage with fallback disabled, returning failed result",
        );
        return finalizeResult(markLowCoverageFailed(heuristicResult));
      }

      return finalizeResult(heuristicResult);
    }

    if (decision.shouldFallback) {
      const fallbackBaseResult =
        decision.reason === "validation_failed" && validationSummary
          ? pruneInvalidSubsidiaries(heuristicResult, validationSummary)
          : heuristicResult;
      logger.warn(
        `${decision.reason}, attempting LLM fallback`,
      );
      const { result: fbResult, elapsedMs: fbMs } = await runFallback(
        html,
        filing,
        fallbackBaseResult,
        fallbackPolicy,
        decision.reason,
      );
      timingsMs.llmFallback = fbMs;
      const provider = fbResult.telemetry?.fallback?.provider;
      fallback = {
        policy: fallbackPolicy,
        used: true,
        reason: decision.reason,
        ...(provider ? { provider } : {}),
      };
      return finalizeResult(fbResult);
    }

    return finalizeResult(heuristicResult);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof ParserError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    logger.error("Parsing failed:", {
      error: errorMessage,
    });

    if (fallbackPolicy === "none") {
      throw error;
    }

    const failedResult = buildFailedParseResult(errorMessage);

    logger.warn("Parsing error, attempting LLM fallback");

    try {
      const { result: fbResult, elapsedMs: fbMs } = await runFallback(
        html,
        filing,
        failedResult,
        fallbackPolicy,
        "heuristic_error",
      );
      timingsMs.llmFallback = fbMs;
      const provider = fbResult.telemetry?.fallback?.provider;
      fallback = {
        policy: fallbackPolicy,
        used: true,
        reason: "heuristic_error",
        ...(provider ? { provider } : {}),
      };
      return finalizeResult(fbResult);
    } catch (llmError) {
      logger.error("LLM fallback also failed:", {
        error: llmError instanceof Error ? llmError.message : String(llmError),
      });
      return finalizeResult(failedResult);
    }
  }
}

// ============================================================================
// Post-Processing (parent info + telemetry)
// ============================================================================

function finalize(
  result: ParseResult,
  filing: {
    accession_number: string;
    filingCompanyId: string;
    filingCompanyName?: string;
  },
  telemetry: ParseTelemetry,
): ParseResult {
  const withParent = ensureParentInfo(
    result,
    filing.filingCompanyId,
    filing.filingCompanyName,
  );
  return { ...withParent, telemetry };
}

function pruneInvalidSubsidiaries(
  parseResult: ParseResult,
  validationSummary: Exclude<ValidationSummary, null>,
): ParseResult {
  if (parseResult.subsidiaries.length === 0) {
    return parseResult;
  }

  const validSubsidiaries = parseResult.subsidiaries.filter(
    (_sub, index) => validationSummary.results[index]?.isValid,
  );
  const droppedCount = parseResult.subsidiaries.length - validSubsidiaries.length;
  if (droppedCount > 0) {
    logger.warn(
      `Pruned ${droppedCount} invalid subsidiaries from heuristic result; kept ${validSubsidiaries.length}`,
    );
  }

  return {
    ...parseResult,
    subsidiaries: validSubsidiaries,
    status:
      validSubsidiaries.length === 0 && parseResult.status === "success"
        ? "empty"
        : parseResult.status,
  };
}

function markValidationFailed(
  parseResult: ParseResult,
  validationSummary: Exclude<ValidationSummary, null>,
): ParseResult {
  const total = validationSummary.results.length;
  const invalid = validationSummary.invalidCount;
  return {
    ...parseResult,
    status: "failed",
    errorMessage: `heuristic_validation_failed (${invalid}/${total} invalid rows)`,
  };
}

function markLowCoverageFailed(parseResult: ParseResult): ParseResult {
  const expectedCount = parseResult.expectedRowCount ?? 0;
  const parsedCount = parseResult.subsidiaries.length;
  const coverage =
    expectedCount > 0 ? parsedCount / expectedCount : Number.NaN;
  const minCoveragePercent = (MIN_VALID_RATIO * 100).toFixed(1);
  const coveragePercent = Number.isFinite(coverage)
    ? (coverage * 100).toFixed(1)
    : "n/a";

  return {
    ...parseResult,
    status: "failed",
    errorMessage: `heuristic_low_coverage (${parsedCount}/${expectedCount} rows, ${coveragePercent}% < ${minCoveragePercent}%)`,
  };
}

function ensureParentInfo(
  parseResult: ParseResult,
  filingCompanyId: string,
  filingCompanyName?: string,
): ParseResult {
  if (!parseResult.subsidiaries || parseResult.subsidiaries.length === 0) {
    return parseResult;
  }

  const normalizedCompanyName = filingCompanyName?.trim();

  const updatedSubsidiaries = parseResult.subsidiaries.map((sub) => ({
    ...sub,
    parentId: sub.parentId || filingCompanyId,
    parentName: sub.parentName || normalizedCompanyName,
  }));

  return {
    ...parseResult,
    subsidiaries: updatedSubsidiaries,
  };
}

function buildNonTableResult(
  $: any,
  config: ParserConfig,
  structure: DocumentStructure,
): ParseResult {
  const footnotesHtml = extractFootnotesHtml($, config.processFootnotes);

  const expectedRowCount = structure.tables
    .filter((table) => table.type === TableType.SUBSIDIARY)
    .reduce((sum, table) => sum + table.rowCount, 0);

  return {
    subsidiaries: [],
    llmApplied: false,
    llmModified: false,
    status: "empty",
    classification: structure.classification,
    tableCount: structure.totalTableCount,
    expectedRowCount,
    maxNestingLevel: 0,
    footnotesHtml,
  };
}

function buildFailedParseResult(errorMessage: string): ParseResult {
  return {
    subsidiaries: [],
    llmApplied: false,
    llmModified: false,
    status: "failed",
    classification: "failed",
    tableCount: 0,
    maxNestingLevel: 0,
    footnotesHtml: "",
    errorMessage,
  };
}

async function runHeuristicParse(
  html: string,
  filing: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName?: string;
  },
  config: ParserConfig,
): Promise<{ result: ParseResult; elapsedMs: number }> {
  const start = Date.now();

  try {
    const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
    const structure = detectDocumentStructure($, config);

    if (
      structure.classification === DocumentClassification.TEXT_BASED ||
      structure.classification === DocumentClassification.NO_TABLE ||
      structure.classification === DocumentClassification.HAS_TABLE_NO_DATA
    ) {
      return {
        result: buildNonTableResult($, config, structure),
        elapsedMs: Date.now() - start,
      };
    }

    const subsidiaryTablesForLog = structure.tables.filter(
      (table) => table.type === TableType.SUBSIDIARY,
    );
    if (subsidiaryTablesForLog.length > 0) {
      logger.info("Table details:");
      subsidiaryTablesForLog.forEach((table, i) => {
        const headerInfo = table.isContinuation
          ? "continuation table"
          : table.headers && table.headers.length > 0
            ? `headers: [${table.headers.join(", ")}]`
            : "no parsed headers";
        const displayColumnCount =
          table.isContinuation && table.cachedHeaders && table.cachedHeaders.length > 0
            ? table.cachedHeaders.length
            : table.headers && table.headers.length > 0
              ? table.headers.length
              : table.columnCount;
        logger.info(
          `  Subsidiary table ${i + 1} (index ${table.index}): ${table.rowCount} rows × ${displayColumnCount} cols, ${headerInfo}`,
        );
      });
    }

    logger.debug("Phase 2: Content extraction");
    const result = extractSubsidiaryRecords({
      structure,
      $,
      config,
      filing,
    });

    const status: ParseResult["status"] =
      result.subsidiaries.length > 0 ? "success" : "empty";

    logger.info(
      `Parsing complete: ${status}, ${result.subsidiaries.length} subsidiaries extracted`,
    );

    if (result.subsidiaries.length === 0) {
      const subsidiaryTableCount = structure.tables.filter(
        (table) => table.type === TableType.SUBSIDIARY,
      ).length;
      logger.info(
        `EMPTY RESULT DETAILS: classification=${structure.classification}, totalTables=${structure.totalTableCount}, subsidiaryTables=${subsidiaryTableCount}, textBased=${structure.textBased ? structure.textBased.entryCount : 0}`,
      );
    }

    return {
      result: {
        subsidiaries: result.subsidiaries,
        llmApplied: false,
        llmModified: false,
        status,
        classification: structure.classification,
        tableCount: result.tableCount,
        expectedRowCount: structure.tables
          .filter((table) => table.type === TableType.SUBSIDIARY)
          .reduce((sum, table) => sum + table.rowCount, 0),
        maxNestingLevel: result.maxNestingLevel,
        footnotesHtml: result.footnotesHtml,
      },
      elapsedMs: Date.now() - start,
    };
  } catch (error: any) {
    if (
      error.name === "CheerioError" ||
      error.message?.includes("Invalid HTML")
    ) {
      throw new ParserError(
        `HTML parsing failed: ${error.message}`,
        "HTML_PARSE_ERROR",
        { originalError: error },
      );
    }

    if (error instanceof ParserError) {
      throw error;
    }

    throw new ParserError(`Parsing failed: ${error.message}`, "UNKNOWN_ERROR", {
      originalError: error,
    });
  }
}

function validateHeuristicResult(
  parseResult: ParseResult,
): {
  summary: ValidationSummary;
  elapsedMs: number;
  metrics: ParseTelemetry["validation"];
} {
  if (
    parseResult.status !== "success" ||
    parseResult.subsidiaries.length === 0
  ) {
    return { summary: null, elapsedMs: 0, metrics: undefined };
  }

  const validationStart = Date.now();
  const validationResult = validateSubsidiaries(
    parseResult.subsidiaries.map((sub) => ({
      name: sub.name,
      jurisdiction: sub.jurisdiction,
    })),
    { requireJurisdiction: true },
  );
  const elapsedMs = Date.now() - validationStart;

  const metrics: ParseTelemetry["validation"] = {
    total: parseResult.subsidiaries.length,
    valid: validationResult.validCount,
    overallValid: validationResult.overallValid,
  };

  if (parseResult.expectedRowCount && parseResult.expectedRowCount > 0) {
    const coverage =
      parseResult.subsidiaries.length / parseResult.expectedRowCount;
    metrics.expectedCount = parseResult.expectedRowCount;
    metrics.coverage = Number.isFinite(coverage) ? coverage : undefined;

    if (parseResult.subsidiaries.length < parseResult.expectedRowCount) {
      logger.warn(
        `Parsed ${parseResult.subsidiaries.length}/${parseResult.expectedRowCount} subsidiaries (row-count coverage ${(coverage * 100).toFixed(1)}%). Flagging for review.`,
      );
    }
  }

  const droppedSamples: DroppedValidationSample[] = parseResult.subsidiaries
    .map((sub, index) => ({
      sub,
      validation: validationResult.results[index],
    }))
    .filter(({ validation }) => !validation.isValid)
    .slice(0, 3)
    .map(({ sub, validation }) => ({
      name: sub.name,
      jurisdiction: sub.jurisdiction,
      issues: validation.issues,
    }));

  if (droppedSamples.length > 0) {
    metrics.droppedSamples = droppedSamples;
  }

  if (!validationResult.overallValid || validationResult.invalidCount > 0) {
    const invalidSamplesForLog = parseResult.subsidiaries
      .map((sub, index) => ({
        sub,
        validation: validationResult.results[index],
      }))
      .filter(({ validation }) => !validation.isValid)
      .slice(0, 5)
      .map(({ sub, validation }) => ({
        name: sub.name,
        jurisdiction: sub.jurisdiction,
        issues: validation.issues,
        issueTypes: validation.issueTypes,
        criticalIssues: validation.criticalIssues,
        warningIssues: validation.warningIssues,
      }));

    logger.warn(
      `Validation failed: ${validationResult.invalidCount}/${validationResult.results.length} invalid subsidiaries`,
      {
        invalidSamples: invalidSamplesForLog,
      },
    );
  }

  return { summary: validationResult, elapsedMs, metrics };
}

function decideFallback(
  parseResult: ParseResult,
  validationSummary: ValidationSummary,
  validationMetrics?: ParseTelemetry["validation"],
): ParseDecision {
  if (parseResult.status === "failed") {
    return { shouldFallback: true, reason: "parsing_failed" };
  }

  if (parseResult.status === "empty" || parseResult.subsidiaries.length === 0) {
    return { shouldFallback: true, reason: "no_subsidiaries" };
  }

  if (validationSummary && !validationSummary.overallValid) {
    return { shouldFallback: true, reason: "validation_failed" };
  }

  if (isCoverageBelowThreshold(validationMetrics)) {
    return { shouldFallback: true, reason: "low_coverage" };
  }

  return { shouldFallback: false, reason: "heuristic_ok" };
}

function isCoverageBelowThreshold(
  validationMetrics?: ParseTelemetry["validation"],
): boolean {
  const coverage = validationMetrics?.coverage;
  return (
    typeof coverage === "number" &&
    Number.isFinite(coverage) &&
    coverage < MIN_VALID_RATIO
  );
}

async function runFallback(
  html: string,
  filing: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName?: string;
  },
  baseResult: ParseResult,
  _policy: SubsidiaryFallbackPolicy,
  _reason: string,
): Promise<{ result: ParseResult; elapsedMs: number }> {
  const llmStart = Date.now();
  const llmResult = await llmFallbackParse(html, baseResult, {
    accession_number: filing.accession_number,
    cik: filing.cik,
    filingCompanyId: filing.filingCompanyId,
    filingCompanyName: filing.filingCompanyName || "",
  });
  return { result: llmResult, elapsedMs: Date.now() - llmStart };
}
