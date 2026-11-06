/**
 * Fase 15 (UCR-12): o CRM antigo em inglês (Contato, Empresa, Negócio, Funil, Canal e os
 * Vínculos, lidos em `state.contacts`, `data.deals` e afins) está saindo, e as telas
 * trocam para o CRM novo (`@/dados/crm/*` na web, as tabelas na api) plano a plano.
 * Enquanto elas trocam, nenhum arquivo NOVO pode voltar a ler o modelo antigo.
 *
 * Este teste LÊ o código-fonte do domínio (sem banco) e congela a lista de
 * arquivos de produção que HOJE leem o modelo antigo. Código novo não entra nela. A metade "a lista só
 * encolhe" (um arquivo que deixou de ler sai de `CONGELADOS`) fica de fora de propósito
 * durante as telas, para os planos paralelos não disputarem este arquivo: ela é ligada
 * no plano 15-43, que também esvazia a lista. Cada plano de tela prova por grep que os
 * seus arquivos saíram do regex.
 *
 * O regex não cobre o resto do Grupo e do Flow (F14-D-05): eles seguem no modelo
 * antigo de Conversa até as Sessões 6 e 7, e nenhum plano de tela os remove.
 *
 * O texto inteiro conta, comentário inclusive: citar o campo num comentário já é apontar
 * para ele (reescreva o comentário, não o regex). O mesmo teste existe nas três camadas
 * (`packages/dominio`, `apps/api`, `apps/web`).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Os arquivos de `packages/dominio/src` que leem o CRM antigo hoje (a lista congelada, caminho relativo a `src`). */
const CONGELADOS = [
  "derive-conversacional.ts",
  "derive-ferramentas.ts",
  "derive-ia.ts",
  "derive.ts",
  "operations/ai.ts",
  // 15-19: `clienteDe` passou a devolver só a referência, e o nome e o dono do cliente que as Automações
  // de Contas a receber usam ({{cliente}}, {{donoDoCliente}}) ainda saem de `state.contacts`. Não é leitura
  // nova: mudou de arquivo (antes morava em `clienteDe`, em financeiro.ts). Sai da lista quando o servidor
  // injetar esses dados como já injeta `cnpjPorEmpresa` (deviation aberta em .planning/WINDOWS.md).
  "operations/automations.ts",
  "operations/canais.ts",
  "operations/contacts.ts",
  "operations/conversations.ts",
  "operations/deals.ts",
  "operations/ferramentas/automacoes.ts",
  "operations/ferramentas/comunidades.ts",
  "operations/ferramentas/flows.ts",
  "operations/ferramentas/grupos.ts",
  "operations/ferramentas/participacoes.ts",
  "operations/ferramentas/permissoes.ts",
  "operations/financeiro.ts",
  "operations/ia/agentes.ts",
  "operations/ia/automacoes-catalogo.ts",
  "operations/importacao-contas-a-receber.ts",
  "operations/iniciar-conversa.ts",
  "operations/members.ts",
  "operations/planning.ts",
  "operations/structure.ts",
  "operations/tarefa-conversacional-nas-tabelas.ts",
  "operations/tasks.ts",
  "seed-comercial.ts",
  "seed-contas-a-receber.ts",
  "seed-ferramentas.ts",
  "seed-pos-venda.ts",
  "seed-produto.ts",
  "seed.ts",
] as const;

const LE_O_CRM_ANTIGO =
  /\b(state|data|estado|s|d)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b/;

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

describe("Fase 15 — nenhum arquivo novo lê o CRM antigo (domínio)", () => {
  const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    texto: readFileSync(caminho, "utf8"),
  }));

  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(producao.length).toBeGreaterThan(50);
    expect(producao.map((f) => f.arquivo)).toContain("state.ts");
    expect(CONGELADOS.length).toBeGreaterThan(0);
  });

  it("nenhum arquivo fora da lista congelada lê o CRM antigo", () => {
    const leem = producao.filter((f) => LE_O_CRM_ANTIGO.test(f.texto)).map((f) => f.arquivo).sort();
    const novos = leem.filter((arquivo) => !(CONGELADOS as readonly string[]).includes(arquivo));
    expect(
      novos,
      `Fase 15: o CRM antigo está saindo; leia o CRM novo por \`@/dados/crm/*\` (web) ou pelas tabelas (api). A lista só encolhe; o plano 15-33 a deixa vazia. Arquivo(s) novo(s) que o leem: ${novos.join(", ")}`,
    ).toEqual([]);
  });
});
