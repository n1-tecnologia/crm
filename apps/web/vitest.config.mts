import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    // Padrão para o resto do workspace (lógica de domínio/store, `*.test.ts`):
    // `node`, mais rápido e sem depender de um DOM que não usa. Um componente
    // síncrono/cliente que precisa de DOM real (`*.test.tsx`) declara
    // `// @vitest-environment jsdom` na primeira linha do próprio arquivo —
    // o Vitest lê esse comentário por arquivo, sem precisar de outra opção
    // global aqui.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
