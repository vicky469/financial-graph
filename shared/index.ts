/**
 * @financial-graph/shared
 * 
 * Shared types, schema, and utilities for financial-graph
 * Used by both backend and frontend for type safety
 */

// Export schema
export { default as schema } from "./instant.schema";
export type { AppSchema } from "./instant.schema";

// Export all types
export * from "./types";

// Export job validation
export * from "./types/job-validation";

// Export validation utilities
export * from "./types/validation";

// Export ID generation utilities (namespaces)
export * from "./types/ids";

// Export SIC codes
export * from "./types/sic-codes";

// Export company filters (categories and owner orgs)
export * from "./types/company-filters";

// Export shared utilities
export * from "./utils";

// Export database client and queries
export * from "./db";
