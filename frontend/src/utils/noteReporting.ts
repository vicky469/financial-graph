import type { TiptapJSON, TiptapNode } from "financial-graph-shared/types";

const ADMIN_MENTION_PATTERN = /(^|[\s([{])@admin\b/i;

function toPlainText(node: TiptapNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "companyMention") {
    const companyName = typeof node.attrs?.companyName === "string" ? node.attrs.companyName : "company";
    return `@${companyName}`;
  }

  const childText = (node.content ?? []).map(toPlainText).join(" ");
  if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
    return `${childText}\n`;
  }

  return childText;
}

export function extractNoteText(content: TiptapJSON): string {
  const raw = (content.content ?? []).map(toPlainText).join(" ");
  return raw.replace(/\s+/g, " ").trim();
}

export function hasAdminMention(content: TiptapJSON): boolean {
  return ADMIN_MENTION_PATTERN.test(extractNoteText(content));
}
