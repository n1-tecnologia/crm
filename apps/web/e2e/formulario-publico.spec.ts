import { expect, test } from "@playwright/test";

/**
 * V02-02D — a jornada de navegador do Formulário público, contra o build de
 * PRODUÇÃO do `apps/web` (`playwright.config.ts` já builda com `next build`
 * e sobe com `next start`; nunca `next dev`, nunca watch mode —
 * `02-VALIDATION.md` proíbe).
 *
 * Precisa de um `apps/api` DE TESTE (nunca o de produção) já no ar, com o
 * Formulário canônico da Solicitação de pagamento publicado sob um segredo
 * conhecido. Duas variáveis, além das que `playwright.config.ts` já lê:
 *
 *   `E2E_API_URL`     — base URL do `apps/api` de teste (ex.: http://localhost:3012)
 *   `E2E_FORM_SECRET` — o segredo desse Formulário de teste
 *
 * `NEXT_PUBLIC_API_URL` do PRÓPRIO build de produção do `apps/web` — não
 * `E2E_API_URL` — é o que `f/[segredo]/page.tsx` lê no servidor para buscar
 * o DTO. Para a jornada apontar para o MESMO `apps/api`, exporte as duas
 * variáveis com o MESMO valor antes de `npm run test:e2e`:
 *
 *   E2E_API_URL=http://localhost:3012 NEXT_PUBLIC_API_URL=http://localhost:3012 \
 *   E2E_FORM_SECRET=<segredo-do-formulario-de-teste> npm run test:e2e -w @n1/web
 *
 * Sem `E2E_API_URL`/`E2E_FORM_SECRET`, ou com o `apps/api` de teste fora do
 * ar, ou sem o Formulário disponível sob esse segredo — a suíte PULA com
 * mensagem clara, a mesma disciplina de "pular sem env" que o resto do
 * repositório usa (`e2e/CONTEXT.md`). Nunca falha, nunca trava. Nenhum dado
 * real, nenhum bucket de produção: o Formulário e o bucket são os do
 * ambiente de teste apontado por essas variáveis.
 */

const E2E_API_URL = process.env.E2E_API_URL;
const E2E_FORM_SECRET = process.env.E2E_FORM_SECRET;

/** PDF mínimo cuja assinatura (`%PDF-`) `apps/api` confere de verdade (Plan 02-11). */
const PDF_DE_TESTE = Buffer.from("%PDF-1.4\n%N1-e2e-formulario-publico\n%%EOF\n", "utf-8");

async function ambientePreparado(request: import("@playwright/test").APIRequestContext): Promise<string | undefined> {
  if (!E2E_API_URL || !E2E_FORM_SECRET) {
    return "Defina E2E_API_URL e E2E_FORM_SECRET (um apps/api de teste com o Formulário canônico já publicado) para rodar esta jornada.";
  }
  try {
    const saude = await request.get(`${E2E_API_URL}/saude`, { timeout: 5_000 });
    if (!saude.ok()) return `apps/api de teste respondeu ${saude.status()} em /saude — ambiente indisponível.`;
  } catch {
    return `apps/api de teste (${E2E_API_URL}) inalcançável.`;
  }
  try {
    const formulario = await request.get(`${E2E_API_URL}/v1/public/forms/${E2E_FORM_SECRET}`, { timeout: 5_000 });
    if (!formulario.ok()) return `Formulário de teste '${E2E_FORM_SECRET}' indisponível em ${E2E_API_URL} (status ${formulario.status()}).`;
  } catch {
    return `Não foi possível confirmar o Formulário de teste em ${E2E_API_URL}.`;
  }
  return undefined;
}

test.describe("Formulário público — jornada completa", () => {
  test.beforeEach(async ({ request }) => {
    const motivo = await ambientePreparado(request);
    test.skip(motivo !== undefined, motivo ?? "");
  });

  test("preenche, anexa um PDF, envia e vê apenas o número legível", async ({ page }) => {
    await page.goto(`/f/${E2E_FORM_SECRET}`);

    // 1 — nunca tela em branco.
    await expect(page.getByRole("heading", { level: 1, name: "Solicitação de pagamento" })).toBeVisible();

    // 2 — obrigatórios (título + Centro de Custo) e um opcional.
    await page.getByLabel("O que deve ser pago?", { exact: false }).fill("Compra de teste E2E");
    await page.getByRole("combobox", { name: "Centro de Custo" }).click();
    await page.getByRole("option").first().click();

    // 3 — Boleto revela Código de barras + upload Boleto; trocar para Chave Pix perde o que foi
    // digitado e abre a confirmação de troca.
    await page.getByRole("combobox", { name: "Forma de pagamento" }).click();
    await page.getByRole("option", { name: "Boleto" }).click();
    await expect(page.getByLabel("Código de barras", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Boleto", { exact: false })).toBeVisible();
    await page.getByLabel("Código de barras", { exact: false }).fill("00190000090000000000000000000000000000");

    await page.getByRole("combobox", { name: "Forma de pagamento" }).click();
    await page.getByRole("option", { name: "Chave Pix" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Trocar e limpar dados" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();

    // 4 — anexar um PDF pequeno gerado pelo próprio teste (nunca dado real) e aguardar "enviado".
    await page.getByLabel("Anexo", { exact: false }).setInputFiles({
      name: "nota-fiscal-e2e.pdf",
      mimeType: "application/pdf",
      buffer: PDF_DE_TESTE,
    });
    await expect(page.getByText("Arquivo enviado")).toBeVisible({ timeout: 20_000 });

    // 5/6 — enviar e ver só o número legível, sem link de acompanhamento nem Status.
    await page.getByRole("button", { name: "Enviar solicitação" }).click();
    await expect(page.getByText("Solicitação enviada")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".identificador")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/acompanhar|aprovador/i);
    expect(await page.locator("a").count()).toBe(0);

    // 7 — copiar o número anuncia o feedback.
    await page.getByRole("button", { name: "Copiar número" }).click();
    await expect(page.getByText("Número copiado.")).toBeVisible();
  });

  test("em 375px, o CTA ocupa a largura e os alvos têm ao menos 44px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/f/${E2E_FORM_SECRET}`);

    await expect(page.getByRole("heading", { level: 1, name: "Solicitação de pagamento" })).toBeVisible();

    const cta = page.getByRole("button", { name: "Enviar solicitação" });
    const caixa = await cta.boundingBox();
    expect(caixa).not.toBeNull();
    if (caixa) {
      expect(caixa.height).toBeGreaterThanOrEqual(44);
      // A largura do CTA deve ocupar essencialmente o painel (375px de viewport menos o respiro
      // de página + painel) — não um botão estreito perdido no canto.
      expect(caixa.width).toBeGreaterThan(250);
    }
  });
});
