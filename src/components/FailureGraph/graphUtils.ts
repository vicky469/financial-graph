// Graph utility functions for FailureGraph component

import type { Edge } from "../../types";

/**
 * Get all downstream node IDs from a trigger using BFS traversal
 */
export function getConnectedIds(triggerId: string, edges: Edge[]): Set<string> {
  const connected = new Set([triggerId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (connected.has(edge.sourceId) && !connected.has(edge.targetId)) {
        connected.add(edge.targetId);
        changed = true;
      }
    }
  }

  return connected;
}

/**
 * Check if two rectangles overlap
 */
export function overlaps(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  nodeWidth = 200,
  nodeHeight = 100
): boolean {
  return Math.abs(x1 - x2) < nodeWidth && Math.abs(y1 - y2) < nodeHeight;
}

/**
 * Find a Y position that doesn't overlap with existing nodes
 */
export function findNonOverlappingY(
  x: number,
  preferredY: number,
  positions: Map<string, { x: number; y: number }>,
  nodeHeight = 100
): number {
  let y = preferredY;
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    let hasOverlap = false;
    for (const [, pos] of positions) {
      if (overlaps(x, y, pos.x, pos.y)) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) return y;

    // Try offsetting Y in alternating directions
    y =
      preferredY +
      (attempts % 2 === 0 ? 1 : -1) * Math.ceil((attempts + 1) / 2) * (nodeHeight + 20);
    attempts++;
  }

  return y; // Fallback to last tried position
}
