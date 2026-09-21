import { expect, test } from "@playwright/test";

/**
 * Prova do harness, não da tela: um navegador real abre o build de produção
 * e vê o `h1` de `/entrar`. A jornada pública de `/f/[segredo]` nasce no
 * Plan 02-23, quando o transporte público do formulário existir.
 */
test("abre /entrar e mostra o título N1 Digital", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.locator("h1")).toHaveText("N1 Digital");
});
