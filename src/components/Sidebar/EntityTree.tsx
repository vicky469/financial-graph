import { useState } from "react";
import type { Entity, Edge, AppContext } from "../../types";

interface EntityTreeProps {
  entities: Entity[];
  edges: Edge[];
  context: AppContext;
  onFocusEntity: (id: string) => void;
  onSelectEntity?: (id: string | null) => void;
}

interface TreeNode {
  entity: Entity;
  children: TreeNode[];
}

export const EntityTree = ({ entities, edges, context, onFocusEntity, onSelectEntity }: EntityTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build tree structure: find root entities (no incoming edges from other entities)
  const buildTree = (): TreeNode[] => {
    const entityIds = new Set(entities.map((e) => e.id));
    const childIds = new Set(
      edges
        .filter((edge) => entityIds.has(edge.sourceId) && entityIds.has(edge.targetId))
        .map((edge) => edge.targetId)
    );

    // Root entities are those with no parent entity
    const rootEntities = entities.filter((e) => !childIds.has(e.id));

    const buildNodeChildren = (parentId: string): TreeNode[] => {
      const childEdges = edges.filter((edge) => edge.sourceId === parentId);
      const children = childEdges
        .map((edge) => entities.find((e) => e.id === edge.targetId))
        .filter((e): e is Entity => e !== undefined);

      return children.map((child) => ({
        entity: child,
        children: buildNodeChildren(child.id),
      }));
    };

    return rootEntities.map((root) => ({
      entity: root,
      children: buildNodeChildren(root.id),
    }));
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

  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.entity.id);

    return (
      <div key={node.entity.id} className="tree-node">
        <div
          className="tree-node-content"
          style={{ paddingLeft: `${level * 16}px`, position: "relative" }}
        >
          {hasChildren && (
            <button
              className="tree-toggle"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.entity.id);
              }}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
          {!hasChildren && <span className="tree-spacer" />}
          <div
            className={`tree-item ${context.focusedEntityId === node.entity.id ? "focused" : ""}`}
            onClick={() => onFocusEntity(node.entity.id)}
          >
            <span className="tree-title">{node.entity.name}</span>
            <span className="tree-type">{node.entity.type}</span>
          </div>
          <button
            className="three-dots-menu"
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "1rem",
              padding: "2px 4px",
              cursor: "pointer",
              opacity: 0.6,
              lineHeight: 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEntity?.(node.entity.id);
            }}
            title="Edit entity"
          >
            ⋮
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree();

  if (entities.length === 0) {
    return <p className="empty-message">No entities yet</p>;
  }

  return (
    <div className="entity-tree">
      {tree.map((node) => renderTreeNode(node))}
    </div>
  );
};
