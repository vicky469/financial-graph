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

        // Node edges (Company/Brand connections)
        if (isNodeEdge) {
          const targetNode = nodes.find((n) => n.id === e.targetId);
          const isBrandConnection = targetNode?.type === "Brand";

          return {
            id: e.id,
            source: e.sourceId,
            target: e.targetId,
            // Dagre layout (Top-Bottom) works best with Top/Bottom handles
            sourceHandle: "bottom",
            targetHandle: "top",
            type: isBrandConnection ? "straight" : "smoothstep", // Straight for brands (dots), Orthogonal (smoothstep) for entities
            label: e.label,
            animated: false,
            style: {
              strokeWidth: isBrandConnection ? 1.5 : 2,
              strokeDasharray: isBrandConnection ? "6 4" : "none", // Dashed for brands, Solid for companies
              stroke:
                selectedEdgeId === e.id ? "#3b82f6" : isBrandConnection ? "#a78bfa" : "#94a3b8",
            },
            labelStyle: { fill: "#94a3b8", fontSize: 11 },
            markerEnd: isBrandConnection
              ? undefined
              : {
                  type: MarkerType.ArrowClosed,
                  color: selectedEdgeId === e.id ? "#3b82f6" : "#94a3b8",
                },
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
