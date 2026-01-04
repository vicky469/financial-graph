// InstantDB Schema Definition
// This is the source of truth for database structure

import { i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    nodes: i.entity({
      name: i.string(),
      type: i.string(), // "Company", "Brand"
      properties: i.json(), // Record<string, PropertyValue> - flexible key-value store
      jurisdiction: i.string().optional(),
      cik: i.string().optional(),
      companyGroupId: i.string().optional(), // Company only - ultimate parent cluster
      sector: i.number().optional(), // Company only - GICS sector code
      segments: i.json().optional(), // Company only - string[] of business segments
      validFrom: i.number().optional(), // Incorporation/Start Date
      validTo: i.number().optional(), // Dissolution/End Date
      url: i.string().optional(),
      metadata: i.json().optional(), // NodeMetadata - data quality & provenance
      createdAt: i.number(),
      createdBy: i.string(),
      updatedAt: i.number(),
      updatedBy: i.string(),
    }),
    edges: i.entity({
      sourceId: i.string(),
      targetId: i.string(),
      label: i.string(),
      edgeType: i.string().optional(), // 'causal' or 'simultaneous'
      ownership: i.number().optional(), // 0-100
      validFrom: i.number().optional(), // Timestamp
      validTo: i.number().optional(), // Timestamp
      createdAt: i.number(),
      createdBy: i.string(),
      updatedAt: i.number(),
      updatedBy: i.string(),
    }),
    userSelections: i.entity({
      odxerId: i.string(),
      userName: i.string(),
      selectedNodeId: i.string().optional(),
      color: i.string(),
      lastUpdated: i.number(),
    }),
    editHistory: i.entity({
      action: i.string(),
      targetId: i.string(),
      targetType: i.string(),
      previousData: i.json().optional(),
      newData: i.json().optional(),
      userId: i.string(),
      userName: i.string(),
      timestamp: i.number(),
    }),
  },
});

export default schema;
