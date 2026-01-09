/**
 * Subsidiary extraction logic
 *
 * Orchestrates the extraction of subsidiaries from table rows:
 * 1. Parse each row's cells (name, jurisdiction, ownership)
 * 2. Detect nesting via indentation
 * 3. Build parent-child relationships
 * 4. Generate deterministic IDs
 */

import { generateCompanyId } from "../../db/ids";
import {
  SUBSIDIARY_KEYWORDS,
  containsAny,
} from "../../config/subsidiary-keywords";
import type { SubsidiaryRecord, FootnoteMap } from "./types";
import { parseColumns } from "./columns";
import { isHeaderRow, filterContentCells } from "./table-detection";
import { determineNestingLevel, ParentStack } from "./nesting";
import { MissingColumnError } from "./errors";

/**
 * Extract subsidiaries from table rows
 * @throws MissingColumnError if jurColIdx is invalid
 */
export function extractSubsidiaries(
  $: any,
  rows: any,
  headerRowIndex: number,
  headers: string[],
  filing: { accession_number: string; cik: string },
  documentFootnotes: FootnoteMap = {}
): SubsidiaryRecord[] {
  const subsidiaries: SubsidiaryRecord[] = [];
  const parentStack = new ParentStack();

  // Generate filing company ID from CIK
  const filingCompanyId = generateCompanyId({
    type: "public",
    identity: { cik: filing.cik },
  });

  // Detect column indices from headers
  const nameColIdx = detectColumnIndex(
    headers,
    SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME,
    0
  );
  const jurColIdx = detectColumnIndex(
    headers,
    SUBSIDIARY_KEYWORDS.JURISDICTION,
    -1
  );
  if (jurColIdx === -1) {
    throw new MissingColumnError("jurisdiction", filing.accession_number);
  }
  const ownershipColIdx = headers.findIndex((h) =>
    /ownership|percent|%|owned/i.test(h)
  );

  // Note: documentFootnotes passed for potential future use
  // Currently ownership resolution happens in LLM enrichment step
  void documentFootnotes;

  // State for jurisdiction inference
  const footnoteJurisdictions = new Map<string, string>();
  let currentNoteContext: string | undefined;

  rows.slice(headerRowIndex + 1).each((_: any, tr: any) => {
    const $tr = $(tr);
    const allCells = $tr.find("td");
    const cells = filterContentCells($, allCells);
    const cellCount = cells.length;

    if (cellCount < 1) return; // Allow 1-cell rows for Note Headers

    const parsed = parseColumns(
      $,
      cells,
      cellCount,
      nameColIdx,
      jurColIdx,
      ownershipColIdx
    );

    // 1. Handle Note Headers (e.g. "(1) Company Name")
    // These rows set the context for subsequent rows
    const noteHeaderMatch = parsed.rawName.match(/^\s*\((\d+)\)/);
    if (noteHeaderMatch && !parsed.jurisdiction) {
      currentNoteContext = noteHeaderMatch[1];
      return; // Skip this row as a subsidiary, it's just a header
    }

    if (
      !parsed.cleanName ||
      parsed.cleanName.length < 2 ||
      parsed.cleanName.length > 200
    )
      return;

    if (isHeaderRow(parsed.rawName, parsed.jurisdiction)) return;

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

    // 4. Skip if still no jurisdiction (prevents crash)
    if (!parsed.jurisdiction) return;

    // Combine footnote refs
    const footnoteRefs = [
      ...new Set([...parsed.nameFootnoteRefs, ...parsed.ownershipFootnoteRefs]),
    ];

    const indentInfo = {
      spaces: parsed.indentationSpaces,
      hasIndentation: parsed.indentationSpaces > 0,
    };
    const level = determineNestingLevel(indentInfo, subsidiaries);

    // Reset context if indentation decreases significantly?
    // For now, let's keep it simple. The context usually holds until next header.

    const parent = parentStack.getParent(level);
    const parentName = parent?.name;
    const parentId = parent?.id ?? filingCompanyId;

    const subsidiaryId = generateCompanyId({
      type: "private",
      name: parsed.cleanName,
      jurisdiction_raw: parsed.jurisdiction,
    });

    subsidiaries.push({
      id: subsidiaryId,
      name: parsed.cleanName,
      jurisdiction: parsed.jurisdiction, // Now guaranteed to be populated
      nestingLevel: level,
      parentName,
      parentId,
      ownership: parsed.ownership,
      footnoteRefs,
      indentationSpaces: indentInfo.spaces,
      isNested: level > 0 || !!parentName,
    });

    parentStack.push({ level, name: parsed.cleanName, id: subsidiaryId });
  });

  return subsidiaries;
}

/**
 * Detect column index from headers using keywords
 */
function detectColumnIndex(
  headers: string[],
  keywords: Set<string>,
  defaultIdx: number
): number {
  const idx = headers.findIndex((h) => containsAny(h, keywords));
  return idx !== -1 ? idx : defaultIdx;
}
