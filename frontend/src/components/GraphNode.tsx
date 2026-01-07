import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

// Adapter for ReactFlow's NodeProps check
type NodeData = {
  name: string;
  type: string;
  isSelected: boolean;
  isPublic: boolean;
  isSubsidiary: boolean;
  [key: string]: any;
};

const GraphNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const { name, type, isSelected, isPublic, isSubsidiary } = data;

  // Company Node
  if (type === "Company") {
    return (
      <div
        className={cn(
          "relative w-[220px] min-h-[140px] p-5 rounded-lg",
          "bg-card/90 border-2 transition-all duration-200",
          isSelected || selected
            ? "border-primary shadow-lg shadow-primary/20"
            : "border-border hover:border-border/80"
        )}
      >
        {/* Handles */}
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !bg-muted-foreground !border-0"
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-muted-foreground !border-0"
        />
        <Handle
          id="left"
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-muted-foreground !border-0"
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-muted-foreground !border-0"
        />

        {/* Badges - Top Right */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {isSubsidiary && (
            <Badge className="bg-orange-600 hover:bg-orange-600 text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5">
              SUB
            </Badge>
          )}
          <Badge
            className={cn(
              "text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5",
              isPublic
                ? "bg-green-600 hover:bg-green-600"
                : "bg-secondary hover:bg-secondary"
            )}
          >
            {isPublic ? "PUB" : "PVT"}
          </Badge>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="text-lg font-bold text-foreground leading-tight pr-20 capitalize">
            {name.toLowerCase()}
          </div>
        </div>
      </div>
    );
  }

  // Brand Node
  return (
    <div
      className={cn(
        "relative w-[160px] h-[160px] rounded-full flex items-center justify-center",
        "bg-card/90 border-[3px] transition-all duration-200",
        isSelected || selected
          ? "border-purple-400 shadow-lg shadow-purple-500/20"
          : "border-purple-500 hover:border-purple-400"
      )}
    >
      {/* Handles */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-purple-400 !border-0"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-purple-400 !border-0"
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-purple-400 !border-0"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-purple-400 !border-0"
      />

      {/* Content */}
      <div className="flex flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-base font-bold text-foreground leading-tight capitalize">
          {name.toLowerCase()}
        </div>
      </div>
    </div>
  );
});

GraphNode.displayName = "GraphNode";
export default GraphNode;
