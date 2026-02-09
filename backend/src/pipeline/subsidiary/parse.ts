/**
 * Subsidiary parsing pipeline (heuristic + fallback + telemetry).
 */

import { createLogger } from "../../utils/logger";
import { parseExhibitRefactored, ParserError } from "../../parser/subsidiary";
import type {
  ParseResult,
  ParseTelemetry,
  SubsidiaryFallbackPolicy,
} from "../../parser/subsidiary/types";
import { validateSubsidiaries } from "../../validation/subsidiary-validator";
import { llmFallbackParse } from "../../validation/llm-fallback";
import type { DecompressedFiling, ParsedFiling } from "../../jobs/parse_subsidiaries/types";

const logger = createLogger("pipeline/subsidiary/parse");

type ValidationSummary = ReturnType<typeof validateSubsidiaries> | null;

type ParseDecision = {
  shouldFallback: boolean;
  reason: string;
};

function ensureParentInfo(
  parseResult: ParseResult,
  filingCompanyId: string,
  filingCompanyName?: string,
): ParseResult {
  if (!parseResult.subsidiaries || parseResult.subsidiaries.length === 0) {
    return parseResult;
  }

  const normalizedCompanyName = filingCompanyName?.trim();

  const updatedSubsidiaries = parseResult.subsidiaries.map((sub) => {
    const parentId = sub.parentId || filingCompanyId;
    const parentName = sub.parentName || normalizedCompanyName;

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

function initTelemetry(policy: SubsidiaryFallbackPolicy): ParseTelemetry {
  return {
    timingsMs: {},
    fallback: { policy, used: false },
  };
}

function finalizeTelemetry(
  telemetry: ParseTelemetry,
  startedAt: number,
): ParseTelemetry {
  const totalMs = Date.now() - startedAt;
  return {
    ...telemetry,
    timingsMs: {
      ...telemetry.timingsMs,
      total: totalMs,
    },
  };
}

function withTelemetry(
  result: ParseResult,
  telemetry: ParseTelemetry,
  startedAt: number,
): ParseResult {
  return {
    ...result,
    telemetry: finalizeTelemetry(telemetry, startedAt),
  };
}

function buildFailedParseResult(errorMessage: string): ParseResult {
  return {
    subsidiaries: [],
    method: "heuristic",
    status: "failed",
    classification: "failed",
    tableCount: 0,
    maxNestingLevel: 0,
    footnotesHtml: "",
    errorMessage,
  };
}

async function runHeuristicParse(
  file: DecompressedFiling,
  telemetry: ParseTelemetry,
): Promise<ParseResult> {
  const start = Date.now();
  try {
    return await parseExhibitRefactored(file.html, {
      accession_number: file.accessionNumberNoDashes,
      cik: file.cik,
      filingCompanyId: file.companyId,
      filingCompanyName: file.companyName,
    });
  } finally {
    telemetry.timingsMs = {
      ...telemetry.timingsMs,
      heuristic: Date.now() - start,
    };
  }
}

function validateHeuristicResult(
  file: DecompressedFiling,
  parseResult: ParseResult,
  telemetry: ParseTelemetry,
): ValidationSummary {
  if (
    parseResult.status !== "success" ||
    parseResult.subsidiaries.length === 0
  ) {
    return null;
  }

  const validationStart = Date.now();
  const validationResult = validateSubsidiaries(
    parseResult.subsidiaries.map((sub) => ({
      name: sub.name,
      jurisdiction: sub.jurisdiction,
    })),
  );
  telemetry.timingsMs = {
    ...telemetry.timingsMs,
    validation: Date.now() - validationStart,
  };
  telemetry.validation = {
    total: parseResult.subsidiaries.length,
    valid: validationResult.validCount,
    overallValid: validationResult.overallValid,
  };

  logger.info(
    `Validation for ${file.accessionNumberNoDashes}: ${validationResult.validCount}/${parseResult.subsidiaries.length} valid (${(
      (validationResult.validCount / parseResult.subsidiaries.length) *
      100
    ).toFixed(1)}%)`,
  );

  return validationResult;
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
  file: DecompressedFiling,
  baseResult: ParseResult,
  telemetry: ParseTelemetry,
  policy: SubsidiaryFallbackPolicy,
  reason: string,
): Promise<ParseResult> {
  telemetry.fallback = {
    policy,
    used: true,
    reason,
    provider: "deepseek",
  };

  const llmStart = Date.now();
  const llmResult = await llmFallbackParse(file.html, baseResult, {
    accession_number: file.accessionNumberNoDashes,
    cik: file.cik,
    filingCompanyId: file.companyId,
    filingCompanyName: file.companyName || "",
  });
  telemetry.timingsMs = {
    ...telemetry.timingsMs,
    llmFallback: Date.now() - llmStart,
  };

  return llmResult;
}

function finalizeParsedFiling(
  file: DecompressedFiling,
  parseResult: ParseResult,
  telemetry: ParseTelemetry,
  startedAt: number,
): ParsedFiling {
  const finalParseResult = withTelemetry(
    ensureParentInfo(parseResult, file.companyId, file.companyName),
    telemetry,
    startedAt,
  );

  const { html: _html, ...rest } = file;
  return {
    ...rest,
    parseResult: finalParseResult,
  };
}

export async function parseFiling(
  file: DecompressedFiling,
  options: { fallbackPolicy?: SubsidiaryFallbackPolicy } = {},
): Promise<ParsedFiling> {
  const fallbackPolicy = options.fallbackPolicy ?? "llm";
  const telemetry = initTelemetry(fallbackPolicy);
  const startedAt = Date.now();

  try {
    const heuristicResult = await runHeuristicParse(file, telemetry);
    const validationSummary = validateHeuristicResult(
      file,
      heuristicResult,
      telemetry,
    );

    if (fallbackPolicy === "none") {
      if (heuristicResult.status === "failed") {
        throw new Error(
          heuristicResult.errorMessage || "Heuristic parsing failed",
        );
      }

      return finalizeParsedFiling(file, heuristicResult, telemetry, startedAt);
    }

    const decision = decideFallback(heuristicResult, validationSummary);

    if (decision.shouldFallback) {
      logger.warn(
        `${decision.reason} for ${file.accessionNumberNoDashes}, attempting LLM fallback`,
      );
      const fallbackResult = await runFallback(
        file,
        heuristicResult,
        telemetry,
        fallbackPolicy,
        decision.reason,
      );
      return finalizeParsedFiling(file, fallbackResult, telemetry, startedAt);
    }

    return finalizeParsedFiling(file, heuristicResult, telemetry, startedAt);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof ParserError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    logger.error(`Parse step failed for ${file.accessionNumberNoDashes}:`, {
      error: errorMessage,
    });

    const failedResult = buildFailedParseResult(errorMessage);

    if (fallbackPolicy === "none") {
      throw error;
    }

    logger.warn(
      `Parsing error for ${file.accessionNumberNoDashes}, attempting LLM fallback`,
    );

    try {
      const fallbackResult = await runFallback(
        file,
        failedResult,
        telemetry,
        fallbackPolicy,
        "heuristic_error",
      );
      return finalizeParsedFiling(file, fallbackResult, telemetry, startedAt);
    } catch (llmError) {
      logger.error(
        `LLM fallback also failed for ${file.accessionNumberNoDashes}:`,
        {
          error:
            llmError instanceof Error ? llmError.message : String(llmError),
        },
      );

      return finalizeParsedFiling(file, failedResult, telemetry, startedAt);
    }
  }
}
