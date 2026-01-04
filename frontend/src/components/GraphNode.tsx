import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { NodeData } from "../types";

const GraphNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const { name, type, isSelected, isPublic, isSubsidiary } = data;

  return (
    <div
      className={`entity-node ${isSelected || selected ? "selected" : ""} ${
        type === "Company" ? "type-company" : "type-brand"
      }`}
    >
      {/* Handles for Vertical Flow (Causal) */}
      <Handle id="top" type="target" position={Position.Top} className="node-handle top" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-handle bottom" />

      {/* Handles for Horizontal Flow (Entity connections) */}
      <Handle id="left" type="target" position={Position.Left} className="node-handle left" />
      <Handle id="right" type="source" position={Position.Right} className="node-handle right" />

      {/* Status Badges */}
      {type === "Company" && (
        <div className="node-badges">
          {isSubsidiary && <span className="badge subsidiary">SUB</span>}
          <span className={`badge ${isPublic ? "public" : "private"}`}>
            {isPublic ? "PUB" : "PVT"}
          </span>
        </div>
      )}

      <div className="entity-content">
        <div className="entity-type">{type}</div>
        <div className="entity-name">{name}</div>
      </div>
    </div>
  );
});

GraphNode.displayName = "GraphNode";
export default GraphNode;
