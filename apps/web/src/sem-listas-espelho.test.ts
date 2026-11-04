/**
 * D-06 (Fase 14): as Listas espelho de Meus negócios foram aposentadas. "Meus
 * negócios" vira o quadro de `/crm/funis/[funil]` com o filtro "meus", a Lista não
 * ganha o campo `funilId` e a regra de formato de id `funilDaLista`
 * (`lst_funil_<x>` ↔ `fnl_<x>`) não é portada: os Funis novos têm id UUID.
 *
 * Este teste LÊ o código-fonte da web (sem navegador, sem banco) e congela a lista
 * de arquivos de produção que HOJE citam `funilDaLista` ou o caminho
 * `iniciar-conversa`. Código novo não entra nela, e o diálogo de nova Tarefa
 * conversacional já saiu (14-16). Só o corte do modelo antigo (3.4.5) a encolhe,
 * quando o diálogo "Iniciar conversa" e quem o abre forem removidos; nunca a aumenta.
 *
 * O texto inteiro conta, comentário inclusive: citar a regra num comentário já é
 * apontar para ela. O mesmo teste existe em `packages/dominio` e em `apps/api`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Os arquivos de `apps/web/src` que citam as Listas espelho hoje (a lista congelada). */
const CONGELADOS = ["features/crm/iniciar-conversa-dialog.tsx", "features/estrutura/dialogos-da-lista.tsx"] as const;

const CITA_AS_LISTAS_ESPELHO = /funilDaLista|iniciar-conversa/;

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

describe("D-06 — nada novo depende das Listas espelho (web)", () => {
  const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    texto: readFileSync(caminho, "utf8"),
  }));

  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(producao.length).toBeGreaterThan(100);
    expect(producao.map((f) => f.arquivo)).toContain("features/estrutura/nova-tarefa-conversacional-dialog.tsx");
  });

  it("só a lista congelada de hoje cita funilDaLista ou iniciar-conversa", () => {
    const citam = producao.filter((f) => CITA_AS_LISTAS_ESPELHO.test(f.texto)).map((f) => f.arquivo).sort();
    const novos = citam.filter((arquivo) => !(CONGELADOS as readonly string[]).includes(arquivo));
    const sumidos = CONGELADOS.filter((arquivo) => !citam.includes(arquivo));
    expect(
      novos,
      `D-06 (Fase 14): as Listas espelho de Meus negócios foram aposentadas; código novo não depende delas. Só o corte do modelo antigo encolhe esta lista. Arquivo(s) novo(s) que as citam: ${novos.join(", ")}`,
    ).toEqual([]);
    expect(
      sumidos,
      `A lista congelada está desatualizada: ${sumidos.join(", ")} deixou(aram) de citar as Listas espelho. Tire-o(s) de CONGELADOS (só encolhe).`,
    ).toEqual([]);
  });
});

/**
 * 14-16: as quatro operações antigas da Tarefa conversacional (que liam o CRM em
 * memória) não têm mais chamador na web; as telas chamam as rotas REST de
 * `dados/crm/tarefas-conversacionais`. O plano 14-17 as tira de `OPERACOES`.
 */
const OPERACOES_ANTIGAS = ["criarTarefaConversacional", "trocarCanalDaTarefa", "vincularNegocioATarefa", "criarNegocioDaTarefa"] as const;

describe("14-16 — nenhum chamador web das operações antigas da Tarefa conversacional", () => {
  const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    texto: readFileSync(caminho, "utf8"),
  }));

  it("nenhum arquivo importa uma delas de @n1/dominio/operations", () => {
    const importaDoDominio = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"@n1\/dominio\/operations[^"]*"/g;
    const achados: string[] = [];
    for (const { arquivo, texto } of producao) {
      for (const importacao of texto.matchAll(importaDoDominio)) {
        const nomes = (importacao[1] ?? "").split(",").map((n) => n.trim().split(/\s+as\s+/)[0]);
        for (const nome of nomes) if ((OPERACOES_ANTIGAS as readonly (string | undefined)[]).includes(nome)) achados.push(`${arquivo}: ${nome}`);
      }
    }
    expect(achados, `Quem chama a Tarefa conversacional na web usa as rotas de dados/crm/tarefas-conversacionais, não a operação do domínio: ${achados.join("; ")}`).toEqual([]);
  });

  it("o teste enxerga o que procura: o cliente REST existe e é importado por quem chama", () => {
    const quemChama = producao.filter((f) => /from\s*"@\/dados\/crm\/tarefas-conversacionais"/.test(f.texto)).map((f) => f.arquivo);
    expect(quemChama).toEqual(expect.arrayContaining(["features/crm/conversation-thread.tsx", "features/estrutura/tarefa-completa.tsx", "features/estrutura/nova-tarefa-conversacional-dialog.tsx"]));
  });
});
