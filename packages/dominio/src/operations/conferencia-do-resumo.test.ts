/**
 * A Conferência do Resumo nasce (Fase 6, Fluxos 5 e 6 — 06-01 Task 1): o
 * Agente publica o RESUMO no fio da conta ANTES do lançamento, aberto ao
 * Financeiro, e abre uma `ApprovalRequest` de processo com `processStep:
 * "resumo"` que guarda a tripla conta · categoria · código e a impressão de
 * lançamento como DADO (D6-10) — nunca relida do texto.
 *
 * `state.activity` é newest-first (`recordActivity` faz `unshift`): Registros
 * são achados por `objectId`/`action`, nunca por índice.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { ApprovalRequest, Comment, Task } from "../types";
import { addTaskComment, trashTask } from "./tasks";
import {
  buildResumoDePagamento,
  classificarRespostaDeConferencia,
  conferenciaDoResumo,
  CP,
  impressaoDeLancamento,
  publicarResumoParaConferencia,
  respostasDeConferenciaPendentes,
  revisoresDoResumo,
  TEXTOS_DA_CONFERENCIA,
  type DeParaDeLancamento,
} from "./financeiro";

let state: DataState;

function conta(id: string): Task {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

/** `tsk_cp_das`: "para pagar", Boleto completo, Tag "conta tria", Categoria "Impostos" — passa por `erpMissingFields`. */
const das = () => conta("tsk_cp_das");

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

const DE_PARA_REVISAR: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "revisar", nome: "Taxas diversas", codigo: "2.06.09", similaridade: 0.61, motivo: "nome parecido com duas categorias" } },
  origem: "omie",
};

const publicar = (opcoes: Partial<Parameters<typeof publicarResumoParaConferencia>[3]> = {}, ator: string = CP.financeiroId, taskId: string = das().id) =>
  publicarResumoParaConferencia(state, ator, taskId, { dePara: DE_PARA, ...opcoes });

const conferenciasDe = (taskId: string): ApprovalRequest[] =>
  state.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.processStep === "resumo" && a.origin.taskId === taskId);

const nome = (id: string) => state.members.find((m) => m.id === id)?.displayName ?? id;

/** O retrato do que uma recusa não pode ter mudado. */
function retrato(taskId: string) {
  const t = conta(taskId);
  return { comments: t.comments.length, approvals: state.approvals.length, activity: state.activity.length, executions: state.agentExecutions.length, statusId: t.statusId };
}

beforeEach(() => {
  state = buildSeed();
});

describe("(a) impressaoDeLancamento: o que vai ao Omie, e nada além", () => {
  it("é determinística e muda com cada dado que vai ao Omie", () => {
    const t = das();
    const base = impressaoDeLancamento(state, t);
    expect(impressaoDeLancamento(state, t)).toBe(base);
    expect(() => JSON.parse(base)).not.toThrow();

    const muda = (mexer: (x: Task) => void, rotulo: string) => {
      const antes = impressaoDeLancamento(state, t);
      const copia = structuredClone(t);
      mexer(copia);
      expect(impressaoDeLancamento(state, copia), rotulo).not.toBe(antes);
    };
    const campo = (id: string, valor: string | number) => (x: Task) => {
      const fv = x.fieldValues.find((f) => f.definitionId === id && f.state === "ativo");
      if (fv) (fv as { value: unknown }).value = valor;
      else x.fieldValues.push({ ...structuredClone(x.fieldValues[0]!), definitionId: id, value: valor, state: "ativo" } as Task["fieldValues"][number]);
    };
    const kopsTag = state.tags.find((tag) => tag.name === "conta kops");
    if (!kopsTag) throw new Error("sem Tag conta kops");

    muda(campo(CP.fields.valor, 99), "Valor");
    muda(campo(CP.fields.categoria, "Ferramentas"), "Categoria");
    muda((x) => (x.dueDate = { form: "civilDay", value: "2031-01-02" }), "vencimento");
    muda((x) => (x.tagIds = [kopsTag.id]), "Tag conta *");
    muda((x) => (x.title = "Outro título"), "título");
    muda((x) => (x.description = "Outra descrição"), "descrição");
    muda(campo(CP.fields.dataEmissao, "2026-09-01"), "Data de Emissão");
  });

  it("não muda com Anexo, Boleto, QR Code ou Comentários", () => {
    const t = das();
    const antes = impressaoDeLancamento(state, t);
    const copia = structuredClone(t);
    const boleto = copia.fieldValues.find((f) => f.definitionId === CP.fields.boleto && f.state === "ativo");
    if (boleto) (boleto as { value: unknown }).value = "outro-boleto.pdf";
    for (const id of [CP.fields.anexo, CP.fields.qrCode]) {
      copia.fieldValues.push({ ...structuredClone(copia.fieldValues[0]!), definitionId: id, value: "arquivo.pdf", state: "ativo" } as Task["fieldValues"][number]);
    }
    copia.comments.push({ id: "cmt_x", author: { kind: "member", id: CP.financeiroId }, content: "qualquer", attachments: [], mentions: [], createdAt: new Date().toISOString() });
    expect(impressaoDeLancamento(state, copia)).toBe(antes);
  });
});

describe("(b) revisoresDoResumo (D6-09)", () => {
  it("o Financeiro ativo e todo Membro ativo Administrador/Proprietário, sem duplicatas", () => {
    const revisores = revisoresDoResumo(state);
    expect(revisores[0]).toBe(CP.financeiroId);
    const esperados = state.members
      .filter((m) => m.state === "ativo" && ["administrador", "proprietario"].includes(state.roles.find((r) => r.id === m.roleId)?.base ?? ""))
      .map((m) => m.id);
    expect(esperados.length).toBeGreaterThan(0);
    for (const id of esperados) expect(revisores).toContain(id);
    expect(new Set(revisores).size).toBe(revisores.length);
    // Um Membro comum que não é o Financeiro não confere.
    expect(revisores).not.toContain(CP.aprovadorId);
  });

  it("o Financeiro que é também Proprietário aparece uma vez; removido, não entra", () => {
    const maryane = state.members.find((m) => m.id === CP.financeiroId);
    if (!maryane) throw new Error("sem Financeiro");
    maryane.roleId = "role_prop";
    expect(revisoresDoResumo(state).filter((id) => id === CP.financeiroId)).toHaveLength(1);
    maryane.state = "removido";
    expect(revisoresDoResumo(state)).not.toContain(CP.financeiroId);
  });
});

describe("(c) publicarResumoParaConferencia: o Resumo nasce aberto", () => {
  it("um Comentário raiz do Agente, o RESUMO byte a byte seguido da chamada, e UMA Conferência com a tripla como dado", () => {
    const t = das();
    const antes = retrato(t.id);
    const r = publicar();
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    const { comentario, conferencia, resumo } = r.value;

    expect(t.comments.length).toBe(antes.comments + 1);
    const esperado = buildResumoDePagamento(state, t, DE_PARA);
    expect(comentario.content.startsWith(esperado.texto)).toBe(true);
    expect(comentario.content.endsWith(`${nome(CP.financeiroId)}, confira: responda "ok" para eu lançar, ou diga o que ajustar.`)).toBe(true);
    expect(comentario.content).toBe(`${esperado.texto}${TEXTOS_DA_CONFERENCIA.chamada(nome(CP.financeiroId))}`);
    expect(comentario.author).toEqual({ kind: "agent", id: CP.agentId });
    expect(comentario.authorDelegate).toEqual({ kind: "member", id: CP.financeiroId });
    expect(comentario.mentions).toContainEqual({ type: "member", id: CP.financeiroId });
    expect(comentario.parentCommentId).toBeUndefined();
    expect(comentario.resolved).toBeUndefined();

    expect(conferenciasDe(t.id)).toHaveLength(1);
    expect(conferencia.origin).toEqual({
      kind: "processTask",
      taskId: t.id,
      processStep: "resumo",
      threadCommentId: comentario.id,
      resumoCommentId: comentario.id,
      impressao: impressaoDeLancamento(state, t),
      lancamento: { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01", veredito: "resolvida" },
    });
    expect(resumo.codigo).toBe("2.06.01");
    expect(conferencia.approverMemberId).toBe(CP.financeiroId);
    expect(conferencia.reason).toBe("processo");
    expect(conferencia.object.targetResourceId).toBe(t.id);
    expect(conferencia.decision).toBeUndefined();
    // Conferir não é um passo de Status.
    expect(t.statusId).toBe(antes.statusId);

    const execucao = state.agentExecutions.filter((e) => e.anchor?.id === t.id).at(-1);
    expect(execucao?.rehearsal).toBe(false);
    expect(execucao?.steps[0]).toMatchObject({ kind: "raciocinio", input: "de-para ERP (omie)", output: "Conta TRIA · Impostos e taxas · 2.06.01" });
    expect(execucao?.steps[1]).toMatchObject({ toolId: "criar_comentario", result: "concluido" });

    const registro = state.activity.find((a) => a.objectId === t.id && a.action === "Resumo de pagamento publicado para conferência");
    expect(registro?.detail).toBe("TRIA · Impostos e taxas · 2.06.01");
    expect(state.activity.some((a) => a.objectId === conferencia.id && a.action === "Conferência do Resumo aberta")).toBe(true);
  });
});

describe("(d) idempotência", () => {
  it("de novo com a mesma impressão e Conferência pendente: ok, nada novo", () => {
    const primeira = publicar();
    if (!primeira.ok) throw new Error(primeira.error);
    const antes = retrato(das().id);
    const segunda = publicar();
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.value.conferencia.id).toBe(primeira.value.conferencia.id);
    expect(segunda.value.comentario.id).toBe(primeira.value.comentario.id);
    expect(retrato(das().id)).toEqual(antes);
  });
});

describe("(e) o Resumo revisado no mesmo fio", () => {
  it("com pedido de revisão: resposta no fio, a Conferência anterior cancelada, a nova aponta para o raiz e para o Comentário novo", () => {
    const primeira = publicar();
    if (!primeira.ok) throw new Error(primeira.error);
    const raiz = primeira.value.comentario;

    const r = publicar({ pedidoDeRevisao: "é comercial, não ADM", pedidoPor: CP.financeiroId });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.comentario.id).not.toBe(raiz.id);
    expect(r.value.comentario.parentCommentId).toBe(raiz.id);
    expect(r.value.comentario.content).toContain(`Revisado a pedido de ${nome(CP.financeiroId)}: "é comercial, não ADM".`);
    expect(r.value.comentario.content.startsWith("📋 RESUMO DE PAGAMENTO")).toBe(true);

    const anterior = state.approvals.find((a) => a.id === primeira.value.conferencia.id);
    expect(anterior?.decision).toBe("cancelada");
    expect(state.activity.some((a) => a.objectId === anterior?.id && a.action === "Conferência superada")).toBe(true);

    const origem = r.value.conferencia.origin;
    expect(origem.threadCommentId).toBe(raiz.id);
    expect(origem.resumoCommentId).toBe(r.value.comentario.id);
    expect(conferenciaDoResumo(state, das()).conferencia?.id).toBe(r.value.conferencia.id);
  });

  it("com a impressão diferente: republica com o texto de dados que mudaram, no mesmo fio", () => {
    const primeira = publicar();
    if (!primeira.ok) throw new Error(primeira.error);
    das().title = "DAS — Simples Nacional (competência 09)";

    const r = publicar({ motivo: "dados-mudaram" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.comentario.parentCommentId).toBe(primeira.value.comentario.id);
    expect(r.value.comentario.content).toContain("Os dados da conta mudaram depois da conferência.");
    expect(r.value.comentario.content).toContain(`${nome(CP.financeiroId)}, confira de novo: responda "ok" para eu lançar, ou diga o que ajustar.`);
    expect(state.approvals.find((a) => a.id === primeira.value.conferencia.id)?.decision).toBe("cancelada");
    expect(r.value.conferencia.origin.impressao).toBe(impressaoDeLancamento(state, das()));
  });
});

describe("(f) conta incompleta", () => {
  it("falta dado do Omie: fail nomeando os Campos, nada gravado", () => {
    const t = das();
    t.fieldValues = t.fieldValues.filter((f) => f.definitionId !== CP.fields.nomeFornecedor && f.definitionId !== CP.fields.valor);
    const antes = retrato(t.id);
    const r = publicar();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const nomeDe = (id: string) => state.fieldDefinitions.find((d) => d.id === id)?.name ?? id;
    expect(r.error).toContain(nomeDe(CP.fields.valor));
    expect(r.error).toContain(nomeDe(CP.fields.nomeFornecedor));
    expect(retrato(t.id)).toEqual(antes);
  });
});

describe("(g) categoria a revisar", () => {
  it("o Resumo sai como `buildResumoDePagamento` o monta, e a Conferência nasce com veredito revisar", () => {
    const t = das();
    const r = publicar({ dePara: DE_PARA_REVISAR });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.comentario.content.startsWith(buildResumoDePagamento(state, t, DE_PARA_REVISAR).texto)).toBe(true);
    expect(r.value.comentario.content).toContain("Código:         2.06.09\n");
    expect(r.value.comentario.content).not.toContain("(revisar)");
    expect(r.value.conferencia.origin.lancamento).toEqual({ conta: "TRIA", categoria: "Taxas diversas", codigo: "2.06.09", veredito: "revisar" });
  });
});

describe("(h) recusas sem efeito", () => {
  it("Agente inativo", () => {
    const agente = state.agents.find((a) => a.id === CP.agentId);
    if (!agente) throw new Error("sem Agente");
    agente.lifecycle = "pausado";
    const antes = retrato(das().id);
    const r = publicar();
    expect(r.ok).toBe(false);
    expect(retrato(das().id)).toEqual(antes);
  });

  it("Tarefa fora da Lista de Contas a pagar", () => {
    const fora = state.tasks.find((t) => t.listId !== CP.listId && t.comments !== undefined);
    if (!fora) throw new Error("sem Tarefa fora da Lista");
    const antes = { comments: fora.comments.length, approvals: state.approvals.length, activity: state.activity.length };
    const r = publicar({}, CP.financeiroId, fora.id);
    expect(r.ok).toBe(false);
    expect({ comments: fora.comments.length, approvals: state.approvals.length, activity: state.activity.length }).toEqual(antes);
  });

  it("conta na lixeira", () => {
    const lixo = trashTask(state, CP.financeiroId, das().id);
    expect(lixo.ok, lixo.ok ? "" : lixo.error).toBe(true);
    const antes = retrato(das().id);
    const r = publicar();
    expect(r.ok).toBe(false);
    expect(retrato(das().id)).toEqual(antes);
  });

  it("ator sem alcance", () => {
    const semAlcance = "mem_julia";
    const antes = retrato(das().id);
    const r = publicar({}, semAlcance);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Quem invoca não alcança a Tarefa.");
    expect(retrato(das().id)).toEqual(antes);
  });
});

describe("(i) conferenciaDoResumo", () => {
  it("sem-resumo → pendente → conferida / ajuste-pedido → desatualizada; canceladas não contam", () => {
    const t = das();
    expect(conferenciaDoResumo(state, t).estado).toBe("sem-resumo");
    expect(conferenciaDoResumo(state, t).impressaoAtual).toBe(impressaoDeLancamento(state, t));

    const r = publicar();
    if (!r.ok) throw new Error(r.error);
    expect(conferenciaDoResumo(state, t)).toMatchObject({ estado: "pendente", conferencia: { id: r.value.conferencia.id } });

    const aprovada = state.approvals.find((a) => a.id === r.value.conferencia.id);
    if (!aprovada) throw new Error("sem Conferência");
    aprovada.decision = "aprovada";
    expect(conferenciaDoResumo(state, t).estado).toBe("conferida");
    aprovada.decision = "rejeitada";
    expect(conferenciaDoResumo(state, t).estado).toBe("ajuste-pedido");

    // Qualquer decisão fica velha quando a conta muda.
    t.description = "Imposto mensal — retificado";
    expect(conferenciaDoResumo(state, t).estado).toBe("desatualizada");
    aprovada.decision = "aprovada";
    expect(conferenciaDoResumo(state, t).estado).toBe("desatualizada");
    aprovada.decision = undefined;
    expect(conferenciaDoResumo(state, t).estado).toBe("desatualizada");

    // Uma Conferência cancelada é ignorada — mesmo sendo a única.
    aprovada.decision = "cancelada";
    expect(conferenciaDoResumo(state, t).estado).toBe("sem-resumo");
  });

  it("a vigente é a mais recente não cancelada", () => {
    const t = das();
    const primeira = publicar();
    if (!primeira.ok) throw new Error(primeira.error);
    const segunda = publicar({ pedidoDeRevisao: "trocar a conta" });
    if (!segunda.ok) throw new Error(segunda.error);
    expect(conferenciaDoResumo(state, t).conferencia?.id).toBe(segunda.value.conferencia.id);
  });
});

describe("(j) respostasDeConferenciaPendentes", () => {
  function responder(autor: string, content: string, raizId: string): Comment {
    const r = addTaskComment(state, autor, das().id, { content, parentCommentId: raizId });
    if (!r.ok) throw new Error(`${autor}: ${r.error}`);
    return r.value;
  }

  it("só respostas de revisores ao fio, depois do Resumo vigente, sem as do Agente nem as canônicas, por createdAt", () => {
    const t = das();
    const r = publicar();
    if (!r.ok) throw new Error(r.error);
    const raiz = r.value.comentario.id;
    const admin = revisoresDoResumo(state).find((id) => id !== CP.financeiroId);
    if (!admin) throw new Error("sem Administrador");

    const doAdmin = responder(admin, "mude para 2.02.98", raiz);
    const daMaryane = responder(CP.financeiroId, "ok", raiz);
    // Força a ordem por createdAt ao contrário da ordem de gravação.
    t.comments = t.comments.map((c) => (c.id === doAdmin.id ? { ...c, createdAt: "2099-01-02T00:00:00.000Z" } : c.id === daMaryane.id ? { ...c, createdAt: "2099-01-01T00:00:00.000Z" } : c));

    // Fora: Agente, Membro fora da lista, canônicas, raiz solto.
    const agente = addTaskComment(state, CP.financeiroId, t.id, { content: "ok", parentCommentId: raiz, actor: { kind: "agent", id: CP.agentId } });
    expect(agente.ok).toBe(true);
    responder(CP.aprovadorId, "ok", raiz);
    responder(admin, `✅ Resumo conferido por ${nome(admin)}`, raiz);
    responder(admin, "🔁 Ajuste pedido por alguém: x", raiz);
    responder(admin, "⚠️ aviso", raiz);
    addTaskComment(state, CP.financeiroId, t.id, { content: "ok, mas fora do fio" });

    expect(respostasDeConferenciaPendentes(state, t).map((c) => c.id)).toEqual([daMaryane.id, doAdmin.id]);
  });

  it("respostas ao Resumo anterior não contam depois do Resumo revisado; decidida, nada pendente", () => {
    const t = das();
    const r = publicar();
    if (!r.ok) throw new Error(r.error);
    responder(CP.financeiroId, "é comercial", r.value.comentario.id);
    const revisado = publicar({ pedidoDeRevisao: "é comercial" });
    if (!revisado.ok) throw new Error(revisado.error);
    expect(respostasDeConferenciaPendentes(state, t)).toEqual([]);

    const nova = responder(CP.financeiroId, "ok", r.value.comentario.id);
    expect(respostasDeConferenciaPendentes(state, t).map((c) => c.id)).toEqual([nova.id]);

    const vigente = state.approvals.find((a) => a.id === revisado.value.conferencia.id);
    if (!vigente) throw new Error("sem Conferência");
    vigente.decision = "aprovada";
    expect(respostasDeConferenciaPendentes(state, t)).toEqual([]);
  });
});

describe("(k) classificarRespostaDeConferencia — pura, sem IA", () => {
  it.each(["ok", "OK!", "aprovado", "conferido", "pode lançar", "pode seguir", "certo", "correto", "liberado", "👍"])("%j → aprovacao", (texto) => {
    expect(classificarRespostaDeConferencia(texto)).toBe("aprovacao");
  });

  it.each(["está errado, é comercial", "mude a categoria", "não, é 2.02.98", "reprovado", "ajustar a conta", "não aprovado", "não está certo"])("%j → ajuste", (texto) => {
    expect(classificarRespostaDeConferencia(texto)).toBe("ajuste");
  });

  it.each(["?", "pode lançar?", "aguardando a nota", "vou verificar", "", "   "])("%j → ignorar", (texto) => {
    expect(classificarRespostaDeConferencia(texto)).toBe("ignorar");
  });

  it("texto sem palavra reconhecida é ajuste (Fluxo 6: toda resposta de revisor é revisão)", () => {
    expect(classificarRespostaDeConferencia("segunda-feira")).toBe("ajuste");
  });
});
