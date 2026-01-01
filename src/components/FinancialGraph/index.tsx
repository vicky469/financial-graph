// FinancialGraph - Main graph visualization component

import { useCallback, useMemo, useEffect } from "react";
import ReactFlow, { type Node, type Edge as FlowEdge, Controls, Background } from "reactflow";
import { BackgroundVariant, useNodesState, useEdgesState } from "reactflow";
import { type Connection } from "reactflow";
import "reactflow/dist/style.css";

import GraphNode from "../GraphNode";
import { useGraph, createEdge, deleteEdge } from "../../db";
import type { NodeData, UserSelection, FinancialGraphProps } from "../../types";
import { useGraphNodes } from "./useGraphNodes";
import { useGraphEdges } from "./useGraphEdges";
import { getEntityWithDescendants } from "./graphUtils";

const nodeTypes = { entityNode: GraphNode };

const FinancialGraph = ({
  context,
  onSelectEdge,
  onSelectNode,
  onFocusNode,
  onClearFocus,
  showNodes = true,
}: FinancialGraphProps) => {
  const { nodes: entities, edges, selections, isLoading } = useGraph();

  // Calculate visible node IDs based on focus and visibility toggles
  const visibleIds = useMemo(() => {
    // If a node is focused, show that node and its descendants
    if (context.focusedNodeId) {
      return getEntityWithDescendants(context.focusedNodeId, entities, edges);
    }

    // No focus: show all nodes if visibility toggle is on
    const entityIds = showNodes ? entities.map((e) => e.id) : [];
    return new Set([...entityIds]);
  }, [context.focusedNodeId, entities, edges, showNodes]);

  // Build nodes and edges using hooks
  const flowNodes = useGraphNodes(entities, edges, visibleIds, selections as UserSelection[], context);

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
    (_: React.MouseEvent, node: Node<NodeData>) => {
      if (node.type === "entityNode") {
        onFocusNode(node.id);
      }
    },
    [onFocusNode]
  );

  const onPaneClick = useCallback(() => {
    if (context.focusedNodeId) {
      onClearFocus();
    }
    onSelectNode?.(null);
    onSelectEdge?.(null);
  }, [context.focusedNodeId, onClearFocus, onSelectNode, onSelectEdge]);

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
