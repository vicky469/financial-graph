// FailureGraph - Main graph visualization component

import { useCallback, useMemo, useEffect } from "react";
import ReactFlow, { type Node, type Edge as FlowEdge, Controls, Background } from "reactflow";
import { BackgroundVariant, useNodesState, useEdgesState } from "reactflow";
import { type Connection } from "reactflow";
import "reactflow/dist/style.css";

import EventNode from "../EventNode";
import EntityNode from "../EntityNode";
import { useGraph, createEdge, deleteEdge } from "../../db";
import type { EventNodeData, EntityNodeData, UserSelection, FailureGraphProps } from "../../types";
import { useGraphNodes } from "./useGraphNodes";
import { useGraphEdges } from "./useGraphEdges";
import { getConnectedIds } from "./graphUtils";

const nodeTypes = { eventNode: EventNode, entityNode: EntityNode };

const FailureGraph = ({
  context,
  onSelectEvent,
  onSelectEdge,
  onSelectEntity,
  onFocusTrigger,
  onClearFocus,
  showActors = true,
}: FailureGraphProps) => {
  const { events, entities, edges, selections, isLoading } = useGraph();

  // Calculate visible node IDs based on focus
  const visibleIds = useMemo(() => {
    const eventIds = events.map((e) => e.id);
    const entityIds = showActors ? entities.map((e) => e.id) : [];
    if (!context.focusedTriggerId) return new Set([...eventIds, ...entityIds]);
    return getConnectedIds(context.focusedTriggerId, edges);
  }, [context.focusedTriggerId, events, entities, edges, showActors]);

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
