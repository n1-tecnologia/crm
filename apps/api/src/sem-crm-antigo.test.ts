/**
 * Fase 15 (UCR-12), formato final: o CRM antigo em inglês (Contato, Empresa, Negócio, Funil, Canal
 * e os Vínculos, lidos em `state.contacts`, `data.deals` e afins) saiu do código da api, e o Canal
 * só existe em `plataforma.canais`. Nenhum arquivo de produção volta a ler as oito coleções, nem a
 * ponte que projetava os Canais da tabela (`persistencia/canais-projetados.ts`, apagada no 15-33).
 *
 * Este teste LÊ o código-fonte da api (sem banco). A lista congelada que as telas foram esvaziando
 * chegou a zero no 15-33, e a metade "a lista só encolhe" está ligada: um arquivo que aparecer em
 * `CONGELADOS` sem ler mais o CRM antigo faz o teste falhar (`sumidos`).
 *
 * `state.conversations` é outra conta: a Conversa 1:1 foi para as tabelas, mas a Conversa de GRUPO
 * e o envio de Flow seguem no estado antigo até as Sessões 6 e 7 (F14-D-05). Só os arquivos de
 * Grupo e Flow listados em `DE_GRUPO_E_FLOW` podem citá-la.
 *
 * O texto inteiro conta, comentário inclusive: citar o campo num comentário já é apontar para ele
 * (reescreva o comentário, não o regex). O mesmo teste existe nas três camadas
 * (`packages/dominio`, `apps/api`, `apps/web`).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Os arquivos de `apps/api/src` que leem o CRM antigo hoje: nenhum (15-33). */
const CONGELADOS: readonly string[] = [];

/** Os arquivos de `apps/api/src` que citam `state.conversations`: só Grupo e Flow (F14-D-05). */
const DE_GRUPO_E_FLOW: readonly string[] = ["rotas/gesto-no-crm/ferramentas.ts"];

const LE_O_CRM_ANTIGO =
  /\b(state|data|estado|s|d)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b|canais-projetados|acrescentarCanaisProjetados|canalAntigoEmConflito/;

const LE_A_CONVERSA_ANTIGA = /\b(state|data|estado|s|d)\.conversations\b/;

const RAIZ = fileURLToPath(new URL(".", import.meta.url));

function arquivosDeProducao(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivosDeProducao(caminho));
    else if (entrada.name.endsWith(".ts") && !entrada.name.endsWith(".test.ts")) achados.push(caminho);
  }
  return achados;
}

describe("Fase 15 — o CRM antigo saiu do código (api)", () => {
  const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    texto: readFileSync(caminho, "utf8"),
  }));
  const nomes = producao.map((f) => f.arquivo);

  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(producao.length).toBeGreaterThan(50);
    expect(nomes).toContain("app.ts");
    // Sentinelas que continuam existindo: o arquivo que lia o CRM antigo e o que o servia por `GET /estado`.
    expect(nomes).toContain("persistencia/unidade-de-trabalho.ts");
    expect(nomes).toContain("rotas/estado.ts");
    // A ponte dos Canais foi apagada.
    expect(nomes).not.toContain("persistencia/canais-projetados.ts");
    expect(DE_GRUPO_E_FLOW.every((arquivo) => nomes.includes(arquivo))).toBe(true);
  });

  it("nenhum arquivo de produção lê as oito coleções do CRM antigo (a lista só encolhe)", () => {
    const leem = producao.filter((f) => LE_O_CRM_ANTIGO.test(f.texto)).map((f) => f.arquivo).sort();
    const novos = leem.filter((arquivo) => !CONGELADOS.includes(arquivo));
    const sumidos = CONGELADOS.filter((arquivo) => !leem.includes(arquivo));
    expect(
      novos,
      `Fase 15: o CRM antigo saiu do código; o que resta de \`conversations\` é só Grupo e Flow (F14-D-05). Leia o CRM novo pelas tabelas. Arquivo(s) que o leem: ${novos.join(", ")}`,
    ).toEqual([]);
    expect(
      sumidos,
      `A lista congelada está desatualizada: ${sumidos.join(", ")} deixou(aram) de ler o CRM antigo. Tire-o(s) de CONGELADOS (só encolhe).`,
    ).toEqual([]);
  });

  it("`state.conversations` só aparece nos arquivos de Grupo e Flow", () => {
    const leem = producao.filter((f) => LE_A_CONVERSA_ANTIGA.test(f.texto)).map((f) => f.arquivo).sort();
    const novos = leem.filter((arquivo) => !DE_GRUPO_E_FLOW.includes(arquivo));
    const sumidos = DE_GRUPO_E_FLOW.filter((arquivo) => !leem.includes(arquivo));
    expect(
      novos,
      `Fase 15: o CRM antigo saiu do código; o que resta de \`conversations\` é só Grupo e Flow (F14-D-05). Arquivo(s) que a leem: ${novos.join(", ")}`,
    ).toEqual([]);
    expect(
      sumidos,
      `A lista de Grupo e Flow está desatualizada: ${sumidos.join(", ")} deixou(aram) de ler a Conversa antiga. Tire-o(s) de DE_GRUPO_E_FLOW (só encolhe).`,
    ).toEqual([]);
  });
});
