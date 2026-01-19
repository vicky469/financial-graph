// Shared jurisdiction color mapping for consistency across components

// Color palette - vibrant and distinct colors
export const JURISDICTION_COLORS = [
  "#3b82f6", // Blue
  "#22c55e", // Green  
  "#f97316", // Orange
  "#a855f7", // Purple
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#eab308", // Yellow
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#10b981", // Emerald
];

// Specific color assignments for common jurisdictions
const JURISDICTION_COLOR_MAP: Record<string, string> = {
  "Delaware, US": "#3b82f6",      // Blue
  "Delaware": "#3b82f6",          // Blue
  "Luxembourg": "#f97316",        // Orange
  "United Kingdom": "#a855f7",    // Purple
  "UK": "#a855f7",               // Purple
  "Nevada, US": "#22c55e",       // Green
  "Nevada": "#22c55e",           // Green
  "California, US": "#ef4444",   // Red
  "California": "#ef4444",       // Red
  "New York, US": "#06b6d4",     // Cyan
  "New York": "#06b6d4",         // Cyan
  "Texas, US": "#eab308",        // Yellow
  "Texas": "#eab308",            // Yellow
  "Florida, US": "#ec4899",      // Pink
  "Florida": "#ec4899",          // Pink
  "Hungary": "#f59e0b",          // Amber
  "Germany": "#14b8a6",          // Teal
  "France": "#8b5cf6",           // Violet
  "Netherlands": "#10b981",      // Emerald
  "Unknown": "#6b7280",          // Gray
  "": "#6b7280",                 // Gray for empty
};

/**
 * Get a consistent color for a jurisdiction name
 * Uses predefined mapping for common jurisdictions, falls back to hash for others
 */
export function getJurisdictionColor(jurisdiction: string): string {
  // Handle empty or unknown jurisdictions
  if (!jurisdiction || jurisdiction === "Unknown" || jurisdiction === "") {
    return "#6b7280"; // Gray
  }

  // Check if we have a specific color mapping for this jurisdiction
  if (JURISDICTION_COLOR_MAP[jurisdiction]) {
    return JURISDICTION_COLOR_MAP[jurisdiction];
  }

  // For unmapped jurisdictions, use hash-based selection
  let hash = 0;
  for (let i = 0; i < jurisdiction.length; i++) {
    hash = jurisdiction.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return JURISDICTION_COLORS[Math.abs(hash) % JURISDICTION_COLORS.length];
}