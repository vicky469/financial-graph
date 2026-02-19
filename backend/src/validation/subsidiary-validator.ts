/**
 * Subsidiary Data Validator
 *
 * Lightweight validation logic used by the pipeline.
 *
 * Current policy:
 * - name is required
 * - jurisdiction can be required by caller (heuristic flow enables this)
 * - reject placeholder and malformed values that commonly leak from parsing
 */

import { isPossibleHeaderRowText } from "../parser/subsidiary/shape/table-detection";

export type ValidationSeverity = "CRITICAL" | "WARNING";
export type ValidationField = "name" | "jurisdiction" | "data_quality";

export interface ValidationIssueDetail {
  severity: ValidationSeverity;
  field: ValidationField;
  type: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  qualityScore: number;
  issues: string[];
  issueTypes: string[];
  issueDetails: ValidationIssueDetail[];
  criticalIssues: string[];
  warningIssues: string[];
  needsReview: boolean;
}

export interface SubsidiaryData {
  name: string | null | undefined;
  jurisdiction?: string | null | undefined;
}

export interface ValidationOptions {
  requireJurisdiction?: boolean;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

const MISSING_NAME_MARKERS = new Set([
  "none",
  "null",
  "nil",
  "n/a",
  "na",
  "not applicable",
  "unknown",
]);

const COMPANY_SUFFIX_REGEX =
  /\b(?:inc|inc\.|corp|corp\.|corporation|co|co\.|company|llc|l\.l\.c\.|llp|l\.l\.p\.|lp|l\.p\.|ltd|ltd\.|limited|plc|gmbh|ag|sa|s\.a\.|bv|n\.v\.|nv)\b/i;
const OWNS_WORD_REGEX = /\bowns\b/i;
const TWO_LETTER_UPPERCASE_JURISDICTION_REGEX = /^[A-Z]{2}$/;
export const MIN_VALID_RATIO = 0.9;

function normalizeMarkerToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isMissingMarker(value: string): boolean {
  if (!value) return false;
  return MISSING_NAME_MARKERS.has(normalizeMarkerToken(value));
}

function isNumericOrSymbolOnly(value: string): boolean {
  return value.length > 0 && /^[\d\W_]+$/.test(value);
}

function containsCompanySuffix(value: string): boolean {
  // Jurisdiction abbreviations like "NV" / "DE" are location codes, not company suffixes.
  if (TWO_LETTER_UPPERCASE_JURISDICTION_REGEX.test(value.trim())) {
    return false;
  }
  return value.length > 0 && COMPANY_SUFFIX_REGEX.test(value);
}

function containsOwnsWord(value: string): boolean {
  return value.length > 0 && OWNS_WORD_REGEX.test(value);
}

/**
 * Validates a single subsidiary record using essential checks only.
 */
export function validateSubsidiary(
  subsidiary: SubsidiaryData,
  options: ValidationOptions = {},
): ValidationResult {
  const issues: string[] = [];
  const issueTypes: string[] = [];
  const issueDetails: ValidationIssueDetail[] = [];
  const criticalIssues: string[] = [];
  const warningIssues: string[] = [];
  let qualityScore = 100;
  let hasCriticalIssue = false;

  const name = normalizeText(subsidiary.name);
  const jurisdiction = normalizeText(subsidiary.jurisdiction);
  const hasJurisdiction = jurisdiction.length > 0;

  const addIssue = (
    severity: ValidationSeverity,
    field: ValidationField,
    message: string,
  ): void => {
    const type = `${severity}:${field}`;
    issues.push(message);
    issueTypes.push(type);
    issueDetails.push({
      severity,
      field,
      type,
      message,
    });
    if (severity === "CRITICAL") {
      criticalIssues.push(message);
      hasCriticalIssue = true;
      qualityScore -= 50;
    } else {
      warningIssues.push(message);
      qualityScore -= 15;
    }
  };

  // Rule 1: Name is required.
  if (!name) {
    addIssue("CRITICAL", "name", "Company name is required");
  }

  // Rule 2: Placeholder names are invalid.
  if (isMissingMarker(name)) {
    addIssue(
      "CRITICAL",
      "name",
      `Company name is a placeholder value ("${name}")`,
    );
  }

  // Rule 3: Header rows should not leak into data.
  const isHeaderRow = isPossibleHeaderRowText(
    name,
    jurisdiction,
  );

  if (isHeaderRow) {
    addIssue(
      "CRITICAL",
      "data_quality",
      "Header row detected in data - should be filtered during data processing",
    );
  }

  // Rule 4: Name should not be numeric/symbol-only.
  const nameIsJustNumbersOrSymbols = isNumericOrSymbolOnly(name);
  if (nameIsJustNumbersOrSymbols) {
    addIssue(
      "CRITICAL",
      "name",
      "Company name contains only numbers and symbols (e.g., '123', '(2)', '-1') - likely parsing error",
    );
  }

  // Rule 5: Narrative sentence fragments should not be treated as company names.
  if (containsOwnsWord(name)) {
    addIssue(
      "CRITICAL",
      "name",
      `Company name contains narrative keyword "owns" ("${name}")`,
    );
  }

  // Rule 6: Optionally require jurisdiction (used by heuristic validation gate).
  if (options.requireJurisdiction && !hasJurisdiction) {
    addIssue(
      "CRITICAL",
      "jurisdiction",
      "Jurisdiction is required",
    );
  }

  // Rule 7: If jurisdiction is provided, reject numeric/symbol-only values.
  const jurisdictionIsJustNumbersOrSymbols =
    hasJurisdiction && isNumericOrSymbolOnly(jurisdiction);
  if (jurisdictionIsJustNumbersOrSymbols) {
    addIssue(
      "CRITICAL",
      "jurisdiction",
      "Jurisdiction contains only numbers and symbols - likely parsing noise",
    );
  }

  // Rule 8: Jurisdiction should not contain company suffixes (likely shifted company name).
  const jurisdictionLooksLikeCompanyName =
    hasJurisdiction && containsCompanySuffix(jurisdiction);
  if (jurisdictionLooksLikeCompanyName) {
    addIssue(
      "CRITICAL",
      "jurisdiction",
      `Jurisdiction appears to contain a company suffix ("${jurisdiction}")`,
    );
  }

  const normalizedScore = Math.max(0, qualityScore);
  const needsReview = issues.length > 0;
  const isValid = !hasCriticalIssue;

  return {
    isValid,
    qualityScore: normalizedScore,
    issues,
    issueTypes,
    issueDetails,
    criticalIssues,
    warningIssues,
    needsReview,
  };
}

/**
 * Validates multiple subsidiary records and returns overall validation result
 */
export function validateSubsidiaries(
  subsidiaries: SubsidiaryData[],
  options: ValidationOptions = {},
): {
  overallValid: boolean;
  validCount: number;
  invalidCount: number;
  results: ValidationResult[];
} {
  const results = subsidiaries.map((subsidiary) =>
    validateSubsidiary(subsidiary, options),
  );
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.length - validCount;
  const invalidRatio =
    subsidiaries.length === 0 ? 0 : invalidCount / subsidiaries.length;

  // overallValid means at least 90% of rows pass validation.
  const overallValid =
    subsidiaries.length === 0 || invalidRatio <= 1 - MIN_VALID_RATIO;

  return {
    overallValid,
    validCount,
    invalidCount,
    results
  };
}

export function filterValidSubsidiaries<T extends SubsidiaryData>(
  subsidiaries: T[],
  options: ValidationOptions = {},
): {
  validSubsidiaries: T[];
  invalidSubsidiaries: T[];
  results: ValidationResult[];
} {
  const results = subsidiaries.map((subsidiary) =>
    validateSubsidiary(subsidiary, options),
  );
  const validSubsidiaries: T[] = [];
  const invalidSubsidiaries: T[] = [];

  subsidiaries.forEach((subsidiary, index) => {
    if (results[index].isValid) {
      validSubsidiaries.push(subsidiary);
    } else {
      invalidSubsidiaries.push(subsidiary);
    }
  });

  return { validSubsidiaries, invalidSubsidiaries, results };
}
