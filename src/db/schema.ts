// InstantDB Schema Definition
// This is the source of truth for database structure

import { i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    nodes: i.entity({
      name: i.string(),
      type: i.string(), // "Bank", "Sector", "Regulator"
      properties: i.json(), // Record<string, string>
      jurisdiction: i.string().optional(),
      cik: i.string().optional(),
      validFrom: i.number().optional(), // Incorporation/Start Date
      validTo: i.number().optional(), // Dissolution/End Date
      url: i.string().optional(),
      createdAt: i.number(),
      createdBy: i.string(),
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
