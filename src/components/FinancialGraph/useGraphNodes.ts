// Graph nodes builder hook

import { useMemo } from "react";
import type { Node } from "reactflow";
import type {
  Event,
  Node as GraphNode,
  Edge,
  EventNodeData,
  NodeData,
  AppContext,
} from "../../types";
import type { UserSelection } from "../../types";
import { useGraphLayout } from "./useGraphLayout";

export function useGraphNodes(
  events: Event[],
  entities: GraphNode[],
  edges: Edge[],
  visibleIds: Set<string>,
  selections: UserSelection[],
  context: AppContext
): Node<EventNodeData | NodeData>[] {
  const positions = useGraphLayout(events, entities, edges);

  return useMemo(() => {
    const allNodes: (Event | GraphNode)[] = [...events, ...entities];
    const visible = allNodes.filter((e) => visibleIds.has(e.id));

    return visible.map((node) => {
      const isEntity = "name" in node;

      if (isEntity) {
        const entity = node as GraphNode;
        const other = selections.find(
          (s) => s.selectedNodeId === entity.id && s.odxerId !== context.userId
        );
        return {
          id: entity.id,
          type: "entityNode",
          position: positions.get(entity.id) ?? { x: 0, y: 0 },
          data: {
            ...entity,
            isSelected: context.selectedNodeId === entity.id,
            otherUserSelecting: other ? { userName: other.userName, color: other.color } : null,
          } as NodeData,
          selected: context.selectedNodeId === entity.id,
        };
      } else {
        const event = node as Event;
        const other = selections.find(
          (s) => s.selectedEventId === event.id && s.odxerId !== context.userId
        );
        return {
          id: event.id,
          type: "eventNode",
          position: positions.get(event.id) ?? { x: 0, y: 0 },
          data: {
            ...event,
            isSelected: context.selectedEventId === event.id,
            otherUserSelecting: other ? { userName: other.userName, color: other.color } : null,
          } as EventNodeData,
          selected: context.selectedEventId === event.id,
        };
      }
    });
  }, [events, entities, visibleIds, selections, context, positions]);
}
