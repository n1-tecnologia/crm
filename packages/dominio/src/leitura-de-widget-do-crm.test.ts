/**
 * 15-23 Task 3 (UCR-07, 3.4.7) — `widgetReading` lê Negócios, Conversas, Contatos e Funis do CRM
 * NOVO por argumento (as linhas que as rotas `GET /negocios`, `/conversas`, `/contatos` e `/funis`
 * devolvem), não do estado (que não guarda mais Negócio, Contato nem Funil). Quando a lista lida é só
 * uma parte do que a api tem, a leitura sai marcada `parcial` (T-15-57).
 *
 * O `state` do seed continua trazendo Negócios, Conversas e Contatos do modelo antigo: nenhum
 * caso abaixo pode ser explicado por eles.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { ContatoResumo } from "./crm/contatos";
import type { ConversaNaLista } from "./crm/conversas";
import type { Etapa, Funil } from "./crm/funis";
import type { NegocioResumo } from "./crm/negocios";
import { widgetReading, type LeituraDoCrmParaPainel, type WidgetReading } from "./derive";
import { buildSeed } from "./seed";
import type { DataState } from "./state";
import { colecaoPelaChave } from "./testes/crm-de-teste";

const THIAGO = "mem_thiago";
const AGORA = new Date("2026-11-06T15:00:00Z");

type EntradaDoWidget = Parameters<typeof widgetReading>[1];

function negocio(id: string, extra: Partial<NegocioResumo & { origem: string | null; motivoPerda: string | null }> = {}): NegocioResumo {
  return {
    id,
    titulo: `Negócio ${id}`,
    valor: null,
    moeda: "BRL",
    probabilidadeEfetiva: 50,
    situacao: "aberto",
    estado: "ativo",
    funilId: "fun_a",
    etapaId: "eta_a1",
    empresa: null,
    contato: null,
    proprietarioId: THIAGO,
    dataPrevistaFechamento: null,
    encerradoEm: null,
    atualizadoEm: "2026-11-01T10:00:00.000Z",
    ...extra,
  };
}

function conversa(id: string, extra: Partial<ConversaNaLista> = {}): ConversaNaLista {
  return {
    id,
    canalId: "can_1",
    contatoId: `ctt_${id}`,
    titulo: `Conversa ${id}`,
    tituloEditado: false,
    situacao: "aberta",
    estado: "ativo",
    naLixeiraEm: null,
    filaId: null,
    atribuido: null,
    adiadaAte: null,
    adiamentoMotivo: null,
    participantes: [],
    resolvidaEm: null,
    reabertaEm: null,
    reaberturas: 0,
    criadoPor: { tipo: "membro", id: THIAGO },
    criadoEm: "2026-11-01T10:00:00.000Z",
    atualizadoEm: "2026-11-02T10:00:00.000Z",
    contatoNome: null,
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
    ...extra,
  };
}

function contato(id: string, estado: ContatoResumo["estado"] = "ativo"): ContatoResumo {
  return { id, nomeDeExibicao: id, estado, proprietarioId: THIAGO, emailPrincipal: null, telefonePrincipal: null, atualizadoEm: "2026-11-01T10:00:00.000Z" };
}

const FUNIS: readonly Pick<Funil, "id" | "nome">[] = [
  { id: "fun_a", nome: "Funil A" },
  { id: "fun_b", nome: "Funil B" },
];

const ETAPAS: readonly Pick<Etapa, "id" | "funilId" | "nome">[] = [
  { id: "eta_a1", funilId: "fun_a", nome: "Novo" },
  { id: "eta_a2", funilId: "fun_a", nome: "Proposta" },
  { id: "eta_b1", funilId: "fun_b", nome: "Triagem" },
];

function crmCom(extra: Partial<LeituraDoCrmParaPainel> = {}): LeituraDoCrmParaPainel {
  return { negocios: [], conversas: [], contatos: [], funis: FUNIS, etapas: ETAPAS, parcial: false, ...extra };
}

const contagem = { aggregation: "contagem", attribute: "id", label: "Negócios" } as const;

function deFunil(extra: Partial<EntradaDoWidget> & { readonly funis?: readonly string[] } = {}): EntradaDoWidget {
  const { funis, ...resto } = extra;
  return {
    viewType: "numero",
    dataSource: { target: "deal", scopeType: "funnel", scopeIds: funis ?? ["fun_a"] },
    metrics: [contagem],
    dimensions: [],
    ...resto,
  };
}

let state: DataState;
const ler = (widget: EntradaDoWidget, crm: LeituraDoCrmParaPainel, membro = THIAGO): WidgetReading =>
  widgetReading(state, widget, membro, AGORA, crm);

function numero(leitura: WidgetReading): number {
  if (leitura.kind !== "numero") throw new Error(`esperava número, veio ${leitura.kind}`);
  return leitura.value;
}

function serie(leitura: WidgetReading): ReadonlyArray<readonly [string, number]> {
  if (leitura.kind !== "serie") throw new Error(`esperava série, veio ${leitura.kind}`);
  return leitura.rows.map((linha) => [linha.label, linha.value] as const);
}

beforeEach(() => {
  state = buildSeed();
});

describe("widgetReading — Negócios do CRM novo por argumento", () => {
  it("'Negócios do Funil F' conta os que vieram no argumento, não os do estado", () => {
    // O estado não tem Negócio nenhum (15-31): tudo o que a leitura conta vem do argumento.
    expect(colecaoPelaChave(state, "deals")).toHaveLength(0);
    const crm = crmCom({ negocios: [negocio("n1"), negocio("n2"), negocio("n3", { funilId: "fun_b", etapaId: "eta_b1" })] });
    expect(numero(ler(deFunil(), crm))).toBe(2);
    expect(numero(ler(deFunil({ funis: ["fun_b"] }), crm))).toBe(1);
    // Um Funil do seed antigo no escopo: o argumento não traz Negócio nele.
    expect(numero(ler(deFunil({ funis: ["fnl_sdr"] }), crm))).toBe(0);
    // Sem Negócio nenhum no argumento, o seed antigo não vaza.
    expect(numero(ler(deFunil({ funis: ["fnl_sdr"] }), crmCom()))).toBe(0);
  });

  it("só o Negócio ativo conta: arquivado e na lixeira ficam fora", () => {
    const crm = crmCom({ negocios: [negocio("n1"), negocio("n2", { estado: "arquivado" }), negocio("n3", { estado: "na_lixeira" })] });
    expect(numero(ler(deFunil(), crm))).toBe(1);
  });

  it("escopo do Espaço inteiro lê todos os Funis", () => {
    const crm = crmCom({ negocios: [negocio("n1"), negocio("n2", { funilId: "fun_b", etapaId: "eta_b1" })] });
    const widget: EntradaDoWidget = { viewType: "numero", dataSource: { target: "deal", scopeType: "workspace", scopeIds: [state.workspace.id] }, metrics: [contagem], dimensions: [] };
    expect(numero(ler(widget, crm))).toBe(2);
  });

  it("por Etapa, a série leva o nome da Etapa que veio no argumento, a maior primeiro", () => {
    const crm = crmCom({ negocios: [negocio("n1"), negocio("n2", { etapaId: "eta_a2" }), negocio("n3", { etapaId: "eta_a2" })] });
    const reading = ler(deFunil({ viewType: "funil", dimensions: [{ attribute: "stageId", label: "Etapa" }] }), crm);
    expect(serie(reading)).toEqual([
      ["Proposta", 2],
      ["Novo", 1],
    ]);
  });

  it("por Situação, as palavras são as do vocabulário: Aberto, Ganho, Perdido", () => {
    const crm = crmCom({ negocios: [negocio("n1"), negocio("n2", { situacao: "ganho" }), negocio("n3", { situacao: "perdido" }), negocio("n4", { situacao: "ganho" })] });
    const reading = ler(deFunil({ viewType: "pizza", dimensions: [{ attribute: "situation", label: "Situação" }] }), crm);
    expect(serie(reading)).toEqual([
      ["Ganho", 2],
      ["Aberto", 1],
      ["Perdido", 1],
    ]);
  });

  it("o Filtro fixo vale em toda leitura: 'em prospecção' não conta o que foi perdido", () => {
    const crm = crmCom({ negocios: [negocio("n1"), negocio("n2", { situacao: "perdido" })] });
    const filtro = [{ attribute: "situation", operator: "igualA", value: "Aberto", label: "Situação: aberto" }] as const;
    expect(numero(ler(deFunil({ fixedFilters: filtro }), crm))).toBe(1);
    expect(numero(ler(deFunil(), crm))).toBe(2);
  });

  it("por Responsável, o nome do Membro (o Proprietário do Negócio)", () => {
    const crm = crmCom({ negocios: [negocio("n1"), negocio("n2", { proprietarioId: "mem_julia" }), negocio("n3", { proprietarioId: "mem_julia" })] });
    const reading = ler(deFunil({ viewType: "barras", dimensions: [{ attribute: "ownerMemberId", label: "Responsável" }] }), crm);
    const julia = state.members.find((m) => m.id === "mem_julia")?.displayName ?? "";
    const thiago = state.members.find((m) => m.id === THIAGO)?.displayName ?? "";
    expect(serie(reading)).toEqual([
      [julia, 2],
      [thiago, 1],
    ]);
  });

  it("ganhos por mês pelo encerramento, com a moeda na série", () => {
    const crm = crmCom({
      negocios: [
        negocio("n1", { situacao: "ganho", valor: "1000.50", encerradoEm: "2026-10-15T12:00:00.000Z" }),
        negocio("n2", { situacao: "ganho", valor: "200", encerradoEm: "2026-10-20T12:00:00.000Z" }),
        negocio("n3", { situacao: "ganho", valor: "50", encerradoEm: "2026-11-02T12:00:00.000Z" }),
        negocio("n4"), // aberto, sem encerramento: fora da dimensão
      ],
    });
    const widget = deFunil({
      viewType: "barras",
      metrics: [{ aggregation: "soma", attribute: "value", label: "Valor ganho" }],
      dimensions: [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }],
    });
    const reading = ler(widget, crm);
    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.currency).toBe("BRL");
    expect(serie(reading)).toEqual([
      ["10/2026", 1200.5],
      ["11/2026", 50],
    ]);
  });

  it("soma dinheiro por moeda, o valor é texto decimal, e nunca consolida (RN-PAI-13)", () => {
    const crm = crmCom({
      negocios: [negocio("n1", { valor: "1000.50" }), negocio("n2", { valor: "200", moeda: "USD" }), negocio("n3", { valor: "99.50" }), negocio("n4", { valor: null })],
    });
    const reading = ler(deFunil({ metrics: [{ aggregation: "soma", attribute: "value", label: "Valor" }] }), crm);
    expect(reading.kind).toBe("moeda");
    if (reading.kind !== "moeda") throw new Error("esperava moeda");
    expect([...reading.byCurrency].sort((a, b) => a.currency.localeCompare(b.currency))).toEqual([
      { currency: "BRL", amount: 1100 },
      { currency: "USD", amount: 200 },
    ]);
  });

  it("série de dinheiro com duas moedas é recusada em texto, como antes", () => {
    const crm = crmCom({
      negocios: [
        negocio("n1", { situacao: "ganho", valor: "10", encerradoEm: "2026-10-15T12:00:00.000Z" }),
        negocio("n2", { situacao: "ganho", valor: "10", moeda: "USD", encerradoEm: "2026-10-16T12:00:00.000Z" }),
      ],
    });
    const widget = deFunil({
      viewType: "barras",
      metrics: [{ aggregation: "soma", attribute: "value", label: "Valor" }],
      dimensions: [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }],
    });
    const reading = ler(widget, crm);
    expect(reading.kind).toBe("texto");
    if (reading.kind === "texto") expect(reading.content).toContain("moedas");
  });

  it("Origem e Motivo de Perda: com o texto no Negócio, a série o usa; sem ele (a lista resumida não traz), ficam sem linhas", () => {
    const comTexto = crmCom({
      negocios: [
        negocio("n1", { origem: "Instagram", motivoPerda: "Preço" }),
        negocio("n2", { origem: "Instagram", motivoPerda: "Prazo" }),
        negocio("n3", { origem: "Indicação", motivoPerda: null }),
      ],
    });
    const origem = deFunil({ viewType: "barras", dimensions: [{ attribute: "originId", label: "Origem" }] });
    const motivo = deFunil({ viewType: "barras", dimensions: [{ attribute: "lossReasonId", label: "Motivo de Perda" }] });
    expect(serie(ler(origem, comTexto))).toEqual([
      ["Instagram", 2],
      ["Indicação", 1],
    ]);
    expect(serie(ler(motivo, comTexto))).toEqual([
      ["Preço", 1],
      ["Prazo", 1],
    ]);
    expect(serie(ler(origem, crmCom({ negocios: [negocio("n1")] })))).toEqual([]);
  });
});

describe("widgetReading — Conversas e Contatos do CRM novo por argumento", () => {
  const deConversa = (scopeType: string, scopeIds: readonly string[], extra: Partial<EntradaDoWidget> = {}): EntradaDoWidget => ({
    viewType: "numero",
    dataSource: { target: "conversation", scopeType, scopeIds },
    metrics: [{ aggregation: "contagem", attribute: "id", label: "Conversas" }],
    dimensions: [],
    ...extra,
  });

  it("Conversas por situação (Aberta, Pendente, Resolvida), só as ativas", () => {
    expect(state.conversations.length).toBeGreaterThan(0);
    const crm = crmCom({
      conversas: [conversa("c1"), conversa("c2", { situacao: "pendente" }), conversa("c3", { situacao: "resolvida" }), conversa("c4", { estado: "na_lixeira" })],
    });
    const reading = ler(deConversa("workspace", [state.workspace.id], { viewType: "pizza", dimensions: [{ attribute: "state", label: "Estado" }] }), crm);
    expect(serie(reading).map(([rotulo]) => rotulo).sort()).toEqual(["Aberta", "Pendente", "Resolvida"]);
    expect(numero(ler(deConversa("inbox", ["inbox_n1"]), crm))).toBe(3);
  });

  it("escopo de Fila lê a Fila da Conversa (`filaId`)", () => {
    const crm = crmCom({ conversas: [conversa("c1", { filaId: "fila_a" }), conversa("c2", { filaId: "fila_b" }), conversa("c3")] });
    expect(numero(ler(deConversa("queue", ["fila_a"]), crm))).toBe(1);
    expect(numero(ler(deConversa("queue", ["fila_z"]), crm))).toBe(0);
  });

  it("Contatos ativos: arquivado e lixeira não contam", () => {
    // O estado não tem Contato nenhum (15-31): tudo o que a leitura conta vem do argumento.
    expect(colecaoPelaChave(state, "contacts")).toHaveLength(0);
    const crm = crmCom({ contatos: [contato("a"), contato("b"), contato("c", "arquivado"), contato("d", "na_lixeira")] });
    const widget: EntradaDoWidget = {
      viewType: "numero",
      dataSource: { target: "contact", scopeType: "workspace", scopeIds: [state.workspace.id] },
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Contatos" }],
      dimensions: [],
    };
    expect(numero(ler(widget, crm))).toBe(2);
  });
});

describe("widgetReading — permissão e leitura parcial", () => {
  it("a Convidada sem concessão continua com semAcesso, mesmo com Negócios no argumento (RN-PAI-15)", () => {
    const crm = crmCom({ negocios: [negocio("n1")] });
    expect(ler(deFunil(), crm, "mem_beatriz")).toEqual({ kind: "semAcesso" });
  });

  it("com `parcial: true`, a leitura de Negócios, Conversas e Contatos leva a marca; com false, não", () => {
    const crm = crmCom({ negocios: [negocio("n1", { valor: "10" })], conversas: [conversa("c1")], contatos: [contato("a")] });
    const parcial = { ...crm, parcial: true };
    const serieDeEtapa = deFunil({ viewType: "funil", dimensions: [{ attribute: "stageId", label: "Etapa" }] });
    const dinheiro = deFunil({ metrics: [{ aggregation: "soma", attribute: "value", label: "Valor" }] });
    const deConversas: EntradaDoWidget = {
      viewType: "numero",
      dataSource: { target: "conversation", scopeType: "workspace", scopeIds: [state.workspace.id] },
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Conversas" }],
      dimensions: [],
    };
    for (const widget of [deFunil(), serieDeEtapa, dinheiro, deConversas]) {
      expect(ler(widget, parcial), JSON.stringify(widget.dataSource)).toMatchObject({ parcial: true });
      expect("parcial" in ler(widget, crm)).toBe(false);
    }
  });

  it("a Tarefa lê o store e nunca é parcial: o CRM incompleto não mancha o que não é do CRM", () => {
    const widget: EntradaDoWidget = {
      viewType: "numero",
      dataSource: { target: "task", scopeType: "space", scopeIds: ["spc_ops"] },
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Tarefas" }],
      dimensions: [],
    };
    const leitura = ler(widget, crmCom({ parcial: true }));
    expect(leitura.kind).toBe("numero");
    expect("parcial" in leitura).toBe(false);
  });

  it("Widget de texto e Fonte sem acesso não levam a marca", () => {
    const texto = ler({ viewType: "texto", content: "olá", metrics: [], dimensions: [] }, crmCom({ parcial: true }));
    expect(texto).toEqual({ kind: "texto", content: "olá" });
    expect(ler(deFunil(), crmCom({ parcial: true }), "mem_beatriz")).toEqual({ kind: "semAcesso" });
  });
});
