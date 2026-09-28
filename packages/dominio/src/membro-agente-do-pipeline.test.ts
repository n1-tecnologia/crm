/**
 * Plano pós-auditoria, 2.2 — o Membro de serviço "Agente do pipeline".
 *
 * Em `ws_n1` ninguém ocupa o Papel `rol_sp_agente_pipeline`, e tudo o que o
 * agendador e a ponte do lançamento gravam em nome dele falha
 * (`apps/api/src/persistencia/credenciais-de-servico.ts`). O CLI
 * `solicitacoes:configurar` passa a pedir ao evolver que o crie
 * (`membroDeServico`) e lhe dê alcance nas Listas de Contas a pagar e a
 * receber. Este arquivo prova, sobre o bootstrap de produção + o evolver
 * aplicado, que esse Membro faz o que a ponte e o agendador fazem com ele:
 *
 *   1. vê a conta a pagar (`memberSeesTask`);
 *   2. comenta nela;
 *   3. publica o Resumo pelo `runLancamentoAgent`;
 *   4. muda o Status (`changeTaskStatus` → `guestStatusWriter`);
 *   e roda a agenda de Automações das duas Listas (`runScheduledAutomations`).
 *
 * E o que ele continua sem poder: é Convidado — não edita Campo, título nem
 * cria conta.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { derive } from "./index";
import { runScheduledAutomations } from "./operations/automations";
import { CP, CR, INVOCADOR_DO_LANCAMENTO, runLancamentoAgent, type DeParaDeLancamento } from "./operations/financeiro";
import { addTaskComment, changeTaskStatus, createTask, setTaskFieldValue, updateTask } from "./operations/tasks";
import { buildSeed } from "./seed";
import { SOL } from "./solicitacao-de-pagamento";
import { EMAIL_DO_AGENTE_DO_PIPELINE, LISTA_ID as SOLICITACOES, evoluirConfiguracaoDeSolicitacoes } from "./solicitacao-de-pagamento-evolver";
import type { DataState } from "./state";
import type { Member, Task } from "./types";

const AGORA = "2026-09-28T12:00:00.000Z";
const MARYANE = "mem_maryane";
const F = CP.fields;
const COM_MEMBRO = { membroDeServico: { email: EMAIL_DO_AGENTE_DO_PIPELINE } } as const;

/** O de-para como a rota `/resolver` do `automation/` devolve: uma entrada, resolvida, origem Omie. */
const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.93 } },
  origem: "omie",
};

function agenteDoPipeline(state: DataState): Member {
  const ocupantes = state.members.filter((m) => m.roleId === SOL.papeis.agentePipeline && m.state !== "removido");
  expect(ocupantes).toHaveLength(1);
  const membro = ocupantes[0];
  if (!membro) throw new Error("sem Agente do pipeline");
  return membro;
}

/** Uma conta completa, criada pela Maryane em "para pagar" e movida por ela para "em lançamento omie" — o caminho real da ponte. */
function contaEmLancamento(state: DataState): Task {
  const criada = createTask(state, MARYANE, {
    listId: CP.listId,
    title: "DAS — setembro",
    dueDate: { form: "civilDay", value: "2026-10-20" },
  });
  if (!criada.ok) throw new Error(criada.error);
  const tarefa = criada.value;
  const campos: Array<[string, string | number]> = [
    [F.centroDeCusto, "TRIA"],
    [F.categoria, "Impostos"],
    [F.valor, 1],
    [F.forma, "Chave Pix"],
    [F.chavePix, "financeiro@exemplo.com.br"],
    [F.fornecedor, "CNPJ"],
    [F.cnpj, "11.222.333/0001-81"],
    [F.nomeFornecedor, "Receita Federal do Brasil"],
  ];
  for (const [campo, valor] of campos) {
    const r = setTaskFieldValue(state, MARYANE, tarefa.id, campo, valor);
    if (!r.ok) throw new Error(`${campo}: ${r.error}`);
  }
  const movida = changeTaskStatus(state, MARYANE, tarefa.id, CP.status.emLancamento);
  if (!movida.ok) throw new Error(movida.error);
  return tarefa;
}

let state: DataState;
beforeEach(() => {
  state = buildGestaoBootstrap({ agora: AGORA });
});

describe("evoluirConfiguracaoDeSolicitacoes com membroDeServico — o Membro nasce e ganha alcance", () => {
  it("(a) cria UM Membro ativo no Papel, sem Usuário, pelo convite — e registra o convite e a ativação", () => {
    expect(state.members.some((m) => m.roleId === SOL.papeis.agentePipeline)).toBe(false);
    const r = evoluirConfiguracaoDeSolicitacoes(state, MARYANE, COM_MEMBRO);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;

    const membro = agenteDoPipeline(state);
    expect(r.value.membroDeServicoCriado).toBe(membro.id);
    expect(membro.state).toBe("ativo");
    expect(membro.displayName).toBe("Agente do pipeline");
    expect(membro.userId).toBeUndefined(); // nenhum JWT resolve para ele
    expect(membro.invitedIdentity).toEqual({ type: "email", value: EMAIL_DO_AGENTE_DO_PIPELINE });
    expect(state.activity.some((a) => a.action === "Membro convidado" && a.objectId === membro.id)).toBe(true);
    expect(state.activity.some((a) => a.action === "Membro de serviço ativado" && a.objectId === membro.id)).toBe(true);
  });

  it("(b) alcance: ver nas Solicitações; administrar em Contas a pagar e a receber, por ato de governança com motivo", () => {
    const r = evoluirConfiguracaoDeSolicitacoes(state, MARYANE, COM_MEMBRO);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    const membro = agenteDoPipeline(state);
    const acoes = (listId: string) =>
      state.grants.filter((g) => g.subjectKind === "member" && g.subjectId === membro.id && g.resourceId === listId).map((g) => g.action);
    expect(acoes(SOLICITACOES)).toEqual(["ver"]);
    expect(acoes(CP.listId)).toEqual(["administrar"]);
    expect(acoes(CR.listId)).toEqual(["administrar"]);
    expect(r.value.concessoesDeGovernanca).toEqual([`${membro.id}→${CP.listId}:administrar`, `${membro.id}→${CR.listId}:administrar`]);
    const atos = state.activity.filter((a) => a.action === "Ato de governança: acesso concedido a Recurso privado");
    expect(atos.map((a) => a.objectId).sort()).toEqual([CP.listId, CR.listId].sort());
    expect(atos.every((a) => (a.detail ?? "").includes("2.2"))).toBe(true);
  });

  it("(c) reaplicar não cria outro Membro, não concede de novo e não escreve Atividade", () => {
    expect(evoluirConfiguracaoDeSolicitacoes(state, MARYANE, COM_MEMBRO).ok).toBe(true);
    const membros = state.members.length;
    const grants = state.grants.length;
    const atividade = state.activity.length;
    const r = evoluirConfiguracaoDeSolicitacoes(state, MARYANE, COM_MEMBRO);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.membroDeServicoCriado).toBeUndefined();
    expect(r.value.concessoesDeGovernanca).toBeUndefined();
    expect(state.members.length).toBe(membros);
    expect(state.grants.length).toBe(grants);
    expect(state.activity.length).toBe(atividade);
  });

  it("(d) sem a opção (o evolver como fixture), nada disso acontece — D-13: o evolver não nomeia ocupante sozinho", () => {
    const r = evoluirConfiguracaoDeSolicitacoes(state, MARYANE);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(state.members.some((m) => m.roleId === SOL.papeis.agentePipeline)).toBe(false);
    expect(state.grants.some((g) => g.resourceId === CP.listId && g.action === "administrar" && g.subjectId !== MARYANE)).toBe(false);
  });

  it("(e) quem não é Administrador nem Proprietário não cria o Membro: recusa com a frase do convite", () => {
    // No seed do protótipo a Maryane é Membro comum (`role_mem`), não Proprietária.
    const seed = buildSeed();
    const r = evoluirConfiguracaoDeSolicitacoes(seed, MARYANE, COM_MEMBRO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Só um Administrador ou o Proprietário convida um Membro");
    expect(seed.members.some((m) => m.roleId === SOL.papeis.agentePipeline)).toBe(false);
  });

  it("(f) um convite pendente no Papel é divergência: nada é criado ao lado dele", () => {
    // Primeiro a Lista e os Papéis (sem o Membro), depois um convite humano no Papel.
    expect(evoluirConfiguracaoDeSolicitacoes(state, MARYANE).ok).toBe(true);
    state.members.push({
      id: "mem_convite_pendente",
      workspaceId: state.workspace.id,
      invitedIdentity: { type: "email", value: "alguem@exemplo.com.br" },
      displayName: "alguem@exemplo.com.br",
      state: "pendente",
      roleId: SOL.papeis.agentePipeline,
      availability: { value: "indisponivel", at: AGORA, origin: "membro" },
      userMemory: { enabled: true, items: [] },
    });
    const membros = state.members.length;
    const r = evoluirConfiguracaoDeSolicitacoes(state, MARYANE, COM_MEMBRO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("mem_convite_pendente");
    expect(state.members.length).toBe(membros);
  });
});

describe("o Membro de serviço faz o que a ponte e o agendador fazem com ele", () => {
  let agente: Member;
  let conta: Task;

  beforeEach(() => {
    const r = evoluirConfiguracaoDeSolicitacoes(state, MARYANE, COM_MEMBRO);
    if (!r.ok) throw new Error(r.error);
    agente = agenteDoPipeline(state);
    conta = contaEmLancamento(state);
  });

  it("1. vê a conta a pagar, no Espaço privado \"Gestão\"", () => {
    expect(derive.memberSeesTask(state, agente.id, conta.id)).toBe(true);
  });

  it("2. comenta na conta (a recusa que a ponte escreve, com o Agente como autor)", () => {
    const r = addTaskComment(state, agente.id, conta.id, {
      content: "Não consegui lançar no Omie: teste.",
      mentions: [{ type: "member", id: CP.financeiroId }],
      actor: { kind: "agent", id: CP.agentId },
    });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
  });

  it("3 e 4. publica o Resumo pelo runLancamentoAgent e move a conta para \"lançado omie\" — a transação da ponte", () => {
    const resumo = runLancamentoAgent(state, agente.id, CP.agentId, conta.id, INVOCADOR_DO_LANCAMENTO, { dePara: DE_PARA, rehearsal: false });
    expect(resumo.ok, resumo.ok ? "" : resumo.error).toBe(true);
    expect(conta.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO") && c.author.kind === "agent")).toBe(true);

    const movida = changeTaskStatus(state, agente.id, conta.id, CP.status.lancado);
    expect(movida.ok, movida.ok ? "" : movida.error).toBe(true);
    expect(conta.statusId).toBe(CP.status.lancado);
    // A trilha diz quem moveu: o Membro de serviço, não uma pessoa.
    const registro = state.activity.find((a) => a.objectId === conta.id && a.action === "Status alterado" && a.after === "lançado omie");
    expect(registro?.actor).toEqual({ kind: "member", id: agente.id });
  });

  it("3b. quando o Agente recusa (categoria sem confiança), o pedido menciona o Financeiro — não o Membro de serviço, que ninguém lê", () => {
    const revisar: DeParaDeLancamento = {
      ...DE_PARA,
      categoriaPorCampo: { Impostos: { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.41, motivo: "duas categorias empatadas" } },
    };
    const r = runLancamentoAgent(state, agente.id, CP.agentId, conta.id, INVOCADOR_DO_LANCAMENTO, { dePara: revisar, rehearsal: false });
    expect(r.ok).toBe(false);
    const pedido = conta.comments.find((c) => c.content.startsWith("Não lancei no Omie"));
    expect(pedido?.mentions).toEqual([{ type: "member", id: CP.financeiroId }]);
    expect(pedido?.authorDelegate).toEqual({ kind: "member", id: agente.id });
  });

  it("5. roda a agenda de Automações de Contas a pagar e de Contas a receber", () => {
    const hoje = new Date(2026, 8, 28, 12);
    const cp = runScheduledAutomations(state, agente.id, CP.listId, hoje);
    expect(cp.ok, cp.ok ? "" : cp.error).toBe(true);
    const cr = runScheduledAutomations(state, agente.id, CR.listId, hoje);
    expect(cr.ok, cr.ok ? "" : cr.error).toBe(true);
  });

  it("e continua Convidado: não edita Campo, título, nem cria conta", () => {
    expect(setTaskFieldValue(state, agente.id, conta.id, F.valor, 999).ok).toBe(false);
    expect(updateTask(state, agente.id, conta.id, { title: "outro" }).ok).toBe(false);
    expect(createTask(state, agente.id, { listId: CP.listId, title: "conta do agente" }).ok).toBe(false);
  });
});
