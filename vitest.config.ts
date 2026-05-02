import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone vitest config — does NOT replace vite.config.ts (which serves
// the app). Pure-node + per-file isolation so the storage mock in
// tests/setup.ts persists for the lifetime of one test file but never
// leaks into another.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    isolate: true,
    testTimeout: 10_000,
    coverage: { enabled: false },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});
