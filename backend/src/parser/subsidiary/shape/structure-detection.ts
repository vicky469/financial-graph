/**
 * Structure Detection Phase
 *
 * Simplified version that focuses on the essential task:
 * 1. Find tables with subsidiary keywords in headers
 * 2. Detect special formats (image/pdf)
 * 3. Return a simple structure description
 */

import * as cheerio from "cheerio";
type CheerioAPI = ReturnType<typeof cheerio.load>;

import { createLogger } from "../../../utils/logger";

import type {
  DocumentStructure,
  ParserConfig,
  TextBasedInfo,
} from "../parser-types";
import { ParserError, DocumentClassification } from "../parser-types";
import { scanTables, classifyDocument } from "./table-classifier";
import { detectSpecialFormats } from "./special-format-detector";

const logger = createLogger("parsers/subsidiary/structure-detection");
const BLOCK_TEXT_SELECTOR = "div,p,li,td";
const MAX_TEXT_BASED_WORDS = 30;
const HEADING_HINT_PATTERN =
  /\b(exhibit\s*21|exhibit\s*8|subsidiaries)\b/i;
const NARRATIVE_SKIP_PATTERN =
  /\b(below is a list|wholly-owned subsidiaries|minority investment|table of contents)\b/i;
const LEGAL_ENTITY_SUFFIX_PATTERN =
  /\b(inc\.?|llc|ltd\.?|limited|corp\.?|corporation|lp|llp|lllp|company|co\.?|partnership|gmbh|pty|s\.?a\.?|b\.?v\.?)\b/i;

function hasJurisdictionPattern(line: string): boolean {
  return (
    /\([^)]+\)\s*\*?$/i.test(line) ||
    /,\s*(a|an)\s+[A-Za-z]/i.test(line) ||
    /,\s*[A-Z][A-Za-z .,&'()/-]{2,}\*?$/i.test(line) ||
    /\s-\s*[A-Z][A-Za-z .,&'()/-]{2,}\*?$/i.test(line)
  );
}

function normalizeCandidateLine(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function collectLeafBlockLines($: CheerioAPI): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  $(BLOCK_TEXT_SELECTOR).each((_: number, element: any) => {
    const $element = $(element);
    if ($element.find(BLOCK_TEXT_SELECTOR).length > 0) {
      return;
    }

    const text = normalizeCandidateLine($element.text());
    if (!text) {
      return;
    }

    if (seen.has(text)) {
      return;
    }

    seen.add(text);
    lines.push(text);
  });

  return lines;
}

function isLikelyTextBasedSubsidiaryEntry(line: string): boolean {
  if (line.length < 10) return false;

  const words = line.split(/\s+/).length;
  if (words > MAX_TEXT_BASED_WORDS) return false;

  if (
    /^(exhibit|schedule|document|copyright)\b/i.test(line) ||
    NARRATIVE_SKIP_PATTERN.test(line)
  ) {
    return false;
  }

  const hasLegalEntitySuffix = LEGAL_ENTITY_SUFFIX_PATTERN.test(line);
  if (!hasLegalEntitySuffix) {
    return false;
  }

  if (hasJurisdictionPattern(line)) {
    return true;
  }

  // Allow simple one-cell company lines when document context implies subsidiary list.
  return words <= 8 && /^[A-Z0-9]/.test(line);
}

function detectTextBasedListings($: CheerioAPI): TextBasedInfo | null {
  const lines = collectLeafBlockLines($);
  if (lines.length === 0) {
    return null;
  }

  const hasHeadingHint = lines.some((line) => HEADING_HINT_PATTERN.test(line));
  const entries = lines.filter(isLikelyTextBasedSubsidiaryEntry);
  const strongPatternEntryCount = entries.filter((line) =>
    hasJurisdictionPattern(line),
  ).length;

  const minEntries = hasHeadingHint || strongPatternEntryCount >= 2 ? 2 : 5;
  if (entries.length < minEntries) {
    return null;
  }

  return {
    entries,
    entryCount: entries.length,
  };
}

// ============================================================================
// Main Structure Detection Function
// ============================================================================

/**
 * Detect and analyze document structure.
 * @param $ - Cheerio instance (parsed once by the caller)
 * @param config - Parser configuration
 * @returns DocumentStructure describing the detected structure
 * @throws ParserError if detection fails
 */
export function detectDocumentStructure(
  $: CheerioAPI,
  _config: ParserConfig,
): DocumentStructure {
  try {
    logger.debug("Starting structure detection");

    const tables = $("table");
    const totalTableCount = tables.length;
    logger.debug(`Found ${totalTableCount} tables in document`);

    const { allTables, subsidiaryTables } = scanTables($, tables);
    const classification =
      totalTableCount === 0
        ? DocumentClassification.NO_TABLE
        : classifyDocument(subsidiaryTables);

    // Only run special-format path when table parsing produced no usable data.
    if (
      classification === DocumentClassification.NO_TABLE ||
      classification === DocumentClassification.HAS_TABLE_NO_DATA
    ) {
      const specialFormat = detectSpecialFormats($);
      if (specialFormat) {
        logger.debug(
          `Detected special format override: ${specialFormat} (base=${classification})`,
        );
        return {
          classification: specialFormat,
          tables: [],
          totalTableCount,
        };
      }

      const textBased = detectTextBasedListings($);
      if (textBased) {
        logger.debug(
          `Detected text-based listing (${textBased.entryCount} entries)`,
        );
        return {
          classification: DocumentClassification.TEXT_BASED,
          tables: allTables,
          totalTableCount,
          textBased,
        };
      }
    }

    if (classification === DocumentClassification.NO_TABLE) {
      logger.debug("No data found - document is empty");
      return {
        classification: DocumentClassification.NO_TABLE,
        tables: [],
        totalTableCount: 0,
      };
    }

    logger.debug(
      `Final classification: ${classification}, ${subsidiaryTables.length} subsidiary tables`,
    );

    return {
      classification,
      tables: allTables,
      totalTableCount,
    };
  } catch (error: any) {
    logger.error(`Structure detection failed: ${error.message}`);

    if (
      error.name === "CheerioError" ||
      error.message?.includes("Invalid HTML")
    ) {
      throw new ParserError(
        `HTML parsing failed: ${error.message}`,
        "HTML_PARSE_ERROR",
        { originalError: error },
      );
    }
    throw error;
  }
}
