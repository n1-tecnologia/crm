/**
 * `paginacao.ts` — testes puros, sem rede: os dois padrões de paginação da
 * API do ClickUp contra fixtures no formato de developer.clickup.com/reference
 * (`gettasks`, `gettaskcomments`), nunca dado real (D-02).
 */

import { describe, expect, it, vi } from "vitest";
import type { RespostaClickUp } from "./cliente";
import { TETO_DE_PAGINAS, paginarPorCursor, paginarPorPagina } from "./paginacao";

function respostaDe(json: unknown): RespostaClickUp {
  const corpoCru = JSON.stringify(json);
  return { status: 200, corpoCru, json, cabecalhos: new Headers() };
}

function tarefaFixture(i: number): { readonly id: string; readonly name: string } {
  return { id: `9hz${i}`, name: `Tarefa fictícia ${i}` };
}

function comentarioFixture(i: number, epochMs: number): { readonly id: string; readonly date: string } {
  return { id: `comment_${i}`, date: String(epochMs - i) };
}

describe("paginarPorPagina — page + booleano de última página (Tarefas, Campos, Membros)", () => {
  const extrairTarefas = (json: unknown) => {
    const corpo = json as { readonly tasks: readonly unknown[]; readonly last_page: boolean };
    return { itens: corpo.tasks, ultima: corpo.last_page };
  };

  it("(a) duas páginas (100 + 37 itens); buscar chamado com 0 e 1 nessa ordem; ultima só na segunda; soma 137", async () => {
    const pagina0 = Array.from({ length: 100 }, (_, i) => tarefaFixture(i));
    const pagina1 = Array.from({ length: 37 }, (_, i) => tarefaFixture(100 + i));
    const buscar = vi.fn(async (page: number) =>
      page === 0 ? respostaDe({ tasks: pagina0, last_page: false }) : respostaDe({ tasks: pagina1, last_page: true }),
    );

    const paginas = [];
    for await (const p of paginarPorPagina(buscar, extrairTarefas)) paginas.push(p);

    expect(buscar.mock.calls.map((c) => c[0])).toEqual([0, 1]);
    expect(paginas).toHaveLength(2);
    expect(paginas[0]!.ultima).toBe(false);
    expect(paginas[1]!.ultima).toBe(true);
    const total = paginas.reduce((soma, p) => soma + p.itens.length, 0);
    expect(total).toBe(137);
  });

  it("(b) página 0 vazia com last_page false rende página vazia com ultima true e para", async () => {
    const buscar = vi.fn(async () => respostaDe({ tasks: [], last_page: false }));

    const paginas = [];
    for await (const p of paginarPorPagina(buscar, extrairTarefas)) paginas.push(p);

    expect(paginas).toHaveLength(1);
    expect(paginas[0]!.itens).toHaveLength(0);
    expect(paginas[0]!.ultima).toBe(true);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("(c) buscar sempre com 100 itens e last_page false lança Error mencionando TETO_DE_PAGINAS após exatamente TETO_DE_PAGINAS chamadas", async () => {
    const cem = Array.from({ length: 100 }, (_, i) => tarefaFixture(i));
    const buscar = vi.fn(async () => respostaDe({ tasks: cem, last_page: false }));

    await expect(async () => {
      for await (const _p of paginarPorPagina(buscar, extrairTarefas)) {
        // consome até estourar o teto
      }
    }).rejects.toThrow(/TETO_DE_PAGINAS/);

    expect(buscar).toHaveBeenCalledTimes(TETO_DE_PAGINAS);
  });
});

describe("paginarPorCursor — start/start_id (Comentários)", () => {
  const extrairComentarios = (json: unknown) => (json as { readonly comments: readonly { readonly id: string; readonly date: string }[] }).comments;
  const AGORA = 1_700_000_000_000;

  it("(d) 25 comentários seguidos de 3: duas páginas; segunda chamada recebe start/start_id do 25º; total 28; ids distintos", async () => {
    const primeiros25 = Array.from({ length: 25 }, (_, i) => comentarioFixture(i, AGORA));
    const proximos3 = Array.from({ length: 3 }, (_, i) => comentarioFixture(25 + i, AGORA - 100));
    const buscar = vi.fn(async (cursor?: { readonly start: string; readonly start_id: string }) =>
      cursor === undefined ? respostaDe({ comments: primeiros25 }) : respostaDe({ comments: proximos3 }),
    );

    const paginas = [];
    for await (const p of paginarPorCursor(buscar, extrairComentarios)) paginas.push(p);

    expect(paginas).toHaveLength(2);
    const ultimoDaPrimeira = primeiros25[24]!;
    expect(buscar).toHaveBeenNthCalledWith(2, { start: ultimoDaPrimeira.date, start_id: ultimoDaPrimeira.id });

    const total = paginas.reduce((soma, p) => soma + p.itens.length, 0);
    expect(total).toBe(28);
    const todosOsIds = paginas.flatMap((p) => p.itens.map((item) => (item as { readonly id: string }).id));
    expect(new Set(todosOsIds).size).toBe(28);
  });

  it("(e) primeira página vazia rende uma página com 0 itens e para; buscar chamado 1 vez", async () => {
    const buscar = vi.fn(async () => respostaDe({ comments: [] }));

    const paginas = [];
    for await (const p of paginarPorCursor(buscar, extrairComentarios)) paginas.push(p);

    expect(paginas).toHaveLength(1);
    expect(paginas[0]!.itens).toHaveLength(0);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("(f) a API repete o comentário-cursor na página seguinte (comportamento inclusivo); o generator deduplica por id, sem alterar o corpoCru", async () => {
    const primeiros25 = Array.from({ length: 25 }, (_, i) => comentarioFixture(i, AGORA));
    const cursorRepetido = primeiros25[24]!; // o mais antigo da primeira página
    const segundaPaginaBruta = [cursorRepetido, ...Array.from({ length: 2 }, (_, i) => comentarioFixture(30 + i, AGORA - 200))];
    const buscar = vi.fn(async (cursor?: { readonly start: string; readonly start_id: string }) =>
      cursor === undefined ? respostaDe({ comments: primeiros25 }) : respostaDe({ comments: segundaPaginaBruta }),
    );

    const paginas = [];
    for await (const p of paginarPorCursor(buscar, extrairComentarios)) paginas.push(p);

    // corpoCru da segunda página preserva os 3 itens brutos, mesmo com o duplicado.
    expect(JSON.parse(paginas[1]!.corpoCru).comments).toHaveLength(3);
    // itens (pós-dedupe) da segunda página tem só os 2 novos.
    expect(paginas[1]!.itens).toHaveLength(2);

    const todosOsIds = paginas.flatMap((p) => p.itens.map((item) => (item as { readonly id: string }).id));
    expect(new Set(todosOsIds).size).toBe(todosOsIds.length);
  });

  it("(g) página de exatamente 25 seguida de página com 0: duas chamadas, 25 itens (não assume que 25 é a última)", async () => {
    const exatos25 = Array.from({ length: 25 }, (_, i) => comentarioFixture(i, AGORA));
    const buscar = vi.fn(async (cursor?: { readonly start: string; readonly start_id: string }) =>
      cursor === undefined ? respostaDe({ comments: exatos25 }) : respostaDe({ comments: [] }),
    );

    const paginas = [];
    for await (const p of paginarPorCursor(buscar, extrairComentarios)) paginas.push(p);

    expect(buscar).toHaveBeenCalledTimes(2);
    const total = paginas.reduce((soma, p) => soma + p.itens.length, 0);
    expect(total).toBe(25);
  });
});
