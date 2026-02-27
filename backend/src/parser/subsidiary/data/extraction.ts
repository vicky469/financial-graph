/**
 * Subsidiary extraction logic
 *
 * Orchestrates the extraction of subsidiaries from table rows:
 * 1. Parse each row's cells (name, jurisdiction, ownership)
 * 2. Assign filing-company parent linkage
 * 3. Generate deterministic IDs
 */

import { generateCompanyId } from "@financial-graph/shared/ids";
import { CompanyType } from "@financial-graph/shared/types";
import {
  SUBSIDIARY_KEYWORDS,
  containsAny,
} from "../../../config/subsidiary-keywords";
import type { SubsidiaryRecord } from "../../../pipeline/subsidiary/types";
import type { ParsedColumns } from "../parser-types";
import { parseColumns } from "./columns";
import {
  isHeaderRow,
  filterContentCells,
  hasCompanyEntitySuffix,
} from "../shape/table-detection";
import { MissingColumnError } from "./errors";
import { createLogger } from "../../../utils/logger";
import {
  hasNoteRowPrefix,
  normalizeNoteText,
  hasLeadingSuperscriptNoteMarker,
} from "../footnote/note-markers";

const logger = createLogger("parsers/subsidiary/extraction");
const PLACEHOLDER_NAME_MARKERS = new Set(["none", "null", "nil", "n/a", "na"]);

/**
 * Extract subsidiaries from table rows
 * @param filing - Filing information including filingCompanyId from database
 * @throws MissingColumnError if jurColIdx is invalid
 */
export function extractSubsidiaries(
  $: any,
  rows: any,
  headerRowIndex: number,
  headers: string[],
  filing: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName: string;
  },
): SubsidiaryRecord[] {
  const subsidiaries: SubsidiaryRecord[] = [];

  // Use the filingCompanyId from database (passed in filing object)
  const parentCompanyId = filing.filingCompanyId;

  // Detect column indices from headers
  const nameColIdx = detectColumnIndex(
    headers,
    SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME,
    0,
  );
  const jurColIdx = detectColumnIndex(
    headers,
    SUBSIDIARY_KEYWORDS.JURISDICTION,
    -1,
  );
  if (jurColIdx === -1) {
    throw new MissingColumnError("jurisdiction", filing.accession_number);
  }
  const ownershipColIdx = headers.findIndex((h) =>
    /ownership|percent|%|owned/i.test(h),
  );

  // Note: Footnote processing happens separately in LLM enrichment step (optional)
  // Footnotes HTML is extracted at document level and stored for later processing

  // State for jurisdiction inference
  const footnoteJurisdictions = new Map<string, string>();
  let currentNoteContext: string | undefined;
  let inlineFootnoteSectionStarted = false;

  rows.slice(headerRowIndex + 1).each((_: any, tr: any) => {
    if (inlineFootnoteSectionStarted) return;

    const $tr = $(tr);
    const allCells = $tr.find("td");
    const cells = filterContentCells($, allCells);
    const cellCount = cells.length;

    if (cellCount < 1) return;

    if (
      subsidiaries.length > 0 &&
      isInlineFootnoteRow($, cells, allCells)
    ) {
      inlineFootnoteSectionStarted = true;
      logger.debug(
        `Detected inline footnote section; stopping row extraction for ${filing.accession_number}`,
      );
      return;
    }

    const parsed = parseColumns(
      $,
      cells,
      cellCount,
      nameColIdx,
      jurColIdx,
      ownershipColIdx,
    );
    processParsedRow(parsed);
  });

  function processParsedRow(parsed: ParsedColumns): void {
    // 1. Handle Note Headers (e.g. "(1) Company Name")
    // These rows set the context for subsequent rows
    // Capture leading note refs such as "(1)" for jurisdiction footnote inference.
    const noteHeaderMatch = parsed.rawName.match(/^\s*\((\d+)\)/);
    if (noteHeaderMatch && !parsed.jurisdiction) {
      currentNoteContext = noteHeaderMatch[1];
      return;
    }

    if (
      !parsed.cleanName ||
      parsed.cleanName.length < 2 ||
      parsed.cleanName.length > 200
    ) {
      return;
    }

    if (isHeaderRow(parsed.rawName, parsed.jurisdiction)) return;

    if (isPlaceholderName(parsed.cleanName)) return;

    // 2. Populate Footnote Map
    // If we have a jurisdiction and footnote refs (usually in ownership column), map them
    if (parsed.jurisdiction && parsed.ownershipFootnoteRefs.length > 0) {
      parsed.ownershipFootnoteRefs.forEach((ref) => {
        footnoteJurisdictions.set(ref, parsed.jurisdiction);
      });
    }

    // 3. Apply Fallback
    // If jurisdiction is missing, try to infer from current note context
    if (!parsed.jurisdiction && currentNoteContext) {
      const mappedJur = footnoteJurisdictions.get(currentNoteContext);
      if (mappedJur) {
        parsed.jurisdiction = mappedJur;
      }
    }

    // Combine footnote refs
    const footnoteRefs = [
      ...new Set([...parsed.nameFootnoteRefs, ...parsed.ownershipFootnoteRefs]),
    ];

    // Nesting is intentionally disabled: all subsidiaries are treated as direct
    // children of the filing company.
    const level = 0;
    const parentName = filing.filingCompanyName;
    const parentId = parentCompanyId;

    const normalizedName = parsed.cleanName?.trim() ?? "";
    const normalizedJurisdiction = parsed.jurisdiction?.trim() ?? "";

    // Name is required; jurisdiction may be empty.
    if (!normalizedName) {
      logger.warn(
        `Skipping subsidiary with invalid data: name="${parsed.cleanName}", jurisdiction="${parsed.jurisdiction}"`,
      );
      return;
    }

    const subsidiaryId = generateCompanyId({
      type: CompanyType.SUBSIDIARY,
      name: normalizedName,
      jurisdiction_raw: normalizedJurisdiction || undefined,
    });

    subsidiaries.push({
      id: subsidiaryId,
      name: normalizedName,
      jurisdiction: normalizedJurisdiction,
      nestingLevel: level,
      parentName,
      parentId,
      ownership: parsed.ownership,
      footnoteRefs,
      indentationSpaces: 0,
      isNested: false,
    });
  }

  return subsidiaries;
}

/**
 * Detect column index from headers using keywords
 */
function detectColumnIndex(
  headers: string[],
  keywords: Set<string>,
  defaultIdx: number,
): number {
  const idx = headers.findIndex((h) => containsAny(h, keywords));
  return idx !== -1 ? idx : defaultIdx;
}

// Drop non-entity placeholder tokens that appear in malformed rows (e.g., "None", "N/A").
function isPlaceholderName(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return PLACEHOLDER_NAME_MARKERS.has(normalized);
}

function looksLikeCompanyNoteHeader(text: string): boolean {
  const withoutMarker = text.replace(
    /^\s*(?:\((?:\d{1,3}[A-Za-z]?|[IVXivx]+|[A-Za-z])\)|(?:\d{1,3}[A-Za-z]?|[IVXivx]+|[A-Za-z])[.)])\s+/,
    "",
  );
  if (!withoutMarker) return false;
  return hasCompanyEntitySuffix(withoutMarker);
}

function isInlineFootnoteRow($: any, contentCells: any, allCells: any): boolean {
  if (!contentCells || contentCells.length !== 1) return false;

  const firstContentCell = contentCells[0];
  const firstText = normalizeNoteText($(firstContentCell).text());
  if (!firstText) return false;

  if (hasNoteRowPrefix(firstText)) {
    // Rows like "(1) Nuovo Pignone Holding S.p.a." are context headers for
    // following rows, not the start of trailing footnotes.
    if (looksLikeCompanyNoteHeader(firstText)) return false;
    return true;
  }

  // Some SEC rows use "<sup>n</sup> ..." instead of plain "(n) ..." markers.
  if (allCells && allCells.length > 0) {
    for (let i = 0; i < allCells.length; i++) {
      const cellText = normalizeNoteText($(allCells[i]).text());
      if (!cellText) continue;
      return hasLeadingSuperscriptNoteMarker($, allCells[i]);
    }
  }

  return hasLeadingSuperscriptNoteMarker($, firstContentCell);
}
