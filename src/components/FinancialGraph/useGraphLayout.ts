// Graph layout calculation hook

import { useMemo } from "react";
import type { Event, Node as GraphNode, Edge } from "../../types";
import { findNonOverlappingY } from "./graphUtils";

export function useGraphLayout(events: Event[], nodes: GraphNode[], edges: Edge[]) {
  return useMemo(() => {
    return calculatePositions([...events, ...nodes], edges);
  }, [events, nodes, edges]);
}

/**
 * Calculate node positions based on depth-first layout algorithm
 */
function calculatePositions(
  nodes: (Event | GraphNode)[],
  edges: Edge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const depths = new Map<string, number>();

  // Separate events and nodes
  const eventNodes = nodes.filter((n) => "date" in n) as Event[];
  const entityNodes = nodes.filter((n) => "name" in n && !("date" in n)) as GraphNode[];

  // 1. Identify roots (nodes with 0 incoming edges) - events only
  const incomingEdgeCounts = new Map<string, number>();
  eventNodes.forEach((n) => incomingEdgeCounts.set(n.id, 0));

  // Only count event-to-event edges for depth calculation
  const eventIds = new Set(eventNodes.map((e) => e.id));
  edges.forEach((e) => {
    if (eventIds.has(e.targetId) && eventIds.has(e.sourceId)) {
      incomingEdgeCounts.set(e.targetId, (incomingEdgeCounts.get(e.targetId) || 0) + 1);
    }
  });

  // Triggers are always roots, plus any event with 0 incoming edges
  const roots = eventNodes.filter((n) => n.isTrigger || incomingEdgeCounts.get(n.id) === 0);
  roots.forEach((n) => depths.set(n.id, 0));

  // 2. Propagate depths (events only)
  let changed = true;
  let iterations = 0;
  const maxIterations = eventNodes.length + 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (const edge of edges) {
      if (!eventIds.has(edge.sourceId) || !eventIds.has(edge.targetId)) continue;
      const sourceDepth = depths.get(edge.sourceId);
      if (sourceDepth !== undefined) {
        const isSimultaneous = edge.edgeType === "simultaneous";
        const nextDepth = isSimultaneous ? sourceDepth : sourceDepth + 1;
        const currentTargetDepth = depths.get(edge.targetId) ?? -1;

        if (currentTargetDepth < nextDepth) {
          depths.set(edge.targetId, nextDepth);
          changed = true;
        }
      }
    }
  }

  // 3. Group and Position Events
  const groups = new Map<number, Event[]>();
  const getTime = (n: Event) => new Date(n.date).getTime();

  eventNodes.forEach((n) => {
    const d = depths.get(n.id) ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(n);
  });

  groups.forEach((groupNodes, depth) => {
    groupNodes.sort((a, b) => getTime(a) - getTime(b));
    groupNodes.forEach((e, i) => {
      positions.set(e.id, {
        x: 400 + (i - (groupNodes.length - 1) / 2) * 280,
        y: 50 + depth * 150,
      });
    });
  });

  // 4. Position Nodes to the LEFT of their first connected event with collision avoidance
  const entityOffset = -280;
  const nodeWidth = 200;
  const nodeHeight = 100;
  let orphanEntityY = 50;

  entityNodes.forEach((entity, idx) => {
    // Find edges where this entity is the source
    const connectedEdges = edges.filter((e) => e.sourceId === entity.id);
    if (connectedEdges.length > 0) {
      // Get the first connected event's position
      const firstTargetId = connectedEdges[0].targetId;
      const targetPos = positions.get(firstTargetId);
      if (targetPos) {
        const preferredX = targetPos.x + entityOffset;
        const preferredY = targetPos.y;
        const safeY = findNonOverlappingY(preferredX, preferredY, positions, nodeHeight);
        positions.set(entity.id, {
          x: preferredX,
          y: safeY,
        });
        return;
      }
    }
    // Fallback: place orphan entities in a column on the left
    positions.set(entity.id, {
      x: 100,
      y: orphanEntityY + idx * 180,
    });
  });

  return positions;
}
