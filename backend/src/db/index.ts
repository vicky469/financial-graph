/**
 * Backend Database Module
 * 
 * This module provides:
 * 1. Admin client (from ./client) - for bulk operations, bypassing auth
 * 2. Query functions (from ./queries) - read-only operations using admin client
 * 3. Repository functions (from ./repo) - admin write operations
 * 
 * Frontend should use @financial-graph/shared/db for CRUD with auth rules.
 */

// Re-export types from shared package
export * from "@financial-graph/shared";

// Admin client (backend only - bypasses auth rules)
export { db } from "./client";

// Repository functions (admin write operations)
export * from "./repo";

// Query functions (read operations using admin client)
export * from "./queries";
