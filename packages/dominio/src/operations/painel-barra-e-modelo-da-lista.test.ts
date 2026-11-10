/**
 * Leituras e regras que não dependem do CRM antigo no estado: o Widget do Painel sobre o CRM lido pela api
 * (`LeituraDoCrmParaPainel`), a Barra global (`notificacoesDoMembro`) e o Modelo de Tarefa da Lista (C35).
 * Eram blocos de `operations.test.ts` que montavam o CRM antigo semeado (`sobre-o-crm-antigo.test.ts`, 15-32);
 * na 15-42 o Painel passou a ler uma massa explícita (Funis, Etapas e Negócios abaixo), a Mensageria e o Rascunho
 * foram para `ferramentas/conversa-de-grupo.test.ts` e o Processo do Closer, que testava o seed do CRM antigo,
 * saiu com ele.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { ConversaNaLista } from "../crm/conversas";
import { isTerminalCategory, memberSeesResource, notificacoesDoMembro, statusCategory, tarefasAbertasDoMembro, widgetReading, type LeituraDoCrmParaPainel } from "../derive";
import type { DataState } from "../state";
import { canalDeTeste, conversaDeTeste } from "../testes/crm-de-teste";
import { TAREFA_SEM_CONTATO, createTask, moveTask } from "./tasks";
import { receiveMessage, sendMessage } from "./ferramentas/conversa-de-grupo";
import { createList } from "./structure";
import { FORMULARIO_EM_LISTA_CONVERSACIONAL, archiveForm, createForm, formBySecret, formOutdatedReason, submitForm, updateForm } from "./scale";
import { FORMULARIOS_ANTES_DO_MODELO, alterarModeloDaLista } from "./tarefas-conversacionais";
import { PAPEL_DO_VINCULO } from "../derive-conversacional";

const THIAGO = "mem_thiago";
const RAFAEL = "mem_rafael";
const JULIA = "mem_julia";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/**
 * O CRM como o Painel o lê desde o 15-23: as linhas das rotas, por argumento. Massa explícita e pequena:
 * dois Funis (SDR e Closer) com Etapas, Negócios abertos, ganho e perdido, e um Negócio em dólar para a
 * recusa de moedas misturadas.
 */
const FUNIS = [
  { id: "fnl_sdr", nome: "SDR" },
  { id: "fnl_closer", nome: "Closer" },
];
const ETAPAS = [
  { id: "sdr_novo", funilId: "fnl_sdr", nome: "Novo lead" },
  { id: "sdr_contato", funilId: "fnl_sdr", nome: "Contato feito" },
  { id: "clo_call", funilId: "fnl_closer", nome: "Call" },
  { id: "clo_proposta", funilId: "fnl_closer", nome: "Proposta" },
];
type NegocioDoPainel = LeituraDoCrmParaPainel["negocios"][number];
const negocio = (id: string, funilId: string, etapaId: string, extra: Partial<NegocioDoPainel> = {}): NegocioDoPainel => ({
  id,
  funilId,
  etapaId,
  situacao: "aberto",
  estado: "ativo",
  valor: null,
  moeda: "BRL",
  proprietarioId: THIAGO,
  encerradoEm: null,
  ...extra,
});
const NEGOCIOS: NegocioDoPainel[] = [
  negocio("neg_1", "fnl_sdr", "sdr_novo"),
  negocio("neg_2", "fnl_sdr", "sdr_novo"),
  negocio("neg_3", "fnl_sdr", "sdr_contato"),
  negocio("neg_4", "fnl_sdr", "sdr_contato", { situacao: "perdido", encerradoEm: "2026-10-02T10:00:00.000Z", motivoPerda: "Sem orçamento" }),
  negocio("neg_5", "fnl_closer", "clo_call", { valor: "1500", origem: "Indicação" }),
  negocio("neg_6", "fnl_closer", "clo_proposta", { valor: "3000", origem: "Anúncio" }),
  negocio("neg_7", "fnl_closer", "clo_proposta", { situacao: "ganho", valor: "5000", encerradoEm: "2026-10-05T10:00:00.000Z", origem: "Indicação" }),
  negocio("neg_8", "fnl_closer", "clo_call", { situacao: "perdido", valor: "800", encerradoEm: "2026-10-06T10:00:00.000Z", motivoPerda: "Foi para o concorrente" }),
];
function crmDoPainel(negocios: readonly NegocioDoPainel[] = NEGOCIOS): LeituraDoCrmParaPainel {
  return { negocios, conversas: [], contatos: [], funis: FUNIS, etapas: ETAPAS, parcial: false };
}

describe("Leitura de Widget e permissões do visualizador (RN-PAI-15, RN-PAI-13, B38a)", () => {
  const CONVIDADA = "mem_beatriz";

  const widgetDe = (panelId: string, widgetId: string) => {
    const panel = state.panels.find((p) => p.id === panelId);
    const widget = panel?.widgets.find((w) => w.id === widgetId);
    if (!widget) throw new Error(`seed sem widget ${widgetId}`);
    return widget;
  };

  it("conta Negócios por Etapa e nomeia cada Etapa, não o identificador", () => {
    const reading = widgetReading(state, widgetDe("pnl_sdr", "wg_sdr_funil"), THIAGO, new Date(), crmDoPainel());

    expect(reading.kind).toBe("serie");
    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.rows.length).toBeGreaterThan(0);
    const nomesDasEtapas = ETAPAS.filter((e) => e.funilId === "fnl_sdr").map((e) => e.nome);
    for (const row of reading.rows) {
      expect(nomesDasEtapas).toContain(row.label);
    }
    const somaDaSerie = reading.rows.reduce((total, row) => total + row.value, 0);
    const noFunil = NEGOCIOS.filter((d) => d.funilId === "fnl_sdr" && d.estado === "ativo");
    expect(somaDaSerie).toBe(noFunil.length);
  });

  it("soma dinheiro por moeda e nunca consolida (RN-PAI-13)", () => {
    const reading = widgetReading(state, widgetDe("pnl_closer", "wg_clo_valor"), THIAGO, new Date(), crmDoPainel());

    expect(reading.kind).toBe("moeda");
    if (reading.kind !== "moeda") throw new Error("esperava moeda");
    expect(reading.byCurrency.length).toBeGreaterThan(0);
    for (const entry of reading.byCurrency) {
      expect(entry.currency).not.toBe("");
      const esperado = NEGOCIOS.filter((d) => d.funilId === "fnl_closer" && d.estado === "ativo")
        .filter((d) => d.moeda === entry.currency)
        .reduce((total, d) => total + Number(d.valor ?? 0), 0);
      expect(entry.amount).toBe(esperado);
    }
  });

  it("devolve semAcesso, e não zero, quando o visualizador não alcança a Fonte", () => {
    const widget = widgetDe("pnl_ops", "wg_6");
    // A Convidada não tem concessão no Espaço de escopo deste Widget.
    expect(memberSeesResource(state, CONVIDADA, "spc_ops")).toBe(false);

    const reading = widgetReading(state, widget, CONVIDADA, new Date(), crmDoPainel());

    expect(reading.kind).toBe("semAcesso");
    // E a mesma leitura, para quem alcança, traz número: zero seria mentira.
    const daProprietaria = widgetReading(state, widget, THIAGO, new Date(), crmDoPainel());
    expect(daProprietaria.kind).toBe("serie");
  });

  it("B38a — um contêiner privado não existe nem para o Proprietário do Espaço de Trabalho", () => {
    const privado = state.spaces.find((space) => space.isPrivate);
    if (!privado) throw new Error("seed sem contêiner privado");
    const temConcessao = state.grants.some(
      (g) => g.resourceId === privado.id && g.subjectKind === "member" && g.subjectId === THIAGO,
    );

    expect(memberSeesResource(state, THIAGO, privado.id)).toBe(temConcessao);
  });
});

describe("Leitura de Widget: dimensões comerciais, moeda e Filtro fixo", () => {
  const ler = (widget: Parameters<typeof widgetReading>[1], negocios: readonly NegocioDoPainel[] = NEGOCIOS) =>
    widgetReading(state, widget, THIAGO, new Date(), crmDoPainel(negocios));

  const fonte = {
    target: "deal",
    scopeType: "funnel",
    scopeIds: ["fnl_closer"],
  } as const;

  it("nomeia o Motivo de Perda e a Origem, nunca o identificador", () => {
    const porMotivo = ler({
      viewType: "barras",
      dataSource: fonte,
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [{ attribute: "lossReasonId", label: "Motivo" }],
    });

    expect(porMotivo.kind).toBe("serie");
    if (porMotivo.kind !== "serie") throw new Error("esperava série");
    for (const row of porMotivo.rows) {
      expect(["Sem orçamento", "Foi para o concorrente"]).toContain(row.label);
      expect(row.label).not.toMatch(/^cat_/);
    }
  });

  it("capitaliza a Situação em vez de mostrar o valor interno", () => {
    const reading = ler({
      viewType: "pizza",
      dataSource: fonte,
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [{ attribute: "situation", label: "Situação" }],
    });

    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.rows.map((r) => r.label).sort()).toEqual(["Aberto", "Ganho", "Perdido"]);
  });

  it("carrega a moeda na série de dinheiro, para o valor não sair como número puro", () => {
    const reading = ler({
      viewType: "barras",
      dataSource: fonte,
      metrics: [{ aggregation: "soma", attribute: "value", label: "Valor ganho" }],
      dimensions: [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }],
    });

    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.currency).toBe("BRL");
  });

  it("recusa a série quando o recorte tem mais de uma moeda (RN-PAI-13)", () => {
    const emDolar = NEGOCIOS.map((d) => (d.id === "neg_5" ? { ...d, valor: "1000", moeda: "USD" } : d));

    const reading = ler({
      viewType: "barras",
      dataSource: fonte,
      metrics: [{ aggregation: "soma", attribute: "value", label: "Valor" }],
      dimensions: [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }],
    }, emDolar);

    expect(reading.kind).toBe("texto");
    if (reading.kind !== "texto") throw new Error("esperava recusa em texto");
    expect(reading.content).toContain("moedas");
  });

  it("aplica o Filtro fixo: o Widget rotulado 'em prospecção' não conta o que foi perdido", () => {
    const abertos = NEGOCIOS.filter((d) => d.funilId === "fnl_sdr" && d.estado === "ativo" && d.situacao === "aberto").length;

    const comFiltro = ler({
      viewType: "numero",
      dataSource: { target: "deal", scopeType: "funnel", scopeIds: ["fnl_sdr"] },
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [],
      fixedFilters: [
        { attribute: "situation", operator: "igualA", value: "Aberto", label: "Situação: aberto" },
      ],
    });
    const semFiltro = ler({
      viewType: "numero",
      dataSource: { target: "deal", scopeType: "funnel", scopeIds: ["fnl_sdr"] },
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [],
    });

    if (comFiltro.kind !== "numero" || semFiltro.kind !== "numero") throw new Error("esperava número");
    expect(comFiltro.value).toBe(abertos);
    expect(semFiltro.value).toBeGreaterThan(comFiltro.value);
  });
});

/** Uma Conversa do CRM novo, como `GET /conversas` a devolve: só o que a derivação lê. */
function conversaNaLista(id: string, atribuidoA: string): ConversaNaLista {
  return {
    id,
    canalId: "can_1",
    contatoId: "ctt_1",
    titulo: `Conversa ${id}`,
    tituloEditado: false,
    situacao: "aberta",
    estado: "ativo",
    naLixeiraEm: null,
    filaId: null,
    atribuido: { tipo: "membro", id: atribuidoA },
    adiadaAte: null,
    adiamentoMotivo: null,
    participantes: [],
    resolvidaEm: null,
    reabertaEm: null,
    reaberturas: 0,
    criadoPor: { tipo: "membro", id: atribuidoA },
    criadoEm: "2026-11-01T10:00:00.000Z",
    atualizadoEm: "2026-11-01T10:00:00.000Z",
    contatoNome: "Ana Souza",
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
  };
}

const SEM_CONVERSAS = { itens: [], total: 0 } as const;

describe("Barra global — o que espera pela pessoa (notificacoesDoMembro)", () => {
  it("o total é a soma dos seis grupos, filtrados pelo Membro", () => {
    const now = new Date();
    const n = notificacoesDoMembro(state, "mem_thiago", now, SEM_CONVERSAS);
    expect(n.total).toBe(n.aprovacoes.length + n.mencoes.length + n.conversas.length + n.vencidas.length + n.bloqueadas.length + n.execucoesFalhas.length);
    for (const a of n.aprovacoes) expect(a.approverMemberId).toBe("mem_thiago");
    for (const t of n.vencidas) expect(t.assignees.some((x) => x.kind === "member" && x.id === "mem_thiago")).toBe(true);
  });

  it("a aprovação de outro Membro não entra; as Tarefas abertas excluem as terminais", () => {
    const pendente = state.approvals.find((a) => a.decision === undefined);
    if (!pendente) throw new Error("sem aprovação pendente no seed");
    const outro = state.members.find((m) => m.id !== pendente.approverMemberId && m.state === "ativo");
    if (!outro) throw new Error("sem outro Membro");
    expect(notificacoesDoMembro(state, outro.id, new Date(), SEM_CONVERSAS).aprovacoes.some((a) => a.id === pendente.id)).toBe(false);
    const abertas = tarefasAbertasDoMembro(state, "mem_thiago");
    for (const t of abertas) expect(isTerminalCategory(statusCategory(state, t))).toBe(false);
  });

  it("15-14: as Conversas atribuídas vêm do argumento e o total geral soma o `total` dele", () => {
    const base = notificacoesDoMembro(state, "mem_thiago", new Date(), SEM_CONVERSAS);
    const duas = [conversaNaLista("cnv_1", "mem_thiago"), conversaNaLista("cnv_2", "mem_thiago")];
    const n = notificacoesDoMembro(state, "mem_thiago", new Date(), { itens: duas, total: 2 });
    expect(n.conversas.map((c) => c.id)).toEqual(["cnv_1", "cnv_2"]);
    expect(n.total).toBe(base.total + 2);
  });

  it("15-14: o `total` da api conta, não a página (20 itens de 57 Conversas)", () => {
    const base = notificacoesDoMembro(state, "mem_thiago", new Date(), SEM_CONVERSAS);
    const pagina = Array.from({ length: 20 }, (_, i) => conversaNaLista(`cnv_${i}`, "mem_thiago"));
    const n = notificacoesDoMembro(state, "mem_thiago", new Date(), { itens: pagina, total: 57 });
    expect(n.conversas).toHaveLength(20);
    expect(n.total).toBe(base.total + 57);
  });

  it("15-14: Conversas do modelo antigo atribuídas ao Membro não entram (nada vem de state.conversations)", () => {
    const base = notificacoesDoMembro(state, "mem_thiago", new Date(), SEM_CONVERSAS);
    const atribuida = conversaDeTeste("cnv_do_estado", "chn_x", "cnt_x");
    atribuida.assignee = { kind: "member", id: "mem_thiago" };
    state.conversations.push(atribuida);
    const antigas = state.conversations.filter((c) => c.assignee?.kind === "member" && c.assignee.id === "mem_thiago");
    expect(antigas.length).toBeGreaterThan(0);
    expect(base.conversas).toEqual([]);
    const sem = { ...state, conversations: [] } as DataState;
    expect(notificacoesDoMembro(sem, "mem_thiago", new Date(), SEM_CONVERSAS).total).toBe(base.total);
  });
});

/**
 * C35 — dois modelos de Tarefa. O modelo é da Lista (não da Tarefa): numa
 * Lista conversacional a Tarefa raiz nasce de um Contato e aponta para o CRM
 * só por Vínculos; a Lista operacional segue como sempre.
 */
describe("Modelo de Tarefa da Lista (C35)", () => {
  it("createList nasce operacional sem dizer o modelo; conversacional é gravado e nomeado na Atividade", () => {
    const padrao = createList(state, THIAGO, { name: "Onboarding", parentType: "space", parentId: "spc_com" });
    expect(padrao.ok).toBe(true);
    if (padrao.ok) expect(padrao.value.modeloDeTarefa).toBe("operacional");

    // C36 — a conversacional nasce dizendo por onde atende.
    const conversacional = createList(state, THIAGO, { name: "Suporte ao aluno", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: ["chn_wpp"] }, [canalDeTeste({ id: "chn_wpp" })]);
    expect(conversacional.ok).toBe(true);
    if (!conversacional.ok) return;
    expect(conversacional.value.modeloDeTarefa).toBe("conversacional");
    const atividade = state.activity.find((a) => a.action === "Lista criada" && a.objectId === conversacional.value.id);
    expect(atividade?.detail).toContain("Modelo conversacional: cada Tarefa nasce de um Contato");
  });

  it("alterarModeloDaLista: livre numa Lista vazia, recusado numa Lista que já tem Tarefas", () => {
    const vazia = createList(state, THIAGO, { name: "Renovações", parentType: "space", parentId: "spc_com" });
    if (!vazia.ok) throw new Error(vazia.error);
    const alterada = alterarModeloDaLista(state, THIAGO, vazia.value.id, "conversacional");
    expect(alterada.ok).toBe(true);
    if (alterada.ok) {
      expect(alterada.value.modeloDeTarefa).toBe("conversacional");
      expect(alterada.id).toBe(vazia.value.id);
    }
    expect(state.activity[0]?.action).toBe("Modelo de Tarefa alterado");
    expect(state.activity[0]?.before).toBe("operacional");
    expect(state.activity[0]?.after).toBe("conversacional");

    const cheia = alterarModeloDaLista(state, THIAGO, "lst_ativacao", "conversacional");
    expect(cheia.ok).toBe(false);
    if (!cheia.ok) expect(cheia.error).toBe("O modelo de Tarefa não muda numa Lista que já tem Tarefas.");
    expect(state.lists.find((l) => l.id === "lst_ativacao")?.modeloDeTarefa).toBe("operacional");
  });

  it("createTask numa Lista conversacional: sem Contato recusa; com o Vínculo nasce e o Link fica no estado", () => {
    const semContato = createTask(state, THIAGO, { listId: "lst_pos_venda", title: "Sem ninguém" });
    expect(semContato.ok).toBe(false);
    if (!semContato.ok) expect(semContato.error).toBe(TAREFA_SEM_CONTATO);

    const comContato = createTask(state, THIAGO, {
      listId: "lst_pos_venda",
      title: "Reenviar certificado",
      vinculos: [{ toType: "contact", toId: "cnt_1", role: PAPEL_DO_VINCULO.contato, alvoConferido: true }],
    });
    expect(comContato.ok).toBe(true);
    if (!comContato.ok) return;
    const link = state.links.find((l) => l.fromType === "task" && l.fromId === comContato.value.id && l.toType === "contact");
    expect(link?.toId).toBe("cnt_1");
    expect(link?.role).toBe(PAPEL_DO_VINCULO.contato);
  });

  it("moveTask: entrar numa Lista conversacional exige Contato; sair dela para uma operacional é livre e o Vínculo fica", () => {
    const solta = state.tasks.find((t) => t.id === "tsk_seed_4");
    if (!solta) throw new Error("seed sem tsk_seed_4");
    const entrada = moveTask(state, THIAGO, "tsk_seed_4", "lst_pos_venda");
    expect(entrada.ok).toBe(false);
    if (!entrada.ok) expect(entrada.error).toBe("Uma Lista conversacional só recebe Tarefa com Contato vinculado.");
    expect(solta.listId).toBe("lst_ativacao");

    const saida = moveTask(state, THIAGO, "tsk_pv_1", "lst_ativacao", [{ fromStatusId: "st_pv_conversa", toStatusId: "st_atv_kick" }]);
    expect(saida.ok).toBe(true);
    const movida = state.tasks.find((t) => t.id === "tsk_pv_1");
    expect(movida?.listId).toBe("lst_ativacao");
    expect(movida?.statusId).toBe("st_atv_kick");
    expect(state.links.some((l) => l.fromType === "task" && l.fromId === "tsk_pv_1" && l.toType === "contact" && l.toId === "cnt_2")).toBe(true);
  });

  it("a Subtarefa nasce sem Vínculo próprio e herda o Contato da raiz", () => {
    const sub = createTask(state, THIAGO, { listId: "lst_pos_venda", title: "Anexar o PDF", parentTaskId: "tsk_pv_1" });
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    expect(state.links.some((l) => l.fromType === "task" && l.fromId === sub.value.id)).toBe(false);
  });

  it("Formulário numa Lista conversacional: createForm recusa com a frase do domínio", () => {
    const antes = state.forms.length;
    const r = createForm(state, THIAGO, "lst_pos_venda", { name: "Pedido", questions: [{ label: "Assunto", required: true, target: { kind: "title" } }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(FORMULARIO_EM_LISTA_CONVERSACIONAL);
    expect(state.forms).toHaveLength(antes);
  });

  it("uma Lista com Formulário ativo não vira conversacional; arquivado o Formulário, vira", () => {
    const lista = createList(state, THIAGO, { name: "Suporte por link", parentType: "space", parentId: "spc_com" });
    if (!lista.ok) throw new Error(lista.error);
    const form = createForm(state, THIAGO, lista.value.id, { name: "Pedido", questions: [{ label: "Assunto", required: true, target: { kind: "title" } }] });
    if (!form.ok) throw new Error(form.error);

    const recusada = alterarModeloDaLista(state, THIAGO, lista.value.id, "conversacional");
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.error).toBe(FORMULARIOS_ANTES_DO_MODELO);
    expect(state.lists.find((l) => l.id === lista.value.id)?.modeloDeTarefa).toBe("operacional");

    expect(archiveForm(state, THIAGO, form.value.id).ok).toBe(true);
    const aceita = alterarModeloDaLista(state, THIAGO, lista.value.id, "conversacional");
    expect(aceita.ok, aceita.ok ? "" : aceita.error).toBe(true);
  });

  it("um Formulário que sobrou numa Lista conversacional fica desatualizado: o envio e a edição recusam com a frase, arquivar segue aberto", () => {
    const lista = createList(state, THIAGO, { name: "Renovações por link", parentType: "space", parentId: "spc_com" });
    if (!lista.ok) throw new Error(lista.error);
    const form = createForm(state, THIAGO, lista.value.id, { name: "Pedido", questions: [{ label: "Assunto", required: true, target: { kind: "title" } }] });
    if (!form.ok) throw new Error(form.error);
    const q1 = form.value.questions[0];
    if (!q1) throw new Error("sem pergunta");
    expect(formOutdatedReason(state, form.value)).toBeUndefined();

    // O domínio não deixa chegar aqui pela porta (o teste acima); o estado é forçado para provar o cerco.
    const registro = state.lists.find((l) => l.id === lista.value.id);
    if (!registro) throw new Error("sem Lista");
    registro.modeloDeTarefa = "conversacional";

    expect(formOutdatedReason(state, form.value)).toBe(FORMULARIO_EM_LISTA_CONVERSACIONAL);
    expect(formBySecret(state, form.value.secret)?.id).toBe(form.value.id);
    const tarefas = state.tasks.length;
    const envio = submitForm(state, form.value.secret, { answers: { [q1.id]: "Preciso de ajuda" } });
    expect(envio.ok).toBe(false);
    if (!envio.ok) expect(envio.error).toBe(FORMULARIO_EM_LISTA_CONVERSACIONAL);
    expect(state.tasks).toHaveLength(tarefas);
    const edicao = updateForm(state, THIAGO, form.value.id, { enabled: false });
    expect(edicao.ok).toBe(false);
    if (!edicao.ok) expect(edicao.error).toBe(FORMULARIO_EM_LISTA_CONVERSACIONAL);
    expect(archiveForm(state, THIAGO, form.value.id).ok).toBe(true);
  });
});
