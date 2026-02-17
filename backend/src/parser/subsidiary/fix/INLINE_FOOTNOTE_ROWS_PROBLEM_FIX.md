# Problem + Fix: Inline Footnote Rows Misparsed as Subsidiaries

## Problem

Observed filing:
- `src/output/data/subsidiary_exhibits/2025/EX-8/1095435_000117184325004718_exh_81.htm.gz`

Failure symptom:
- `heuristic_validation_failed (1/10 invalid rows)`
- dropped sample:
  - name: `2 Formerly Intensity Holdings Limited`
  - jurisdiction: `""`
  - issue: `Jurisdiction is required`

## Root Cause

This filing uses a **single table** that contains:
1. Normal subsidiary rows (name + jurisdiction + ownership)
2. Inline footnote rows appended at the bottom (e.g., `<sup>2</sup> Formerly ...`) with only one non-empty cell

The parser previously treated those inline footnote rows as subsidiary rows.

Also, `footnotesHtml` extraction only matched parenthesized markers (`(1)`), so superscript-style inline rows were often missed.

## Fix Implemented

## 1) Stop extraction when inline footnote block starts

File:
- `src/parser/subsidiary/data/extraction.ts`

Change:
- Added row-level inline-footnote detection:
  - one non-empty semantic cell in the row
  - starts with note marker (`(1)`, `1`, `1.`, `1)`) or leading `<sup>1</sup>` style marker
- Once detected (after at least one subsidiary row is already parsed), extraction stops for remaining rows in that table.

Result:
- inline footnote lines no longer become subsidiaries.

## 2) Include inline superscript footnotes in `footnotesHtml`

File:
- `src/parser/subsidiary/footnote/footnotes.ts`

Change:
- Added inline footnote row detection at document-footnote extraction time.
- When inline footnote rows are detected inside a larger table, we capture rows from the first inline footnote row onward and append them to extracted footnote sections.
- Kept existing support for standalone `(n)` footnote tables and paragraph-style footnotes.

Result:
- `footnotesHtml` now includes superscript-based inline note content like `Formerly Intensity Holdings Limited`.

## Validation

Focused tests:
- `tests/parser/extraction.test.ts`
- `tests/parser/footnotes.test.ts`

Run:
- `npm test -- tests/parser/extraction.test.ts tests/parser/footnotes.test.ts`

Outcome:
- Passed (`39/39` tests).

Direct parse replay for the problematic filing:
- status: `success`
- subsidiaries: `9`
- no parsed subsidiary named `Formerly ...`
- `footnotesHtml` populated (contains inline note text).

## Task List

- [x] Confirm root cause on real accession sample
- [x] Add row-level inline footnote guard in extraction
- [x] Add superscript inline footnote capture for `footnotesHtml`
- [x] Add regression tests for extraction + footnote capture
- [x] Replay accession and verify status changes from failed to success
