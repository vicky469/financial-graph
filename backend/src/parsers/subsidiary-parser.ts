/**
 * Subsidiary Parser
 *
 * Pure parsing functions for SEC Exhibit 21 (10-K) and Exhibit 8 (20-F) files
 * Extracts subsidiary information with hierarchical parent-child relationships
 *
 * Parsing Strategy (in order):
 * 1. Heuristic Table Parser - Handles both flat and nested structures via indentation analysis
 * 2. LLM Parser (optional fallback) - Uses Ollama for complex structures
 *
 * The heuristic parser:
 * - Finds columns via keyword matching (robust to column ordering)
 * - Analyzes indentation for every row (detects nested hierarchies)
 * - If no indentation found: maxNestingLevel = 0 (flat table)
 * - If indentation found: maxNestingLevel > 0 (nested table)
 */

import { load } from "cheerio";
import {
  SUBSIDIARY_KEYWORDS,
  containsAny,
} from "../config/subsidiary-keywords";
import { generateCompanyId } from "../db/ids";
import { createLogger } from "../utils/logger";

const logger = createLogger("parsers/subsidiary");

// ============================================================================
// Type Definitions
// ============================================================================

export interface SubsidiaryRecord {
  name: string;
  jurisdiction: string;
  nestingLevel: number;
  parentName?: string; // For nested subsidiaries (human-readable)
  parentId?: string; // UUID of parent company (for database relations)
  ownership?: number; // Ownership percentage
  footnotes: string[];
  indentationSpaces: number;
  isNested: boolean;
}

export interface ParseResult {
  subsidiaries: SubsidiaryRecord[];
  method: "Heuristic" | "LLM" | "Failed";
  tableCount: number;
  maxNestingLevel: number;
}

// ============================================================================
// Main Parser Entry Point
// ============================================================================

export async function parseExhibit(
  html: string,
  filing: { accession_number: string; cik?: string },
  useLLMFallback: boolean = false
): Promise<ParseResult> {
  // Generate filing company ID from CIK
  const filingCompanyId = filing.cik
    ? generateCompanyId({
        type: "public",
        identity: { cik: filing.cik },
      })
    : undefined;

  // Strategy 1: Heuristic table parsing (handles both flat and nested)
  const heuristicResult = parseHeuristicTable(html, filingCompanyId);

  if (heuristicResult && heuristicResult.subsidiaries.length > 0) {
    logger.info(
      `[${filing.accession_number}] Heuristic parser succeeded: ${heuristicResult.subsidiaries.length} subsidiaries (maxNesting: ${heuristicResult.maxNestingLevel})`
    );
    return {
      ...heuristicResult,
      method: "Heuristic",
    };
  }

  // Strategy 2: LLM fallback (if enabled)
  if (useLLMFallback) {
    logger.warn(`[${filing.accession_number}] Trying LLM fallback...`);
    const llmResult = await parseLLM(html, filing.accession_number);

    if (llmResult && llmResult.subsidiaries.length > 0) {
      logger.info(
        `[${filing.accession_number}] LLM parser succeeded: ${llmResult.subsidiaries.length} subsidiaries`
      );
      return {
        ...llmResult,
        method: "LLM",
      };
    }
  }

  // All strategies failed
  logger.error(`[${filing.accession_number}] All parsing strategies failed`);
  return {
    subsidiaries: [],
    method: "Failed",
    tableCount: 0,
    maxNestingLevel: 0,
  };
}

// ============================================================================
// Heuristic Table Parser (handles both flat and nested structures)
// ============================================================================

function parseHeuristicTable(
  html: string,
  filingCompanyId?: string
): Omit<ParseResult, "method"> | null {
  const $ = load(html, { xmlMode: false, decodeEntities: true });
  const tables = $("table");

  if (tables.length === 0) return null;

  const bestTable = findSubsidiaryTable($, tables);
  if (!bestTable) return null;

  const rows = bestTable.find("tr");
  const headerRowIndex = findHeaderRow($, rows);

  if (headerRowIndex === -1) return null;

  const headers = extractHeaders($, rows[headerRowIndex]);
  const subsidiaries = extractSubsidiaries(
    $,
    rows,
    headerRowIndex,
    headers,
    filingCompanyId
  );

  if (subsidiaries.length === 0) return null;

  const maxNestingLevel = Math.max(
    ...subsidiaries.map((s) => s.nestingLevel),
    0
  );

  return {
    subsidiaries,
    tableCount: tables.length,
    maxNestingLevel,
  };
}

function extractSubsidiaries(
  $: any,
  rows: any,
  headerRowIndex: number,
  headers: string[],
  filingCompanyId?: string
): SubsidiaryRecord[] {
  const subsidiaries: SubsidiaryRecord[] = [];
  const parentStack: Array<{ level: number; name: string; id: string }> = [];

  // Find name and jurisdiction column indices (more robust than assuming 0,1)
  const nameColIdx =
    headers.findIndex((h) =>
      containsAny(h, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME)
    ) || 0;
  const jurColIdx =
    headers.findIndex((h) =>
      containsAny(h, SUBSIDIARY_KEYWORDS.JURISDICTION)
    ) || 1;

  rows.slice(headerRowIndex + 1).each((_: any, tr: any) => {
    const $tr = $(tr);
    const cells = $tr.find("td");

    if (cells.length < 2) return;

    const nameCell = $(cells[nameColIdx]);
    const jurisdictionCell = $(cells[jurColIdx]);
    const rawName = nameCell.text().trim();
    const jurisdiction = jurisdictionCell.text().trim();

    if (!rawName || rawName.length < 2 || rawName.length > 200) return;
    if (isHeaderRow(rawName, jurisdiction)) return;

    const footnotes = extractFootnotes(rawName);
    const cleanName = cleanSubsidiaryName(rawName);
    const cleanedJurisdiction = cleanJurisdiction(jurisdiction);
    const ownership = parseOwnership(jurisdiction, cells);

    // Analyze indentation (detects nested structures)
    const indentInfo = analyzeIndentation(nameCell, rawName);
    const level = determineNestingLevel(indentInfo, subsidiaries);

    // Determine parent using stack
    while (
      parentStack.length > 0 &&
      parentStack[parentStack.length - 1].level >= level
    ) {
      parentStack.pop();
    }

    const parentName =
      parentStack.length > 0
        ? parentStack[parentStack.length - 1].name
        : undefined;

    // Determine parent ID: use parent from stack or filing company
    const parentId =
      parentStack.length > 0
        ? parentStack[parentStack.length - 1].id
        : filingCompanyId;

    // Generate ID for this subsidiary (private company)
    const subsidiaryId = generateCompanyId({
      type: "private",
      name: cleanName,
      jurisdiction_raw: cleanedJurisdiction,
      parent_company_id: parentId,
    });

    subsidiaries.push({
      name: cleanName,
      jurisdiction: cleanedJurisdiction,
      nestingLevel: level,
      parentName,
      parentId,
      ownership,
      footnotes,
      indentationSpaces: indentInfo.spaces,
      isNested: level > 0 || !!parentName,
    });

    parentStack.push({ level, name: cleanName, id: subsidiaryId });
  });

  return subsidiaries;
}

// ============================================================================
// Strategy 2: LLM Parser (Fallback)
// ============================================================================

async function parseLLM(
  html: string,
  accession: string
): Promise<Omit<ParseResult, "method"> | null> {
  // Placeholder - would call LLM parser from existing code
  // Not implementing full LLM integration here as it requires Ollama setup
  logger.warn(
    `[${accession}] LLM parsing not yet implemented in consolidated parser`
  );
  return null;
}

// ============================================================================
// Helper Functions: Table Detection
// ============================================================================

function findSubsidiaryTable($: any, tables: any): any {
  let bestTable: any = null;
  let maxScore = 0;

  tables.each((_: number, tbl: any) => {
    const $tbl = $(tbl);
    const rows = $tbl.find("tr");
    if (rows.length < 2) return;

    let score = 0;

    // Check first 3 rows for keywords
    const headerText = rows.slice(0, 3).text();
    if (containsAny(headerText, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME))
      score += 3;
    if (containsAny(headerText, SUBSIDIARY_KEYWORDS.JURISDICTION)) score += 3;

    // Check preceding context for "Exhibit 21" or "Exhibit 8"
    const prevText = $tbl
      .prevAll("b, strong, p, h1, h2, h3, h4, h5, h6, div, font")
      .first()
      .text();
    if (containsAny(prevText, SUBSIDIARY_KEYWORDS.EXHIBIT_MARKER)) score += 5;

    if (score > maxScore) {
      maxScore = score;
      bestTable = $tbl;
    }
  });

  return bestTable || tables.first();
}

function findHeaderRow($: any, rows: any): number {
  let headerRowIndex = -1;

  rows.slice(0, 10).each((i: number, tr: any) => {
    const $tr = $(tr);
    const hasThCells = $tr.find("th").length > 0;
    const text = $tr.text().toLowerCase();
    const cellCount = $tr.find("td, th").length;

    if (cellCount === 1) return;
    if (text.length < 10 && !text.includes("name")) return;

    if (hasThCells && headerRowIndex === -1) {
      headerRowIndex = i;
      return false;
    }

    if (
      headerRowIndex === -1 &&
      containsAny(text, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) &&
      containsAny(text, SUBSIDIARY_KEYWORDS.JURISDICTION)
    ) {
      headerRowIndex = i;
      return false;
    }
  });

  return headerRowIndex === -1 ? 0 : headerRowIndex;
}

function extractHeaders($: any, headerRow: any): string[] {
  const headers: string[] = [];

  $(headerRow)
    .find("th, td")
    .each((_: any, cell: any) => {
      let text = $(cell)
        .text()
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) text = `Column_${headers.length}`;
      headers.push(text);
    });

  return headers;
}

// ============================================================================
// Helper Functions: Data Cleaning
// ============================================================================

function cleanSubsidiaryName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "") // Remove footnotes
    .replace(/[—\-\*]+\s*/g, "") // Remove bullets and dashes
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

function cleanJurisdiction(jurisdiction: string): string {
  // Remove ownership percentages if they leaked into jurisdiction column
  let cleaned = jurisdiction
    .replace(/\d+(\.\d+)?%/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Standardize common abbreviations
  const stateMap: Record<string, string> = {
    Del: "Delaware",
    "Del.": "Delaware",
    CA: "California",
    NY: "New York",
    TX: "Texas",
    // Add more as needed
  };

  return stateMap[cleaned] || cleaned;
}

function parseOwnership(jurisdiction: string, cells: any): number | undefined {
  // Check if jurisdiction contains percentage
  const jurMatch = jurisdiction.match(/([\d\.]+)\s*%/);
  if (jurMatch) return parseFloat(jurMatch[1]);

  // Check other cells for ownership column
  // This is a simplified version - could be enhanced
  return undefined;
}

function extractFootnotes(name: string): string[] {
  const footnotes: string[] = [];
  const matches = name.match(/\(([^)]+)\)/g);

  if (matches) {
    matches.forEach((match) => {
      footnotes.push(match.slice(1, -1));
    });
  }

  return footnotes;
}

function isHeaderRow(name: string, jurisdiction: string): boolean {
  const text = (name + " " + jurisdiction).toLowerCase();
  return (
    containsAny(text, SUBSIDIARY_KEYWORDS.TITLE_MARKERS) ||
    containsAny(text, SUBSIDIARY_KEYWORDS.SECTION_HEADERS) ||
    (text.includes("name") && text.includes("jurisdiction"))
  );
}

// ============================================================================
// Helper Functions: Indentation Analysis
// ============================================================================

function analyzeIndentation(
  nameCell: any,
  rawName: string
): { spaces: number; hasIndentation: boolean } {
  const cellHtml = nameCell.html() || "";
  const nbspCount = (cellHtml.match(/&nbsp;/g) || []).length;

  const style = nameCell.attr("style") || "";
  const marginMatch = style.match(/margin-left:\s*(\d+)/);
  const paddingMatch = style.match(/padding-left:\s*(\d+)/);

  const leadingSpaces = rawName.match(/^(\s*)/)?.[1]?.length || 0;

  let spaces = 0;

  if (nbspCount > 0) {
    spaces = nbspCount * 4;
  } else if (marginMatch) {
    spaces = parseInt(marginMatch[1]) / 4;
  } else if (paddingMatch) {
    spaces = parseInt(paddingMatch[1]) / 4;
  } else if (leadingSpaces > 0) {
    spaces = leadingSpaces;
  }

  return {
    spaces,
    hasIndentation: spaces > 0,
  };
}

function determineNestingLevel(
  indentInfo: { spaces: number; hasIndentation: boolean },
  existingSubsidiaries: SubsidiaryRecord[]
): number {
  if (!indentInfo.hasIndentation) return 0;

  // Find most recent subsidiary with less indentation
  for (let i = existingSubsidiaries.length - 1; i >= 0; i--) {
    const existing = existingSubsidiaries[i];
    if (existing.indentationSpaces < indentInfo.spaces) {
      return existing.nestingLevel + 1;
    }
  }

  return 1;
}
