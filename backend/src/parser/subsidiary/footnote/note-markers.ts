/**
 * Shared note/footnote marker patterns used by both:
 * - row extraction guards
 * - document footnote extraction
 */

// Numeric note token: 1, 2A, 12b.
const NUMERIC_NOTE_TOKEN = "\\d{1,3}[A-Za-z]?";
// Roman note token (common footnote range): I..XXXIX (supports i/ii/iv/ix/x/xi/xiv/etc.).
// Kept intentionally narrow to avoid false positives like legal suffixes "(LLC)".
const ROMAN_NOTE_TOKEN = "(?=[IVX])X{0,3}(?:IX|IV|V?I{0,3})";
// Alphabetic note token: a, B.
const ALPHA_NOTE_TOKEN = "[A-Za-z]";
// Any supported note token (numeric, roman, alphabetic).
const NOTE_TOKEN = `(?:${NUMERIC_NOTE_TOKEN}|${ROMAN_NOTE_TOKEN}|${ALPHA_NOTE_TOKEN})`;

/** Matches footnote refs inline in text (capturing the marker token). */
const NUMERIC_FOOTNOTE_REF_PATTERNS = [
  new RegExp(`\\((${NUMERIC_NOTE_TOKEN})\\)`, "g"), // (1), (2A), (12b)
  new RegExp(`\\*(${NUMERIC_NOTE_TOKEN})`, "g"), // *1, *2A
];
const ROMAN_FOOTNOTE_REF_PATTERNS = [
  new RegExp(`\\((${ROMAN_NOTE_TOKEN})\\)`, "gi"), // (I), (ii), (IV), (XIV)
  new RegExp(`\\*(${ROMAN_NOTE_TOKEN})`, "gi"), // *I, *iv, *XIV
];
const ALPHA_FOOTNOTE_REF_PATTERNS = [
  new RegExp(`\\((${ALPHA_NOTE_TOKEN})\\)`, "g"), // (a), (B)
  new RegExp(`\\*(${ALPHA_NOTE_TOKEN})(?![A-Za-z])`, "g"), // *a, *B (single letter only)
];
export const FOOTNOTE_REF_PATTERNS = [
  ...NUMERIC_FOOTNOTE_REF_PATTERNS,
  ...ROMAN_FOOTNOTE_REF_PATTERNS,
  ...ALPHA_FOOTNOTE_REF_PATTERNS,
];

/** Row starts with a parenthesized marker, e.g. "(1) ...", "(II) ...". */
export const PARENTHESIZED_NOTE_ROW_REGEX = new RegExp(
  `^\\(${NOTE_TOKEN}\\)(?:\\s+|$)`,
  "i",
);
/** Row starts with numeric marker, e.g. "1 ...", "2. ...", "3) ...". */
export const NUMERIC_NOTE_ROW_REGEX = new RegExp(
  `^${NUMERIC_NOTE_TOKEN}[.)]?(?:\\s+|$)`,
  "i",
);
/** Row starts with roman marker, e.g. "I ...", "IV. ...", "ii) ...". */
export const ROMAN_NOTE_ROW_REGEX = new RegExp(
  `^${ROMAN_NOTE_TOKEN}[.)]?(?:\\s+|$)`,
  "i",
);
/** Row starts with alphabetic marker, e.g. "a) ...", "B. ...". */
export const ALPHA_NOTE_ROW_REGEX = new RegExp(
  `^${ALPHA_NOTE_TOKEN}[.)](?:\\s+|$)`,
  "i",
);

export const NOTE_ROW_PREFIX_PATTERNS = [
  PARENTHESIZED_NOTE_ROW_REGEX,
  NUMERIC_NOTE_ROW_REGEX,
  ROMAN_NOTE_ROW_REGEX,
  ALPHA_NOTE_ROW_REGEX,
];

/** Superscript marker token patterns composed by marker family. */
export const SUPERSCRIPT_NOTE_MARKER_PATTERNS = [
  new RegExp(`^${NUMERIC_NOTE_TOKEN}$`, "i"),
  new RegExp(`^${ROMAN_NOTE_TOKEN}$`, "i"),
  new RegExp(`^${ALPHA_NOTE_TOKEN}$`, "i"),
];

export function normalizeNoteText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function hasNoteRowPrefix(text: string): boolean {
  const normalized = normalizeNoteText(text);
  return NOTE_ROW_PREFIX_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function hasLeadingSuperscriptNoteMarker($: any, cell: any): boolean {
  const nodes = $(cell).contents().toArray();
  for (const node of nodes) {
    if (node.type === "text") {
      const text = normalizeNoteText(node.data || "");
      if (text.length === 0) continue;
      return false;
    }

    if (node.type === "tag" && String(node.name).toLowerCase() === "sup") {
      const supText = normalizeNoteText($(node).text());
      return SUPERSCRIPT_NOTE_MARKER_PATTERNS.some((pattern) =>
        pattern.test(supText),
      );
    }

    return false;
  }

  return false;
}
