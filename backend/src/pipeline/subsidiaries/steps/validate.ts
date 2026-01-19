/**
 * Validate Step
 *
 * Validates parsed subsidiary data using the new abstracted validation approach.
 * Can be skipped via config.steps.skipValidation
 * 
 * Note: Validation is now integrated into the parse step. This step is kept for
 * backward compatibility but uses the same validation logic.
 */

import { Step } from "../../core/types";
import { ParsedFiling, ValidatedFiling } from "../types";
import { validateSubsidiaries } from "../../../validation/subsidiary-validator";
import { createLogger } from "../../../utils/logger";

const logger = createLogger('ValidateStep');

export const validateStep: Step<ParsedFiling, ValidatedFiling> = {
  name: "validate",

  // Skip if configured
  canSkip: (_input, context) => {
    return context.config.steps?.skipValidation === true;
  },

  async execute(filing, context) {
    const issues: string[] = [];

    // Skip validation for failed parses
    if (!filing.success) {
      return {
        ...filing,
        valid: false,
        issues: [filing.parseResult.errorMessage || "Parse failed"],
      };
    }

    try {
      // Ensure we have subsidiaries to validate
      if (!filing.parseResult.subsidiaries || !Array.isArray(filing.parseResult.subsidiaries)) {
        logger.warn(`No subsidiaries array found for ${filing.accessionNumber}`);
        return {
          ...filing,
          valid: true, // Empty is considered valid
          issues: [],
        };
      }

      // Use the new abstracted validation logic
      const subsidiaryData = filing.parseResult.subsidiaries.map((sub, index) => {
        if (!sub || typeof sub !== 'object') {
          logger.warn(`Invalid subsidiary at index ${index} for ${filing.accessionNumber}:`, sub);
          return { name: '', jurisdiction: '' };
        }
        return {
          name: sub.name || '',
          jurisdiction: sub.jurisdiction || ''
        };
      });

      logger.info(`🔍 Validating filing ${filing.accessionNumber}: ${subsidiaryData.length} subsidiaries to validate`);

      const validationResult = validateSubsidiaries(subsidiaryData);
      
      logger.info(`🔍 Validating filing ${filing.accessionNumber}: ${validationResult.validCount}/${subsidiaryData.length} valid (${(validationResult.validCount / subsidiaryData.length * 100).toFixed(1)}%)`);

      // Collect issues from validation results
      validationResult.results.forEach((result, index) => {
        if (!result.isValid) {
          const subsidiary = filing.parseResult.subsidiaries[index];
          if (subsidiary) {
            result.issues.forEach(issue => {
              issues.push(`${subsidiary.name || 'Unknown'}: ${issue}`);
            });
          }
        }
      });

      // Calculate overall quality score
      const avgQualityScore = validationResult.results.length > 0 
        ? validationResult.results.reduce((sum, result) => sum + result.qualityScore, 0) / validationResult.results.length
        : 100;

      const needsReviewCount = validationResult.results.filter(result => result.needsReview).length;

      if (issues.length > 0 || needsReviewCount > 0) {
        const warningMessage = `[${filing.accessionNumber}] ${issues.length} validation issues, ${needsReviewCount} entries need review, avg quality: ${avgQualityScore.toFixed(1)}`;
        if (context.warnings) {
          context.warnings.push(warningMessage);
        }
      }

      return {
        ...filing,
        valid: validationResult.overallValid,
        issues,
        qualityScore: avgQualityScore,
        needsReviewCount,
        qualityAssessments: validationResult.results.map((result) => ({
          score: result.qualityScore,
          issues: result.issues.map(issue => ({
            type: result.issueTypes.includes('CRITICAL') ? 'CRITICAL' as const : 'WARNING' as const,
            field: 'name' as const, // Default to 'name' field for validation issues
            message: issue,
            score: 100 - result.qualityScore
          })),
          needsReview: result.needsReview
        }))
      };

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Validation failed for ${filing.accessionNumber}:`, { error: errorMessage });
      
      if (context.warnings) {
        context.warnings.push(`Validation failed: ${errorMessage}`);
      }
      
      return {
        ...filing,
        valid: false,
        issues: [`Validation error: ${errorMessage}`],
      };
    }
  },
};