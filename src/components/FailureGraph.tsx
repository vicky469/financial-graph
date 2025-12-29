import { useCallback, useMemo, useEffect } from "react";
import ReactFlow, { type Node, type Edge as FlowEdge, Controls, Background } from "reactflow";
import { BackgroundVariant, useNodesState, useEdgesState } from "reactflow";
import { type Connection, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

import EventNode from "./EventNode";
import { useGraph, createEdge } from "../db";
import type { Event, Entity, Edge, EventNodeData, EntityNodeData } from "../types";
import type { AppContext, UserSelection } from "../types";
import EntityNode from "./EntityNode";

const nodeTypes = { eventNode: EventNode, entityNode: EntityNode };

interface Props {
  context: AppContext;
  onSelectEvent: (eventId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  onSelectEntity?: (entityId: string | null) => void;
  onFocusTrigger: (triggerId: string) => void;
  onClearFocus: () => void;
  showActors?: boolean;
}

// Get all downstream IDs from a trigger
const getConnectedIds = (triggerId: string, edges: Edge[]): Set<string> => {
  // ... same logic
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
};

// Calculate positions based on depth
const calculatePositions = (nodes: (Event | Entity)[], edges: Edge[]) => {
  const positions = new Map<string, { x: number; y: number }>();
  const depths = new Map<string, number>();

  // Separate events and entities
  const eventNodes = nodes.filter((n) => "date" in n) as Event[];
  const entityNodes = nodes.filter((n) => "name" in n && !("date" in n)) as Entity[];

  // 1. Identify "roots" (nodes with 0 incoming edges in the visible graph) - events only
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

  // 4. Position Entities to the LEFT of their first connected event
  // with collision avoidance
  const entityOffset = -280; // How far left of the event
  const nodeWidth = 200;
  const nodeHeight = 100;
  let orphanEntityY = 50;

  // Helper: check if two rectangles overlap
  const overlaps = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.abs(x1 - x2) < nodeWidth && Math.abs(y1 - y2) < nodeHeight;
  };

  // Helper: find a Y position that doesn't overlap
  const findNonOverlappingY = (x: number, preferredY: number) => {
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
  };

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
        const safeY = findNonOverlappingY(preferredX, preferredY);
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
};

const FailureGraph = ({
  context,
  onSelectEvent,
  onSelectEdge,
  onSelectEntity,
  onFocusTrigger,
  onClearFocus,
  showActors = true,
}: Props) => {
  const { events, entities, edges, selections, isLoading } = useGraph();

  const visibleIds = useMemo(() => {
    const eventIds = events.map((e) => e.id);
    const entityIds = showActors ? entities.map((e) => e.id) : [];
    if (!context.focusedTriggerId) return new Set([...eventIds, ...entityIds]);
    return getConnectedIds(context.focusedTriggerId, edges);
  }, [context.focusedTriggerId, events, entities, edges, showActors]);

  const flowNodes: Node<EventNodeData | EntityNodeData>[] = useMemo(() => {
    const allNodes: (Event | Entity)[] = [...events, ...entities];
    const visible = allNodes.filter((e) => visibleIds.has(e.id));
    const pos = calculatePositions(visible, edges);

    return visible.map((node) => {
      const isEntity = "name" in node;
      if (isEntity) {
        const entity = node as Entity;
        const other = (selections as UserSelection[]).find(
          (s) => s.selectedEntityId === entity.id && s.odxerId !== context.userId
        );
        return {
          id: entity.id,
          type: "entityNode",
          position: pos.get(entity.id) ?? { x: 0, y: 0 },
          data: {
            ...entity,
            isSelected: context.selectedEntityId === entity.id,
            isEditing: false,
            otherUserSelecting: other ? { userName: other.userName, color: other.color } : null,
          } as EntityNodeData,
          selected: context.selectedEntityId === entity.id,
        };
      } else {
        const event = node as Event;
        const other = (selections as UserSelection[]).find(
          (s) => s.selectedEventId === event.id && s.odxerId !== context.userId
        );
        return {
          id: event.id,
          type: "eventNode",
          position: pos.get(event.id) ?? { x: 0, y: 0 },
          data: {
            ...event,
            isSelected: context.selectedEventId === event.id,
            isEditing: context.editingEventId === event.id,
            otherUserSelecting: other ? { userName: other.userName, color: other.color } : null,
          } as EventNodeData,
          selected: context.selectedEventId === event.id,
        };
      }
    });
  }, [events, entities, edges, visibleIds, selections, context]);

  const flowEdges: FlowEdge[] = useMemo(() => {
    // Build set of entity IDs for detecting entity-to-event edges
    const entityIds = new Set(entities.map((e) => e.id));

    // Build parent map for simultaneous rerouting (EVENT edges only)
    const parentMap = new Map<string, string>();
    edges.forEach((e) => {
      // Only build parent map from causal event-to-event edges
      if (e.edgeType !== "simultaneous" && !entityIds.has(e.sourceId)) {
        parentMap.set(e.targetId, e.sourceId);
      }
    });

    return edges
      .filter((e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId))
      .map((e) => {
        const isSimultaneous = e.edgeType === "simultaneous";
        const isEntityEdge = entityIds.has(e.sourceId); // Source is an entity

        // Entity edges: horizontal dashed purple lines (completely separate)
        if (isEntityEdge) {
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
              stroke: context.selectedEdgeId === e.id ? "#3b82f6" : "#a78bfa",
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
            stroke: context.selectedEdgeId === e.id ? "#3b82f6" : "#64748b",
          },
          labelStyle: { fill: "#94a3b8", fontSize: 11 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: context.selectedEdgeId === e.id ? "#3b82f6" : "#64748b",
          },
        };
      });
  }, [edges, entities, visibleIds, (context as any).selectedEdgeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => setNodes(flowNodes), [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) createEdge(c.source, c.target);
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<EventNodeData | EntityNodeData>) => {
      if (node.type === "entityNode") {
        onSelectEntity?.(node.id);
      } else {
        const data = node.data as EventNodeData;
        data.isTrigger ? onFocusTrigger(node.id) : onSelectEvent(node.id);
      }
    },
    [onFocusTrigger, onSelectEvent, onSelectEntity]
  );

  const onPaneClick = useCallback(() => {
    context.focusedTriggerId ? onClearFocus() : onSelectEvent(null);
    onSelectEdge?.(null);
  }, [context.focusedTriggerId, onClearFocus, onSelectEvent, onSelectEdge]);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: FlowEdge) => {
      onSelectEdge?.(edge.id);
    },
    [onSelectEdge]
  );

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading failure graph...</p>
      </div>
    );
  }

  return (
    <div className="graph-container">
      {context.focusedTriggerId && (
        <div className="filter-indicator">
          <span>
            Showing: <strong>{events.find((e) => e.id === context.focusedTriggerId)?.title}</strong>
          </span>
          <button onClick={onClearFocus} className="clear-filter-btn">
            ✕ Show All
          </button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        selectionOnDrag
        panOnDrag={false}
        zoomOnScroll={false}
      >
        <Background variant={BackgroundVariant.Dots} color="#334155" gap={20} />
        <Controls className="flow-controls" />
      </ReactFlow>
    </div>
  );
};

export default FailureGraph;
