// Zod schemas for form validation

import { z } from "zod";

// Node property schema
export const propertySchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
});

export type PropertyFormData = z.infer<typeof propertySchema>;

// Node schema
export const nodeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  properties: z.array(propertySchema),
});

export type NodeFormData = z.infer<typeof nodeSchema>;

// Edge schema
export const edgeSchema = z.object({
  label: z.string().optional().default(""),
  edgeType: z.enum(["causal", "simultaneous"]).default("causal"),
});

export type EdgeFormData = z.infer<typeof edgeSchema>;
