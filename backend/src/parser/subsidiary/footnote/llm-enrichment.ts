/**
 * LLM-based enrichment for subsidiary parsing
 *
 * Post-processes heuristic parse results to fill missing ownership data
 * by analyzing footnote text using LLM.
 *
 * Strategy:
 * - Extracts ownership structure (parent-child relationships)
 * - Extracts ownership percentages
 * - Only scans footnotes (not whole document) for efficiency
 * - Validates LLM responses
 * - Preserves original data if LLM fails
 */

import { createLogger } from "../../../utils/logger";
import type { SubsidiaryRecord, LLMModification } from "../../../pipeline/subsidiary/types";
import { createLLMProvider, type LLMProvider } from "./llm-provider";

export type { LLMModification };

const logger = createLogger("parsers/subsidiary/llm-enrichment");

// Singleton LLM provider instance
let llmProvider: LLMProvider | null = null;

function getLLMProvider(): LLMProvider {
  if (!llmProvider) {
    llmProvider = createLLMProvider();
    logger.info(`Initialized LLM provider: ${llmProvider.getName()}`);
  }
  return llmProvider;
}

/**
 * LLM response for ownership enrichment
 */
interface OwnershipInfo {
  parentName?: string; // Name of the parent company (if different from heuristic)
  ownership?: number; // Ownership percentage (0-100)
}

/**
 * Result of LLM enrichment with modification tracking
 */
export interface LLMEnrichmentResult {
  subsidiaries: SubsidiaryRecord[];
  modifications: LLMModification[];
}

/**
 * Enrich subsidiary records with LLM-extracted ownership from footnotes
 *
 * For each subsidiary with footnote references:
 * 1. Extract ownership structure (who owns who)
 * 2. Extract ownership percentage
 * 3. Match parent names to existing subsidiary IDs
 * 4. Update subsidiary records and track modifications
 * 5. Default to 100% for subsidiaries with no footnotes (standard for Exhibit 21)
 *
 * @param subsidiaries - ALL subsidiaries (needed for parent name matching)
 * @param footnotesHtml - Raw HTML of all footnote sections
 * @param filing - Filing metadata (accession_number, filingCompanyId)
 * @returns Result with enriched subsidiaries and list of modifications
 */
export async function enrichWithLLM(
  subsidiaries: SubsidiaryRecord[],
  footnotesHtml: string,
  filing: {
    accession_number: string;
    filingCompanyId: string;
  }
): Promise<LLMEnrichmentResult> {
  const modifications: LLMModification[] = [];

  // Filter to only subsidiaries with footnote refs
  const needsEnrichment = subsidiaries.filter(
    (sub) => sub.footnoteRefs.length > 0
  );

  if (needsEnrichment.length === 0 || !footnotesHtml) {
    logger.info(
      `Skipping LLM enrichment: ` +
      `${needsEnrichment.length} subsidiaries with footnotes, ` +
      `footnotesHtml ${footnotesHtml ? 'present' : 'empty'} (${footnotesHtml?.length || 0} chars)`
    );

    // Still apply default ownership for subsidiaries with no footnotes
    applyDefaultOwnership(subsidiaries);
    return { subsidiaries, modifications };
  }

  logger.info(
    `Enriching ${needsEnrichment.length} subsidiaries with LLM ` +
    `(footnotesHtml: ${footnotesHtml.length} chars)`
  );

  // Build name-to-id map for parent matching
  const nameToIdMap = new Map<string, string>();
  for (const sub of subsidiaries) {
    nameToIdMap.set(sub.name.toLowerCase(), sub.id);
  }

  let enrichedCount = 0;
  let failedCount = 0;

  for (const sub of needsEnrichment) {
    try {
      const changes: {
        field: string;
        oldValue: unknown;
        newValue: unknown;
      }[] = [];

      // Build LLM prompt with filing context, current subsidiary, all subsidiaries, and ALL footnotes HTML
      const ownershipInfo = await extractOwnershipFromFootnotes(
        sub,
        subsidiaries,
        footnotesHtml,
        filing
      );

      // Track ownership changes
      const oldOwnership = sub.ownership;
      const newOwnership = ownershipInfo.ownership;

      if (newOwnership !== undefined && newOwnership !== oldOwnership) {
        sub.ownership = newOwnership;
        changes.push({
          field: "ownership",
          oldValue: oldOwnership,
          newValue: newOwnership,
        });
      }

      // Track parent changes
      const oldParentId = sub.parentId;
      let newParentId: string | undefined;

      if (ownershipInfo.parentName) {
        newParentId = findParentId(ownershipInfo.parentName, nameToIdMap);
        if (newParentId && newParentId !== oldParentId) {
          sub.parentId = newParentId;
          sub.parentName = ownershipInfo.parentName;
          changes.push({
            field: "parentId",
            oldValue: oldParentId,
            newValue: newParentId,
          });
        }
      }

      if (changes.length > 0) {
        enrichedCount++;
        modifications.push({
          subsidiaryId: sub.id,
          fieldChanges: changes,
        });
        logger.info(
          `Enriched "${sub.name}": parent=${
            ownershipInfo.parentName || "unchanged"
          }, ownership=${ownershipInfo.ownership || "unchanged"}%`
        );
      }
    } catch (error: any) {
      failedCount++;
      logger.warn(
        `Failed to enrich "${sub.name}": ${error.message}`
      );
    }
  }

  logger.info(
    `LLM enrichment complete: ${enrichedCount} enriched, ${failedCount} failed`
  );

  // Apply default ownership for subsidiaries with no footnotes
  applyDefaultOwnership(subsidiaries);

  return { subsidiaries, modifications };
}

/**
 * Apply default 100% ownership to subsidiaries with no footnotes
 * (Standard assumption for Exhibit 21 filings)
 */
function applyDefaultOwnership(
  subsidiaries: SubsidiaryRecord[],
): void {
  let defaultCount = 0;

  for (const sub of subsidiaries) {
    if (sub.ownership === undefined && sub.footnoteRefs.length === 0) {
      sub.ownership = 100;
      defaultCount++;
    }
  }

  if (defaultCount > 0) {
    logger.info(
      `Applied default 100% ownership to ${defaultCount} subsidiaries with no footnotes`
    );
  }
}

/**
 * Find parent ID by matching parent name to existing subsidiaries
 */
function findParentId(
  parentName: string,
  nameToIdMap: Map<string, string>
): string | undefined {
  const normalized = parentName.toLowerCase().trim();

  // Exact match
  if (nameToIdMap.has(normalized)) {
    return nameToIdMap.get(normalized);
  }

  return undefined;
}

/**
 * Extract ownership information from footnotes using LLM
 * Returns both parent structure and ownership percentage
 *
 * @param subsidiary - Current subsidiary being analyzed
 * @param allSubsidiaries - All subsidiaries (for parent name -> ID matching)
 * @param footnotesHtml - Raw HTML of all footnote sections
 * @param filing - Filing metadata
 */
async function extractOwnershipFromFootnotes(
  subsidiary: SubsidiaryRecord,
  allSubsidiaries: SubsidiaryRecord[],
  footnotesHtml: string,
  filing: {
    accession_number: string;
    filingCompanyId: string;
  }
): Promise<OwnershipInfo> {
  // Build prompt with full context
  const prompt = buildOwnershipPrompt(
    subsidiary,
    allSubsidiaries,
    footnotesHtml,
    filing
  );

  // Query LLM
  const provider = getLLMProvider();
  const answer = await provider.generate(prompt);

  // Parse response
  return parseOwnershipResponse(answer);
}

/**
 * Build prompt for ownership extraction with full context
 */
function buildOwnershipPrompt(
  subsidiary: SubsidiaryRecord,
  allSubsidiaries: SubsidiaryRecord[],
  footnotesHtml: string,
  filing: {
    accession_number: string;
    filingCompanyId: string;
  }
): string {
  // Build list of available subsidiaries for parent matching
  const subsidiaryList = allSubsidiaries
    .map((s) => `- ${s.name} (ID: ${s.id})`)
    .join("\n");

  // Format footnote refs for the prompt
  const footnoteRefs =
    subsidiary.footnoteRefs.length > 0
      ? `Footnote References: ${subsidiary.footnoteRefs
          .map((ref) => `(${ref})`)
          .join(", ")}`
      : "No footnote references";

  // Determine current parent display
  const currentParent = subsidiary.parentName 
    ? subsidiary.parentName 
    : `Filing Company (ID: ${filing.filingCompanyId})`;

  return `You are analyzing SEC filing footnotes to extract ownership information.

Filing Accession: ${filing.accession_number}
Filing Company ID: ${filing.filingCompanyId}

Subsidiary being analyzed:
- Name: ${subsidiary.name}
- Jurisdiction: ${subsidiary.jurisdiction}
- ${footnoteRefs}
- Current Ownership: ${
    subsidiary.ownership !== undefined ? subsidiary.ownership + "%" : "unknown"
  }
- Current Parent: ${currentParent}

Available subsidiaries for parent matching:
${subsidiaryList}

All footnotes (HTML - may contain tables, paragraphs, or mixed formats):
${footnotesHtml}

Task: Find the footnotes referenced by this subsidiary ${
    footnoteRefs !== "No footnote references"
      ? `(${subsidiary.footnoteRefs.map((r) => `(${r})`).join(", ")})`
      : ""
  } and extract ownership percentage and parent company.

Rules:
- Return your answer in this exact format: "PARENT: [name or unknown] | OWNERSHIP: [number or unknown]"
- For ownership percentage, return ONLY a number between 0 and 100 (e.g., "100", "75.5", "51")
- If the footnote says "wholly owned" or "100% owned", return "100"
- If the footnote says "majority owned", return "51"
- If a parent company is mentioned in the footnote, return the EXACT name from the "Available subsidiaries" list
- If no parent is mentioned (meaning owned directly by the filing company), return "unknown" for PARENT
- If no ownership information is found, return "100" (default for Exhibit 21 and Exhibit 8 subsidiaries)
- The footnote HTML may be in table format (with <tr>, <td>) or paragraph format (with <p>)
- Do NOT include the % symbol
- Do NOT include any explanation or additional text

Answer:`;
}

/**
 * Parse LLM response into ownership information
 */
function parseOwnershipResponse(response: string): OwnershipInfo {
  const result: OwnershipInfo = {};

  // Expected format: "PARENT: [name] | OWNERSHIP: [number]"
  const parentMatch = response.match(/PARENT:\s*([^|]+)/i);
  const ownershipMatch = response.match(/OWNERSHIP:\s*(\S+)/i);

  // Parse parent name
  if (parentMatch) {
    const parentName = parentMatch[1].trim().toLowerCase();
    if (
      parentName !== "unknown" &&
      parentName !== "n/a" &&
      parentName !== "none"
    ) {
      result.parentName = parentMatch[1].trim(); // Keep original case
    }
  }

  // Parse ownership percentage
  if (ownershipMatch) {
    const ownershipStr = ownershipMatch[1].trim().toLowerCase();

    // If "unknown", default to 100% (standard for Exhibit 21)
    if (
      ownershipStr === "unknown" ||
      ownershipStr === "n/a" ||
      ownershipStr === "none"
    ) {
      result.ownership = 100;
    } else {
      const num = parseFloat(ownershipStr);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        result.ownership = num;
      } else {
        // Invalid number, default to 100%
        result.ownership = 100;
      }
    }
  } else {
    // No ownership match, default to 100%
    result.ownership = 100;
  }

  return result;
}
