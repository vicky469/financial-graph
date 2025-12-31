// Graph edges builder hook

import { useMemo } from "react";
import type { Edge as FlowEdge } from "reactflow";
import { MarkerType } from "reactflow";
import type { Edge, Node as GraphNode } from "../../types";

export function useGraphEdges(
  edges: Edge[],
  nodes: GraphNode[],
  visibleIds: Set<string>,
  selectedEdgeId?: string | null
): FlowEdge[] {
  return useMemo(() => {
    // Build set of node IDs for detecting node-to-event edges
    const nodeIds = new Set(nodes.map((e) => e.id));

    // Build parent map for simultaneous rerouting (EVENT edges only)
    const parentMap = new Map<string, string>();
    edges.forEach((e) => {
      // Only build parent map from causal event-to-event edges
      if (e.edgeType !== "simultaneous" && !nodeIds.has(e.sourceId)) {
        parentMap.set(e.targetId, e.sourceId);
      }
    });

    return edges
      .filter((e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId))
      .map((e) => {
        const isSimultaneous = e.edgeType === "simultaneous";
        const isNodeEdge = nodeIds.has(e.sourceId); // Source is a node

        // Node edges: horizontal dashed purple lines (completely separate)
        if (isNodeEdge) {
          return {
            id: e.id,
            source: e.sourceId,
            target: e.targetId,
            sourceHandle: "right",
            targetHandle: "left",
            type: "straight",
            label: e.label,
            animated: false,
            style: {
              strokeWidth: 1.5,
              strokeDasharray: "6 4",
              stroke: selectedEdgeId === e.id ? "#3b82f6" : "#a78bfa",
            },
            labelStyle: { fill: "#94a3b8", fontSize: 11 },
            markerEnd: undefined,
          };
        }

        // Event-to-event edges: apply simultaneous rerouting
        let source = e.sourceId;
        if (isSimultaneous) {
          const parent = parentMap.get(e.sourceId);
          if (parent) source = parent; // Reroute to parent for sibling appearance
        }

        return {
          id: e.id,
          source: source,
          target: e.targetId,
          sourceHandle: "bottom",
          targetHandle: "top",
          type: "default",
          label: e.label,
          animated: !isSimultaneous,
          style: {
            strokeWidth: 2,
            strokeDasharray: "none",
            stroke: selectedEdgeId === e.id ? "#3b82f6" : "#64748b",
          },
          labelStyle: { fill: "#94a3b8", fontSize: 11 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: selectedEdgeId === e.id ? "#3b82f6" : "#64748b",
          },
        };
      });
  }, [edges, nodes, visibleIds, selectedEdgeId]);
}
