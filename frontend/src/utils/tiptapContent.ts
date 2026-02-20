import type { TiptapJSON, TiptapMark, TiptapNode } from "financial-graph-shared/types";

const LEGACY_LINK_MARK_PREFIXES = ["link-editor-", "link-notecard-"];
const EMPTY_NOTE_DOC: TiptapJSON = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

function isLegacyLinkMarkType(type: string): boolean {
  return LEGACY_LINK_MARK_PREFIXES.some((prefix) => type.startsWith(prefix));
}

function normalizeMark(mark: TiptapMark): TiptapMark {
  if (isLegacyLinkMarkType(mark.type)) {
    return {
      ...mark,
      type: "link",
    };
  }

  return {
    ...mark,
  };
}

function normalizeNode(node: TiptapNode): TiptapNode {
  const normalizedContent = Array.isArray(node.content)
    ? node.content.map(normalizeNode)
    : undefined;
  const normalizedMarks = Array.isArray(node.marks)
    ? node.marks
        .filter((mark): mark is TiptapMark => Boolean(mark && typeof mark.type === "string"))
        .map(normalizeMark)
    : undefined;

  return {
    ...node,
    content: normalizedContent,
    marks: normalizedMarks,
  };
}

export function normalizeTiptapContent(content: TiptapJSON | null | undefined): TiptapJSON {
  if (!content || content.type !== "doc") {
    return EMPTY_NOTE_DOC;
  }

  const normalizedNodes = Array.isArray(content.content)
    ? content.content.map(normalizeNode)
    : [];

  if (normalizedNodes.length === 0) {
    return EMPTY_NOTE_DOC;
  }

  return {
    ...content,
    content: normalizedNodes,
  };
}
