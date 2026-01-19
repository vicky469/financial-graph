import { useMemo } from "react";

interface TreemapNode {
  id: string;
  name: string;
  value: number;
  children?: TreemapNode[];
  subsidiaryData?: any; // Store subsidiary data for leaf nodes
}

interface TreemapProps {
  data: TreemapNode[];
  width: number;
  height: number;
  onNodeClick?: (node: TreemapNode) => void;
}

interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  node: TreemapNode;
  depth: number;
}

// Enhanced treemap layout algorithm for hierarchical data
function squarifyHierarchical(
  nodes: TreemapNode[],
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number = 0
): TreemapRect[] {
  if (nodes.length === 0) return [];
  
  const totalValue = nodes.reduce((sum, node) => sum + node.value, 0);
  const rects: TreemapRect[] = [];
  
  let currentX = x;
  let currentY = y;
  let remainingWidth = width;
  let remainingHeight = height;
  
  // Use different layout strategies based on depth
  const isHorizontal = width > height;
  
  nodes.forEach((node) => {
    const ratio = node.value / totalValue;
    
    if (isHorizontal) {
      const rectWidth = remainingWidth * ratio;
      const rect: TreemapRect = {
        x: currentX,
        y: currentY,
        width: rectWidth,
        height: height,
        node,
        depth,
      };
      rects.push(rect);
      
      // If this node has children, recursively layout them within this rectangle
      if (node.children && node.children.length > 0 && depth === 0) {
        // Leave space for the group label
        const labelHeight = 30;
        const childRects = squarifyHierarchical(
          node.children,
          currentX + 2,
          currentY + labelHeight,
          rectWidth - 4,
          height - labelHeight - 2,
          depth + 1
        );
        rects.push(...childRects);
      }
      
      currentX += rectWidth;
      remainingWidth -= rectWidth;
    } else {
      const rectHeight = remainingHeight * ratio;
      const rect: TreemapRect = {
        x: currentX,
        y: currentY,
        width: width,
        height: rectHeight,
        node,
        depth,
      };
      rects.push(rect);
      
      // If this node has children, recursively layout them within this rectangle
      if (node.children && node.children.length > 0 && depth === 0) {
        // Leave space for the group label
        const labelHeight = 30;
        const childRects = squarifyHierarchical(
          node.children,
          currentX + 2,
          currentY + labelHeight,
          width - 4,
          rectHeight - labelHeight - 2,
          depth + 1
        );
        rects.push(...childRects);
      }
      
      currentY += rectHeight;
      remainingHeight -= rectHeight;
    }
  });
  
  return rects;
}

// Generate colors for different levels and jurisdictions
function getNodeColor(depth: number, index: number, isGroup: boolean = false): string {
  if (isGroup) {
    // Darker colors for jurisdiction groups
    const groupColors = [
      "#1e40af", "#7c2d12", "#166534", "#7c2d12", "#581c87",
      "#be185d", "#0f766e", "#a16207", "#dc2626", "#6366f1"
    ];
    return groupColors[index % groupColors.length];
  } else {
    // Lighter colors for individual subsidiaries
    const colors = [
      ["#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe"], // Blue
      ["#10b981", "#34d399", "#6ee7b7", "#d1fae5"], // Green
      ["#f59e0b", "#fbbf24", "#fcd34d", "#fef3c7"], // Yellow
      ["#ef4444", "#f87171", "#fca5a5", "#fecaca"], // Red
      ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ede9fe"], // Purple
    ];
    
    const colorSet = colors[index % colors.length];
    return colorSet[Math.min(depth, colorSet.length - 1)];
  }
}

export function Treemap({ data, width, height, onNodeClick }: TreemapProps) {
  const rects = useMemo(() => {
    if (data.length === 0) return [];
    return squarifyHierarchical(data, 0, 0, width, height);
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-muted-foreground/60"
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1">No data to visualize</p>
          <p className="text-xs text-muted-foreground/50">
            Select a company with subsidiaries
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width, height }} className="relative">
      <svg width={width} height={height} className="border border-border/20 rounded-lg">
        {rects.map((rect, index) => {
          const isGroup = rect.depth === 0 && rect.node.children && rect.node.children.length > 0;
          const isClickable = rect.node.subsidiaryData || !isGroup;
          const color = getNodeColor(rect.depth, index, isGroup);
          const textColor = "#ffffff";
          const fontSize = Math.max(10, Math.min(rect.width / 8, rect.height / 4, 16));
          
          return (
            <g key={`${rect.node.id}-${rect.depth}`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={color}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={rect.depth === 0 ? 2 : 1}
                className={isClickable ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
                onClick={() => isClickable && onNodeClick?.(rect.node)}
              />
              
              {/* Node label */}
              {rect.width > 40 && rect.height > 20 && (
                <text
                  x={rect.x + rect.width / 2}
                  y={rect.y + (isGroup ? 20 : rect.height / 2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={textColor}
                  fontSize={isGroup ? Math.max(fontSize, 12) : fontSize}
                  fontWeight={isGroup ? "600" : "500"}
                  className="pointer-events-none select-none"
                >
                  <tspan x={rect.x + rect.width / 2} dy="0">
                    {rect.node.name.length > (isGroup ? 15 : 20) 
                      ? rect.node.name.substring(0, (isGroup ? 12 : 17)) + "..." 
                      : rect.node.name}
                  </tspan>
                  {isGroup && rect.width > 100 && rect.height > 50 && (
                    <tspan 
                      x={rect.x + rect.width / 2} 
                      dy={fontSize + 2}
                      fontSize={fontSize * 0.8}
                      fill="rgba(255,255,255,0.8)"
                    >
                      {rect.node.value} subsidiaries
                    </tspan>
                  )}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}