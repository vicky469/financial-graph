/**
 * Helpers for extracting and parsing JSON payloads from LLM responses.
 *
 * We intentionally recover partial subsidiary objects when the response is
 * truncated (common for long subsidiary lists) so fallback can still return
 * useful data instead of hard-failing.
 */

export interface LLMJsonParseResult<T> {
  value: T;
  recovered: boolean;
  recoveredCount?: number;
}

function stripCodeFences(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? content.trim();
}

function extractLikelyJsonObject(content: string): string {
  const cleaned = stripCodeFences(content);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  if (start >= 0) {
    return cleaned.slice(start);
  }

  return cleaned;
}

function recoverSubsidiaryObjects(text: string): Array<Record<string, unknown>> {
  const keyIndex = text.search(/"subsidiaries"\s*:/i);
  if (keyIndex < 0) return [];

  const arrayStart = text.indexOf("[", keyIndex);
  if (arrayStart < 0) return [];

  const objects: Array<Record<string, unknown>> = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectStart = -1;

  for (let i = arrayStart + 1; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) {
        objectStart = i;
      }
      depth += 1;
      continue;
    }

    if (ch === "}") {
      if (depth <= 0) continue;
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        const candidate = text.slice(objectStart, i + 1);
        try {
          const parsed = JSON.parse(candidate) as Record<string, unknown>;
          objects.push(parsed);
        } catch {
          // Ignore malformed objects and continue scanning.
        }
        objectStart = -1;
      }
      continue;
    }

    if (ch === "]" && depth === 0) {
      break;
    }
  }

  return objects;
}

/**
 * Parse JSON with best-effort recovery for truncated subsidiary payloads.
 */
export function parseSubsidiaryJsonResponse<T extends { subsidiaries: unknown[] }>(
  content: string,
): LLMJsonParseResult<T> {
  const candidate = extractLikelyJsonObject(content);

  try {
    return {
      value: JSON.parse(candidate) as T,
      recovered: false,
    };
  } catch {
    const recoveredObjects = recoverSubsidiaryObjects(candidate);
    if (recoveredObjects.length === 0) {
      throw new Error("Unable to parse JSON response");
    }

    return {
      value: { subsidiaries: recoveredObjects } as T,
      recovered: true,
      recoveredCount: recoveredObjects.length,
    };
  }
}

