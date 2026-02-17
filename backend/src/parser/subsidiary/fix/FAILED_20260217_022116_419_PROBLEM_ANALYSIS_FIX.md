# Failed CSV Analysis + Fix Plan

Target file:
- `src/output/data/subsidiaries_FAILED.20260217_022116_419.csv`

## Scope

This analysis groups failures, validates patterns directly against cache HTML files (`CachePath`), identifies root causes, and proposes concrete fixes in heuristic parser logic.

## Data Summary

- Failed filings: `116`
- Structure detection split:
  - `single-table`: `73`
  - `multi-table`: `43`
- Invalid rows reported by errors: `2752 / 6836` (`40.26%`)
- Ratio distribution:
  - Fully invalid filings (`x/x`): `21`
  - `>=50%` invalid rows: `51`
  - `<25%` invalid rows: `47`

Sampled dropped-issue counts (from `DroppedSamplesJson`, max 3 samples per failed filing):
- `Jurisdiction is required`: `232`
- `Jurisdiction contains only numbers/symbols`: `18`
- `Company name contains only numbers/symbols`: `18`
- `Header row detected in data`: `14`

## Grouped Problems (Cache-Verified)

Grouped by primary root-cause signature detected from cache HTML patterns:

1. `single_cell_section_header_rows_need_skip`
- Filings: `22`
- Invalid rows: `679`
- Accessions (examples): `000095017025023145`, `000159696125000024`, `000164559025000130`, `000004054525000015`
- Accessions (full list): see `Appendix A.1`
- Typical failure:
  - Section/title rows leak as subsidiaries or confuse row mapping.

2. `generic_column_mapping_or_validation_gap`
- Filings: `63`
- Invalid rows: `499`
- Accessions (examples): `000164117225026092`, `000143774925029731`, `000155837025001937`, `000173795325000009`
- Accessions (full list): see `Appendix A.2`
- Typical failure:
  - Mixed-format rows not fully handled by current column fallback logic.

3. `country_grouped_tables_need_jurisdiction_carry_forward`
- Filings: `1`
- Invalid rows: `416`
- Accessions: `000130696525000007`
- Typical failure:
  - Jurisdiction appears as country section headers, not per row.

4. `ownership_voting_subrows_inside_table`
- Filings: `12`
- Invalid rows: `378`
- Accessions (examples): `000003408825000010`, `000104625725000018`, `000008136225000014`, `000170803525000070`
- Accessions (full list): see `Appendix A.4`
- Typical failure:
  - `%`, `Voting`, `No Voting` subrows parsed as entity rows.

5. `inline_narrative_or_footnote_sentence_rows_leaked`
- Filings: `8`
- Invalid rows: `245`
- Accessions: `000117184325004718`, `000119312525033543`, `000143774925009118`, `000148939325000008`, `000162828025008179`, `000162828025056742`, `000172359625000061`, `000143774925008868`
- Typical failure:
  - Footnote/narrative sentence rows parsed as subsidiaries.

6. `dba_alias_block_inside_subsidiary_table`
- Filings: `3`
- Invalid rows: `232`
- Accessions: `000074659825000045`, `000153095025000260`, `000201164125000027`
- Typical failure:
  - `Doing Business As` alias lists are treated as subsidiaries.

7. `series_rows_with_placeholder_cells_and_trailing_jurisdiction`
- Filings: `1`
- Invalid rows: `145`
- Accessions: `000095017025054434`
- Typical failure:
  - Placeholder punctuation cell (`,`) selected as jurisdiction instead of trailing real jurisdiction.

8. `jurisdiction_plus_entity_type_combined_column`
- Filings: `1`
- Invalid rows: `132`
- Accessions: `000109166725000034`
- Typical failure:
  - Values like `Delaware limited liability company` are dropped/cleared as “company-like” jurisdiction.

9. `address_or_city_state_continuation_rows_leaked`
- Filings: `3`
- Invalid rows: `23`
- Accessions: `000010917725000043`, `000070056425000014`, `000095017025024666`
- Typical failure:
  - Address/city-state continuation lines parsed as entity names.

10. `domestic_international_section_headers_leaked`
- Filings: `2`
- Invalid rows: `3`
- Accessions: `000091052125000017`, `000181984825000196`
- Typical failure:
  - `Domestic` / `International` section labels parsed as entities.

## Root Causes With Cache Evidence

## A) Country section tables require carry-forward jurisdiction (not per-row jurisdiction)

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-8/1306965_000130696525000007_a2024exhibits-81.htm.gz`
- Header pattern: `Company by country of incorporation | Address of registered office | %`
- Rows include section labels (`ARGENTINA`, `AUSTRALIA`) followed by company rows with no separate jurisdiction cell.

Root cause:
- Parser expects jurisdiction in-row, but this format encodes jurisdiction as a section context.

Fix:
- Add section-context state machine:
  - detect country-only section rows, // can we add a free library to check jurisdiction? not just country but also state. note: this is not iso code. It can be NY, New York, DE, Shanghai, etc 
  - carry jurisdiction forward to following rows until next section row.

## B) Overloaded/ambiguous headers cause wrong column mapping

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-21/34088_000003408825000010_xomexhibit21123124.htm.gz`
- Header row has content only for percentage + jurisdiction (`Percentage ...`, `State or Country ...`), first header cell is empty.
- Extracted names become ownership values (`87.5`, `50`, `100`).

Root cause:
- Name/jurisdiction index detection is too keyword-driven and can mis-locate name column in sparse/merged header layouts.
- Overlap risk from broad keyword sets (e.g., `organization`) increases ambiguity.

Fix:
- Use weighted column scoring instead of direct `findIndex`:
  - name column: company/entity-like row values
  - jurisdiction column: jurisdiction-like text
  - ownership column: `%` / numeric ownership patterns
- Resolve ambiguous headers by data profiling over first N data rows. (check the code if we already have this, see how we can leverage it)
- Remove overlapping header tokens that belong to both name and jurisdiction categories.

## C) Jurisdiction field includes entity type suffix and gets cleared

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-21/1091667_000109166725000034_chtr123124exh-211.htm.gz`
- Column is `Jurisdiction and Type`, values like `Delaware limited liability company`.
- Output drops jurisdiction for many rows.

Root cause:
- Jurisdiction sanitization/shift guard treats these as company-like and clears them.

Fix:
- Add normalization rule:
  - `Delaware limited liability company` -> `Delaware`
  - `Germany Corporation` -> `Germany`
- Keep legal-type suffix for optional metadata, but preserve cleaned jurisdiction value.
This can also potentially leverage the jurisdiction package. Or, should we train a local model to do that?

## D) Alias/DBA blocks are parsed as subsidiaries

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-21/2011641_000201164125000027_exhibit211listofsignifican.htm.gz`
- Row `Doing Business As Name:` followed by alias list (`Aaron & Co.`, `ACF Environmental`, ...).

Root cause:
- Alias sections are not treated as metadata blocks; each line is parsed as a new subsidiary row.

Fix:
- Block-mode skip:
  - on `Doing Business As` / alias labels, enter alias mode
  - ignore rows until next row with valid company + jurisdiction pair.

## E) Ownership subrows (`Voting` / `No Voting`) leak as entities

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-8/1047716_000162828025012639_a81listofsubsidiaries2024.htm.gz`
- Rows include split ownership representation (`Voting`, `No Voting`) and merged-cell layout.
- `No Voting` appears as leaked subsidiary name.

Root cause:
- Subrow semantics are not merged with parent row; parser treats them as standalone entities.

Fix:
- detect subrow and ignore

## F) Series rows with punctuation placeholders break jurisdiction selection

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-21/1802450_000095017025054434_mspr-ex21_1.htm.gz`
- Row shape: `Series ... | , | a designated series of ... | Delaware`

Root cause:
- Jurisdiction selector accepts punctuation placeholder cell (`,`) instead of trailing jurisdiction cell.

Fix:
- Treat punctuation-only cells as empty/noise.
- When selected jurisdiction is punctuation/noise, scan right for last jurisdiction-like cell.

## G) Continuation rows (address/city-state) leak as subsidiaries

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-21/36029_000095017025024666_ffin-ex21_1.htm.gz`
- After company row, extra line `Abilene, Texas` appears.

Root cause:
- Continuation/address lines are parsed as independent entity rows.

Fix:
- Continuation-row detector:
  - single non-empty cell with city/state or address-like pattern
  - directly follows a valid entity row
  - skip/attach as metadata.

## H) Section header rows (`Domestic` / `International`) leak

Evidence:
- `src/output/data/subsidiary_exhibits/2025/EX-21/1819848_000181984825000196_joby-20241231xex21_1.htm.gz`
- Rows `Domestic` and `International` are section labels.

Root cause:
- Single-cell section labels are not consistently filtered.

Fix:
- Extend section-header filters for canonical labels (`Domestic`, `International`, country-only section tokens).

## Prioritized Fix Plan

## P0 (highest impact)

1. Column scoring + overlap cleanup
- Replace simple keyword-index selection with data-profile scoring.
- Remove overlapping/ambiguous keywords between name and jurisdiction header sets.

2. Jurisdiction normalization for `jurisdiction + legal type`
- Normalize and preserve jurisdiction instead of dropping.

3. Row-type state machine
- Explicit row classes: `entity`, `section_header`, `alias_block`, `continuation`, `ownership_subrow`, `inline_footnote`.
- Skip or merge non-entity row classes.

## P1

4. Country-section carry-forward jurisdiction
- Support EX-8 country-grouped formats.

5. Placeholder punctuation handling in jurisdiction selection
- `,`, `%`, punctuation-only tokens => noise.

## P2

6. Add regression fixtures for each group above.
7. Add parser telemetry tags for row-class drops to accelerate future triage.

## Suggested Validation Strategy

1. Replay the same cohort (`subsidiaries_FAILED.20260217_022116_419.csv`) with `fallback=none`.
2. Track before/after for:
- failed filings count
- invalid rows count
- top recurring dropped names (`100`, `No Voting`, `International`, `Doing Business As`)
3. Spot-check representative caches for each root-cause group above.

## Appendix A: Full Accession Lists By Group

### A.1 `single_cell_section_header_rows_need_skip` (22)
`000004054525000015`, `000005849225000136`, `000009602125000099`, `000079526625000014`, `000081115625000036`, `000086145925000007`, `000095017025023145`, `000095017025026604`, `000100498025000010`, `000114036125006937`, `000117891325001173`, `000121390025035604`, `000124342925000017`, `000135059325000066`, `000149090625000033`, `000159696125000024`, `000160548425000013`, `000164559025000130`, `000165495425002948`, `000165785325000015`, `000182912625004289`, `000199681025000011`

### A.2 `generic_column_mapping_or_validation_gap` (63)
`000007290325000029`, `000071251525000022`, `000072085825000007`, `000078516125000009`, `000080567625000014`, `000085277225000070`, `000087450125000032`, `000091314225000005`, `000092480525000012`, `000095017025026655`, `000095017025029100`, `000095017025034713`, `000095017025037918`, `000095017025040387`, `000102583525000039`, `000104734025000009`, `000108476525000115`, `000110465925120879`, `000113709125000005`, `000114036125006528`, `000117184325001658`, `000117485025000008`, `000117891325000572`, `000121390025008172`, `000121390025020360`, `000121390025026353`, `000121390025033966`, `000121390025037643`, `000141057825000068`, `000141057825000177`, `000141057825000194`, `000141057825000774`, `000141057825000996`, `000141057825001415`, `000143774925004742`, `000143774925005069`, `000143774925007520`, `000143774925028862`, `000143774925029731`, `000147793225002248`, `000149315225004500`, `000149315225013547`, `000149315225019123`, `000151739925000017`, `000155837025001937`, `000155837025003129`, `000155837025003237`, `000155837025003701`, `000155837025004153`, `000161764025000016`, `000162828025007962`, `000162828025012639`, `000162828025017048`, `000164117225000205`, `000164117225000364`, `000164117225001259`, `000164117225001660`, `000164117225026092`, `000165495425012190`, `000167978825000022`, `000168316825001686`, `000173795325000009`, `000179466925000011`

### A.3 `country_grouped_tables_need_jurisdiction_carry_forward` (1)
`000130696525000007`

### A.4 `ownership_voting_subrows_inside_table` (12)
`000003408825000010`, `000007528825000033`, `000008136225000014`, `000095017025029085`, `000102665525000005`, `000104625725000018`, `000119312525293703`, `000162828025005392`, `000162828025009007`, `000162828025047346`, `000165495425012195`, `000170803525000070`

### A.5 `inline_narrative_or_footnote_sentence_rows_leaked` (8)
`000117184325004718`, `000119312525033543`, `000143774925008868`, `000143774925009118`, `000148939325000008`, `000162828025008179`, `000162828025056742`, `000172359625000061`

### A.6 `dba_alias_block_inside_subsidiary_table` (3)
`000074659825000045`, `000153095025000260`, `000201164125000027`

### A.7 `series_rows_with_placeholder_cells_and_trailing_jurisdiction` (1)
`000095017025054434`

### A.8 `jurisdiction_plus_entity_type_combined_column` (1)
`000109166725000034`

### A.9 `address_or_city_state_continuation_rows_leaked` (3)
`000010917725000043`, `000070056425000014`, `000095017025024666`

### A.10 `domestic_international_section_headers_leaked` (2)
`000091052125000017`, `000181984825000196`

## Implementation Checklist

- [ ] Replace index-by-header with scored column inference.
- [ ] Remove ambiguous header keyword overlap (name vs jurisdiction).
- [ ] Add jurisdiction legal-type normalization.
- [ ] Add row-class state machine (section/alias/continuation/ownership-subrow/narrative).
- [ ] Add country-section carry-forward jurisdiction logic.
- [ ] Harden punctuation/noise jurisdiction fallback scan.
- [ ] Add regression tests for all representative cache patterns.
- [ ] Replay failed cohort and compare before/after metrics.
