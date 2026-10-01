/**
 * Checklist 1.1–1.3, 1.6 e 1.8 — o Formulário público editável:
 *   - a Lista de Solicitações deixa de usar os Campos herdados que duplicam os
 *     dela (`usarCampoHerdado`, e o configurador);
 *   - perguntas com seção, ajuda e condição como dado, validadas;
 *   - o envio respeita o que está à mostra;
 *   - o Formulário da Solicitação nasce de dado (`garantirFormularioDaSolicitacao`);
 *   - remover o Membro dono não mata o link.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { effectiveListConfig } from "./derive";
import { garantirFormularioDaSolicitacao, NOME_DO_FORMULARIO_DA_SOLICITACAO } from "./formulario-da-solicitacao";
import { usarCampoHerdado } from "./operations/configuration";
import { CP } from "./operations/financeiro";
import { removeMember } from "./operations/members";
import { createForm, formBySecret, formOutdatedReason, perguntaVisivel, submitForm, updateForm, type FormInput } from "./operations/scale";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "./solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes, LISTA_ID } from "./solicitacao-de-pagamento-evolver";
import type { DataState } from "./state";
import type { Form, Member } from "./types";

const AGORA = "2026-10-01T12:00:00.000Z";
const MARYANE = "mem_maryane";
let state: DataState;

const campoSol = (rotulo: string) => {
  const c = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((x) => x.rotulo === rotulo);
  if (!c) throw new Error(rotulo);
  return c.id;
};
const valorNaTarefa = (taskId: string, definitionId: string) =>
  state.tasks.find((t) => t.id === taskId)?.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;

/** Um Administrador que alcança a Lista de Solicitações (o Espaço "Gestão" é privado). */
function membro(id: string, roleId: string): Member {
  const m: Member = {
    id,
    workspaceId: state.workspace.id,
    displayName: id,
    state: "ativo",
    roleId,
    availability: { value: "disponivel", at: AGORA, origin: "membro" },
    userMemory: { enabled: true, items: [] },
  };
  state.members.push(m);
  state.grants.push({
    id: `gr_teste_${id}`,
    workspaceId: state.workspace.id,
    subjectKind: "member",
    subjectId: id,
    action: "administrar",
    resourceType: "list",
    resourceId: LISTA_ID,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: MARYANE,
    grantedAt: AGORA,
  });
  return m;
}

beforeEach(() => {
  state = buildGestaoBootstrap({ agora: AGORA });
  const r = evoluirConfiguracaoDeSolicitacoes(state, MARYANE);
  if (!r.ok) throw new Error(r.error);
});

function formularioDaSolicitacao(): Form {
  const r = garantirFormularioDaSolicitacao(state, MARYANE);
  if (!r.ok) throw new Error(r.error);
  return r.value.form;
}

const idDe = (form: Form, label: string) => {
  const q = form.questions.find((x) => x.label === label);
  if (!q) throw new Error(label);
  return q.id;
};

describe("1.8 — o Formulário da Solicitação nasce de dado", () => {
  it("cria uma vez, com a ordem, as seções e as condições do UI-SPEC apontando para os ids definitivos", () => {
    const primeiro = garantirFormularioDaSolicitacao(state, MARYANE);
    if (!primeiro.ok) throw new Error(primeiro.error);
    expect(primeiro.value.criado).toBe(true);
    const form = primeiro.value.form;
    expect(form.name).toBe(NOME_DO_FORMULARIO_DA_SOLICITACAO);
    expect(form.description).toMatch(/^Preencha os dados do pagamento/);
    expect(form.questions.map((q) => q.label).slice(0, 5)).toEqual(["O que deve ser pago?", "O que é e como será utilizado?", "Nome do solicitante", "WhatsApp", "Centro de Custo"]);
    expect([...new Set(form.questions.map((q) => q.section))]).toEqual(["Sobre a solicitação", "Solicitante", "Classificação", "Fornecedor", "Documento e datas", "Pagamento"]);
    expect(form.questions.find((q) => q.label === "CNPJ")?.showWhen).toEqual({ questionId: idDe(form, "Fornecedor"), values: ["CNPJ"] });
    expect(form.questions.find((q) => q.label === "Link de pagamento")?.showWhen).toEqual({ questionId: idDe(form, "Forma de pagamento"), values: ["Cartão"] });
    expect(form.questions.every((q) => !q.id.startsWith("p_"))).toBe(true);
    expect(form.questions.filter((q) => q.required).map((q) => q.label)).toEqual(["O que deve ser pago?", "Centro de Custo"]);

    const segundo = garantirFormularioDaSolicitacao(state, MARYANE);
    if (!segundo.ok) throw new Error(segundo.error);
    expect(segundo.value).toEqual({ criado: false, form });
    expect(state.forms.filter((f) => f.listId === LISTA_ID)).toHaveLength(1);
  });
});

describe("1.1 — Campos herdados que a Lista não usa", () => {
  it("sem tirar os de Contas a pagar, o Formulário exigia um segundo Centro de Custo", () => {
    const lista = state.lists.find((l) => l.id === LISTA_ID)!;
    const foraAntes = lista.camposHerdadosFora;
    for (const id of foraAntes ?? []) {
      const r = usarCampoHerdado(state, MARYANE, "list", LISTA_ID, id, true);
      if (!r.ok) throw new Error(r.error);
    }
    const r = garantirFormularioDaSolicitacao(state, MARYANE);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("“Centro de Custo” é obrigatório nesta Lista") });
  });

  it("recusa um Campo que não é herdado, e um que um Formulário ativo pergunta", () => {
    expect(usarCampoHerdado(state, MARYANE, "list", LISTA_ID, campoSol("Valor"), false)).toMatchObject({ ok: false, error: expect.stringContaining("não é herdado aqui") });
    const fora = state.lists.find((l) => l.id === LISTA_ID)!.camposHerdadosFora ?? [];
    expect(fora).toContain(CP.fields.valor);
    const volta = usarCampoHerdado(state, MARYANE, "list", LISTA_ID, CP.fields.valor, true);
    expect(volta.ok).toBe(true);
    expect(effectiveListConfig(state, LISTA_ID)?.fieldDefinitionIds).toContain(CP.fields.valor);

    const form = createForm(state, MARYANE, LISTA_ID, {
      name: "Com o Valor de Contas a pagar",
      questions: [
        { label: "Assunto", required: true, target: { kind: "title" } },
        { label: "Centro", required: true, target: { kind: "field", definitionId: campoSol("Centro de Custo") } },
        { label: "Valor", required: false, target: { kind: "field", definitionId: CP.fields.valor } },
      ],
    });
    if (!form.ok) throw new Error(form.error);
    expect(usarCampoHerdado(state, MARYANE, "list", LISTA_ID, CP.fields.valor, false)).toMatchObject({ ok: false, error: expect.stringContaining("pergunta por “Valor”") });
  });
});

describe("1.2/1.3 — seção, ajuda e condição como dado", () => {
  const base = (extras: Partial<FormInput["questions"][number]>[] = []): FormInput => ({
    name: "Teste",
    questions: [
      { id: "a", label: "Assunto", required: true, target: { kind: "title" } },
      { id: "b", label: "Centro", required: true, target: { kind: "field", definitionId: campoSol("Centro de Custo") } },
      { id: "c", label: "Forma", required: false, target: { kind: "field", definitionId: campoSol("Forma de pagamento") } },
      ...extras.map((e, i) => ({ id: `x${i}`, label: `Extra ${i}`, required: false, target: { kind: "field" as const, definitionId: campoSol("Chave pix") }, ...e })),
    ],
  });

  it("recusa condição que aponta para a frente, para pergunta que não é de escolha, ou com valor que não existe", () => {
    const naFrente = base([{ showWhen: { questionId: "x1", values: ["Chave Pix"] } }, { target: { kind: "field", definitionId: campoSol("BU") } }]);
    expect(createForm(state, MARYANE, LISTA_ID, naFrente)).toMatchObject({ ok: false, error: expect.stringContaining("ANTERIOR") });
    expect(createForm(state, MARYANE, LISTA_ID, base([{ showWhen: { questionId: "a", values: ["x"] } }]))).toMatchObject({
      ok: false,
      error: expect.stringContaining("não é de escolha"),
    });
    expect(createForm(state, MARYANE, LISTA_ID, base([{ showWhen: { questionId: "c", values: ["Dinheiro"] } }]))).toMatchObject({
      ok: false,
      error: expect.stringContaining("“Dinheiro” não é uma resposta possível"),
    });
  });

  it("o título e o Campo obrigatório da Lista não podem ter condição", () => {
    const titulo = base();
    const comTitulo = { ...titulo, questions: titulo.questions.map((q) => (q.id === "a" ? { ...q, showWhen: { questionId: "c", values: ["Boleto"] } } : q)) };
    expect(createForm(state, MARYANE, LISTA_ID, comTitulo)).toMatchObject({ ok: false, error: expect.stringContaining("título aparece sempre") });
    const centro = { ...titulo, questions: titulo.questions.map((q) => (q.id === "b" ? { ...q, showWhen: { questionId: "c", values: ["Boleto"] } } : q)) };
    expect(createForm(state, MARYANE, LISTA_ID, { ...centro, questions: [centro.questions[0]!, centro.questions[2]!, centro.questions[1]!] })).toMatchObject({
      ok: false,
      error: expect.stringContaining("sem condição"),
    });
  });

  it("guarda seção e ajuda aparadas; ids provisórios viram definitivos e a condição acompanha; na edição, o id existente fica", () => {
    const r = createForm(state, MARYANE, LISTA_ID, base([{ section: "  Pagamento ", help: " A chave do fornecedor ", showWhen: { questionId: "c", values: ["Chave Pix"] } }]));
    if (!r.ok) throw new Error(r.error);
    const forma = r.value.questions[2]!;
    const chave = r.value.questions[3]!;
    const idsAntes = r.value.questions.map((q) => q.id);
    expect(chave).toMatchObject({ section: "Pagamento", help: "A chave do fornecedor", showWhen: { questionId: forma.id, values: ["Chave Pix"] } });

    const nova = updateForm(state, MARYANE, r.value.id, {
      questions: [
        ...r.value.questions.map((q) => ({ ...q })),
        { id: "provisorio_9", label: "Código", required: false, target: { kind: "field", definitionId: campoSol("Código de barras") }, showWhen: { questionId: forma.id, values: ["Boleto"] } },
      ],
    });
    if (!nova.ok) throw new Error(nova.error);
    expect(nova.value.questions.slice(0, 4).map((q) => q.id)).toEqual(idsAntes);
    expect(nova.value.questions[4]!.id).not.toBe("provisorio_9");
    expect(nova.value.questions[4]!.showWhen?.questionId).toBe(forma.id);
  });

  it("perguntaVisivel segue a cadeia: escondida a pergunta-gatilho, a que depende dela também some", () => {
    const perguntas = [
      { id: "f", showWhen: undefined },
      { id: "g", showWhen: { questionId: "f", values: ["sim"] } },
      { id: "h", showWhen: { questionId: "g", values: ["A"] } },
    ];
    expect(perguntaVisivel(perguntas, perguntas[2]!, { f: "sim", g: "A" })).toBe(true);
    expect(perguntaVisivel(perguntas, perguntas[2]!, { f: "não", g: "A" })).toBe(false);
    expect(perguntaVisivel(perguntas, perguntas[1]!, { f: " sim " })).toBe(true);
  });
});

describe("1.3 — o envio respeita o que está à mostra", () => {
  it("a resposta de uma pergunta escondida não entra; a obrigatória escondida não é exigida, a à mostra é", () => {
    const form = formularioDaSolicitacao();
    const respostas = (extra: Record<string, string>) => ({
      [idDe(form, "O que deve ser pago?")]: "TESTE AUTOMATIZADO — Formulário",
      [idDe(form, "Centro de Custo")]: "TRIA",
      ...extra,
    });

    const envio = submitForm(state, form.secret, {
      answers: respostas({ [idDe(form, "Fornecedor")]: "CNPJ", [idDe(form, "CNPJ")]: "11222333000181", [idDe(form, "CPF")]: "11144477735" }),
    });
    if (!envio.ok) throw new Error(envio.error);
    expect(valorNaTarefa(envio.value.id, campoSol("CNPJ"))).toBe("11222333000181");
    expect(valorNaTarefa(envio.value.id, campoSol("CPF"))).toBeUndefined();

    const comChaveObrigatoria = updateForm(state, MARYANE, form.id, {
      questions: form.questions.map((q) => (q.label === "Chave pix" ? { ...q, required: true } : { ...q })),
    });
    if (!comChaveObrigatoria.ok) throw new Error(comChaveObrigatoria.error);
    expect(submitForm(state, form.secret, { answers: respostas({ [idDe(form, "Forma de pagamento")]: "Boleto" }) }).ok).toBe(true);
    expect(submitForm(state, form.secret, { answers: respostas({ [idDe(form, "Forma de pagamento")]: "Chave Pix" }) })).toMatchObject({
      ok: false,
      error: "Responda “Chave pix”.",
    });
  });
});

describe("1.6 — remover o Membro dono não mata o link", () => {
  it("o Formulário passa ao Sucessor que alcança a Lista, e o link continua abrindo", () => {
    const dono = membro("mem_dono_do_form", "role_adm");
    const sucessor = membro("mem_sucessor", "role_adm");
    const r = garantirFormularioDaSolicitacao(state, dono.id);
    if (!r.ok) throw new Error(r.error);
    const segredo = r.value.form.secret;
    expect(formBySecret(state, segredo)).toBeDefined();

    const removido = removeMember(state, MARYANE, dono.id, sucessor.id);
    if (!removido.ok) throw new Error(removido.error);
    expect(r.value.form.ownerMemberId).toBe(sucessor.id);
    expect(formBySecret(state, segredo)?.id).toBe(r.value.form.id);
  });
});

describe("revisão de código — Campo herdado e condição quebrada", () => {
  it("quem administra só a Lista não tira um Campo que nasce no Espaço", () => {
    const so_lista = membro("mem_admin_so_da_lista", "role_mem");
    const fora = state.lists.find((l) => l.id === LISTA_ID)!.camposHerdadosFora ?? [];
    const valor = fora.find((id) => id === CP.fields.valor)!;
    const volta = usarCampoHerdado(state, MARYANE, "list", LISTA_ID, valor, true);
    if (!volta.ok) throw new Error(volta.error);
    expect(usarCampoHerdado(state, so_lista.id, "list", LISTA_ID, valor, false)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Só quem configura onde o Campo “Valor” nasce"),
    });
  });

  it("a condição que aponta para uma opção que saiu deixa o Formulário desatualizado (o link recusa)", () => {
    const form = formularioDaSolicitacao();
    expect(formOutdatedReason(state, form)).toBeUndefined();
    const forma = state.fieldDefinitions.find((d) => d.id === campoSol("Forma de pagamento"))!;
    (forma as { options?: readonly string[] }).options = (forma.options ?? []).filter((o) => o !== "Boleto");
    expect(formOutdatedReason(state, form)).toMatch(/A condição da pergunta “Código de barras” aponta para uma resposta que não existe mais em “Forma de pagamento”/);
  });
});
