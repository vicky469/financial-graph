import type { TiptapJSON, TiptapNode } from '../../../shared/types/types';

/**
 * Extract company IDs from CompanyMention nodes in Tiptap JSON content
 * 
 * Traverses the entire document tree to find all companyMention nodes
 * and extracts their companyId attributes. Handles nested content structures
 * and removes duplicate IDs.
 * 
 * 
 * @param content - Tiptap JSON document structure
 * @returns Array of unique company IDs mentioned in the document
 */
export function extractMentionedCompanies(content: TiptapJSON): string[] {
  const companyIds: string[] = [];

  /**
   * Recursively traverse the node tree to find companyMention nodes
   */
  function traverse(node: TiptapNode): void {
    // Check if this is a companyMention node with a valid companyId
    if (node.type === 'companyMention' && node.attrs?.companyId) {
      companyIds.push(node.attrs.companyId);
    }

    // Recursively traverse child nodes
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  // Start traversal from the root content array
  if (content.content && Array.isArray(content.content)) {
    content.content.forEach(traverse);
  }

  // Remove duplicates using Set and return
  return [...new Set(companyIds)];
}
