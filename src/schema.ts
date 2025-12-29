// InstantDB Schema Definition
// This is the source of truth for database structure

import { i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    events: i.entity({
      title: i.string(),
      description: i.string(),
      isTrigger: i.boolean(),
      date: i.string(),
      createdAt: i.number(),
      createdBy: i.string(),
    }),
    entities: i.entity({
      name: i.string(),
      type: i.string(), // "Bank", "Sector", "Regulator"
      properties: i.json(), // Record<string, string>
      createdAt: i.number(),
      createdBy: i.string(),
    }),
    edges: i.entity({
      sourceId: i.string(),
      targetId: i.string(),
      label: i.string(),
      edgeType: i.string().optional(), // 'causal' or 'simultaneous'
      createdAt: i.number(),
      createdBy: i.string(),
    }),
    userSelections: i.entity({
      odxerId: i.string(),
      userName: i.string(),
      selectedEventId: i.string().optional(),
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
