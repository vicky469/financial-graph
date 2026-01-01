import { useState } from "react";
import type { Node, Edge, AppContext } from "../../types";

interface NodeTreeProps {
  nodes: Node[];
  edges: Edge[];
  context: AppContext;
  onFocusNode: (id: string) => void;
  onSelectNode?: (id: string | null) => void;
}

interface TreeNode {
  node: Node;
  children: TreeNode[];
  level: number;
}

export const NodeTree = ({ nodes, edges, context, onFocusNode, onSelectNode }: NodeTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build tree structure
  const buildTree = (nodesList: Node[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Initialize all nodes
    nodesList.forEach((node) => {
      nodeMap.set(node.id, { node, children: [], level: 0 });
    });

    // Build hierarchy based on edges
    const childIds = new Set<string>();
    edges.forEach((edge) => {
      // Only consider edges between nodes (entities)
      if (nodeMap.has(edge.sourceId) && nodeMap.has(edge.targetId)) {
        childIds.add(edge.targetId);
        const parent = nodeMap.get(edge.sourceId);
        const child = nodeMap.get(edge.targetId);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    // Find roots (nodes with no incoming edges from other nodes)
    nodesList.forEach((node) => {
      if (!childIds.has(node.id)) {
        const root = nodeMap.get(node.id);
        if (root) roots.push(root);
      }
    });

    return roots;
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const renderNode = (treeNode: TreeNode) => {
    const hasChildren = treeNode.children.length > 0;
    const isExpanded = expanded.has(treeNode.node.id);
    const isFocused = context.focusedNodeId === treeNode.node.id;

    return (
      <div key={treeNode.node.id} className="tree-node-wrapper">
        <div className={`tree-row level-${treeNode.level} ${isFocused ? "focused" : ""}`}>
          {hasChildren ? (
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(treeNode.node.id);
              }}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="expand-spacer" />
          )}
          <div
            className={`tree-item ${context.focusedNodeId === treeNode.node.id ? "focused" : ""}`}
            onClick={() => onFocusNode(treeNode.node.id)}
          >
            <span className="tree-title">{treeNode.node.name}</span>
          </div>
          <button
            className="menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode?.(treeNode.node.id);
            }}
            title="Edit node"
          >
            ⋮
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {treeNode.children.map((child) => renderNode({ ...child, level: treeNode.level + 1 }))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(nodes);

  if (nodes.length === 0) {
    return <p className="empty-message">No nodes yet</p>;
  }

  return <div className="entity-tree">{tree.map((node) => renderNode(node))}</div>;
};
