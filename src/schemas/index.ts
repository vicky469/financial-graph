// Zod schemas for form validation

import { z } from "zod";

// Event schema
export const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().default(""),
  link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  isTrigger: z.boolean().default(false),
});

export type EventFormData = z.infer<typeof eventSchema>;

// Entity schema
export const entitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
});

export type EntityFormData = z.infer<typeof entitySchema>;

// Entity property schema
export const propertySchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
});

export type PropertyFormData = z.infer<typeof propertySchema>;

// Edge schema
export const edgeSchema = z.object({
  label: z.string().optional().default(""),
  edgeType: z.enum(["causal", "simultaneous"]).default("causal"),
});

export type EdgeFormData = z.infer<typeof edgeSchema>;
