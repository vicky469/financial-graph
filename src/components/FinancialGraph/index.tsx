// FinancialGraph - Main graph visualization component

import { useCallback, useMemo, useEffect } from "react";
import ReactFlow, { type Node, type Edge as FlowEdge, Controls, Background } from "reactflow";
import { BackgroundVariant, useNodesState, useEdgesState } from "reactflow";
import { type Connection } from "reactflow";
import "reactflow/dist/style.css";

import EventNode from "../EventNode";
import GraphNode from "../GraphNode";
import { useGraph, createEdge, deleteEdge } from "../../db";
import type { EventNodeData, NodeData, UserSelection, FinancialGraphProps } from "../../types";
import { useGraphNodes } from "./useGraphNodes";
import { useGraphEdges } from "./useGraphEdges";
import { getEntityWithDescendants } from "./graphUtils";

const nodeTypes = { eventNode: EventNode, entityNode: GraphNode };

const FinancialGraph = ({
  context,
  onSelectEvent,
  onSelectEdge,
  onFocusTrigger,
  onFocusNode,
  onClearFocus,
  showNodes = true,
  showTriggersOnGraph = true,
  showNonTriggersOnGraph = true,
}: FinancialGraphProps) => {
  const { events, nodes: entities, edges, selections, isLoading } = useGraph();

  // Calculate visible node IDs based on focus and visibility toggles
  const visibleIds = useMemo(() => {
    // If a trigger is focused, show ONLY that trigger
    if (context.focusedTriggerId) {
      return new Set([context.focusedTriggerId]);
    }

    // If an entity is focused, show that entity, descendants, and connected events
    if (context.focusedNodeId) {
      const entityIds = getEntityWithDescendants(context.focusedNodeId, entities, edges);
      // Find events connected to focused entity
      const connectedEventIds = edges
        .filter((edge) => edge.sourceId === context.focusedNodeId)
        .map((edge) => edge.targetId)
        .filter((id) => {
          const event = events.find((e) => e.id === id);
          if (!event) return false;
          // Only include if the event's toggle is on
          if (event.isTrigger && !showTriggersOnGraph) return false;
          if (!event.isTrigger && !showNonTriggersOnGraph) return false;
          return true;
        });

      return new Set([...entityIds, ...connectedEventIds]);
    }

    // No focus: show all visible nodes based on toggles
    const visibleEvents = events.filter((e) => {
      if (e.isTrigger && !showTriggersOnGraph) return false;
      if (!e.isTrigger && !showNonTriggersOnGraph) return false;
      return true;
    });

    const eventIds = visibleEvents.map((e) => e.id);
    const entityIds = showNodes ? entities.map((e) => e.id) : [];

    return new Set([...eventIds, ...entityIds]);
  }, [
    context.focusedTriggerId,
    context.focusedNodeId,
    events,
    entities,
    edges,
    showNodes,
    showTriggersOnGraph,
    showNonTriggersOnGraph,
  ]);

  // Build nodes and edges using hooks
  const flowNodes = useGraphNodes(
    events,
    entities,
    edges,
    visibleIds,
    selections as UserSelection[],
    context
  );

  const flowEdges = useGraphEdges(edges, entities, visibleIds, context.selectedEdgeId);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => setNodes(flowNodes), [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  // Delete selected edge on Delete/Backspace key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && context.selectedEdgeId) {
        const edge = edges.find((e) => e.id === context.selectedEdgeId);
        if (edge) {
          deleteEdge(edge.id, edge);
          onSelectEdge?.(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [context.selectedEdgeId, edges, onSelectEdge]);

  // Event handlers
  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) createEdge(c.source, c.target);
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<EventNodeData | NodeData>) => {
      if (node.type === "entityNode") {
        onFocusNode(node.id);
      } else {
        const data = node.data as EventNodeData;
        data.isTrigger ? onFocusTrigger(node.id) : onSelectEvent(node.id);
      }
    },
    [onFocusTrigger, onSelectEvent, onFocusNode]
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
        <p>Loading graph...</p>
      </div>
    );
  }

  return (
    <div className="graph-container">
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

export default FinancialGraph;
