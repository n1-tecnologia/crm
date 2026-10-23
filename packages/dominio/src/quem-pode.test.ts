/**
 * Fase 9, 1.2.4 — a tabela "Quem pode" de `packages/dominio/CONTEXT.md` vira
 * regressão. Uma linha por chave de `OPERACOES`: a operação, o módulo, a
 * recusa que ela chama antes de gravar (ou "sem conferência" com o porquê).
 *
 * A varredura que originou esta tarefa olhou 167 das cerca de 200 operações;
 * o registro tem mais de 280. Sem este teste, a próxima operação que grava sem
 * olhar quem chama passa despercebida; com ele, ela deixa o `npm run check`
 * vermelho até alguém escrever quem pode.
 *
 * O formato da seção é fixo (o teste depende dele): título
 * `## Quem pode (1.2.4)`, uma legenda, a tabela
 * `| Operação | Arquivo | Conferência | Observação |` e uma linha por operação
 * começando por `` | `nome` | ``. A seção termina no próximo título `## `.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERACOES } from "./operations/registro";

const TITULO_DA_SECAO = "## Quem pode (1.2.4)";

interface Linha {
  readonly operacao: string;
  readonly arquivo: string;
  readonly conferencia: string;
  readonly observacao: string;
}

interface Tabela {
  readonly secaoExiste: boolean;
  readonly linhas: readonly Linha[];
  /** Linhas que começam como linha de operação mas não têm as quatro colunas. */
  readonly ilegiveis: readonly string[];
}

const semAcento = (texto: string): string => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
const semCrases = (texto: string): string => texto.replace(/`/g, "").trim();

function lerTabela(): Tabela {
  const texto = readFileSync(new URL("../CONTEXT.md", import.meta.url), "utf8");
  const inicio = texto.indexOf(`\n${TITULO_DA_SECAO}\n`);
  if (inicio < 0) return { secaoExiste: false, linhas: [], ilegiveis: [] };
  const depois = texto.slice(inicio + TITULO_DA_SECAO.length + 2);
  const fim = depois.search(/\n## /);
  const corpo = fim < 0 ? depois : depois.slice(0, fim);

  const linhas: Linha[] = [];
  const ilegiveis: string[] = [];
  for (const bruta of corpo.split("\n")) {
    if (!bruta.startsWith("| `")) continue;
    const celulas = bruta.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
    if (celulas.length !== 4) {
      ilegiveis.push(bruta);
      continue;
    }
    const [operacao, arquivo, conferencia, observacao] = celulas.map((c) => c.trim()) as [string, string, string, string];
    linhas.push({ operacao: semCrases(operacao), arquivo: semCrases(arquivo), conferencia, observacao });
  }
  return { secaoExiste: true, linhas, ilegiveis };
}

const tabela = lerTabela();
const chaves = Object.keys(OPERACOES);

describe("Quem pode (1.2.4) — a tabela do CONTEXT.md cobre o registro", () => {
  it("nenhuma operação do registro fica sem linha na tabela, e toda linha é legível", () => {
    const problemas: string[] = [];
    if (!tabela.secaoExiste) problemas.push(`a seção "${TITULO_DA_SECAO}" não existe em packages/dominio/CONTEXT.md`);
    const comLinha = new Set(tabela.linhas.map((l) => l.operacao));
    for (const chave of chaves) if (!comLinha.has(chave)) problemas.push(`${chave}: sem linha na tabela`);
    for (const bruta of tabela.ilegiveis) problemas.push(`linha sem as quatro colunas: ${bruta}`);
    expect(problemas).toEqual([]);
  });

  it("nenhuma linha fala de operação que não existe em OPERACOES", () => {
    const existentes = new Set<string>(chaves);
    const problemas = tabela.linhas.filter((l) => !existentes.has(l.operacao)).map((l) => `${l.operacao}: não está em OPERACOES`);
    expect(problemas).toEqual([]);
  });

  it("nenhuma operação aparece em duas linhas", () => {
    const contagem = new Map<string, number>();
    for (const l of tabela.linhas) contagem.set(l.operacao, (contagem.get(l.operacao) ?? 0) + 1);
    const problemas = [...contagem].filter(([, n]) => n > 1).map(([nome, n]) => `${nome}: ${n} linhas`);
    expect(problemas).toEqual([]);
  });

  it("a coluna Conferência nunca está vazia nem diz 'a conferir'", () => {
    const problemas = tabela.linhas
      .filter((l) => semCrases(l.conferencia) === "" || semAcento(l.conferencia).toLowerCase().includes("a conferir"))
      .map((l) => `${l.operacao}: Conferência ${semCrases(l.conferencia) === "" ? "vazia" : "pendente (a conferir)"}`);
    expect(problemas).toEqual([]);
  });

  it("'sem conferência' nunca vem sem justificativa na Observação", () => {
    const problemas = tabela.linhas
      .filter((l) => semAcento(semCrases(l.conferencia)).toLowerCase().startsWith("sem conferencia") && l.observacao === "")
      .map((l) => `${l.operacao}: "sem conferência" sem justificativa`);
    expect(problemas).toEqual([]);
  });

  it("o Arquivo de cada linha é o módulo de onde registro.ts importa a operação", () => {
    const registro = readFileSync(new URL("./operations/registro.ts", import.meta.url), "utf8");
    const moduloDe = new Map<string, string>();
    for (const m of registro.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/([^"]+)"/g)) {
      for (const nome of m[1]!.split(",").map((s) => s.trim()).filter(Boolean)) moduloDe.set(nome, `operations/${m[2]}.ts`);
    }
    const problemas = tabela.linhas
      .filter((l) => moduloDe.has(l.operacao) && moduloDe.get(l.operacao) !== l.arquivo)
      .map((l) => `${l.operacao}: a tabela diz ${l.arquivo}, o registro importa de ${moduloDe.get(l.operacao)}`);
    expect(problemas).toEqual([]);
  });
});
