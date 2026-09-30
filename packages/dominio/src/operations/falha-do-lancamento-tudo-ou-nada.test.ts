/**
 * crm:WR-10 (06-11 Task 3, D6-03) — a falha do lançamento é tudo ou nada.
 * `registrarFalhaDoLancamento` aplica `guardasDoAgente` e publica o aviso
 * ANTES de voltar o Status: uma recusa não deixa Comentário, mudança de
 * Status nem Registro; se a volta a "para pagar" for recusada, o aviso
 * publicado diz que a conta NÃO voltou — nunca afirma o que não aconteceu.
 *
 * `state.activity` é newest-first: Registros achados por `objectId`/`action`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { taskCommentRefusal } from "../derive";
import { buildSeed } from "../seed";
import { PAPEIS_SOLICITACAO_DE_PAGAMENTO, SOL } from "../solicitacao-de-pagamento";
import type { DataState } from "../state";
import type { Member, Role, Task } from "../types";
import { decideProcessApproval } from "./ai";
import { CP, publicarResumoParaConferencia, registrarFalhaDoLancamento, TEXTOS_DA_CONFERENCIA, type DeParaDeLancamento } from "./financeiro";
import { changeTaskStatus, guestFieldWriter, guestStatusWriter } from "./tasks";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

const MOTIVO = "Fornecedor sem CNPJ válido";
const CODE = "FORNECEDOR_NAO_RESOLVIDO";
const FALHA = { motivo: MOTIVO, code: CODE } as const;

let state: DataState;
let conta: Task;

const retrato = () => ({ comments: conta.comments.length, activity: state.activity.length, statusId: conta.statusId });
const registroDaFalha = () => state.activity.find((a) => a.objectId === conta.id && a.action === "Lançamento no Omie falhou");

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  const p = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA });
  if (!p.ok) throw new Error(p.error);
  const d = decideProcessApproval(state, CP.financeiroId, p.value.conferencia.id, "aprovada", { source: "click" });
  if (!d.ok) throw new Error(d.error);
  const m = changeTaskStatus(state, CP.financeiroId, conta.id, CP.status.emLancamento);
  if (!m.ok) throw new Error(m.error);
});

describe("(a) Agente pausado", () => {
  it("recusa sem efeito", () => {
    const agente = state.agents.find((a) => a.id === CP.agentId);
    if (!agente) throw new Error("sem Agente");
    agente.lifecycle = "pausado";
    const antes = retrato();
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, FALHA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Agente de lançamento não está ativo.");
    expect(retrato()).toEqual(antes);
  });
});

describe("(b) ator sem alcance", () => {
  it("recusa sem efeito — nem o Registro fica", () => {
    const antes = retrato();
    const r = registrarFalhaDoLancamento(state, "mem_julia", conta.id, FALHA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Quem invoca não alcança a Tarefa.");
    expect(retrato()).toEqual(antes);
    expect(registroDaFalha()).toBeUndefined();
  });
});

describe("(c) ator que move o Status mas não comenta", () => {
  it("recusa sem efeito — a conta não volta para “para pagar” às escondidas", () => {
    const molde = PAPEIS_SOLICITACAO_DE_PAGAMENTO.find((p) => p.id === SOL.papeis.agentePipeline);
    if (!molde) throw new Error("sem o Papel Agente do pipeline no catálogo");
    const papel: Role = {
      id: "role_teste_so_status",
      workspaceId: state.workspace.id,
      name: "Agente do pipeline sem comentar",
      system: false,
      base: "convidado",
      permissions: molde.capacidades
        .filter((acao) => acao !== "comentar")
        .map((acao) => ({ action: acao, resourceType: "task", scope: "subarvore" as const, ...(acao === "editar" ? { restrictedTo: "status" as const } : {}) })),
    };
    state.roles.push(papel);
    const convidado: Member = {
      id: "mem_teste_so_status",
      workspaceId: state.workspace.id,
      displayName: "Serviço só Status",
      state: "ativo",
      roleId: papel.id,
      availability: { value: "disponivel", at: new Date().toISOString(), origin: "membro" },
      userMemory: { enabled: true, items: [] },
    };
    state.members.push(convidado);
    state.grants.push({
      id: "grn_teste_so_status",
      workspaceId: state.workspace.id,
      subjectKind: "member",
      subjectId: convidado.id,
      action: "ver",
      resourceType: "list",
      resourceId: CP.listId,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: "mem_thiago",
      grantedAt: new Date().toISOString(),
    });
    // A Lista de Contas a pagar libera Anexo e Data de Emissão a Convidados (a
    // Pessoa da conta), e quem edita um Campo liberado também comenta
    // (`addTaskComment` → `guestFieldWriter`). Sem essa liberação, este
    // Convidado só move o Status.
    const lista = state.lists.find((l) => l.id === CP.listId);
    if (!lista) throw new Error("sem a Lista");
    lista.guestEditableDefinitionIds = [];
    expect(guestFieldWriter(state, convidado.id, conta.id)).toBeUndefined();
    expect(guestStatusWriter(state, convidado.id, conta.id)).toBe(true);
    expect(taskCommentRefusal(state, convidado.id, conta.id)).not.toBeUndefined();

    const antes = retrato();
    const r = registrarFalhaDoLancamento(state, convidado.id, conta.id, FALHA);
    expect(r.ok).toBe(false);
    expect(conta.statusId).toBe(CP.status.emLancamento);
    expect(retrato()).toEqual(antes);
    expect(registroDaFalha()).toBeUndefined();
  });
});

describe("(d) “para pagar” recusa a entrada", () => {
  it("um aviso só, que diz que a conta NÃO voltou; o Status fica", () => {
    const lista = state.lists.find((l) => l.id === CP.listId);
    const paraPagar = lista?.statusSet?.definitions.find((d) => d.id === CP.status.paraPagar);
    if (!paraPagar) throw new Error("sem “para pagar” na Lista");
    paraPagar.entryAllowedMemberIds = [CP.aprovadorId];

    const antes = retrato();
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, FALHA);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.statusId).toBe(CP.status.emLancamento);

    const detalhe = registroDaFalha()?.detail ?? "";
    const prefixo = `${CODE} — Status não voltou: `;
    expect(detalhe.startsWith(prefixo)).toBe(true);
    const recusa = detalhe.slice(prefixo.length);
    expect(recusa).not.toBe("");

    const novos = conta.comments.slice(antes.comments);
    expect(novos).toHaveLength(1);
    expect(novos[0]?.content).toBe(TEXTOS_DA_CONFERENCIA.falhaSemVolta(MOTIVO, CODE, recusa));
    expect(conta.comments.some((c) => c.content.includes("A conta voltou"))).toBe(false);
    // O Registro do Comentário desfeito também saiu: só o do aviso e o da falha.
    expect(state.activity.length - antes.activity).toBe(2);
  });
});

describe("(e) o caminho feliz continua", () => {
  it("o aviso diz que a conta voltou, e ela voltou", () => {
    const antes = retrato();
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, FALHA);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const novos = conta.comments.slice(antes.comments);
    expect(novos).toHaveLength(1);
    expect(novos[0]?.content).toBe(TEXTOS_DA_CONFERENCIA.falha(MOTIVO, CODE));
    expect(conta.statusId).toBe(CP.status.paraPagar);
    expect(registroDaFalha()?.detail).toBe(CODE);
  });
});
