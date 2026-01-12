/**
 * @financial-graph/shared
 * 
 * Shared types, schema, and utilities for financial-graph
 * Used by both backend and frontend for type safety
 */

// Export schema
export { default as schema } from "./types/schema";
export type { AppSchema } from "./types/schema";

// Export all types
export * from "./types/types";

// Export validation utilities
export * from "./types/validation";

// Export ID generation utilities (namespaces)
export * from "./types/ids";
