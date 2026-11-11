import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Regex so "@/lib/..." resolves but "@vitest/..." does not.
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
