/**
 * Subsidiary Data Validator
 * 
 * Abstracted validation logic for subsidiary records that can be used
 * both in CSV validation and in-memory pipeline validation.
 */

export interface ValidationResult {
  isValid: boolean;
  qualityScore: number;
  issues: string[];
  issueTypes: string[];
  needsReview: boolean;
}

export interface SubsidiaryData {
  name: string;
  jurisdiction: string;
}

/**
 * Validates a single subsidiary record using rule-based validation
 */
export function validateSubsidiary(subsidiary: SubsidiaryData): ValidationResult {
  const issues: string[] = [];
  const issueTypes: string[] = [];
  let qualityScore = 100;

  // Check for header rows that got mixed into the data
  const isHeaderRow = 
    subsidiary.jurisdiction.toLowerCase().includes('jurisdiction of incorporation') ||
    subsidiary.jurisdiction.toLowerCase().includes('jurisdiction of organization') ||
    subsidiary.jurisdiction.toLowerCase().includes('state of incorporation') ||
    subsidiary.jurisdiction.toLowerCase().includes('country of incorporation');
    
  if (isHeaderRow) {
    issues.push("Header row detected in data - should be filtered during data processing");
    issueTypes.push("CRITICAL:data_quality");
    qualityScore = 0;
    return {
      isValid: false,
      qualityScore,
      issues,
      issueTypes,
      needsReview: true
    };
  }

  // Rule 1: Jurisdiction too long (should be country/state, not description)
  if (subsidiary.jurisdiction.length > 50) {
    issues.push(`Jurisdiction too long (${subsidiary.jurisdiction.length} chars) - likely contains company name or description`);
    issueTypes.push("CRITICAL:jurisdiction");
    qualityScore -= 40;
  }

  // Rule 2: Jurisdiction looks like a full company name (not just containing suffixes)
  const jurisdictionLooksLikeCompanyName = 
    subsidiary.jurisdiction.toLowerCase().includes('inc') ||
    subsidiary.jurisdiction.toLowerCase().includes('corp') ||
    subsidiary.jurisdiction.toLowerCase().includes('llc') ||
    subsidiary.jurisdiction.toLowerCase().includes('ltd') ||
    subsidiary.jurisdiction.toLowerCase().includes('limited') ||
    subsidiary.jurisdiction.toLowerCase().includes('company') ||
    subsidiary.jurisdiction.toLowerCase().includes('corporation');

  const isActualCompanyName = jurisdictionLooksLikeCompanyName && (
    // Must have multiple words AND end with a company suffix
    subsidiary.jurisdiction.split(/\s+/).length > 2 &&
    /\b(inc|corp|llc|ltd|limited|company|corporation)\.?\s*$/i.test(subsidiary.jurisdiction.trim())
  );
  
  if (isActualCompanyName) {
    issues.push("Jurisdiction appears to be a company name rather than geographic location");
    issueTypes.push("CRITICAL:jurisdiction");
    qualityScore -= 40;
  }

  // Rule 3: Jurisdiction is exact duplicate of company name (data corruption)
  if (subsidiary.name.toLowerCase().trim() === subsidiary.jurisdiction.toLowerCase().trim()) {
    issues.push("Jurisdiction is exact duplicate of company name - data corruption detected");
    issueTypes.push("CRITICAL:jurisdiction");
    qualityScore -= 40;
  }

  // Rule 4: Empty or suspicious fields
  if (!subsidiary.name.trim()) {
    issues.push("Company name is empty");
    issueTypes.push("CRITICAL:name");
    qualityScore -= 50;
  }

  if (!subsidiary.jurisdiction.trim()) {
    issues.push("Jurisdiction is empty");
    issueTypes.push("CRITICAL:jurisdiction");
    qualityScore -= 50;
  }

  // Rule 5: Company name or jurisdiction is just numbers/symbols (data corruption)
  const nameIsJustNumbersOrSymbols = /^\s*[\d\(\)\-\s]+\s*$/.test(subsidiary.name);
  const jurisdictionIsJustNumbersOrSymbols = /^\s*[\d\(\)\-\s]+\s*$/.test(subsidiary.jurisdiction);
  
  if (nameIsJustNumbersOrSymbols) {
    issues.push("Company name contains only numbers and symbols (e.g., '123', '(2)', '-1') - likely data corruption or parsing error");
    issueTypes.push("CRITICAL:name");
    qualityScore -= 50;
  }
  
  if (jurisdictionIsJustNumbersOrSymbols) {
    issues.push("Jurisdiction contains only numbers and symbols (e.g., '123', '(2)', '-1') - likely data corruption or parsing error");
    issueTypes.push("CRITICAL:jurisdiction");
    qualityScore -= 50;
  }

  // Rule 6: Jurisdiction contains numbers (unusual for geographic locations)
  if (/\d/.test(subsidiary.jurisdiction) && !subsidiary.jurisdiction.toLowerCase().includes('hong kong')) {
    issues.push("Jurisdiction contains numbers - unusual for geographic locations");
    issueTypes.push("WARNING:jurisdiction");
    qualityScore -= 20;
  }

  // Determine if needs review
  const needsReview = qualityScore < 80 || issues.length > 0;
  const isValid = qualityScore >= 80 && issues.length === 0;

  return {
    isValid,
    qualityScore,
    issues,
    issueTypes,
    needsReview
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