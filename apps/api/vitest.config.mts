import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // O spike fala com Postgres de verdade; o padrão de 5 s não cobre o
    // semear de 900 registros mais as medições em 10x.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
