/**
 * Subsidiary Data Validator
 *
 * Lightweight validation logic used by the pipeline.
 *
 * Current policy (intentional simplification):
 * - name is required
 * - jurisdiction is optional
 * - avoid hard-coded jurisdiction/company heuristics
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

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Validates a single subsidiary record using essential checks only.
 */
export function validateSubsidiary(subsidiary: SubsidiaryData): ValidationResult {
  const issues: string[] = [];
  const issueTypes: string[] = [];
  const issueDetails: ValidationIssueDetail[] = [];
  const criticalIssues: string[] = [];
  const warningIssues: string[] = [];
  let qualityScore = 100;
  let hasCriticalIssue = false;

  const name = normalizeText(subsidiary.name);
  const jurisdiction = normalizeText(subsidiary.jurisdiction);

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

  // Rule 2: Header rows should not leak into data.
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

  // Rule 3: Name should not be numeric/symbol-only.
  const nameIsJustNumbersOrSymbols = /^\s*[\d\(\)\-\s]+\s*$/.test(name);
  if (nameIsJustNumbersOrSymbols) {
    addIssue(
      "CRITICAL",
      "name",
      "Company name contains only numbers and symbols (e.g., '123', '(2)', '-1') - likely parsing error",
    );
  }

  // Rule 4: Jurisdiction is optional. If provided but numeric/symbol-only, flag for review.
  const hasJurisdiction = jurisdiction.length > 0;
  const jurisdictionIsJustNumbersOrSymbols =
    hasJurisdiction && /^\s*[\d\(\)\-\s]+\s*$/.test(jurisdiction);
  if (jurisdictionIsJustNumbersOrSymbols) {
    addIssue(
      "CRITICAL",
      "jurisdiction",
      "Jurisdiction contains only numbers and symbols - likely parsing noise",
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
export function validateSubsidiaries(subsidiaries: SubsidiaryData[]): {
  overallValid: boolean;
  validCount: number;
  invalidCount: number;
  results: ValidationResult[];
} {
  const results = subsidiaries.map(validateSubsidiary);
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.length - validCount;
  
  // Consider overall valid if more than 80% of records are valid
  const overallValid = subsidiaries.length === 0 || (validCount / subsidiaries.length) >= 0.8;

  return {
    overallValid,
    validCount,
    invalidCount,
    results
  };
}

export function filterValidSubsidiaries<T extends SubsidiaryData>(
  subsidiaries: T[],
): {
  validSubsidiaries: T[];
  invalidSubsidiaries: T[];
  results: ValidationResult[];
} {
  const results = subsidiaries.map(validateSubsidiary);
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
