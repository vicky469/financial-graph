import { GICS } from "./sec";

// Domain types for Financial Graph
// These represent the core business entities

export const NodeType = {
  Company: "Company",
  Brand: "Brand",
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export interface BaseNode {
  id: string;
  name: string;
  validFrom?: number;
  validTo?: number;
  url?: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}

export interface CompanyGroup {
  id: string;
  name: string;
  sector: GICS | null; // Primary GICS-style sector
  createdAt: number;
  createdBy: string;
}

export type PropertyValue = string | number | boolean | null | string[];

export type NodeProperties = Record<string, PropertyValue>;

// Only includes properties that go in the properties object
// Note: ownership_percent and parent_id are edge properties, not node properties
export interface CompanyBaseProperties {
  primary_industry?: string | null;
}

export interface BrandBaseProperties {
  brand_type?: "product" | "service" | "trademark";
  category?: string | null;
  company_id?: string | null;
}

// Union type for all typed properties
export type TypedNodeProperties = CompanyBaseProperties | BrandBaseProperties;

// Meta & Quality Fields - tracking data provenance and quality
// Applies to both Company and Brand nodes
export type ParsingMethod = "regex_table" | "llm_fallback" | "item1_fallback" | "manual";

export interface NodeMetadata {
  dataSourceId?: string; // UUID - Links to DataSource Node (e.g., "SEC Exhibit 21")
  sourceFilingId?: string; // UUID - Links to specific filing (e.g., "Microsoft 10-K 2024")
  parsingMethod?: ParsingMethod; // How the data was extracted
  confidenceScore?: number; // 0.0 - 1.0 - Bot's certainty score
  isComplete?: boolean; // False if "Material Subsidiaries" disclaimer found
}

export interface Node extends BaseNode {
  type: NodeType | string; // allowing string for legacy/seed compatibility temporarily
  properties: NodeProperties; // canonical + custom metadata (see templates below)
  jurisdiction?: string;
  cik?: string;
  companyGroupId?: string; // Ultimate parent cluster (Company only)
  sector?: GICS | null; // Primary GICS-style sector (Company only)
  segments?: string[]; // Item 1 business segments like Retail, Cloud (Company only)
  metadata?: NodeMetadata; // Meta & Quality fields for data provenance
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  edgeType?: "causal" | "simultaneous"; // Visual style: causal (solid) or simultaneous (dashed)
  ownership?: number; // Ownership percentage (0-100) for parent-child company relationships
  validFrom?: number; // Timestamp
  validTo?: number; // Timestamp
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}
