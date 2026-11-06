/**
 * O que sobrou de testes que ainda precisam do CRM ANTIGO semeado (`semearCrmAntigo`) depois que as
 * operações do modelo antigo saíram de `OPERACOES` (15-32): a Mensageria e o Rascunho das Mensagens
 * que as Ferramentas (Grupo, Flow, Automação) ainda enviam, as leituras do modelo antigo (Suspeita de
 * Duplicidade, Widget, Barra global) e a Tarefa conversacional sobre Contato antigo. Eram blocos de
 * `operations.test.ts`.
 *
 * Divida registrada (`.planning/WINDOWS.md`, 15-32): o 15-42 apaga as leituras antigas com os blocos
 * delas e o 15-43 apaga `semearCrmAntigo` — o que ainda valer para o CRM novo se reescreve sobre
 * as tabelas ali, não aqui.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { semearCrmAntigo } from "../seed-crm-antigo";
import type { ConversaNaLista } from "../crm/conversas";
import { isTerminalCategory, memberSeesResource, notificacoesDoMembro, statusCategory, tarefasAbertasDoMembro, widgetReading, type LeituraDoCrmParaPainel } from "../derive";
import type { DataState } from "../state";
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
  state = estadoComCrmAntigo();
});

/** O estado como o seed o entregava antes do 15-31 (D-15-13): com o CRM antigo de demonstração. */
function estadoComCrmAntigo(): DataState {
  const estado = buildSeed();
  semearCrmAntigo(estado);
  return estado;
}

/**
 * O CRM como o Painel o lê desde o 15-23: as linhas das rotas, por argumento. Estes testes
 * seguem usando os Negócios do seed antigo como MASSA de dados; o helper só os põe na forma da
 * lista (`valor` em texto, `estado` do CRM novo, Origem e Motivo de Perda pelo nome no Catálogo).
 */
function crmDoSeed(estado: DataState): LeituraDoCrmParaPainel {
  const estadoCrm = (lifecycle: string) => (lifecycle === "ativo" ? "ativo" : lifecycle === "arquivado" ? "arquivado" : "na_lixeira");
  const nome = (id: string | undefined) => (id ? (estado.catalog.find((item) => item.id === id)?.name ?? null) : null);
  return {
    negocios: estado.deals.map((deal) => ({
      id: deal.id,
      funilId: deal.funnelId,
      etapaId: deal.stageId,
      situacao: deal.situation,
      estado: estadoCrm(deal.lifecycle),
      valor: deal.value ? String(deal.value.amount) : null,
      moeda: deal.value?.currency ?? "BRL",
      proprietarioId: deal.ownerMemberId,
      encerradoEm: deal.closedAt ?? null,
      origem: nome(deal.originId),
      motivoPerda: nome(deal.lossReasonId),
    })),
    conversas: estado.conversations.map((conversa) => ({
      id: conversa.id,
      situacao: conversa.state,
      estado: conversa.lifecycle === "ativo" ? ("ativo" as const) : ("na_lixeira" as const),
      filaId: conversa.queueId ?? null,
    })),
    contatos: estado.contacts.map((contato) => ({ id: contato.id, estado: estadoCrm(contato.lifecycle) })),
    funis: estado.funnels.map((funil) => ({ id: funil.id, nome: funil.name })),
    etapas: estado.funnels.flatMap((funil) => funil.stages.map((etapa) => ({ id: etapa.id, funilId: funil.id, nome: etapa.name }))),
    parcial: false,
  };
}

describe("Mensageria (RN-CXE-09, RN-CXE-19, RN-CXE-33, B66)", () => {
  // Operação antiga do CRM (15-32 a apaga): o estado ainda precisa do CRM que o seed deixou de criar (15-31).
  beforeEach(() => {
    state = estadoComCrmAntigo();
  });
  it("envia, esvazia o Rascunho do autor e mantém a autoria de quem enviou", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    expect(conversation?.drafts).toHaveLength(1);

    const result = sendMessage(state, THIAGO, { conversationId: "cnv_1", content: "Segue o cronograma." });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.actor).toEqual({ kind: "member", id: THIAGO });
    // A Membro escreveu o seu próprio texto: o Rascunho do Agente segue à espera.
    expect(conversation?.drafts).toHaveLength(1);
    expect(conversation?.messages.at(-1)?.content).toBe("Segue o cronograma.");
  });

  it("grava a Mensagem como pendente quando o Canal está desconectado, sem descarte silencioso", () => {
    const conversation = state.conversations.find((c) => c.channelId === "chn_insta");
    if (!conversation) throw new Error("seed sem Conversa no Canal desconectado");

    const result = sendMessage(state, THIAGO, { conversationId: conversation.id, content: "Oi!" });

    expect(result.ok).toBe(true);
    expect(conversation.messages.at(-1)?.deliveryStatus).toBe("pendente");
    expect(state.activity[0]?.detail).toContain("Canal desconectado");
  });

  it("reabre a MESMA Conversa quando a Mensagem chega dentro do Prazo de reabertura", () => {
    // Resolvida E fora da lixeira: RN-CXE-33 não reabre o que está na lixeira.
    const conversation = state.conversations.find(
      (c) => c.state === "resolvida" && c.lifecycle === "ativo",
    );
    if (!conversation?.contactId) throw new Error("seed sem Conversa resolvida ativa");
    conversation.resolvedAt = new Date().toISOString();
    const before = state.conversations.length;
    const reopensBefore = conversation.reopenCount;

    const result = receiveMessage(state, conversation.channelId, conversation.contactId, "Voltei!");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(conversation.id);
    expect(result.value.state).toBe("aberta");
    // A regra é o incremento, não um valor absoluto: a Conversa pode já ter
    // sido reaberta antes, e o contador conta as reaberturas dela.
    expect(result.value.reopenCount).toBe(reopensBefore + 1);
    expect(state.conversations.length).toBe(before);
  });

  it("cria uma Conversa NOVA quando a Mensagem chega fora do prazo", () => {
    // Resolvida E fora da lixeira: RN-CXE-33 não reabre o que está na lixeira.
    const conversation = state.conversations.find(
      (c) => c.state === "resolvida" && c.lifecycle === "ativo",
    );
    if (!conversation?.contactId) throw new Error("seed sem Conversa resolvida ativa");
    conversation.resolvedAt = new Date(Date.now() - 100 * 3_600_000).toISOString();
    const before = state.conversations.length;

    const result = receiveMessage(state, conversation.channelId, conversation.contactId, "Muito tempo depois");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).not.toBe(conversation.id);
    expect(state.conversations.length).toBe(before + 1);
  });

  it("restaura o Contato arquivado ao receber Mensagem (RN-CON-13)", () => {
    const contact = state.contacts.find((c) => c.id === "cnt_20");
    if (!contact) throw new Error("seed sem Contato");
    contact.lifecycle = "arquivado";

    receiveMessage(state, "chn_wpp", contact.id, "Oi, voltei a precisar do serviço.");

    expect(contact.lifecycle).toBe("ativo");
    expect(state.activity.some((a) => a.action === "Contato restaurado por Mensagem recebida")).toBe(true);
  });
});

describe("Adoção de Rascunho de IA no envio (documento 14, 7.10)", () => {
  // Operação antiga do CRM (15-32 a apaga): o estado ainda precisa do CRM que o seed deixou de criar (15-31).
  beforeEach(() => {
    state = estadoComCrmAntigo();
  });
  it("adotar e enviar esvazia o Rascunho do Agente e registra a adoção", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    const rascunho = conversation?.drafts[0];
    if (!conversation || !rascunho) throw new Error("seed sem Rascunho em cnv_1");
    const agente = state.agents.find((a) => a.id === rascunho.actor.id);

    const result = sendMessage(state, THIAGO, {
      conversationId: "cnv_1",
      content: rascunho.content,
      adoptedDraftOf: rascunho.actor,
    });

    expect(result.ok).toBe(true);
    expect(conversation.drafts).toHaveLength(0);
    const record = state.activity.find((entry) => entry.action === "Mensagem enviada");
    expect(record?.detail).toContain(`Rascunho de ${agente?.name} adotado`);
  });

  it("o mesmo Rascunho não vai duas vezes ao Contato", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    const rascunho = conversation?.drafts[0];
    if (!conversation || !rascunho) throw new Error("seed sem Rascunho em cnv_1");

    sendMessage(state, THIAGO, {
      conversationId: "cnv_1",
      content: rascunho.content,
      adoptedDraftOf: rascunho.actor,
    });
    // Não há mais Rascunho para o próximo Atendente adotar.
    expect(conversation.drafts).toHaveLength(0);
    expect(
      conversation.messages.filter(
        (m) => m.direction === "enviada" && m.content === rascunho.content,
      ),
    ).toHaveLength(1);
  });

  it("a nota interna não consome o Rascunho: ela não sai da plataforma", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    if (!conversation) throw new Error("seed sem cnv_1");

    sendMessage(state, THIAGO, {
      conversationId: "cnv_1",
      content: "Confere isto antes de eu responder.",
      internal: true,
    });

    expect(conversation.drafts).toHaveLength(1);
  });
});

describe("Leitura de Widget e permissões do visualizador (RN-PAI-15, RN-PAI-13, B38a)", () => {
  // Operação antiga do CRM (15-32 a apaga): o estado ainda precisa do CRM que o seed deixou de criar (15-31).
  beforeEach(() => {
    state = estadoComCrmAntigo();
  });
  const CONVIDADA = "mem_beatriz";

  const widgetDe = (panelId: string, widgetId: string) => {
    const panel = state.panels.find((p) => p.id === panelId);
    const widget = panel?.widgets.find((w) => w.id === widgetId);
    if (!widget) throw new Error(`seed sem widget ${widgetId}`);
    return widget;
  };

  it("conta Negócios por Etapa e nomeia cada Etapa, não o identificador", () => {
    const reading = widgetReading(state, widgetDe("pnl_sdr", "wg_sdr_funil"), THIAGO, new Date(), crmDoSeed(state));

    expect(reading.kind).toBe("serie");
    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.rows.length).toBeGreaterThan(0);
    const funil = state.funnels.find((f) => f.id === "fnl_sdr");
    for (const row of reading.rows) {
      expect(funil?.stages.some((stage) => stage.name === row.label)).toBe(true);
    }
    const somaDaSerie = reading.rows.reduce((total, row) => total + row.value, 0);
    const abertosNoFunil = state.deals.filter(
      (d) => d.funnelId === "fnl_sdr" && d.lifecycle === "ativo",
    );
    expect(somaDaSerie).toBe(abertosNoFunil.length);
  });

  it("soma dinheiro por moeda e nunca consolida (RN-PAI-13)", () => {
    const reading = widgetReading(state, widgetDe("pnl_closer", "wg_clo_valor"), THIAGO, new Date(), crmDoSeed(state));

    expect(reading.kind).toBe("moeda");
    if (reading.kind !== "moeda") throw new Error("esperava moeda");
    expect(reading.byCurrency.length).toBeGreaterThan(0);
    for (const entry of reading.byCurrency) {
      expect(entry.currency).not.toBe("");
      const esperado = state.deals
        .filter((d) => d.funnelId === "fnl_closer" && d.lifecycle === "ativo")
        .filter((d) => d.value?.currency === entry.currency)
        .reduce((total, d) => total + (d.value?.amount ?? 0), 0);
      expect(entry.amount).toBe(esperado);
    }
  });

  it("devolve semAcesso, e não zero, quando o visualizador não alcança a Fonte", () => {
    const widget = widgetDe("pnl_ops", "wg_6");
    // A Convidada não tem concessão no Espaço de escopo deste Widget.
    expect(memberSeesResource(state, CONVIDADA, "spc_ops")).toBe(false);

    const reading = widgetReading(state, widget, CONVIDADA, new Date(), crmDoSeed(state));

    expect(reading.kind).toBe("semAcesso");
    // E a mesma leitura, para quem alcança, traz número: zero seria mentira.
    const daProprietaria = widgetReading(state, widget, THIAGO, new Date(), crmDoSeed(state));
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
  // Operação antiga do CRM (15-32 a apaga): o estado ainda precisa do CRM que o seed deixou de criar (15-31).
  beforeEach(() => {
    state = estadoComCrmAntigo();
  });
  const ler = (widget: Parameters<typeof widgetReading>[1]) =>
    widgetReading(state, widget, THIAGO, new Date(), crmDoSeed(state));

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
      expect(state.catalog.some((c) => c.name === row.label)).toBe(true);
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
    const emDolar = state.deals.find((d) => d.funnelId === "fnl_closer" && d.value);
    if (!emDolar) throw new Error("seed sem Negócio com valor no Closer");
    emDolar.value = { amount: 1_000, currency: "USD" };

    const reading = ler({
      viewType: "barras",
      dataSource: fonte,
      metrics: [{ aggregation: "soma", attribute: "value", label: "Valor" }],
      dimensions: [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }],
    });

    expect(reading.kind).toBe("texto");
    if (reading.kind !== "texto") throw new Error("esperava recusa em texto");
    expect(reading.content).toContain("moedas");
  });

  it("aplica o Filtro fixo: o Widget rotulado 'em prospecção' não conta o que foi perdido", () => {
    const abertos = state.deals.filter(
      (d) => d.funnelId === "fnl_sdr" && d.lifecycle === "ativo" && d.situation === "aberto",
    ).length;

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

describe("Processo do Closer", () => {
  // Operação antiga do CRM (15-32 a apaga): o estado ainda precisa do CRM que o seed deixou de criar (15-31).
  beforeEach(() => {
    state = estadoComCrmAntigo();
  });
  const ETAPAS = ["clo_agendamento", "clo_call", "clo_proposta", "clo_negociacao", "clo_fechamento"];

  it("tem cinco Etapas, e cada uma cobra o que só existe depois da anterior", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_closer");
    if (!funil) throw new Error("seed sem o Funil Closer");

    expect([...funil.stages].sort((a, b) => a.order - b.order).map((s) => s.id)).toEqual(ETAPAS);
    const exigido = (id: string, momento: "entrada" | "saida") =>
      funil.stages
        .find((s) => s.id === id)
        ?.requirements.filter((r) => r.moment === momento)
        .map((r) => r.fieldDefinitionId ?? r.kind);

    expect(exigido("clo_agendamento", "saida")).toContain("fd_data_reuniao");
    expect(exigido("clo_call", "saida")).toContain("fd_diagnostico");
    expect(exigido("clo_proposta", "entrada")).toContain("valorObrigatorio");
    expect(exigido("clo_proposta", "saida")).toContain("fd_plano");
    expect(exigido("clo_negociacao", "saida")).toContain("fd_objecao");
    expect(exigido("clo_fechamento", "entrada")).toContain("fd_pagamento");
  });

  /*
   * Um Negócio parado numa Etapa precisa ter cumprido o caminho até ela. Sem
   * esta garantia o seed nasce num estado impossível, e a primeira operação que
   * revalida a Etapa recusa por um motivo que ninguém provocou.
   */
  it("todo Negócio do Closer cumpre os Requisitos de entrada da Etapa onde está", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_closer");
    if (!funil) throw new Error("seed sem o Funil Closer");

    for (const deal of state.deals.filter((d) => d.funnelId === "fnl_closer")) {
      const etapa = funil.stages.find((s) => s.id === deal.stageId);
      if (!etapa) throw new Error(`Negócio ${deal.id} numa Etapa que não existe`);
      for (const requisito of etapa.requirements.filter((r) => r.moment === "entrada")) {
        if (requisito.kind === "valorObrigatorio") {
          expect(`${deal.id}: valor`).toBe(`${deal.id}: ${deal.value && deal.value.amount > 0 ? "valor" : "sem valor"}`);
        }
        if (requisito.kind === "contatoObrigatorio") {
          expect(`${deal.id}: ${deal.contactLinks.length > 0}`).toBe(`${deal.id}: true`);
        }
        if (requisito.kind === "campoPreenchido") {
          const valor = deal.fieldValues.find((v) => v.definitionId === requisito.fieldDefinitionId)?.value;
          expect(`${deal.id}/${requisito.fieldDefinitionId}: ${valor !== undefined && valor !== null && valor !== ""}`).toBe(
            `${deal.id}/${requisito.fieldDefinitionId}: true`,
          );
        }
      }
    }
  });

  it("cada Campo do Closer tem a pergunta escrita, e as opções que o produto usa", () => {
    const plano = state.fieldDefinitions.find((d) => d.id === "fd_plano");
    const pagamento = state.fieldDefinitions.find((d) => d.id === "fd_pagamento");
    const objecao = state.fieldDefinitions.find((d) => d.id === "fd_objecao");

    expect(plano?.options).toEqual(["Classic", "Pro", "Elite"]);
    expect(objecao?.options).toContain("Parcelamento");
    expect(pagamento?.options).toContain("Cartão em 12x");
    for (const definicao of [plano, pagamento, objecao]) {
      expect(definicao?.description).toBeTruthy();
    }
  });
  it("o Registro de transição diz a Etapa, e a passagem de Funil diz o Funil", () => {
    const daPassagem = state.activity.filter(
      (registro) => registro.action === "Negócio mudou de Funil",
    );
    expect(daPassagem.length).toBeGreaterThan(0);
    for (const registro of daPassagem) {
      // Os dois Funis têm uma Etapa "Agendamento": sem o prefixo do Funil a
      // linha leria "Agendamento → Agendamento".
      expect(registro.before).toMatch(/ · /);
      expect(registro.after).toMatch(/ · /);
      expect(registro.before).not.toEqual(registro.after);
    }

    // O nome do evento é UM só: a Auditoria busca por `action` em texto livre,
    // e dois nomes para o mesmo fato escondem metade dos registros.
    expect(
      state.activity.some((r) => r.action === "Negócio passou de Funil"),
    ).toBe(false);

    const deEtapa = state.activity.filter(
      (registro) => registro.action === "Negócio entrou em Etapa",
    );
    expect(deEtapa.length).toBeGreaterThan(0);
    for (const registro of deEtapa) {
      expect(registro.after).toBeTruthy();
    }
  });
  it("nenhuma coleção do seed tem id repetido", () => {
    const colecoes: ReadonlyArray<readonly [string, ReadonlyArray<{ readonly id: string }>]> = [
      ["tasks", state.tasks],
      ["deals", state.deals],
      ["contacts", state.contacts],
      ["companies", state.companies],
      ["conversations", state.conversations],
      ["activity", state.activity],
      ["members", state.members],
      ["lists", state.lists],
    ];
    for (const [nome, itens] of colecoes) {
      const repetidos = itens
        .map((item) => item.id)
        .filter((id, indice, todos) => todos.indexOf(id) !== indice);
      expect(repetidos, nome).toEqual([]);
    }
  });
  it("o Funil de Validação vai do sinal à venda, e cada Requisito aponta para um Campo que existe", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_validacao");
    expect(funil?.stages.map((etapa) => etapa.name)).toEqual([
      "Sinal pago",
      "Aguardando agendamento",
      "Call agendada",
      "Call realizada",
      "Em análise",
      "Aprovado",
      "Venda",
    ]);
    // Ganho é situação e reprovação é perda com Motivo — não são Etapas.
    expect(funil?.closingRules).toEqual({ requireLossReason: true, requireValueOnWin: true });
    expect(state.catalog.some((c) => c.kind === "motivoPerda" && c.name === "Não aprovado")).toBe(true);

    const campos = new Set(state.fieldDefinitions.map((d) => d.id));
    for (const f of state.funnels) {
      for (const etapa of f.stages) {
        for (const requisito of etapa.requirements) {
          if (requisito.fieldDefinitionId) {
            expect(campos.has(requisito.fieldDefinitionId), `${f.id}/${etapa.id}`).toBe(true);
          }
        }
      }
    }
  });
  it("a Venda direta vai do lead à negociação, e o Iallas está em Oferta apresentada com valor", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_venda_direta");
    expect(funil?.stages.map((etapa) => etapa.name)).toEqual([
      "Novo lead",
      "Primeiro contato",
      "Em qualificação",
      "Oferta apresentada",
      "Em negociação",
    ]);
    const negocio = state.deals.find((d) => d.id === "deal_vd_1");
    expect(negocio?.stageId).toBe("vd_oferta");
    // Oferta apresentada exige valor na entrada: o seed não pode violar a própria Etapa.
    expect(negocio?.value?.amount).toBeGreaterThan(0);
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
  // Operação antiga do CRM (15-32 a apaga): o estado ainda precisa do CRM que o seed deixou de criar (15-31).
  beforeEach(() => {
    state = estadoComCrmAntigo();
  });
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
  // Operação antiga do CRM (15-32 a apaga): o estado ainda precisa do CRM que o seed deixou de criar (15-31).
  beforeEach(() => {
    state = estadoComCrmAntigo();
  });
  it("createList nasce operacional sem dizer o modelo; conversacional é gravado e nomeado na Atividade", () => {
    const padrao = createList(state, THIAGO, { name: "Onboarding", parentType: "space", parentId: "spc_com" });
    expect(padrao.ok).toBe(true);
    if (padrao.ok) expect(padrao.value.modeloDeTarefa).toBe("operacional");

    // C36 — a conversacional nasce dizendo por onde atende.
    const conversacional = createList(state, THIAGO, { name: "Suporte ao aluno", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: ["chn_wpp"] });
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
      vinculos: [{ toType: "contact", toId: "cnt_1", role: PAPEL_DO_VINCULO.contato }],
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
