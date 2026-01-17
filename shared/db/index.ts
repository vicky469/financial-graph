/**
 * Shared Database Module
 * 
 * Exports query definitions and helper functions that work with both:
 * - Frontend: db.query() from @instantdb/core
 * - Backend: db.queryOnce() from @instantdb/admin
 * 
 * This module does NOT export a db client - each environment provides its own.
 */

// Query definitions and helpers
export * from "./queries";
