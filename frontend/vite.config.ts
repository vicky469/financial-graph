import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false, // Disable source maps in production - prevents source code exposure
    minify: 'esbuild', // Use esbuild for fast minification (default)
    target: 'es2020', // Modern browsers only
  },
  // Development server configuration
  server: {
    sourcemapIgnoreList: false, // Show all source maps in dev (for debugging)
  },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 10000,
  },
});
