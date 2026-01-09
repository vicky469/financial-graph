/**
 * Global test setup - runs before all tests
 */

// Mock logger to prevent file I/O during tests
jest.mock("../src/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));
