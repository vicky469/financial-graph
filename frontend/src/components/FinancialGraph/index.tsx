// FinancialGraph - Main graph visualization component

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Controls,
  Background,
  BackgroundVariant,
} from "reactflow";
import type { Node, Edge as FlowEdge, Connection } from "reactflow";
import "reactflow/dist/style.css";

import GraphNode from "../GraphNode";
import { DetailPanel } from "../DetailPanel";
import { useGraphNodes } from "./useGraphNodes";
import { useGraphEdges } from "./useGraphEdges";
import { getEntityWithDescendants } from "./graphUtils";
import type { Node as AppNode, Edge as AppEdge } from "../../types";

const nodeTypes = { entityNode: GraphNode };

interface FinancialGraphProps {
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  selectedGraphNodeId: string | null;
  selectedEdgeId: string | null;
  nodes: AppNode[];
  edges: AppEdge[];
  onSelectGraphNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onClearFocus: () => void;
  showNodes?: boolean;
  showBrands?: boolean;
}

const FinancialGraph = ({
  focusedNodeId,
  selectedNodeId,
  selectedGraphNodeId,
  selectedEdgeId,
  nodes: entities,
  edges,
  onSelectGraphNode,
  onSelectEdge,
  onClearFocus,
  showNodes = true,
  showBrands = true,
}: FinancialGraphProps) => {

  // Calculate visible node IDs based on focus and visibility toggles
  const visibleIds = useMemo(() => {
    let candidateIds = new Set<string>();

    // 1. Determine candidate nodes (Focus Mode vs Selected Node)
    if (focusedNodeId) {
      candidateIds = getEntityWithDescendants(focusedNodeId, entities, edges);
    } else if (selectedNodeId) {
      // Only show the selected node and its descendants
      candidateIds = getEntityWithDescendants(selectedNodeId, entities, edges);
    } else {
      // No selection - show nothing
      return new Set<string>();
    }

    // 2. Apply Visibility Filters
    const finalVisibleSet = new Set<string>();
    const selectedNode = entities.find((n) => n.id === selectedNodeId);

    candidateIds.forEach((id) => {
      const node = entities.find((e) => e.id === id);
      if (!node) return;

      // Filter Companies
      if (node.type === "Company") {
        if (showNodes) finalVisibleSet.add(id);
      }
      // Filter Brands
      else if (node.type === "Brand") {
        if (showBrands) {
          // If a company is selected, show ONLY its brands
          if (selectedNode?.type === "Company") {
            // Check if this brand belongs to the selected company
            const isOwnedBySelect = edges.some(
              (e) =>
                e.sourceId === selectedNode.id &&
                e.targetId === id &&
                e.label === "owns"
            );
            if (isOwnedBySelect) {
              finalVisibleSet.add(id);
            }
          } else {
            // Otherwise show all brands (that are candidates)
            finalVisibleSet.add(id);
          }
        }
      }
      // Keep other node types (if any) visible by default or add logic
      else {
        finalVisibleSet.add(id);
      }
    });

    return finalVisibleSet;
  }, [focusedNodeId, selectedNodeId, entities, edges, showNodes, showBrands]);

  // Build nodes and edges using hooks
  const nodes = useGraphNodes(entities, edges, visibleIds, selectedGraphNodeId);
  const edgesFlow = useGraphEdges(edges, visibleIds, selectedEdgeId);

  // Event handlers
  const onNodesChange = useCallback(() => {
    // Nodes are read-only in this visualization
  }, []);

  const onEdgesChange = useCallback(() => {
    // Edges are read-only in this visualization
  }, []);

  // Event handlers
  const onConnect = useCallback((_c: Connection) => {
    // Connections are disabled in this visualization
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "entityNode") {
        onSelectGraphNode(node.id);
      }
    },
    [onSelectGraphNode]
  );

  const onPaneClick = useCallback(() => {
    if (focusedNodeId) {
      onClearFocus();
    }
    onSelectGraphNode(null);
    onSelectEdge(null);
  }, [focusedNodeId, onClearFocus, onSelectGraphNode, onSelectEdge]);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: FlowEdge) => {
      onSelectEdge(edge.id);
    },
    [onSelectEdge]
  );

  // Find selected graph node
  const selectedGraphNode = selectedGraphNodeId
    ? entities.find((e) => e.id === selectedGraphNodeId)
    : null;

  // Determine if selected node is public and subsidiary
  const isPublic = selectedGraphNode?.cik ? true : false;
  const isSubsidiary = selectedGraphNode
    ? edges.some(
        (e) =>
          e.targetId === selectedGraphNode.id &&
          (e.label === "owns" || e.label === "controls")
      )
    : false;

  return (
    <div className="w-full h-full bg-background relative flex">
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edgesFlow}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, duration: 0 }}
          panOnScroll
          selectionOnDrag
          panOnDrag
          zoomOnScroll={false}
          elementsSelectable={true}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} color="hsl(var(--muted-foreground) / 0.2)" gap={16} size={1} />
          <Controls className="!bg-card/90 !border-border/50 !text-muted-foreground/70 [&_button]:hover:!bg-accent/50" />
        </ReactFlow>
      </div>
      {selectedGraphNode && (
        <DetailPanel
          node={selectedGraphNode}
          onClose={() => onSelectGraphNode(null)}
          isPublic={isPublic}
          isSubsidiary={isSubsidiary}
        />
      )}
    </div>
  );
};

export default FinancialGraph;
