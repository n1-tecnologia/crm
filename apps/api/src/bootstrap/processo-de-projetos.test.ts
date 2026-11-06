/**
 * `configurarProcessoDeProjetos()` contra o Postgres real: `--dry-run` não grava,
 * `--apply` grava e sobrevive à volta pelo banco, a segunda execução é no-op, e
 * uma Tarefa criada depois do aplicar continua intacta numa terceira.
 *
 * Precisa de `DATABASE_URL`; sem ele, pula em vez de falhar (mesmo padrão de
 * `contas-a-receber.test.ts`).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CP } from "@n1/dominio/operations/financeiro";
import { createSpace } from "@n1/dominio/operations/structure";
import { createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import { bootstrapGestao } from "./gestao";
import { configurarProcessoDeProjetos, inspecionarEspacoDoProcesso } from "./processo-de-projetos";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = `ws_pp_${Date.now()}_${randomUUID().slice(0, 8)}`;
const WS_EXISTENTE = `${WS}_existente`;
const EU = CP.financeiroId;

async function comCliente<T>(fazer: (cliente: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool().connect();
  try {
    return await fazer(cliente);
  } finally {
    cliente.release();
  }
}

const contarLinhas = () =>
  comCliente(async (c) => Number((await c.query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1", [WS])).rows[0]!.n));
const revisao = () =>
  comCliente(async (c) => Number((await c.query<{ r: string }>("select revisao::text as r from plataforma.workspaces where workspace_id = $1", [WS])).rows[0]!.r));
const limpar = () =>
  comCliente(async (c) => {
    for (const ws of [WS, WS_EXISTENTE]) {
      await c.query("delete from plataforma.automacao_agenda where workspace_id = $1", [ws]);
      await c.query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await c.query("delete from plataforma.registros where workspace_id = $1", [ws]);
      await c.query("delete from plataforma.workspaces where workspace_id = $1", [ws]);
    }
  });

d("configurarProcessoDeProjetos contra o Postgres real", () => {
  beforeAll(async () => {
    await limpar();
    const resultado = await comCliente((c) => bootstrapGestao(c, { workspaceId: WS, agora: "2026-11-06T12:00:00.000Z" }));
    expect(resultado.criado).toBe(true);
  });

  afterAll(async () => {
    await limpar();
    await encerrar();
  });

  it("--dry-run calcula o diff e não grava nada", async () => {
    const linhas = await contarLinhas();
    const rev = await revisao();
    const r = await configurarProcessoDeProjetos({ workspaceId: WS, actingMemberId: EU, dryRun: true });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.diff.criados).toContain("lst_pp_14");
    expect(await contarLinhas()).toBe(linhas);
    expect(await revisao()).toBe(rev);
  });

  it("--apply grava, e o que volta do banco é o que o manual pede", async () => {
    const r = await configurarProcessoDeProjetos({ workspaceId: WS, actingMemberId: EU, dryRun: false, clientes: ["Cliente A", "Cliente B"] });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const { state } = await comCliente((c) => hidratar(c, WS));
    const listas = state.lists.filter((l) => l.parentId === "fld_pp_processo_projetos");
    expect(listas).toHaveLength(14);
    expect(listas.every((l) => l.statusSet && l.statusSet.definitions.length >= 7)).toBe(true);
    expect(state.fieldDefinitions.filter((f) => f.id.startsWith("fd_pp_"))).toHaveLength(179);
    expect(state.views.filter((v) => v.id.startsWith("viw_pp_"))).toHaveLength(42);
    expect(state.fieldDefinitions.find((f) => f.id === "fd_pp_cliente")!.options).toEqual(["Cliente A", "Cliente B"]);
    expect(state.spaces.find((s) => s.id === "spc_pp_produto_tecnologia")!.isPrivate).toBe(true);
    const qualificada = listas.find((l) => l.id === "lst_pp_01")!.statusSet!.definitions.find((s) => s.name === "Qualificada")!;
    expect(qualificada.entryRequirements?.length).toBeGreaterThan(10);
  });

  it("uma Tarefa grava em cima da configuração, e reaplicar não encosta nela nem cria nada", async () => {
    const criada = await executar(WS, (state) => {
      const t = createTask(state, EU, { listId: "lst_pp_01", title: "Demanda real" });
      if (!t.ok) return t;
      return setTaskFieldValue(state, EU, t.value.id, "fd_pp_solicitante", "Ana");
    });
    if ("conflito" in criada) throw new Error(criada.error);
    expect(criada.ok, criada.ok ? "" : criada.error).toBe(true);
    if (!criada.ok) return;

    const linhas = await contarLinhas();
    const rev = await revisao();
    const r = await configurarProcessoDeProjetos({ workspaceId: WS, actingMemberId: EU, dryRun: false });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.diff.criados).toEqual([]);
    expect(r.diff.divergentes).toEqual([]);
    expect(await contarLinhas()).toBe(linhas);
    expect(await revisao()).toBeGreaterThanOrEqual(rev);

    const { state } = await comCliente((c) => hidratar(c, WS));
    const tarefa = state.tasks.find((t) => t.title === "Demanda real")!;
    expect(tarefa.statusId).toBe("st_pp_01_nova_demanda");
    expect(tarefa.fieldValues.find((v) => v.definitionId === "fd_pp_solicitante")!.value).toBe("Ana");
  });

  it("num Espaço que já existe: inspeciona sem gravar, recusa sem o id e aplica com ele", async () => {
    const criado = await comCliente((c) => bootstrapGestao(c, { workspaceId: WS_EXISTENTE, agora: "2026-11-06T12:00:00.000Z" }));
    expect(criado.criado).toBe(true);
    const espaco = await executar(WS_EXISTENTE, (state) => createSpace(state, EU, { name: "Produto e Tecnologia" }));
    if ("conflito" in espaco) throw new Error(espaco.error);
    if (!espaco.ok) throw new Error(espaco.error);
    const id = espaco.value.id;

    const contar = () =>
      comCliente(async (c) => Number((await c.query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1", [WS_EXISTENTE])).rows[0]!.n));
    const antes = await contar();
    const inspecionados = await inspecionarEspacoDoProcesso(WS_EXISTENTE);
    expect(inspecionados.map((e) => e.id)).toEqual([id]);
    expect(await contar()).toBe(antes);

    const semId = await configurarProcessoDeProjetos({ workspaceId: WS_EXISTENTE, actingMemberId: EU, dryRun: false });
    expect(semId.ok).toBe(false);
    expect(await contar()).toBe(antes);

    const r = await configurarProcessoDeProjetos({ workspaceId: WS_EXISTENTE, actingMemberId: EU, dryRun: false, espacoExistenteId: id });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const { state } = await comCliente((c) => hidratar(c, WS_EXISTENTE));
    expect(state.spaces.filter((s) => s.name === "Produto e Tecnologia").map((s) => s.id)).toEqual([id]);
    const pasta = state.folders.find((f) => f.id === "fld_pp_processo_projetos")!;
    expect(pasta.parentId).toBe(id);
    expect(pasta.isPrivate).toBe(true);
    expect(state.lists.filter((l) => l.parentId === pasta.id)).toHaveLength(14);

    const de_novo = await configurarProcessoDeProjetos({ workspaceId: WS_EXISTENTE, actingMemberId: EU, dryRun: false, espacoExistenteId: id });
    expect(de_novo.ok, de_novo.ok ? "" : de_novo.error).toBe(true);
    if (de_novo.ok) expect(de_novo.diff.criados).toEqual([]);
  });

  it("recusa Membro que não existe no Espaço de Trabalho, sem gravar", async () => {
    const linhas = await contarLinhas();
    const r = await configurarProcessoDeProjetos({ workspaceId: WS, actingMemberId: "mem_nao_existe", dryRun: false });
    expect(r.ok).toBe(false);
    expect(await contarLinhas()).toBe(linhas);
  });
});
