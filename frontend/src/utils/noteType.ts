import type { Note, TiptapJSON, TiptapNode } from "financial-graph-shared/types";

export type NoteType = "idea" | "issue" | "todo" | "other";
export type NoteTypeFilter = NoteType | "all";

export interface NoteTypeMeta {
  label: string;
  borderColor: string;
  background: string;
  textColor: string;
}

export const NOTE_TYPE_META: Record<NoteType, NoteTypeMeta> = {
  idea: {
    label: "Idea",
    borderColor: "rgba(110, 231, 183, 0.3)",
    background: "rgba(6, 78, 59, 0.35)",
    textColor: "rgba(167, 243, 208, 0.95)",
  },
  issue: {
    label: "Issue",
    borderColor: "rgba(248, 113, 113, 0.32)",
    background: "rgba(127, 29, 29, 0.32)",
    textColor: "rgba(254, 202, 202, 0.92)",
  },
  todo: {
    label: "Todo",
    borderColor: "rgba(250, 204, 21, 0.34)",
    background: "rgba(113, 63, 18, 0.34)",
    textColor: "rgba(254, 240, 138, 0.94)",
  },
  other: {
    label: "Other",
    borderColor: "rgba(148, 163, 184, 0.28)",
    background: "rgba(15, 23, 42, 0.3)",
    textColor: "rgba(203, 213, 225, 0.84)",
  },
};

const ISSUE_TAG_PATTERN = /(^|\s)@admin\b/i;
const TODO_TAG_PATTERN = /(^|\s)@todo\b/i;

function tiptapNodeToText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";

  if (node.type === "companyMention") {
    const mentionName = typeof node.attrs?.companyName === "string" ? node.attrs.companyName : "";
    return mentionName ? `@${mentionName}` : "@company";
  }

  const childText = (node.content ?? []).map(tiptapNodeToText).join("");
  if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
    return `${childText}\n`;
  }
  return childText;
}

export function tiptapToPlainText(content: TiptapJSON | undefined | null): string {
  if (!content?.content) return "";
  const raw = content.content.map(tiptapNodeToText).join(" ");
  return raw.replace(/\s+/g, " ").trim();
}

export function getNoteType(note: Pick<Note, "content" | "company">): NoteType {
  if (!note.company?.id) return "idea";

  const plainText = tiptapToPlainText(note.content);

  if (ISSUE_TAG_PATTERN.test(plainText)) return "issue";
  if (TODO_TAG_PATTERN.test(plainText)) return "todo";
  return "other";
}

export function getNoteTypeCounts<T extends Pick<Note, "content" | "company">>(
  notes: readonly T[]
): Record<NoteType, number> {
  const counts: Record<NoteType, number> = {
    idea: 0,
    issue: 0,
    todo: 0,
    other: 0,
  };

  for (const note of notes) {
    counts[getNoteType(note)] += 1;
  }

  return counts;
}
