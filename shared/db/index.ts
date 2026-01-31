/**
 * Shared Database Module
 * 
 * Exports query definitions and helper functions that work with:
 * - Frontend: db.useQuery(query) from @instantdb/react to enable "live queries"
 * - Backend: await db.query from @instantdb/admin to simply fires a query once and returns a result.
 * 
 * Each environment provides its own client for security reasons:
 * - Backend uses admin token for full access
 * - Frontend uses app ID only for limited access
 */

// Query definitions and helpers
export * from "./queries";
