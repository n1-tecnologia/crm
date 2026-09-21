/**
 * D-03 (autoria) e o achado 3 de 02-RESEARCH.md (atomicidade): o envio
 * anônimo de um Formulário é Ator próprio — nunca o dono, que só empresta
 * autorização e propriedade — e nasce completo, Campos e anexos juntos,
 * antes de qualquer automação enxergar a Tarefa.
 *
 * Fixture: três Campos reais de `docs/07-processos/solicitacao-de-pagamento.md`
 * §4 (Centro de Custo — obrigatório, singleSelect; Valor — currency; Anexo —
 * arquivo) mais um Fornecedor de texto livre, só para ter um Campo depois do
 * que falha em (d) — a prova de que uma recusa no meio não deixa resíduo.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Form } from "../types";
import { createFieldDefinition } from "./configuration";
import { createForm, formActor, submitForm, type SubmitFormInput } from "./scale";

const LISTA = "lst_prospeccao";
const DONO = "mem_thiago";

/** `fd_centro` ("Centro de custo", singleSelect) já existe no seed em `spc_com`, ancestral de `lst_prospeccao`. */
const CENTRO_DE_CUSTO_ID = "fd_centro";

function montarFormulario(state: DataState): {
  form: Form;
  centroDeCustoId: string;
  valorId: string;
  anexoId: string;
  fornecedorId: string;
} {
  const valor = createFieldDefinition(state, DONO, {
    name: "Valor",
    type: "currency",
    required: false,
    definedAtType: "list",
    definedAtId: LISTA,
  });
  if (!valor.ok) throw new Error(valor.error);
  const fornecedor = createFieldDefinition(state, DONO, {
    name: "Fornecedor",
    type: "text",
    required: false,
    definedAtType: "list",
    definedAtId: LISTA,
  });
  if (!fornecedor.ok) throw new Error(fornecedor.error);
  const anexo = createFieldDefinition(state, DONO, {
    name: "Anexo",
    type: "file",
    required: false,
    definedAtType: "list",
    definedAtId: LISTA,
  });
  if (!anexo.ok) throw new Error(anexo.error);

  const form = createForm(state, DONO, LISTA, {
    name: "Solicitação de pagamento",
    questions: [
      { label: "Assunto", required: true, target: { kind: "title" } },
      { label: "Centro de Custo", required: true, target: { kind: "field", definitionId: CENTRO_DE_CUSTO_ID } },
      { label: "Valor", required: false, target: { kind: "field", definitionId: valor.value.id } },
      { label: "Fornecedor", required: false, target: { kind: "field", definitionId: fornecedor.value.id } },
      { label: "Anexo", required: false, target: { kind: "field", definitionId: anexo.value.id } },
    ],
  });
  if (!form.ok) throw new Error(form.error);

  return {
    form: form.value,
    centroDeCustoId: CENTRO_DE_CUSTO_ID,
    valorId: valor.value.id,
    anexoId: anexo.value.id,
    fornecedorId: fornecedor.value.id,
  };
}

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

describe("submitForm — autoria anônima e atomicidade (D-03, achado 3)", () => {
  it("(a) envio válido: uma Tarefa nova com proveniência form, e um único Registro de Atividade do Ator sistema/Formulário", () => {
    const { form, centroDeCustoId } = montarFormulario(state);
    const q = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    if (!q) throw new Error("sem pergunta de Centro de Custo");
    const antesTasks = state.tasks.length;
    const envio = submitForm(state, form.secret, {
      answers: { [form.questions[0]!.id]: "Combustível de frota", [q.id]: "Comercial" },
    });
    expect(envio.ok, envio.ok ? "" : envio.error).toBe(true);
    if (!envio.ok) return;
    expect(state.tasks.length).toBe(antesTasks + 1);
    expect(envio.value.provenance?.kind).toBe("form");
    const registros = state.activity.filter((a) => a.objectId === envio.value.id);
    expect(registros).toHaveLength(1);
    expect(registros[0]!.actor.kind).toBe("system");
    expect(registros[0]!.actor.id.startsWith("formulario:")).toBe(true);
  });

  it("(b) nenhum Registro de Atividade do envio tem Ator igual ao Membro dono do Formulário", () => {
    const { form, centroDeCustoId } = montarFormulario(state);
    const q = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    if (!q) throw new Error("sem pergunta");
    const envio = submitForm(state, form.secret, { answers: { [form.questions[0]!.id]: "Pedido", [q.id]: "Comercial" } });
    expect(envio.ok, envio.ok ? "" : envio.error).toBe(true);
    if (!envio.ok) return;
    const comActorDoDono = state.activity.filter((a) => a.actor.kind === "member" && a.actor.id === form.ownerMemberId && a.objectId === envio.value.id);
    expect(comActorDoDono).toHaveLength(0);
  });

  it("(c) a Tarefa nasce com todos os Campos respondidos, e a Atividade do envio é posterior (ou igual) ao último setTaskFieldValue", () => {
    const { form, centroDeCustoId, valorId } = montarFormulario(state);
    const qCentro = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    const qValor = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === valorId);
    if (!qCentro || !qValor) throw new Error("sem perguntas");
    const envio = submitForm(state, form.secret, {
      answers: { [form.questions[0]!.id]: "Pedido", [qCentro.id]: "Comercial", [qValor.id]: "150,50" },
    });
    expect(envio.ok, envio.ok ? "" : envio.error).toBe(true);
    if (!envio.ok) return;
    expect(envio.value.fieldValues.find((v) => v.definitionId === centroDeCustoId)?.value).toBe("Comercial");
    expect(envio.value.fieldValues.find((v) => v.definitionId === valorId)?.value).toBe(150.5);
    const registro = state.activity.find((a) => a.objectId === envio.value.id);
    if (!registro) throw new Error("sem registro");
    expect(Date.parse(registro.at)).toBeGreaterThanOrEqual(Date.parse(envio.value.updatedAt));
  });

  it("(d) resposta inválida num Campo do meio: fail, e tasks/activity/files/taskReadableId voltam ao estado anterior", () => {
    const { form, centroDeCustoId, valorId, fornecedorId } = montarFormulario(state);
    const qCentro = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    const qValor = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === valorId);
    const qFornecedor = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === fornecedorId);
    if (!qCentro || !qValor || !qFornecedor) throw new Error("sem perguntas");
    const antes = {
      tasks: [...state.tasks],
      activity: [...state.activity],
      files: [...state.files],
      readable: state.workspace.taskReadableId.next,
    };
    const envio = submitForm(state, form.secret, {
      answers: {
        [form.questions[0]!.id]: "Pedido",
        [qCentro.id]: "Comercial",
        [qValor.id]: "não é número", // Campo do meio: Fornecedor viria depois, e nunca é alcançado.
        [qFornecedor.id]: "ACME",
      },
    });
    expect(envio.ok).toBe(false);
    expect(state.tasks).toEqual(antes.tasks);
    expect(state.activity).toEqual(antes.activity);
    expect(state.files).toEqual(antes.files);
    expect(state.workspace.taskReadableId.next).toBe(antes.readable);
  });

  it("(e) segredo inexistente, Formulário pausado e Formulário desatualizado preservam as três mensagens", () => {
    const { form, centroDeCustoId } = montarFormulario(state);
    const q = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    if (!q) throw new Error("sem pergunta");
    const entrada: SubmitFormInput = { answers: { [form.questions[0]!.id]: "Pedido", [q.id]: "Comercial" } };

    const inexistente = submitForm(state, "segredo-que-nao-existe", entrada);
    expect(inexistente.ok).toBe(false);
    if (!inexistente.ok) expect(inexistente.error).toBe("Este Formulário não existe mais ou o link foi renovado.");

    // Sem Membro admin, a chamada abaixo não altera enabled — usa o dono, que administra a Lista.
    const listaAntes = state.forms.find((f) => f.id === form.id);
    if (listaAntes) listaAntes.enabled = false;
    const pausado = submitForm(state, form.secret, entrada);
    expect(pausado.ok).toBe(false);
    if (!pausado.ok) expect(pausado.error).toBe("Este Formulário está pausado.");
    if (listaAntes) listaAntes.enabled = true;

    const novoCampo = createFieldDefinition(state, DONO, { name: "Categoria obrigatória", type: "text", required: true, definedAtType: "list", definedAtId: LISTA });
    expect(novoCampo.ok, novoCampo.ok ? "" : novoCampo.error).toBe(true);
    const desatualizado = submitForm(state, form.secret, entrada);
    expect(desatualizado.ok).toBe(false);
    if (!desatualizado.ok) expect(desatualizado.error).toBe("Este Formulário está desatualizado: peça a quem o enviou para revisá-lo.");
  });

  it("(f) pergunta obrigatória sem resposta: fail citando o rótulo", () => {
    const { form } = montarFormulario(state);
    const r = submitForm(state, form.secret, { answers: { [form.questions[0]!.id]: "Pedido" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Centro de Custo");
  });

  it("(g) anexo com questionId que não é pergunta de arquivo: fail e nenhum WorkspaceFile criado", () => {
    const { form, centroDeCustoId } = montarFormulario(state);
    const qCentro = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    if (!qCentro) throw new Error("sem pergunta");
    const antesFiles = state.files.length;
    const r = submitForm(state, form.secret, {
      answers: { [form.questions[0]!.id]: "Pedido", [qCentro.id]: "Comercial" },
      attachments: [{ questionId: qCentro.id, objectKey: "obj-errado", displayName: "nota.pdf", mediaType: "application/pdf", sizeBytes: 1024 }],
    });
    expect(r.ok).toBe(false);
    expect(state.files.length).toBe(antesFiles);
  });

  it("(h) dois anexos com o mesmo objectKey no mesmo envio: fail", () => {
    const { form, centroDeCustoId, anexoId } = montarFormulario(state);
    const qCentro = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    const qAnexo = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === anexoId);
    if (!qCentro || !qAnexo) throw new Error("sem perguntas");
    const r = submitForm(state, form.secret, {
      answers: { [form.questions[0]!.id]: "Pedido", [qCentro.id]: "Comercial" },
      attachments: [
        { questionId: qAnexo.id, objectKey: "duplicado", displayName: "nota.pdf", mediaType: "application/pdf", sizeBytes: 1024 },
        { questionId: qAnexo.id, objectKey: "duplicado", displayName: "comprovante.pdf", mediaType: "application/pdf", sizeBytes: 2048 },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("(i) envio com anexo válido: existe WorkspaceFile com o objectKey dado, createdBy.kind system, state enviado, ligado à Tarefa", () => {
    const { form, centroDeCustoId, anexoId } = montarFormulario(state);
    const qCentro = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    const qAnexo = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === anexoId);
    if (!qCentro || !qAnexo) throw new Error("sem perguntas");
    const r = submitForm(state, form.secret, {
      answers: { [form.questions[0]!.id]: "Pedido", [qCentro.id]: "Comercial" },
      attachments: [{ questionId: qAnexo.id, objectKey: "nf-2026-001", displayName: "nota-fiscal.pdf", mediaType: "application/pdf", sizeBytes: 4096, sha256: "abc123" }],
    });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    const arquivo = state.files.find((f) => f.objectKey === "nf-2026-001");
    expect(arquivo).toBeDefined();
    expect(arquivo?.createdBy.kind).toBe("system");
    expect(arquivo?.state).toBe("enviado");
    expect(arquivo?.sha256).toBe("abc123");
    const valorCampo = r.value.fieldValues.find((v) => v.definitionId === anexoId)?.value;
    expect(Array.isArray(valorCampo) && arquivo && valorCampo.includes(arquivo.id)).toBe(true);
  });

  it("(j) chaves extras (ownerId/status/taskId) na entrada não têm efeito: a Tarefa nasce com status inicial e id gerado", () => {
    const { form, centroDeCustoId } = montarFormulario(state);
    const qCentro = form.questions.find((x) => x.target.kind === "field" && x.target.definitionId === centroDeCustoId);
    if (!qCentro) throw new Error("sem pergunta");

    const baseline = submitForm(state, form.secret, { answers: { [form.questions[0]!.id]: "Base", [qCentro.id]: "Comercial" } });
    expect(baseline.ok, baseline.ok ? "" : baseline.error).toBe(true);
    if (!baseline.ok) return;
    const statusInicial = baseline.value.statusId;

    // Simula um payload de rede não confiável: chaves que a assinatura de `submitForm` nunca declarou.
    const entradaBruta: Record<string, unknown> = {
      answers: { [form.questions[0]!.id]: "Tentativa hostil", [qCentro.id]: "Comercial" },
      ownerId: "mem_julia",
      status: "aprovado",
      taskId: "tsk_forjado",
      actorId: "mem_julia",
    };
    const r = submitForm(state, form.secret, entradaBruta as unknown as SubmitFormInput);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).not.toBe("tsk_forjado");
    expect(r.value.statusId).toBe(statusInicial);
    expect(state.activity.some((a) => a.objectId === r.value.id && a.actor.id === "mem_julia")).toBe(false);
  });

  it("Ator do envio: formActor(formId) é kind system com id formulario:<id do Formulário>", () => {
    const { form } = montarFormulario(state);
    const actor = formActor(form.id);
    expect(actor.kind).toBe("system");
    expect(actor.id).toBe(`formulario:${form.id}`);
  });
});
