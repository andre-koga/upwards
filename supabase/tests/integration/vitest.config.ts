import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  cacheDir: join(root, "../../../node_modules/.vite/vitest-integration"),
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

