/**
 * Prova de domínio de V02-01A: `evoluirConfiguracaoDeSolicitacoes` cria a
 * configuração ausente, confere a existente, recusa divergência com diff
 * legível e nunca toca Tarefa/Comentário — os oito casos (a)-(h) do plano
 * (Plan 02-08, Task 2).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { effectiveListConfig } from "./derive";
import { CP } from "./operations/financeiro";
import { addTaskComment, createTask } from "./operations/tasks";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO, SOL } from "./solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes } from "./solicitacao-de-pagamento-evolver";
import type { DataState } from "./state";

const AGORA = "2026-09-21T12:00:00.000Z";
const NOME_DA_LISTA = "Solicitações de pagamento";

/** Soma dos elementos do catálogo: 1 Lista + 5 Status (D5-06 acrescentou "em revisão") + 1 Tag + 25 Campos + 5 Papéis. */
const TOTAL_DE_ELEMENTOS =
  1 +
  CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.definitions.length +
  CATALOGO_SOLICITACAO_DE_PAGAMENTO.tags.length +
  CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.length +
  CATALOGO_SOLICITACAO_DE_PAGAMENTO.papeis.length;

function acharLista(state: DataState) {
  const lista = state.lists.find((l) => l.name === NOME_DA_LISTA);
  if (!lista) throw new Error("Lista 'Solicitações de pagamento' não encontrada.");
  return lista;
}

describe("evoluirConfiguracaoDeSolicitacoes", () => {
  let s: DataState;
  beforeEach(() => {
    s = buildGestaoBootstrap({ agora: AGORA });
  });

  it("(a) a primeira evolução cria a Lista, os 4 Status, os 25 Campos, a Tag e os 5 Papéis", () => {
    const r = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.criados.length).toBe(TOTAL_DE_ELEMENTOS);
    expect(r.value.divergentes).toEqual([]);

    const lista = acharLista(s);
    expect(lista.parentType).toBe("folder");
    expect(lista.parentId).toBe(CP.folderId);
    expect(lista.statusSet!.definitions.length).toBe(5);
    expect(lista.statusSet!.definitions.map((d) => d.id).sort()).toEqual(
      CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.definitions.map((d) => d.id).sort(),
    );

    const camposDaLista = s.fieldDefinitions.filter((f) => f.definedAtType === "list" && f.definedAtId === lista.id);
    expect(camposDaLista.length).toBe(25);

    expect(s.tags.some((t) => t.id === SOL.tags.contaTria)).toBe(true);

    const papeisIds = CATALOGO_SOLICITACAO_DE_PAGAMENTO.papeis.map((p) => p.id);
    expect(papeisIds.every((id) => s.roles.some((role) => role.id === id))).toBe(true);
  });

  it("(b) reaplicar sobre o mesmo estado devolve ok com criados e divergentes vazios — não duplica nada", () => {
    const primeira = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(primeira.ok).toBe(true);

    const totalDeListasAntes = s.lists.length;
    const totalDeCamposAntes = s.fieldDefinitions.length;
    const totalDeTagsAntes = s.tags.length;
    const totalDeRolesAntes = s.roles.length;

    const segunda = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
    if (!segunda.ok) throw new Error("unreachable");
    expect(segunda.value.criados).toEqual([]);
    expect(segunda.value.divergentes).toEqual([]);

    expect(s.lists.length).toBe(totalDeListasAntes);
    expect(s.fieldDefinitions.length).toBe(totalDeCamposAntes);
    expect(s.tags.length).toBe(totalDeTagsAntes);
    expect(s.roles.length).toBe(totalDeRolesAntes);
  });

  it("(c) renomear um Status existente e evoluir de novo recusa com id, esperado e encontrado na mensagem — o estado não muda", () => {
    const primeira = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(primeira.ok).toBe(true);

    const lista = acharLista(s);
    const status = lista.statusSet!.definitions.find((d) => d.id === SOL.status.emAprovacao)!;
    const nomeOriginal = status.name;
    status.name = "em aprovacao (renomeado)";

    const antes = structuredClone(s);
    const r = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain(SOL.status.emAprovacao);
    expect(r.error).toContain(nomeOriginal);
    expect(r.error).toContain("em aprovacao (renomeado)");

    expect(s).toStrictEqual(antes);
  });

  it("(d) acrescentar uma Tarefa e três Comentários à Lista e evoluir de novo é ok — Tarefas e Comentários ficam intactos", () => {
    const primeira = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(primeira.ok).toBe(true);
    const lista = acharLista(s);

    const criacao = createTask(s, "mem_maryane", { listId: lista.id, title: "Solicitação de teste" });
    expect(criacao.ok, criacao.ok ? "" : criacao.error).toBe(true);
    if (!criacao.ok) throw new Error("unreachable");
    for (const texto of ["primeiro comentário", "segundo comentário", "terceiro comentário"]) {
      const comentario = addTaskComment(s, "mem_maryane", criacao.value.id, { content: texto });
      expect(comentario.ok, comentario.ok ? "" : comentario.error).toBe(true);
    }

    const totalDeTarefasAntes = s.tasks.length;
    const totalDeComentariosAntes = s.tasks.find((t) => t.id === criacao.value.id)!.comments.length;

    const r = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    expect(s.tasks.length).toBe(totalDeTarefasAntes);
    expect(s.tasks.find((t) => t.id === criacao.value.id)!.comments.length).toBe(totalDeComentariosAntes);
  });

  it("(e) tasksPerList sobe de 500 para 5000 na primeira evolução e uma elevação menor sobre 5000 não abaixa o limite", () => {
    expect(s.workspace.limits.tasksPerList).toBe(500);

    const primeira = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(primeira.ok).toBe(true);
    if (!primeira.ok) throw new Error("unreachable");
    expect(primeira.value.tasksPerList).toEqual({ antes: 500, depois: 5000 });
    expect(s.workspace.limits.tasksPerList).toBe(5000);

    const segunda = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane", { tasksPerListMinimo: 2000 });
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) throw new Error("unreachable");
    expect(segunda.value.tasksPerList).toBeUndefined();
    expect(s.workspace.limits.tasksPerList).toBe(5000);
  });

  it("(f) Espaço sem a Pasta 'Financeiro' recusa apontando o bootstrap da Fase 1", () => {
    s.folders = s.folders.filter((f) => f.id !== CP.folderId);
    const r = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("Fase 1");
  });

  it("(g) o número de Registros de Atividade criados é igual ao número de elementos criados + 1 pela elevação do limite + 1 pelos Campos herdados deixados de fora", () => {
    expect(s.activity.length).toBe(0);
    const r = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.camposHerdadosFora?.length).toBeGreaterThan(0);
    expect(s.activity.length).toBe(r.value.criados.length + 2);
  });

  it("(g2) checklist 1.1 — os Campos de Contas a pagar com nome de Campo do catálogo saem da Lista; reaplicar não muda nada", () => {
    const r = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    if (!r.ok) throw new Error(r.error);
    expect([...(r.value.camposHerdadosFora ?? [])].sort()).toEqual(["BU", "Centro de Custo", "Empresa", "Integração manual", "Produto", "Valor"]);
    const lista = acharLista(s);
    const nomes = (effectiveListConfig(s, lista.id)?.fieldDefinitionIds ?? []).map((id) => s.fieldDefinitions.find((d) => d.id === id)?.name);
    for (const nome of ["Centro de Custo", "BU", "Empresa", "Valor", "Integração manual", "Produto"]) {
      expect(nomes.filter((n) => n === nome), nome).toHaveLength(1);
    }
    // Contas a pagar continua com os seus.
    const cp = effectiveListConfig(s, CP.listId)?.fieldDefinitionIds ?? [];
    expect(cp).toContain(CP.fields.centroDeCusto);
    expect(cp).toContain(CP.fields.valor);

    const antes = s.activity.length;
    const de_novo = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    if (!de_novo.ok) throw new Error(de_novo.error);
    expect(de_novo.value.camposHerdadosFora).toBeUndefined();
    expect(s.activity.length).toBe(antes);
  });

  it("(h) um Campo a mais na Lista, fora do catálogo, é reportado em divergentes e não é removido", () => {
    const primeira = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(primeira.ok).toBe(true);
    const lista = acharLista(s);

    s.fieldDefinitions.push({
      id: "fld_sp_extra_nao_previsto",
      workspaceId: s.workspace.id,
      name: "Campo extra não previsto",
      type: "text",
      required: false,
      target: "task",
      definedAtType: "list",
      definedAtId: lista.id,
      lifecycle: "ativo",
    });

    const r = evoluirConfiguracaoDeSolicitacoes(s, "mem_maryane");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("fld_sp_extra_nao_previsto");

    expect(s.fieldDefinitions.some((f) => f.id === "fld_sp_extra_nao_previsto")).toBe(true);
  });
});
