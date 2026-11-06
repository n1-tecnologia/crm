/**
 * Fase 15 (UCR-12): o CRM antigo em inglês (Contato, Empresa, Negócio, Funil, Canal e os
 * Vínculos, lidos em `state.contacts`, `data.deals` e afins) está saindo, e as telas
 * trocam para o CRM novo (`@/dados/crm/*` na web, as tabelas na api) plano a plano.
 * Enquanto elas trocam, nenhum arquivo NOVO pode voltar a ler o modelo antigo.
 *
 * Este teste LÊ o código-fonte da web (sem banco, sem navegador) e congela a lista de
 * arquivos de produção que HOJE leem o modelo antigo. Código novo não entra nela. A metade "a lista só
 * encolhe" (um arquivo que deixou de ler sai de `CONGELADOS`) fica de fora de propósito
 * durante as telas, para os planos paralelos não disputarem este arquivo: ela é ligada
 * no plano 15-33, que também esvazia a lista. Cada plano de tela prova por grep que os
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

/** Os arquivos de `apps/web/src` que leem o CRM antigo hoje (a lista congelada, caminho relativo a `src`). */
const CONGELADOS = [
  "app/(shell)/buscar/page.tsx",
  "app/(shell)/configuracoes/campos/page.tsx",
  "app/(shell)/configuracoes/catalogos/page.tsx",
  "app/(shell)/configuracoes/lixeira/page.tsx",
  "app/(shell)/configuracoes/page.tsx",
  "app/(shell)/configuracoes/tags/page.tsx",
  "app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx",
  "app/(shell)/crm/contatos/[contato]/page.tsx",
  "app/(shell)/crm/empresas/[empresa]/page.tsx",
  "app/(shell)/crm/negocios/[negocio]/page.tsx",
  "app/(shell)/crm/reunioes/[reuniao]/page.tsx",
  "app/(shell)/notificacoes/page.tsx",
  "features/configuracoes/governance-access-dialog.tsx",
  "features/crm/conectar-provedor.tsx",
  "features/crm/contact-card.tsx",
  "features/crm/conversation-thread.tsx",
  "features/crm/deal-card.tsx",
  "features/crm/deal-screen.tsx",
  "features/crm/empresa-popup.tsx",
  "features/crm/iniciar-conversa-dialog.tsx",
  "features/crm/legado/ficha-de-empresa-legado.tsx",
  "features/crm/move-conversation-dialog.tsx",
  "features/estrutura/financeiro/serie-dialog.tsx",
  "features/estrutura/nova-tarefa-conversacional-dialog.tsx",
  "features/estrutura/tarefa-completa.tsx",
  "features/ferramentas/aba-comunidades.tsx",
  "features/ferramentas/aba-flows.tsx",
  "features/ferramentas/aba-grupos.tsx",
  "features/ferramentas/comunidade-popup.tsx",
  "features/ferramentas/conversa-do-grupo.tsx",
  "features/ferramentas/criar-comunidade-dialog.tsx",
  "features/ferramentas/criar-flow-dialog.tsx",
  "features/ferramentas/criar-grupo-dialog.tsx",
  "features/ferramentas/flow-builder.tsx",
  "features/ferramentas/flow-popup.tsx",
  "features/ferramentas/grupo-popup.tsx",
  "features/ferramentas/importar-grupos-dialog.tsx",
  "features/ferramentas/participacoes.tsx",
  "features/ferramentas/pedidos-de-entrada.tsx",
  "features/ia/agentes/ensaiar-dialog.tsx",
  "features/ia/ancora-do-chat.tsx",
  "features/ia/automacoes/automacao-spec.ts",
  "features/ia/automacoes/editor-de-automacao.tsx",
  "features/ia/automacoes/nova-automacao-dialog.tsx",
  "features/inicio/panorama-do-robo.ts",
] as const;

const LE_O_CRM_ANTIGO =
  /\b(state|data|estado|s|d)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b/;

const RAIZ = fileURLToPath(new URL(".", import.meta.url));

function ehDeProducao(nome: string): boolean {
  return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome);
}

function arquivosDeProducao(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivosDeProducao(caminho));
    else if (ehDeProducao(entrada.name)) achados.push(caminho);
  }
  return achados;
}

describe("Fase 15 — nenhum arquivo novo lê o CRM antigo (web)", () => {
  const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    texto: readFileSync(caminho, "utf8"),
  }));

  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(producao.length).toBeGreaterThan(100);
    expect(producao.map((f) => f.arquivo)).toContain("app/(shell)/layout.tsx");
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
