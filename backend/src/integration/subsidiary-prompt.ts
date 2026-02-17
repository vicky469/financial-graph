export type SubsidiaryPromptMode = "text" | "vision";

const OUTPUT_SCHEMA =
  '{"subsidiaries":[{"name":"...","jurisdiction":"...","ownership_percentage":null}]}';

function getSourceRule(mode: SubsidiaryPromptMode): string {
  if (mode === "vision") {
    return "Extract only what is visible in provided pages/images.";
  }
  return "Extract only what is visible in the provided HTML.";
}

export function buildSubsidiaryExtractionPrompt(
  mode: SubsidiaryPromptMode,
): string {
  return `You extract subsidiaries from SEC Exhibit 21.

Output format:
- Return ONLY one valid JSON object (no markdown/prose).
- Use this exact schema:
${OUTPUT_SCHEMA}

Hard constraints (must follow):
1. ${getSourceRule(mode)} Never invent entities.
2. If jurisdiction is not explicitly present for a row, set jurisdiction to null.
3. Keep legal suffixes in name (Inc., LLC, Ltd., Limited, Corp., Company, etc.).
4. Split combined single-cell patterns:
   - "Company Name (State)"
   - "Company Name - Delaware"
   - "Company Name, Delaware"
   - "226HC 8me LLC (Delaware)" => name="226HC 8me LLC", jurisdiction="Delaware"
   - "Cui Yi Information Science and Technology (Shanghai) Company Limited" =>
     name="Cui Yi Information Science and Technology Company Limited", jurisdiction="Shanghai"
5. Handle jurisdiction headers: If a jurisdiction appears as a header/section title above subsidiary names,
   apply that jurisdiction to all subsidiaries listed below it until a new jurisdiction header appears.
   Example:
   "Delaware" (header)
   - Company A Inc.
   - Company B LLC
   "Nevada" (header)
   - Company C Corp.
   Result: Company A and B get jurisdiction="Delaware", Company C gets jurisdiction="Nevada"
6. ownership_percentage is numeric only when explicitly shown; otherwise null.
7. Preserve document order.
8. Keep output minimal: include only name, jurisdiction, ownership_percentage keys.
9. If no subsidiaries are found, return {"subsidiaries":[]}.10. Ensure JSON is complete and valid (close all brackets/objects, no trailing commas, no ellipsis).`;
}

export function buildSubsidiaryTextPrompt(html: string): string {
  return `${buildSubsidiaryExtractionPrompt("text")}

HTML:
${html}`;
}
