import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { EventNodeData } from "../types";

const EventNode = memo(({ data, selected }: NodeProps<EventNodeData>) => {
  const { title, date, description, isTrigger, isSelected, otherUserSelecting } = data;
  const [noteExpanded, setNoteExpanded] = useState(false);
  const hasDescription = description && description.trim().length > 0;

  return (
    <div
      className={`event-node ${isTrigger ? "trigger" : ""} ${
        isSelected || selected ? "selected" : ""
      }`}
      style={{
        boxShadow: otherUserSelecting ? `0 0 0 3px ${otherUserSelecting.color}` : undefined,
      }}
    >
      <div className="node-content">
        {isTrigger && <span className="trigger-badge">🔴 TRIGGER</span>}
        <h3 className="node-title">{title}</h3>
        <span className="node-date">{date}</span>

        {/* Sticky note toggle */}
        {hasDescription && (
          <button
            className="note-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setNoteExpanded(!noteExpanded);
            }}
            title={noteExpanded ? "Collapse note" : "Expand note"}
          >
            {noteExpanded ? "📝" : "📋"}
          </button>
        )}
      </div>

      {/* Expandable sticky note */}
      {hasDescription && noteExpanded && (
        <div className="sticky-note">
          <p>{description}</p>
        </div>
      )}

      {otherUserSelecting && (
        <div className="user-indicator" style={{ backgroundColor: otherUserSelecting.color }}>
          {otherUserSelecting.userName}
        </div>
      )}

      {/* Handles for Vertical Flow (Causal) */}
      <Handle id="top" type="target" position={Position.Top} className="node-handle top" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-handle bottom" />

      {/* Handles for Horizontal Flow (Entity connections) */}
      <Handle id="left" type="target" position={Position.Left} className="node-handle left" />
      <Handle id="right" type="source" position={Position.Right} className="node-handle right" />
    </div>
  );
});

EventNode.displayName = "EventNode";
export default EventNode;
