/**
 * LLM Fallback for Subsidiary Parsing
 * 
 * When rule-based parsing fails validation, use DeepSeek V3.1 to re-parse
 * the HTML and extract subsidiary data with LLM assistance.
 */

import { SubsidiaryRecord, ParseResult } from "../parser/subsidiary/types";
import { LLMModification } from "../parser/subsidiary/llm-enrichment";
import { createLogger } from "../utils/logger";

const logger = createLogger("validation/llm-fallback");

interface LLMSubsidiaryRecord {
  name: string;
  jurisdiction: string;
  ownership_percentage?: number | null;
}

interface LLMParseResponse {
  subsidiaries: LLMSubsidiaryRecord[];
}

/**
 * Use DeepSeek V3.1 to re-parse HTML when validation fails
 */
export async function llmFallbackParse(
  html: string,
  originalResult: ParseResult,
  filingInfo: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName: string;
  }
): Promise<ParseResult> {
  try {
    logger.info(`LLM fallback parsing for ${filingInfo.accession_number}`);

    const llmResult = await callDeepSeekAPI(html);
    
    if (!llmResult || !llmResult.subsidiaries || llmResult.subsidiaries.length === 0) {
      logger.warn(`LLM returned no subsidiaries for ${filingInfo.accession_number}`);
      return {
        ...originalResult,
        method: "LLM - deepseek-chat (no results)",
        status: "empty"
      };
    }

    // Convert LLM results to SubsidiaryRecord format and filter out invalid records
    const validSubsidiaries: SubsidiaryRecord[] = [];

    for (const llmSub of llmResult.subsidiaries) {
      // Skip records with null/empty name or jurisdiction
      if (!llmSub.name || !llmSub.name.trim() || !llmSub.jurisdiction || !llmSub.jurisdiction.trim()) {
        logger.warn(`Skipping invalid LLM subsidiary: name="${llmSub.name}", jurisdiction="${llmSub.jurisdiction}"`);
        continue;
      }

      const record: SubsidiaryRecord = {
        id: generateId(),
        name: llmSub.name.trim(),
        jurisdiction: llmSub.jurisdiction.trim(),
        nestingLevel: 0, // LLM doesn't provide nesting info
        ownership: llmSub.ownership_percentage || undefined,
        footnoteRefs: [],
        indentationSpaces: 0,
        isNested: false
      };
      validSubsidiaries.push(record);
    }

    // If no valid subsidiaries were extracted, return failed status
    if (validSubsidiaries.length === 0) {
      logger.warn(`LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none were valid for ${filingInfo.accession_number}`);
      return {
        ...originalResult,
        method: "LLM - deepseek-chat (no valid results)",
        status: "failed",
        errorMessage: `LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none had valid name and jurisdiction`
      };
    }

    // Calculate modifications between original and LLM results
    const modifications = calculateModifications(originalResult.subsidiaries, validSubsidiaries);

    const enhancedResult: ParseResult = {
      subsidiaries: validSubsidiaries,
      method: "LLM - deepseek-chat",
      status: "success",
      classification: originalResult.classification + " (LLM enhanced)",
      tableCount: originalResult.tableCount,
      maxNestingLevel: 0, // LLM doesn't preserve nesting
      footnotesHtml: originalResult.footnotesHtml,
      llmModifications: modifications
    };

    logger.info(`LLM fallback successful: ${validSubsidiaries.length} valid subsidiaries extracted (${llmResult.subsidiaries.length - validSubsidiaries.length} invalid records skipped)`);
    return enhancedResult;

  } catch (error) {
    logger.error(`LLM fallback failed for ${filingInfo.accession_number}:`, error);
    
    return {
      ...originalResult,
      method: "LLM - deepseek-chat (failed)",
      status: "failed",
      errorMessage: `LLM fallback failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Call DeepSeek V3.1 API to parse HTML
 */
async function callDeepSeekAPI(html: string): Promise<LLMParseResponse | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY environment variable not set");
  }

  const prompt = `You are parsing SEC Exhibit 21 (Subsidiaries of the Registrant) from HTML files. I need the name, jurisdiction, and ownership percentage (optional). Your task is to extract a hierarchical tree of subsidiaries.

For each entity, extract:
- name (legal entity name, verbatim)
- jurisdiction (country/state if available)
- ownership_percentage (number if explicitly stated; otherwise null)

Return ONLY a JSON object with this structure:
{
  "subsidiaries": [
    {
      "name": "Company Name",
      "jurisdiction": "Delaware",
      "ownership_percentage": 100
    }
  ]
}

HTML content:
${html.substring(0, 50000)}`; // Limit HTML to avoid token limits

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in DeepSeek API response");
  }

  try {
    // Extract JSON from response (handle potential markdown formatting)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in LLM response");
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    logger.error("Failed to parse LLM JSON response:", content);
    throw new Error(`Failed to parse LLM response as JSON: ${parseError}`);
  }
}

/**
 * Calculate modifications between original and LLM results
 */
function calculateModifications(
  original: SubsidiaryRecord[],
  llmResult: SubsidiaryRecord[]
): LLMModification[] {
  const modifications: LLMModification[] = [];

  // Create a map for easier comparison
  const originalMap = new Map(original.map(s => [s.name.toLowerCase().trim(), s]));
  const llmMap = new Map(llmResult.map(s => [s.name.toLowerCase().trim(), s]));

  // Check each LLM result against original
  llmResult.forEach(llmSub => {
    const key = llmSub.name.toLowerCase().trim();
    const originalSub = originalMap.get(key);
    
    if (!originalSub) {
      // New subsidiary added by LLM
      modifications.push({
        subsidiaryId: llmSub.id,
        fieldChanges: [{
          field: "subsidiary_added",
          oldValue: null,
          newValue: llmSub.name
        }]
      });
    } else {
      // Compare fields for existing subsidiaries
      const fieldChanges: { field: string; oldValue: unknown; newValue: unknown }[] = [];
      
      if (originalSub.jurisdiction !== llmSub.jurisdiction) {
        fieldChanges.push({
          field: "jurisdiction",
          oldValue: originalSub.jurisdiction,
          newValue: llmSub.jurisdiction
        });
      }
      
      if (originalSub.ownership !== llmSub.ownership) {
        fieldChanges.push({
          field: "ownership",
          oldValue: originalSub.ownership,
          newValue: llmSub.ownership
        });
      }
      
      if (fieldChanges.length > 0) {
        modifications.push({
          subsidiaryId: llmSub.id,
          fieldChanges
        });
      }
    }
  });

  // Check for subsidiaries removed by LLM
  original.forEach(originalSub => {
    const key = originalSub.name.toLowerCase().trim();
    if (!llmMap.has(key)) {
      modifications.push({
        subsidiaryId: originalSub.id,
        fieldChanges: [{
          field: "subsidiary_removed",
          oldValue: originalSub.name,
          newValue: null
        }]
      });
    }
  });

  return modifications;
}

/**
 * Generate a simple ID for subsidiaries
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}