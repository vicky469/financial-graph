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

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = h / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (segment >= 0 && segment < 1) {
    r = chroma;
    g = second;
  } else if (segment >= 1 && segment < 2) {
    r = second;
    g = chroma;
  } else if (segment >= 2 && segment < 3) {
    g = chroma;
    b = second;
  } else if (segment >= 3 && segment < 4) {
    g = second;
    b = chroma;
  } else if (segment >= 4 && segment < 5) {
    r = second;
    b = chroma;
  } else {
    r = chroma;
    b = second;
  }

  const match = lightness - chroma / 2;
  const toHex = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hashJurisdiction(jurisdiction: string): number {
  // FNV-1a 32-bit hash for stable, low-collision distribution.
  let hash = 2166136261;
  for (let i = 0; i < jurisdiction.length; i++) {
    hash ^= jurisdiction.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

/**
 * Get a consistent color for a jurisdiction name.
 * Uses predefined mapping for common jurisdictions, then a hash-derived HSL color
 * to avoid collisions from the old small fixed palette.
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

  const normalized = jurisdiction.trim().toLowerCase();
  const hash = hashJurisdiction(normalized);

  const hue = hash % 360;
  const saturation = 62 + ((hash >> 8) % 18); // 62-79
  const lightness = 50 + ((hash >> 13) % 10); // 50-59

  return hslToHex(hue, saturation, lightness);
}
