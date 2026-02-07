/**
 * Shared Database Module
 * 
 * Exports query definitions and helper functions that work with both:
 * - Frontend: db.query() from @instantdb/core
 * - Backend: db.query() from @instantdb/admin (async, one-shot)
 * 
 * This module does NOT export a db client - each environment provides its own.
 */

// Query definitions and helpers
export * from "./queries";
