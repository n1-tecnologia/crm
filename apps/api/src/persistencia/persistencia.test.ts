/**
 * A aposta da Fase 1, posta à prova: hidratar o Espaço de Trabalho do banco,
 * rodar a operação **pura** do domínio e gravar só o que mudou.
 *
 * Se a hidratação devolve um `DataState` idêntico ao que o seed monta, então
 * todo teste que hoje passa sobre o seed passa sobre o banco — sem reescrever
 * os 214. É esse o argumento que este arquivo verifica, e não "o INSERT
 * funcionou".
 *
 * Precisa de um Postgres em DATABASE_URL — da variável de ambiente ou de
 * `apps/api/.env`. Sem ele, os testes são pulados em vez de falhar, para
 * `npm run check` não depender de infraestrutura.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio";
import { addTaskComment, changeTaskStatus, CP } from "@n1/dominio/operations";
import { carregarEnv, encerrar, pool } from "./conexao";
import { hidratar, semear } from "./repositorio";
import { executar } from "./unidade-de-trabalho";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_spike";
const conta = (s: DataState) =>
  Object.values(s as unknown as Record<string, unknown>).reduce<number>(
    (n, v) => n + (Array.isArray(v) ? v.length : 0),
    0,
  );

d("persistência do DataState", () => {
  let semente: DataState;

  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
      semente = buildSeed();
      const t0 = performance.now();
      const gravados = await semear(cliente, WS, semente);
      console.log(`\n  semear: ${gravados} registros em ${(performance.now() - t0).toFixed(0)} ms`);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await encerrar();
  });

  it("hidrata um estado equivalente ao que o seed monta", async () => {
    const cliente = await pool().connect();
    try {
      const t0 = performance.now();
      const { state } = await hidratar(cliente, WS);
      const ms = performance.now() - t0;
      console.log(`  hidratar: ${conta(state)} registros em ${ms.toFixed(0)} ms`);

      // As mesmas coleções, com os mesmos tamanhos.
      const colecoes = (s: DataState) =>
        Object.entries(s as unknown as Record<string, unknown>)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => `${k}:${(v as unknown[]).length}`)
          .sort();
      expect(colecoes(state)).toEqual(colecoes(semente));

      // E o conteúdo inteiro, na mesma ordem. É esta asserção que sustenta a
      // Fase 1: passando ela, nenhum dos 214 testes precisa saber do banco.
      expect(state).toEqual(semente);

      // `toEqual` trata `{ a: 1, b: undefined }` e `{ a: 1 }` como iguais, e a
      // ida ao banco converte o primeiro no segundo. Para o domínio os dois são
      // o mesmo (`registro.b === undefined` nos dois casos), mas `"b" in
      // registro` não é — então vale saber se a diferença existe de fato.
      expect(state).toStrictEqual(semente);
    } finally {
      cliente.release();
    }
  });

  it("grava só o que a operação tocou", async () => {
    const alvo = semente.tasks.find((t) => t.listId === CP.listId && t.statusId === CP.status.paraPagar);
    expect(alvo, "o seed precisa ter uma conta em 'para pagar'").toBeDefined();

    const r = await executar(WS, (state) =>
      addTaskComment(state, CP.financeiroId, alvo!.id, { content: "Comentário do spike." }),
    );
    expect(r.ok, "ok" in r ? String((r as { error?: string }).error) : "").toBe(true);
    if (!("diferenca" in r)) throw new Error("esperava resultado com diferença");
    console.log(`  comentar: ${r.diferenca.gravados} gravados, ${r.diferenca.removidos} removidos`);

    // Um Comentário muda a Tarefa (que o contém) e acrescenta um Registro de
    // Atividade. Se isso gravasse as 900 linhas, a comparação por JSON não
    // estaria funcionando.
    expect(r.diferenca.gravados).toBeLessThanOrEqual(4);
    expect(r.diferenca.removidos).toBe(0);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const tarefa = state.tasks.find((t) => t.id === alvo!.id);
      expect(tarefa?.comments.some((c) => c.content === "Comentário do spike.")).toBe(true);
    } finally {
      cliente.release();
    }
  });

  it("recusa do domínio não grava nada", async () => {
    const antes = await contarLinhas();
    const alvo = semente.tasks.find((t) => t.listId === CP.listId);
    const r = await executar(WS, (state) =>
      // Mover para 'pago' sem passar pelo fluxo: o domínio recusa (RN-CP-04).
      changeTaskStatus(state, CP.financeiroId, alvo!.id, CP.status.pago),
    );
    expect(r.ok).toBe(false);
    expect(await contarLinhas()).toBe(antes);
  });

  it("mede a hidratação com o estado 10x maior", async () => {
    const cliente = await pool().connect();
    try {
      const grande = buildSeed();
      // Multiplica a coleção mais pesada (o log de atividade) por 10.
      const base = grande.activity.slice();
      for (let n = 1; n < 10; n += 1) {
        for (const a of base) grande.activity.push({ ...a, id: `${a.id}_x${n}` });
      }
      await cliente.query("delete from plataforma.registros where workspace_id = $1", ["ws_spike_10x"]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", ["ws_spike_10x"]);
      const t0 = performance.now();
      const gravados = await semear(cliente, "ws_spike_10x", grande);
      const tSemear = performance.now() - t0;
      const t1 = performance.now();
      const { state } = await hidratar(cliente, "ws_spike_10x");
      const tHidratar = performance.now() - t1;
      console.log(`  10x — semear ${gravados} em ${tSemear.toFixed(0)} ms · hidratar ${conta(state)} em ${tHidratar.toFixed(0)} ms`);
      expect(conta(state)).toBe(conta(grande));
    } finally {
      cliente.release();
    }
  });
});

async function contarLinhas(): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      "select count(*)::text as n from plataforma.registros where workspace_id = $1",
      [WS],
    );
    return Number(r.rows[0]!.n);
  } finally {
    cliente.release();
  }
}
