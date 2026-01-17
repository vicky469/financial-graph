/**
 * Validate Step
 *
 * Validates parsed subsidiary data for completeness.
 * Can be skipped via config.steps.skipValidation
 */

import { Step } from "../../core/types";
import { ParsedFiling, ValidatedFiling } from "../types";

export const validateStep: Step<ParsedFiling, ValidatedFiling> = {
  name: "validate",

  // Skip if configured
  canSkip: (input, context) => {
    return context.config.steps?.skipValidation === true;
  },

  execute(filing, context) {
    const issues: string[] = [];

    // Skip validation for failed parses
    if (!filing.success) {
      return {
        ...filing,
        valid: false,
        issues: [filing.parseResult.errorMessage || "Parse failed"],
      };
    }

    // Validate each subsidiary
    for (const sub of filing.parseResult.subsidiaries) {
      if (!sub.parentId) {
        issues.push(`Missing parentId: ${sub.name}`);
      }
      if (!sub.jurisdiction || sub.jurisdiction.trim() === "") {
        issues.push(`Missing jurisdiction: ${sub.name}`);
      }
      if (!sub.name || sub.name.trim() === "") {
        issues.push(`Empty name found`);
      }
    }

    if (issues.length > 0) {
      context.warnings.push(
        `[${filing.accessionNumber}] ${issues.length} validation issues`
      );
    }

    return {
      ...filing,
      valid: issues.length === 0,
      issues,
    };
  },
};
