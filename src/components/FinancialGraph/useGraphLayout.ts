// Graph layout calculation hook using Dagre

import { useMemo } from "react";
import dagre from "dagre";
import type { Node as GraphNode, Edge } from "../../types";
import { Position } from "reactflow";

// Diagram Layout Configuration
const NODE_WIDTH = 180;
const NODE_HEIGHT = 100;
const RANK_SEP = 120; // Vertical gap between levels
const NODE_SEP = 80; // Horizontal gap between nodes

export function useGraphLayout(nodes: GraphNode[], edges: Edge[]) {
  return useMemo(() => {
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
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.sourceId, edge.targetId);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // We need to pass a slightly off-center position to handle React Flow's center anchor
    // but React Flow handles handle positions automatically if we just give the top-left or center.
    // Dagre gives center. React Flow nodes default to top-left unless anchor is set?
    // Usually React Flow nodes x/y are top-left. Dagre gives center x/y.

    positions.set(node.id, {
      x: nodeWithPosition.x - NODE_WIDTH / 2,
      y: nodeWithPosition.y - NODE_HEIGHT / 2,
    });
  });

  return positions;
}
