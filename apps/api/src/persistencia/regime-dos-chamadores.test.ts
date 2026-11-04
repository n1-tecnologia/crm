/**
 * Quem pode passar `regime: "otimista"` a `executar()` (Fase 12, 12-04, D-10; T-12-11).
 *
 * O regime `travado` (o padrão) segura a linha do Espaço de Trabalho desde o
 * começo da transação. Numa importação manual longa isso seguraria o `ws_n1`
 * inteiro durante minutos: por isso as quatro importações abaixo — e só elas —
 * ficam no `otimista`, como até a Fase 11. Todo o resto (tela, agendador, ponte
 * do Agente, ponte do Financeiro, formulários públicos, anexos, convite,
 * `criar-usuario` e todo `bootstrap/*`) grava no `travado`.
 *
 * Sem banco: este teste LÊ o código-fonte de `apps/api/src`. Falha, com o
 * arquivo e a linha, se:
 *   1. um arquivo que passa `semEventosDeSaida: true` (a marca das importações
 *      históricas) não passa `regime: "otimista"`;
 *   2. um arquivo fora das quatro importações passa `regime: "otimista"` — ou uma
 *      delas deixa de passar;
 *   3. um arquivo que chama `executar()` passa `tentativas` (só existe no otimista;
 *      nenhum chamador de produção a passava antes da Fase 12);
 *   4. algum arquivo de `bootstrap/` ganha `regime:` (nenhum é lote longo).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** As quatro importações manuais longas (D-10) e por que cada uma é otimista. */
const IMPORTACOES_LONGAS: Readonly<Record<string, string>> = {
  "importacao/clickup/importar-contas-a-pagar.ts": "lotes de milhares de contas, manual, com DATABASE_QUERY_TIMEOUT_MS=0",
  "importacao/clickup/importar-contas-a-receber.ts": "lotes de Contas a Receber, manual, com DATABASE_QUERY_TIMEOUT_MS=0",
  "importacao/financeiro/importar.ts": "lotes de solicitações do Financeiro Tria, manual, com DATABASE_QUERY_TIMEOUT_MS=0",
  "importacao/clickup/corrigir-data-de-pagamento-cr.ts":
    "lote histórico manual de igual natureza (uma executar() sobre até 240 Tarefas; decisão do planejador, Open Question 4)",
};

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
/** O arquivo que DEFINE os regimes: o texto `regime: "otimista"` aparece nos tipos dele. */
const DEFINICAO = "persistencia/unidade-de-trabalho.ts";

function arquivosDeProducao(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivosDeProducao(caminho));
    else if (entrada.name.endsWith(".ts") && !entrada.name.endsWith(".test.ts")) achados.push(caminho);
  }
  return achados;
}

interface Fonte {
  /** Caminho relativo a `apps/api/src`, com `/`. */
  readonly arquivo: string;
  /** Só as linhas de código (comentários de `//`, `/*` e ` *` ficam de fora), com o número da linha. */
  readonly codigo: readonly { readonly linha: number; readonly texto: string }[];
}

const FONTES: readonly Fonte[] = arquivosDeProducao(RAIZ)
  .map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    codigo: readFileSync(caminho, "utf8")
      .split("\n")
      .map((texto, i) => ({ linha: i + 1, texto }))
      .filter(({ texto }) => !/^\s*(\/\/|\/\*|\*)/.test(texto)),
  }))
  .filter(({ arquivo }) => arquivo !== DEFINICAO);

const ondeAparece = (fonte: Fonte, padrao: RegExp) => fonte.codigo.filter(({ texto }) => padrao.test(texto));

describe("quem grava no regime otimista (D-10, T-12-11)", () => {
  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(FONTES.length).toBeGreaterThan(50);
    for (const arquivo of Object.keys(IMPORTACOES_LONGAS)) {
      expect(FONTES.map((f) => f.arquivo), `${arquivo} sumiu — a lista de D-10 está desatualizada`).toContain(arquivo);
    }
  });

  it("todo chamador com semEventosDeSaida: true (importação histórica) passa regime: \"otimista\"", () => {
    const violacoes = FONTES.filter((f) => ondeAparece(f, /semEventosDeSaida:\s*true/).length > 0 && ondeAparece(f, /regime:\s*"otimista"/).length === 0).map(
      (f) => `${f.arquivo}:${ondeAparece(f, /semEventosDeSaida:\s*true/)[0]!.linha} — passa semEventosDeSaida: true mas não regime: "otimista"`,
    );
    expect(violacoes, violacoes.join("\n")).toEqual([]);
  });

  it("os únicos arquivos com regime: \"otimista\" são as quatro importações longas", () => {
    const sobrando = FONTES.filter((f) => !(f.arquivo in IMPORTACOES_LONGAS)).flatMap((f) =>
      ondeAparece(f, /regime:\s*"otimista"/).map(({ linha }) => `${f.arquivo}:${linha} — passa regime: "otimista" sem ser uma das quatro importações longas de D-10`),
    );
    const faltando = Object.keys(IMPORTACOES_LONGAS)
      .filter((arquivo) => {
        const fonte = FONTES.find((f) => f.arquivo === arquivo);
        return !fonte || ondeAparece(fonte, /regime:\s*"otimista"/).length === 0;
      })
      .map((arquivo) => `${arquivo} — deveria passar regime: "otimista" (${IMPORTACOES_LONGAS[arquivo]})`);
    const violacoes = [...sobrando, ...faltando];
    expect(violacoes, violacoes.join("\n")).toEqual([]);
  });

  it("nenhum arquivo de bootstrap/ passa regime: (nenhum é lote longo; gravam no travado)", () => {
    const violacoes = FONTES.filter((f) => f.arquivo.startsWith("bootstrap/")).flatMap((f) =>
      ondeAparece(f, /\bregime\s*:/).map(({ linha }) => `${f.arquivo}:${linha} — bootstrap/ não escolhe regime`),
    );
    expect(violacoes, violacoes.join("\n")).toEqual([]);
  });

  it("nenhum chamador de executar() passa tentativas (só existe no otimista, e nenhum de produção a passava)", () => {
    const violacoes = FONTES.filter((f) => f.codigo.some(({ texto }) => /from "\.{1,2}\/(?:.*\/)?unidade-de-trabalho"/.test(texto))).flatMap((f) =>
      // `readonly tentativas: number` é campo de interface (a coluna da agenda do agendador), não opção.
      ondeAparece(f, /(?<!readonly\s)\btentativas\s*:/).map(({ linha }) => `${f.arquivo}:${linha} — passa tentativas a executar()`),
    );
    expect(violacoes, violacoes.join("\n")).toEqual([]);
  });
});
