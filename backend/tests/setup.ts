/**
 * Global test setup - runs before all tests
 */
import { vi } from 'vitest';

// Mock logger to prevent file I/O during tests
vi.mock("../src/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  withLogMetadata: <T>(_metadata: Record<string, unknown>, fn: () => T): T => fn(),
}));
