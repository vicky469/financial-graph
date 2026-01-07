// Graph utility functions for FinancialGraph component

import type { Edge, Node } from "../../types";

/**
 * Get entity and all its descendant entities (children, grandchildren, etc.)
 */
export function getEntityWithDescendants(
  entityId: string,
  nodes: Node[],
  edges: Edge[]
): Set<string> {
  const entityIds = new Set(nodes.map((e) => e.id));
  const descendants = new Set([entityId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const edge of edges) {
      // Only consider edges between entities (parent -> child relationship)
      if (
        entityIds.has(edge.sourceId) &&
        entityIds.has(edge.targetId) &&
        descendants.has(edge.sourceId) &&
        !descendants.has(edge.targetId)
      ) {
        descendants.add(edge.targetId);
        changed = true;
      }
    }
  }

  return descendants;
}
