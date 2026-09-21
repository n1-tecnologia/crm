import { defineConfig } from "@playwright/test";

/**
 * Harness de E2E contra o build de produção do apps/web (V02-02D) — nunca
 * `next dev`, nunca watch mode (02-VALIDATION.md proíbe). `webServer` builda
 * e sobe `next start` na porta abaixo; `reuseExistingServer` fora de CI deixa
 * reaproveitar um servidor já no ar ao rodar localmente mais de uma vez.
 *
 * A porta é configurável por `E2E_PORT` (default 3011, o valor do plano) só
 * porque uma porta fixa pode colidir com outro processo já no ar na máquina
 * de quem executa — o padrão em todo ambiente limpo continua 3011.
 */
const porta = process.env.E2E_PORT ?? "3011";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${porta}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${porta}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
