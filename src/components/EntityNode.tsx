import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { EntityNodeData } from "../types";

const EntityNode = memo(({ data, selected }: NodeProps<EntityNodeData>) => {
  const { name, type, isSelected, otherUserSelecting } = data;

  return (
    <div
      className={`entity-node ${isSelected || selected ? "selected" : ""}`}
      style={{
        boxShadow: otherUserSelecting
          ? `0 0 0 3px ${otherUserSelecting.color}`
          : undefined,
      }}
    >
      {/* Handles for Vertical Flow (Causal) */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="node-handle top"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="node-handle bottom"
      />

      {/* Handles for Horizontal Flow (Entity connections) */}
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="node-handle left"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="node-handle right"
      />

      <div className="entity-content">
        <div className="entity-type">{type}</div>
        <div className="entity-name">{name}</div>
      </div>

      {otherUserSelecting && (
        <div
          className="user-indicator"
          style={{ backgroundColor: otherUserSelecting.color }}
        >
          {otherUserSelecting.userName}
        </div>
      )}
    </div>
  );
});

EntityNode.displayName = "EntityNode";
export default EntityNode;
