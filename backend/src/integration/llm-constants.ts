/**
 * Shared LLM runtime defaults used across multiple modules.
 * Keep this file small: only values that are truly cross-module.
 */

// Per-request timeout for provider API calls.
export const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 60_000;

// Outer hard timeout used by worker-pool guardrails.
export const DEFAULT_LLM_HARD_REQUEST_TIMEOUT_MS = 120_000;

// Extra headroom added above request timeout for hard timeout calculation.
export const DEFAULT_LLM_HARD_TIMEOUT_BUFFER_MS = 30_000;

// Global max in-flight worker count for the LLM worker pool.
export const DEFAULT_LLM_POOL_MAX_WORKERS = 15;
