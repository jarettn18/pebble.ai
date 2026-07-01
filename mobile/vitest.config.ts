import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/api/demo/**/*.test.ts"],
    environment: "node",
  },
});
