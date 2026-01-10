// Audit Trail Types

export interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface Audit {
  id: string;
  entity_type: string; // "companies" | "parent_of" | etc.
  entity_id: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  changed_by: "heuristic" | "llm" | "human";
  changed_at: string; // ISO-8601 timestamp
  source_id: string | null; // Filing ID if applicable
  fields_changed: FieldChange[];
  expires_at: string;
}
