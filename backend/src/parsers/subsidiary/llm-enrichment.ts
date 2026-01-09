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

import { Ollama } from "ollama";
import { createLogger } from "../../utils/logger";
import type { SubsidiaryRecord, FootnoteMap } from "./types";

const logger = createLogger("parsers/subsidiary/llm-enrichment");

// Initialize Ollama client
const ollama = new Ollama({ host: "http://localhost:11434" });

// Model to use for enrichment (configurable via env)
const MODEL = process.env.LLM_MODEL || "qwen2:7b";

/**
 * LLM response for ownership enrichment
 */
interface OwnershipInfo {
  parentName?: string; // Name of the parent company (if different from heuristic)
  ownership?: number; // Ownership percentage (0-100)
}

/**
 * Enrich subsidiary records with LLM-extracted ownership from footnotes
 * 
 * For each subsidiary with missing ownership or unclear parent:
 * 1. Extract ownership structure (who owns who)
 * 2. Extract ownership percentage
 * 3. Match parent names to existing subsidiary IDs
 * 4. Update subsidiary records
 * 5. Default to 100% for subsidiaries with no footnotes (standard for Exhibit 21)
 */
export async function enrichWithLLM(
  subsidiaries: SubsidiaryRecord[],
  footnotes: FootnoteMap,
  accessionNumber: string
): Promise<SubsidiaryRecord[]> {
  const needsEnrichment = subsidiaries.filter(
    (sub) => 
      (sub.ownership === undefined || !sub.parentId) && 
      sub.footnoteRefs.length > 0
  );

  if (needsEnrichment.length === 0) {
    logger.info(`[${accessionNumber}] No subsidiaries need LLM enrichment`);
    
    // Still apply default ownership for subsidiaries with no footnotes
    applyDefaultOwnership(subsidiaries, accessionNumber);
    return subsidiaries;
  }

  logger.info(
    `[${accessionNumber}] Enriching ${needsEnrichment.length} subsidiaries with LLM`
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
      const ownershipInfo = await extractOwnershipFromFootnotes(
        sub.name,
        sub.footnoteRefs,
        footnotes
      );

      let updated = false;

      // Update ownership percentage if found
      if (ownershipInfo.ownership !== undefined && sub.ownership === undefined) {
        sub.ownership = ownershipInfo.ownership;
        updated = true;
      }

      // Update parent if found and different from heuristic
      if (ownershipInfo.parentName) {
        const parentId = findParentId(ownershipInfo.parentName, nameToIdMap);
        if (parentId && parentId !== sub.parentId) {
          sub.parentId = parentId;
          sub.parentName = ownershipInfo.parentName;
          updated = true;
        }
      }

      if (updated) {
        enrichedCount++;
        logger.info(
          `[${accessionNumber}] Enriched "${sub.name}": parent=${ownershipInfo.parentName || 'unchanged'}, ownership=${ownershipInfo.ownership || 'unchanged'}%`
        );
      }
    } catch (error: any) {
      failedCount++;
      logger.warn(
        `[${accessionNumber}] Failed to enrich "${sub.name}": ${error.message}`
      );
    }
  }

  logger.info(
    `[${accessionNumber}] LLM enrichment complete: ${enrichedCount} enriched, ${failedCount} failed`
  );

  // Apply default ownership for subsidiaries with no footnotes
  applyDefaultOwnership(subsidiaries, accessionNumber);

  return subsidiaries;
}

/**
 * Apply default 100% ownership to subsidiaries with no footnotes
 * (Standard assumption for Exhibit 21 filings)
 */
function applyDefaultOwnership(
  subsidiaries: SubsidiaryRecord[],
  accessionNumber: string
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
      `[${accessionNumber}] Applied default 100% ownership to ${defaultCount} subsidiaries with no footnotes`
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
  
  // Fuzzy match (contains)
  for (const [name, id] of nameToIdMap.entries()) {
    if (name.includes(normalized) || normalized.includes(name)) {
      return id;
    }
  }
  
  return undefined;
}

/**
 * Extract ownership information from footnotes using LLM
 * Returns both parent structure and ownership percentage
 */
async function extractOwnershipFromFootnotes(
  subsidiaryName: string,
  footnoteRefs: string[],
  footnotes: FootnoteMap
): Promise<OwnershipInfo> {
  // Build footnote context
  const footnoteTexts = footnoteRefs
    .map((ref) => {
      const text = footnotes[ref];
      return text ? `(${ref}) ${text}` : null;
    })
    .filter(Boolean)
    .join("\n");

  if (!footnoteTexts) {
    return {};
  }

  // Build prompt
  const prompt = buildOwnershipPrompt(subsidiaryName, footnoteTexts);

  // Query LLM
  const response = await ollama.generate({
    model: MODEL,
    prompt,
    stream: false,
  });

  const answer = response.response.trim();

  // Parse response
  return parseOwnershipResponse(answer);
}

/**
 * Build prompt for ownership extraction
 */
function buildOwnershipPrompt(
  subsidiaryName: string,
  footnoteTexts: string
): string {
  return `You are analyzing SEC filing footnotes to extract ownership information.

Subsidiary: ${subsidiaryName}

Footnotes:
${footnoteTexts}

Questions:
1. Who owns this subsidiary? (parent company name)
2. What is the ownership percentage?

Rules:
- Return your answer in this exact format: "PARENT: [name or unknown] | OWNERSHIP: [number or unknown]"
- For ownership percentage, return ONLY a number between 0 and 100 (e.g., "100", "75.5", "51")
- If the footnote says "wholly owned" or "100% owned", return "100"
- If the footnote says "majority owned", return "51"
- If no parent is mentioned, return "unknown" for PARENT
- If no ownership information is found, return "100" (default for Exhibit 21 & Exhibit 8 subsidiaries)
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
    if (parentName !== "unknown" && parentName !== "n/a" && parentName !== "none") {
      result.parentName = parentMatch[1].trim(); // Keep original case
    }
  }

  // Parse ownership percentage
  if (ownershipMatch) {
    const ownershipStr = ownershipMatch[1].trim().toLowerCase();
    
    // If "unknown", default to 100% (standard for Exhibit 21)
    if (ownershipStr === "unknown" || ownershipStr === "n/a" || ownershipStr === "none") {
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
