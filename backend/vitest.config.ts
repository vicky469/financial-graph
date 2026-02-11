import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000, // 30 seconds for LLM tests
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      USE_TEST_DB: 'true',
      SEC_USER_AGENT: 'FinancialGraphBot/1.0 (test environment)',
      DEEPSEEK_API_KEY: 'test-key',
      OPENROUTER_API_KEY: 'test-key',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
