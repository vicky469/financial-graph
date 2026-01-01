// Graph nodes builder hook

import { useMemo } from "react";
import type { Node } from "reactflow";
import type { Node as GraphNode, Edge, NodeData, AppContext } from "../../types";
import type { UserSelection } from "../../types";
import { useGraphLayout } from "./useGraphLayout";

export function useGraphNodes(
  entities: GraphNode[],
  edges: Edge[],
  visibleIds: Set<string>,
  selections: UserSelection[],
  context: AppContext
): Node<NodeData>[] {
  const positions = useGraphLayout(entities, edges);

  return useMemo(() => {
    const visible = entities.filter((e) => visibleIds.has(e.id));

    return visible.map((entity) => {
      const other = selections.find(
        (s) => s.selectedNodeId === entity.id && s.odxerId !== context.userId
      );

      // Determine entity properties
      // Public usually implies having a CIK (SEC reporting)
      const isPublic = !!entity.cik;

      // Subsidiary: Has a parent Company node via ownership edge
      const isSubsidiary = edges.some(
        (e) =>
          e.targetId === entity.id && entities.find((n) => n.id === e.sourceId)?.type === "Company"
      );

      return {
        id: entity.id,
        type: "entityNode",
        position: positions.get(entity.id) ?? { x: 0, y: 0 },
        data: {
          ...entity,
          isPublic,
          isSubsidiary,
          isSelected: context.selectedNodeId === entity.id,
          otherUserSelecting: other ? { userName: other.userName, color: other.color } : null,
        } as NodeData,
        selected: context.selectedNodeId === entity.id,
      };
    });
  }, [entities, visibleIds, selections, context, positions]);
}
