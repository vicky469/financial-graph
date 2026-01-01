// Graph layout calculation hook

import { useMemo } from "react";
import type { Node as GraphNode, Edge } from "../../types";

export function useGraphLayout(nodes: GraphNode[], edges: Edge[]) {
  return useMemo(() => {
    return calculatePositions(nodes, edges);
  }, [nodes, edges]);
}

/**
 * Calculate node positions based on hierarchical tree layout
 */
function calculatePositions(
  nodes: GraphNode[],
  edges: Edge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const depths = new Map<string, number>();

  // 1. Identify roots (nodes with 0 incoming edges)
  const incomingEdgeCounts = new Map<string, number>();
  nodes.forEach((n) => incomingEdgeCounts.set(n.id, 0));

  edges.forEach((e) => {
    if (incomingEdgeCounts.has(e.targetId)) {
      incomingEdgeCounts.set(e.targetId, (incomingEdgeCounts.get(e.targetId) || 0) + 1);
    }
  });

  const roots = nodes.filter((n) => incomingEdgeCounts.get(n.id) === 0);
  roots.forEach((n) => depths.set(n.id, 0));

  // 2. Propagate depths using BFS
  let changed = true;
  let iterations = 0;
  const maxIterations = nodes.length + 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (const edge of edges) {
      const sourceDepth = depths.get(edge.sourceId);
      if (sourceDepth !== undefined) {
        const nextDepth = sourceDepth + 1;
        const currentTargetDepth = depths.get(edge.targetId) ?? -1;

        if (currentTargetDepth < nextDepth) {
          depths.set(edge.targetId, nextDepth);
          changed = true;
        }
      }
    }
  }

  // 3. Group nodes by depth and position them
  const groups = new Map<number, GraphNode[]>();

  nodes.forEach((n) => {
    const d = depths.get(n.id) ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(n);
  });

  // Position nodes in a tree layout
  groups.forEach((groupNodes, depth) => {
    groupNodes.forEach((node, i) => {
      positions.set(node.id, {
        x: 200 + (i - (groupNodes.length - 1) / 2) * 300,
        y: 100 + depth * 200,
      });
    });
  });

  return positions;
}
