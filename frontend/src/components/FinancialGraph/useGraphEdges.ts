// Graph edges builder hook

import { useMemo } from "react";
import { MarkerType } from "reactflow";
import type { Edge as FlowEdge } from "reactflow";
import type { Edge } from "../../types";

export function useGraphEdges(
  edges: Edge[],
  visibleIds: Set<string>,
  selectedEdgeId: string | null
): FlowEdge[] {
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId)),
    [edges, visibleIds]
  );

  return useMemo(() => {
    return visibleEdges.map((e) => {
        // Since owns entity is not active, we only handle parent_of relationships
        const isOwnership = e.label === "parent_of" || e.ownership !== undefined;
        const isSelected = selectedEdgeId === e.id;

        // Edge colors based on type
        let strokeColor = "#64748b"; // Default gray
        if (isSelected) {
          strokeColor = "#60a5fa"; // Blue when selected
        } else if (isOwnership) {
          strokeColor = "#94a3b8"; // Light gray for ownership
        }

        // Label text - show ownership percentage if available
        let labelText = e.label;
        if (e.ownership && e.ownership > 0) {
          labelText = `owns ${e.ownership}%`;
        }

        return {
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          sourceHandle: "bottom",
          targetHandle: "top",
          type: "smoothstep", // Always use smoothstep since we don't have brand connections
          label: labelText,
          animated: false,
          style: {
            strokeWidth: 2,
            stroke: strokeColor,
          },
          labelStyle: {
            fill: "#1e293b",
            fontSize: 11,
            fontWeight: 500,
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.95,
          },
          labelBgPadding: [6, 8] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: 20,
            height: 20,
          },
        };
      });
  }, [visibleEdges, selectedEdgeId]);
}
