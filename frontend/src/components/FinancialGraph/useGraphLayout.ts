// Graph layout calculation hook using Dagre

import { useMemo } from "react";
import dagre from "dagre";
import type { Node as GraphNode, Edge } from "../../types";

// Diagram Layout Configuration
const NODE_WIDTH = 220; // Company node width
const NODE_HEIGHT = 140; // Company node height
const RANK_SEP = 150; // Vertical gap between levels
const NODE_SEP = 100; // Horizontal gap between nodes

export function useGraphLayout(nodes: GraphNode[], edges: Edge[]) {
  return useMemo(() => {
    if (nodes.length === 0) return new Map();
    return calculatePositions(nodes, edges);
  }, [nodes, edges]);
}

/**
 * Calculate node positions using Dagre layout engine
 */
function calculatePositions(
  nodes: GraphNode[],
  edges: Edge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return positions;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: "TB", // Top-to-Bottom
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
  });

  nodes.forEach((node) => {
    // Use different dimensions for brands (circular nodes)
    const width = node.type === "Brand" ? 160 : NODE_WIDTH;
    const height = node.type === "Brand" ? 160 : NODE_HEIGHT;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.sourceId, edge.targetId);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // Dagre gives center x/y, React Flow needs top-left
    const width = node.type === "Brand" ? 160 : NODE_WIDTH;
    const height = node.type === "Brand" ? 160 : NODE_HEIGHT;

    positions.set(node.id, {
      x: nodeWithPosition.x - width / 2,
      y: nodeWithPosition.y - height / 2,
    });
  });

  return positions;
}
