// Graph nodes builder hook

import { useMemo } from "react";
import type { Node as FlowNode } from "reactflow";
import type { Node, Edge } from "../../types";
import { useGraphLayout } from "./useGraphLayout";

export function useGraphNodes(
  nodes: Node[],
  edges: Edge[],
  visibleIds: Set<string>,
  selectedNodeId: string | null
): FlowNode<any>[] {
  // Filter to only visible nodes and edges BEFORE layout calculation
  const visibleNodes = useMemo(
    () => nodes.filter((n) => visibleIds.has(n.id)),
    [nodes, visibleIds]
  );
  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId)
      ),
    [edges, visibleIds]
  );

  const positions = useGraphLayout(visibleNodes, visibleEdges);

  return useMemo(() => {

    return visibleNodes.map((node) => {
      // Determine entity properties
      // Public usually implies having a CIK (SEC reporting)
      const isPublic = !!node.cik;

      // Subsidiary: Has a parent Company node via ownership edge
      const isSubsidiary = visibleEdges.some(
        (e) =>
          e.targetId === node.id &&
          e.label === "parent_of" &&
          visibleNodes.find((n) => n.id === e.sourceId)?.type === "Company"
      );

      return {
        id: node.id,
        type: "entityNode", // Must match nodeTypes key in FinancialGraph
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        data: {
          ...node,
          ...node.properties,
          type: node.type,
          label: node.name,
          isPublic,
          isSubsidiary,
          isSelected: selectedNodeId === node.id,
        },
        selected: selectedNodeId === node.id,
      };
    });
  }, [visibleNodes, visibleEdges, selectedNodeId, positions]);
}
