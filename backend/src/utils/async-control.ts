/**
 * Shared async execution helpers used by network/provider code.
 *
 * Why this exists:
 * - Keep retry/backoff logic consistent across modules.
 * - Keep timeout wrappers consistent across long-running provider calls.
 * - Avoid each integration implementing its own sleep/backoff math.
 *
 * Notes:
 * - `maxRetries` means extra attempts after the first call.
 * - `withTimeout` rejects on timeout but does not cancel the underlying operation
 *   unless the operation itself supports cancellation (for example AbortController).
 */
export type RetryBackoffMode = "linear" | "exponential";

export type RetryContext = {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  error: unknown;
};

export type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  backoffMode?: RetryBackoffMode;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (context: RetryContext) => void | Promise<void>;
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeRetryDelayMs(
  baseDelayMs: number,
  attempt: number,
  mode: RetryBackoffMode = "exponential",
): number {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  if (mode === "linear") {
    return baseDelayMs * normalizedAttempt;
  }
  return baseDelayMs * 2 ** (normalizedAttempt - 1);
}

export function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => reject(onTimeout()), timeoutMs);

    operation().then(
      (result) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(result);
      },
      (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error as Error);
      },
    );
  });
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    baseDelayMs,
    backoffMode = "exponential",
    shouldRetry,
    onRetry,
  } = options;

  let retries = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!shouldRetry(error) || retries >= maxRetries) {
        throw error;
      }

      retries += 1;
      const delayMs = computeRetryDelayMs(baseDelayMs, retries, backoffMode);

      if (onRetry) {
        await onRetry({
          attempt: retries,
          maxRetries,
          delayMs,
          error,
        });
      }

      await sleep(delayMs);
    }
  }
}
