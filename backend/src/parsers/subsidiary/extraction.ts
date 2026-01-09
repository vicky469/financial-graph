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
import { SUBSIDIARY_KEYWORDS, containsAny } from "../../config/subsidiary-keywords";
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
  const nameColIdx = detectColumnIndex(headers, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME, 0);
  const jurColIdx = detectColumnIndex(headers, SUBSIDIARY_KEYWORDS.JURISDICTION, -1);
  if (jurColIdx === -1) {
    throw new MissingColumnError("jurisdiction", filing.accession_number);
  }
  const ownershipColIdx = headers.findIndex((h) => /ownership|percent|%|owned/i.test(h));

  // Note: documentFootnotes passed for potential future use
  // Currently ownership resolution happens in LLM enrichment step
  void documentFootnotes;

  rows.slice(headerRowIndex + 1).each((_: any, tr: any) => {
    const $tr = $(tr);
    // Filter to only get cells with actual content (colspan or text content)
    // Some tables have empty width-defining <td> elements that we should skip
    const allCells = $tr.find("td");
    const cells = filterContentCells($, allCells);
    const cellCount = cells.length;

    if (cellCount < 2) return;

    // Parse all columns
    const parsed = parseColumns($, cells, cellCount, nameColIdx, jurColIdx, ownershipColIdx);
    
    if (!parsed.cleanName || parsed.cleanName.length < 2 || parsed.cleanName.length > 200) return;

    if (isHeaderRow(parsed.rawName, parsed.jurisdiction)) return;

    // Combine footnote refs from name and ownership
    const footnoteRefs = [...new Set([...parsed.nameFootnoteRefs, ...parsed.ownershipFootnoteRefs])];


    // Detect nesting level from indentation
    const indentInfo = { spaces: parsed.indentationSpaces, hasIndentation: parsed.indentationSpaces > 0 };
    const level = determineNestingLevel(indentInfo, subsidiaries);

    // Get parent from stack
    const parent = parentStack.getParent(level);
    const parentName = parent?.name;
    const parentId = parent?.id ?? filingCompanyId;

    // Generate deterministic ID
    const subsidiaryId = generateCompanyId({
      type: "private",
      name: parsed.cleanName,
      jurisdiction_raw: parsed.jurisdiction,
    });

    subsidiaries.push({
      id: subsidiaryId,
      name: parsed.cleanName,
      jurisdiction: parsed.jurisdiction,
      nestingLevel: level,
      parentName,
      parentId,
      ownership: parsed.ownership,
      footnoteRefs,
      indentationSpaces: indentInfo.spaces,
      isNested: level > 0 || !!parentName,
    });

    // Push this subsidiary as potential parent for next rows
    parentStack.push({ level, name: parsed.cleanName, id: subsidiaryId });
  });

  return subsidiaries;
}

/**
 * Detect column index from headers using keywords
 */
function detectColumnIndex(headers: string[], keywords: Set<string>, defaultIdx: number): number {
  const idx = headers.findIndex((h) => containsAny(h, keywords));
  return idx !== -1 ? idx : defaultIdx;
}
