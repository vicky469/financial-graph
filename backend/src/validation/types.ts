/**
 * Validation Types
 */

export interface ValidationIssue {
  type: "CRITICAL" | "WARNING" | "INFO";
  field: "name" | "jurisdiction" | "pattern";
  message: string;
  score: number; // Impact on quality score (0-100)
}

export interface QualityAssessment {
  score: number; // 0-100
  issues: ValidationIssue[];
  needsReview: boolean;
}
