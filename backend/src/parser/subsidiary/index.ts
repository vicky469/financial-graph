/**
 * Subsidiary Parser - Main Entry Point
 *
 * Parses Exhibit 21/8 HTML and returns subsidiaries with parent-child relationships.
 * Flow: detect document structure, then extract subsidiary records.
 */

import * as cheerio from "cheerio";
import { createLogger } from "../../utils/logger";

import type {
  ParseResult,
  ParseTelemetry,
  SubsidiaryFallbackPolicy,
  SubsidiaryParseMethod,
} from "./types";
import {
  validateSubsidiaries,
  filterValidSubsidiaries,
} from "../../validation/subsidiary-validator";
import { llmFallbackParse } from "../../validation/llm-fallback";

import { detectDocumentStructure } from "./structure-detection";
import {
  extractSubsidiaryRecords,
  extractFootnotesHtml,
} from "./content-extraction";
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
export type { ContentExtractionResult } from "./types";

const logger = createLogger("parsers/subsidiary");

type ValidationSummary = ReturnType<typeof validateSubsidiaries> | null;

type ParseDecision = {
  shouldFallback: boolean;
  reason: string;
};

// ============================================================================
// Two-Phase Parser
// ============================================================================

/**
 * Parse a single SEC exhibit HTML using the two-phase parser.
 *
 * Returns a fully finalized ParseResult:
 * - Invalid subsidiaries are pruned
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
    logger.info(
      `[${filing.accession_number}] PDF file detected - will use vision model for parsing`,
    );
    isPDF = true;
  }

  try {
    // For PDFs, skip heuristic parsing and go straight to fallback
    if (isPDF) {
      const pdfResult: ParseResult = {
        subsidiaries: [],
        method: "unknown",
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
      
      logger.warn(
        `no_subsidiaries for ${filing.accession_number}, attempting LLM fallback`,
      );
      const { result: fbResult, elapsedMs: fbMs } = await runFallback(
        html,
        filing,
        pdfResult,
        fallbackPolicy,
        "no_subsidiaries",
      );
      timingsMs.llmFallback = fbMs;
      fallback = {
        policy: fallbackPolicy,
        used: true,
        reason: "no_subsidiaries",
        provider: "qwen-vl",
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
    } = validateHeuristicResult(filing, heuristicResult);
    timingsMs.validation = validationMs;
    validation = validationMetrics;

    if (fallbackPolicy === "none") {
      return finalizeResult(heuristicResult);
    }

    const decision = decideFallback(heuristicResult, validationSummary);
    if (decision.shouldFallback) {
      logger.warn(
        `${decision.reason} for ${filing.accession_number}, attempting LLM fallback`,
      );
      const { result: fbResult, elapsedMs: fbMs } = await runFallback(
        html,
        filing,
        heuristicResult,
        fallbackPolicy,
        decision.reason,
      );
      timingsMs.llmFallback = fbMs;
      fallback = {
        policy: fallbackPolicy,
        used: true,
        reason: decision.reason,
        provider: heuristicResult.classification === DocumentClassification.IMAGE_BASED ? "qwen-vl-plus" : "deepseek",
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

    logger.error(`[${filing.accession_number}] Parsing failed:`, {
      error: errorMessage,
    });

    if (fallbackPolicy === "none") {
      throw error;
    }

    const failedResult = buildFailedParseResult(errorMessage);

    logger.warn(
      `Parsing error for ${filing.accession_number}, attempting LLM fallback`,
    );

    try {
      const { result: fbResult, elapsedMs: fbMs } = await runFallback(
        html,
        filing,
        failedResult,
        fallbackPolicy,
        "heuristic_error",
      );
      timingsMs.llmFallback = fbMs;
      fallback = {
        policy: fallbackPolicy,
        used: true,
        reason: "heuristic_error",
        provider: "deepseek",
      };
      return finalizeResult(fbResult);
    } catch (llmError) {
      logger.error(`[${filing.accession_number}] LLM fallback also failed:`, {
        error: llmError instanceof Error ? llmError.message : String(llmError),
      });
      return finalizeResult(failedResult);
    }
  }
}

// ============================================================================
// Post-Processing (prune + parent info + telemetry)
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
  const pruned = pruneInvalidSubsidiaries(filing.accession_number, result);
  const withParent = ensureParentInfo(
    pruned,
    filing.filingCompanyId,
    filing.filingCompanyName,
  );
  return { ...withParent, telemetry };
}

function pruneInvalidSubsidiaries(
  accessionNumber: string,
  parseResult: ParseResult,
): ParseResult {
  if (!parseResult.subsidiaries || parseResult.subsidiaries.length === 0) {
    return parseResult;
  }

  const { validSubsidiaries, invalidSubsidiaries, results } =
    filterValidSubsidiaries(parseResult.subsidiaries);

  if (invalidSubsidiaries.length === 0) {
    return parseResult;
  }

  const invalidSamples = parseResult.subsidiaries
    .map((sub, index) => ({
      sub,
      validation: results[index],
    }))
    .filter(({ validation }) => !validation.isValid)
    .slice(0, 5)
    .map(({ sub, validation }) => ({
      name: sub.name,
      jurisdiction: sub.jurisdiction,
      issues: validation.issues,
      issueTypes: validation.issueTypes,
    }));

  logger.warn(
    `[${accessionNumber}] Dropping ${invalidSubsidiaries.length} invalid subsidiaries from parse results`,
    { invalidSamples },
  );

  const nextStatus =
    validSubsidiaries.length === 0 && parseResult.status === "success"
      ? "empty"
      : parseResult.status;

  return {
    ...parseResult,
    subsidiaries: validSubsidiaries,
    status: nextStatus,
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

function resolveParseMethod(
  classification: DocumentClassification,
): SubsidiaryParseMethod {
  switch (classification) {
    case DocumentClassification.TEXT_BASED:
      return "text";
    case DocumentClassification.SINGLE_TABLE:
    case DocumentClassification.MULTI_TABLE:
      return "table";
    default:
      return "unknown";
  }
}

function buildNonTableResult(
  $: any,
  config: ParserConfig,
  structure: DocumentStructure,
  filing: { accession_number: string },
): ParseResult {
  if (structure.classification === DocumentClassification.TEXT_BASED) {
    logger.info(
      `[${filing.accession_number}] Detected text-based subsidiaries (${structure.textBased?.entryCount ?? 0}); deferring to LLM`,
    );
  } else {
    logger.info(
      `[${filing.accession_number}] No extractable content: ${structure.classification}`,
    );
  }

  const footnotesHtml = extractFootnotesHtml($, config.processFootnotes);

  const expectedRowCount = structure.tables
    .filter((table) => table.type === TableType.SUBSIDIARY)
    .reduce((sum, table) => sum + table.rowCount, 0);

  return {
    subsidiaries: [],
    method: resolveParseMethod(structure.classification),
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
    method: "unknown",
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
        result: buildNonTableResult($, config, structure, filing),
        elapsedMs: Date.now() - start,
      };
    }

    if (structure.tables.length > 0) {
      logger.info(`[${filing.accession_number}] Table details:`);
      structure.tables.forEach((table, i) => {
        const headerInfo = table.headers
          ? `headers: [${table.headers.join(", ")}]`
          : "continuation table";
        logger.info(
          `[${filing.accession_number}]   Table ${i + 1} (index ${table.index}): ${table.rowCount} rows × ${table.columnCount} cols, ${headerInfo}`,
        );
      });
    }

    logger.debug(`[${filing.accession_number}] Phase 2: Content extraction`);
    const result = extractSubsidiaryRecords({
      structure,
      $,
      config,
      filing,
    });

    const status: ParseResult["status"] =
      result.subsidiaries.length > 0 ? "success" : "empty";

    logger.info(
      `[${filing.accession_number}] Parsing complete: ${status}, ${result.subsidiaries.length} subsidiaries extracted`,
    );

    if (result.subsidiaries.length === 0) {
      logger.info(
        `[${filing.accession_number}] EMPTY RESULT DETAILS: classification=${structure.classification}, totalTables=${structure.totalTableCount}, subsidiaryTables=${structure.tables.length}, textBased=${structure.textBased ? structure.textBased.entryCount : 0}`,
      );
    }

    return {
      result: {
        subsidiaries: result.subsidiaries,
        method: resolveParseMethod(structure.classification),
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
  filing: { accession_number: string },
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
        `[${filing.accession_number}] Parsed ${parseResult.subsidiaries.length}/${parseResult.expectedRowCount} subsidiaries (row-count coverage ${(coverage * 100).toFixed(1)}%). Flagging for review.`,
      );
    }
  }

  if (!validationResult.overallValid || validationResult.invalidCount > 0) {
    const invalidSamples = parseResult.subsidiaries
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
      }));

    logger.warn(
      `[${filing.accession_number}] Validation failed: ${validationResult.invalidCount}/${validationResult.results.length} invalid subsidiaries`,
      {
        invalidSamples,
      },
    );
  }

  return { summary: validationResult, elapsedMs, metrics };
}

function decideFallback(
  parseResult: ParseResult,
  validationSummary: ValidationSummary,
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

  return { shouldFallback: false, reason: "heuristic_ok" };
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
