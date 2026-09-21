/**
 * §9 do catálogo Solicitação de pagamento — o "Agente do pipeline" é um
 * Convidado (`base: "convidado"`) cujo Papel concede `editar` restrito a
 * Status (`editarRestritoA: "status"`, `solicitacao-de-pagamento.ts`): muda
 * SÓ o Status de uma Solicitação; não altera Tags, Vencimento nem qualquer
 * outro Campo.
 *
 * Antes deste arquivo, `taskWriteRefusal` (`derive.ts`) recusava QUALQUER
 * Convidado categoricamente, sem consultar `editarRestritoA` — a credencial
 * de serviço de produção resolve para exatamente este Papel (D-15,
 * `apps/api/src/persistencia/credenciais-de-servico.ts`), então as rotas
 * `PUT /:taskId/status`, `PUT /:taskId/tags/:tagId` e
 * `PUT /:taskId/due-date` do Plan 02-13 sempre recusavam em produção —
 * documentado como item BLOQUEANTE em
 * `.planning/phases/02-.../deferred-items.md` e no cabeçalho de
 * `apps/api/src/rotas/integracao-solicitacoes.test.ts`.
 *
 * Este arquivo prova a correção: `changeTaskStatus` agora enxerga
 * `editarRestritoA` via `guestStatusWriter` (`operations/tasks.ts`) e o
 * Papel materializado (`Role.permissions[].restrictedTo`,
 * `solicitacao-de-pagamento-evolver.ts::permissoesEsperadas`) — SEM alterar
 * `base` do Papel (continua Convidado) e SEM abrir Tags/Vencimento/Campos,
 * que o §9 nunca concedeu.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO, SOL } from "../solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes } from "../solicitacao-de-pagamento-evolver";
import type { DataState } from "../state";
import type { Grant, Id, Member } from "../types";
import { changeTaskStatus, createTask, guestStatusWriter, setTaskTags, updateTask } from "./tasks";
import { CP } from "./financeiro";

const AGORA = "2026-09-21T12:00:00.000Z";
const NOME_DA_LISTA = "Solicitações de pagamento";

function acharLista(state: DataState) {
  const lista = state.lists.find((l) => l.name === NOME_DA_LISTA);
  if (!lista) throw new Error(`Lista "${NOME_DA_LISTA}" não encontrada.`);
  return lista;
}

/**
 * O mínimo para um Convidado alcançar uma Tarefa (B70): `ver` concedido
 * diretamente nela — o mesmo mecanismo que a fixture "Pessoa da conta" usa
 * em `seed-financeiro.ts` (`gr_cp_pessoa_*`). `editarRestritoA` não
 * substitui esta concessão; ele só afrouxa a recusa categórica DEPOIS que o
 * Convidado já alcança a Tarefa.
 */
function concederVer(state: DataState, subjectId: Id, taskId: Id): void {
  const grant: Grant = {
    id: `gr_teste_${subjectId}_${taskId}`,
    workspaceId: state.workspace.id,
    subjectKind: "member",
    subjectId,
    action: "ver",
    resourceType: "task",
    resourceId: taskId,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: "mem_maryane",
    grantedAt: AGORA,
  };
  state.grants.push(grant);
}

function criarMembro(state: DataState, id: Id, roleId: Id): Member {
  const membro: Member = {
    id,
    workspaceId: state.workspace.id,
    displayName: id,
    state: "ativo",
    roleId,
    availability: { value: "disponivel", at: AGORA, origin: "membro" },
    userMemory: { enabled: true, items: [] },
  };
  state.members.push(membro);
  return membro;
}

describe("Agente do pipeline (§9) — Convidado com editar restrito a Status", () => {
  let state: DataState;
  let taskId: Id;

  beforeEach(() => {
    state = buildGestaoBootstrap({ agora: AGORA });
    const evoluido = evoluirConfiguracaoDeSolicitacoes(state, "mem_maryane");
    expect(evoluido.ok, evoluido.ok ? "" : evoluido.error).toBe(true);

    const lista = acharLista(state);
    const criada = createTask(state, "mem_maryane", {
      listId: lista.id,
      title: "Pagamento de teste",
      statusId: SOL.status.paraFazer,
    });
    expect(criada.ok, criada.ok ? "" : criada.error).toBe(true);
    if (!criada.ok) throw new Error("unreachable");
    taskId = criada.value.id;
  });

  it("premissa do gap: o catálogo mesmo declara o Papel Convidado com editar restrito a Status, e o evolver materializa isso na Role real", () => {
    const papel = CATALOGO_SOLICITACAO_DE_PAGAMENTO.papeis.find((p) => p.id === SOL.papeis.agentePipeline);
    expect(papel?.editarRestritoA).toBe("status");

    const role = state.roles.find((r) => r.id === SOL.papeis.agentePipeline);
    expect(role?.base).toBe("convidado");
    expect(role?.permissions.some((p) => p.action === "editar" && p.restrictedTo === "status")).toBe(true);
  });

  it("com a concessão de ver na Tarefa, o Agente do pipeline MUDA o Status", () => {
    criarMembro(state, "mem_agente_pipeline_teste", SOL.papeis.agentePipeline);
    concederVer(state, "mem_agente_pipeline_teste", taskId);
    expect(guestStatusWriter(state, "mem_agente_pipeline_teste", taskId)).toBe(true);

    const r = changeTaskStatus(state, "mem_agente_pipeline_teste", taskId, SOL.status.emAprovacao);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value.statusId).toBe(SOL.status.emAprovacao);
  });

  it("o MESMO Agente do pipeline NÃO muda Tags — a restrição do §9 é só Status", () => {
    criarMembro(state, "mem_agente_pipeline_teste", SOL.papeis.agentePipeline);
    concederVer(state, "mem_agente_pipeline_teste", taskId);

    const r = setTaskTags(state, "mem_agente_pipeline_teste", taskId, [SOL.tags.contaTria]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Convidado não altera Tarefa/);
  });

  it("o MESMO Agente do pipeline NÃO muda Vencimento nem outros Campos via updateTask", () => {
    criarMembro(state, "mem_agente_pipeline_teste", SOL.papeis.agentePipeline);
    concederVer(state, "mem_agente_pipeline_teste", taskId);

    const vencimento = updateTask(state, "mem_agente_pipeline_teste", taskId, {
      dueDate: { form: "civilDay", value: "2026-10-01" },
    });
    expect(vencimento.ok).toBe(false);
    if (!vencimento.ok) expect(vencimento.error).toMatch(/Convidado não altera Tarefa/);

    const titulo = updateTask(state, "mem_agente_pipeline_teste", taskId, { title: "outro título" });
    expect(titulo.ok).toBe(false);
    if (!titulo.ok) expect(titulo.error).toMatch(/Convidado não altera Tarefa/);
  });

  it("um Convidado comum (Papel do sistema, sem editarRestritoA) continua recusado até para Status — a recusa categórica de sempre não regrediu", () => {
    const roleConv = state.roles.find((r) => r.base === "convidado" && r.id !== SOL.papeis.agentePipeline);
    expect(roleConv).toBeDefined();
    if (!roleConv) throw new Error("unreachable");

    criarMembro(state, "mem_convidado_comum_teste", roleConv.id);
    concederVer(state, "mem_convidado_comum_teste", taskId);
    expect(guestStatusWriter(state, "mem_convidado_comum_teste", taskId)).toBe(false);

    const r = changeTaskStatus(state, "mem_convidado_comum_teste", taskId, SOL.status.emAprovacao);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Convidado não altera Tarefa/);
  });

  it("sem a concessão de ver na Tarefa, o Agente do pipeline continua sem acesso — editarRestritoA não substitui a concessão (B70)", () => {
    criarMembro(state, "mem_agente_pipeline_sem_grant", SOL.papeis.agentePipeline);
    expect(guestStatusWriter(state, "mem_agente_pipeline_sem_grant", taskId)).toBe(false);

    // Sem a concessão, `guestStatusWriter` já devolve `false` e a chamada cai
    // na recusa categórica de sempre (`taskWriteRefusal` recusa Convidado
    // antes de checar acesso) — a mesma frase de um Convidado comum.
    const r = changeTaskStatus(state, "mem_agente_pipeline_sem_grant", taskId, SOL.status.emAprovacao);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Convidado não altera Tarefa/);
  });

  it("um Membro comum (não Convidado) não é afetado: continua mudando Status, Tags e Campos livremente", () => {
    const r1 = changeTaskStatus(state, "mem_maryane", taskId, SOL.status.emAprovacao);
    expect(r1.ok, r1.ok ? "" : r1.error).toBe(true);

    const r2 = setTaskTags(state, "mem_maryane", taskId, [SOL.tags.contaTria]);
    expect(r2.ok, r2.ok ? "" : r2.error).toBe(true);

    const r3 = updateTask(state, "mem_maryane", taskId, { title: "Pagamento revisado" });
    expect(r3.ok, r3.ok ? "" : r3.error).toBe(true);
  });

  /**
   * A segunda metade do buraco. A regra do §9 sozinha não basta: um Convidado
   * nunca alcança contêiner por Papel (B70), e nada criava a concessão que o
   * faz enxergar as Solicitações. O evolver passou a provisionar isso — sem
   * nomear ocupante (D-13), concedendo a quem JÁ ocupa o Papel.
   */
  describe("provisionamento do alcance pelo evolver (item 5)", () => {
    it("concede `ver` na Lista a quem já ocupa o Papel, e aí o Agente muda Status SEM concessão por Tarefa", () => {
      criarMembro(state, "mem_agente_provisionado", SOL.papeis.agentePipeline);

      const r = evoluirConfiguracaoDeSolicitacoes(state, "mem_maryane");
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(r.value.concedidos).toContain("mem_agente_provisionado");

      const lista = acharLista(state);
      expect(
        state.grants.some(
          (g) =>
            g.subjectKind === "member" &&
            g.subjectId === "mem_agente_provisionado" &&
            g.resourceType === "list" &&
            g.resourceId === lista.id &&
            g.action === "ver",
        ),
      ).toBe(true);

      // Nenhuma concessão por Tarefa foi criada — o alcance vem da Lista.
      expect(guestStatusWriter(state, "mem_agente_provisionado", taskId)).toBe(true);
      const mudou = changeTaskStatus(state, "mem_agente_provisionado", taskId, SOL.status.emAprovacao);
      expect(mudou.ok, mudou.ok ? "" : mudou.error).toBe(true);
    });

    it("reaplicar é no-op: a segunda execução não concede de novo nem duplica o Grant", () => {
      criarMembro(state, "mem_agente_provisionado", SOL.papeis.agentePipeline);
      const primeira = evoluirConfiguracaoDeSolicitacoes(state, "mem_maryane");
      expect(primeira.ok).toBe(true);

      const segunda = evoluirConfiguracaoDeSolicitacoes(state, "mem_maryane");
      expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
      if (!segunda.ok) throw new Error("unreachable");
      expect(segunda.value.concedidos).toBeUndefined();

      const lista = acharLista(state);
      const quantos = state.grants.filter(
        (g) => g.subjectId === "mem_agente_provisionado" && g.resourceId === lista.id && g.action === "ver",
      ).length;
      expect(quantos).toBe(1);
    });

    it("a concessão na Lista não abre Tags nem Vencimento — `taskWriteRefusal` segue recusando", () => {
      criarMembro(state, "mem_agente_provisionado", SOL.papeis.agentePipeline);
      expect(evoluirConfiguracaoDeSolicitacoes(state, "mem_maryane").ok).toBe(true);

      const tags = setTaskTags(state, "mem_agente_provisionado", taskId, [SOL.tags.contaTria]);
      expect(tags.ok).toBe(false);

      const campo = updateTask(state, "mem_agente_provisionado", taskId, { title: "Renomeado pelo agente" });
      expect(campo.ok).toBe(false);
    });

    it("o alcance não vaza para outra Lista: uma Tarefa de Contas a pagar continua fora", () => {
      criarMembro(state, "mem_agente_provisionado", SOL.papeis.agentePipeline);
      expect(evoluirConfiguracaoDeSolicitacoes(state, "mem_maryane").ok).toBe(true);

      const outra = createTask(state, "mem_maryane", {
        listId: CP.listId,
        title: "Conta de outra Lista",
      });
      expect(outra.ok, outra.ok ? "" : outra.error).toBe(true);
      if (!outra.ok) throw new Error("unreachable");

      expect(guestStatusWriter(state, "mem_agente_provisionado", outra.value.id)).toBe(false);
    });

    it("quem NÃO ocupa o Papel não ganha nada: um Convidado comum segue sem alcance", () => {
      criarMembro(state, "mem_convidado_comum", "role_conv");
      const r = evoluirConfiguracaoDeSolicitacoes(state, "mem_maryane");
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(r.value.concedidos ?? []).not.toContain("mem_convidado_comum");
      expect(guestStatusWriter(state, "mem_convidado_comum", taskId)).toBe(false);
    });
  });
});
