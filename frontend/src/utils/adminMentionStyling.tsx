import type { ReactNode } from "react";

const ADMIN_TOKEN_CAPTURE = /(@admin\b)/gi;
const ADMIN_TOKEN_EXACT = /^@admin$/i;

function isAdminToken(part: string): boolean {
  return ADMIN_TOKEN_EXACT.test(part);
}

function createAdminMentionDomFragment(documentRef: Document): DocumentFragment {
  const fragment = documentRef.createDocumentFragment();

  const atSign = documentRef.createElement("span");
  atSign.className = "admin-mention-at";
  atSign.textContent = "@";

  const admin = documentRef.createElement("span");
  admin.className = "admin-mention-text";
  admin.textContent = "admin";

  fragment.appendChild(atSign);
  fragment.appendChild(admin);
  return fragment;
}

/**
 * Render @admin token as "@"+underlined "admin" using shared styles.
 */
export function renderTextWithAdminMention(text: string): ReactNode {
  const parts = text.split(ADMIN_TOKEN_CAPTURE);
  if (parts.length <= 1) return text;

  return parts.map((part, index) => {
    if (!isAdminToken(part)) return part;

    return (
      <span key={`admin-mention-${index}`}>
        <span className="admin-mention-at">@</span>
        <span className="admin-mention-text">admin</span>
      </span>
    );
  });
}

/**
 * Mutate a rendered DOM subtree and replace @admin text tokens with styled spans.
 * Used for read-only Tiptap output where plain text nodes need display decoration.
 */
export function decorateAdminMentionsInElement(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node.textContent?.toLowerCase().includes("@admin")) {
      textNodes.push(node as Text);
    }
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent ?? "";
    const parts = text.split(ADMIN_TOKEN_CAPTURE);
    if (parts.length <= 1) return;

    const replacement = document.createDocumentFragment();
    parts.forEach((part) => {
      if (isAdminToken(part)) {
        replacement.appendChild(createAdminMentionDomFragment(document));
      } else if (part.length > 0) {
        replacement.appendChild(document.createTextNode(part));
      }
    });

    textNode.parentNode?.replaceChild(replacement, textNode);
  });
}
