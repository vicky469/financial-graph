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

// Mock uuid to avoid checking for ESM issues in every test
jest.mock("uuid", () => ({
  v5: () => "mock-uuid-v5",
}));
