/**
 * O resumo do Membro no Início: mensagens novas, Leads a atender e as
 * estatísticas do período.
 *
 * O seed nasce de HOJE às 09:00 UTC (`BASE` em seed.ts). Nenhum teste lê o
 * relógio da máquina: `agora` sai de um instante do próprio seed, para o
 * resultado não mudar com a hora do dia em que a suíte roda.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { buildProductSeed } from "./seed-produto";
import {
  METRICAS_DO_RESUMO,
  PERIODOS_DO_RESUMO,
  estatisticasDoMembro,
  janelaDoResumo,
  janelasDeConsultaDoCrm,
  juntarEstatisticasDoCrm,
  mensagensNovasDasConversas,
  qualificacoesDeLead,
} from "./derive-resumo";
import { diaCivilNoFuso, recortesDeTarefas } from "./recortes-de-tarefas";
import { isoNoFuso } from "./relogio";
import type { DataState } from "./state";
import type { ConversaNaLista } from "./crm/conversas";
import { conferirJanelaDeEstatisticas, type EstatisticasDoCrm } from "./crm/inicio";
import type { ActorRef, Task } from "./types";

const THIAGO = "mem_thiago";
const FUSO = "America/Sao_Paulo"; // UTC−3, sem horário de verão desde 2019
const HORA = 3_600_000;
const DIA = 24 * HORA;
const thiago: ActorRef = { kind: "member", id: THIAGO };

/** O `BASE` do seed (hoje, 09:00 UTC), lido de um registro: o Membro `mem_thiago` entra em `at(400)`. */
function baseDoSeed(state: DataState): number {
  const entrou = state.members.find((m) => m.id === THIAGO)?.joinedAt;
  if (!entrou) throw new Error("seed sem mem_thiago");
  const base = Date.parse(entrou) + 400 * DIA;
  expect(new Date(base).getUTCHours()).toBe(9);
  return base;
}

/** 18:00 em São Paulo do dia do `BASE` (que lá é 06:00): tudo que o seed põe "hoje" até as 21:00 UTC já aconteceu. */
const agoraDoSeed = (state: DataState): Date => new Date(baseDoSeed(state) + 12 * HORA);

const iso = (instante: number): string => new Date(instante).toISOString();

function exigir<T>(valor: T | undefined, oQue: string): T {
  if (valor === undefined) throw new Error(`seed sem ${oQue}`);
  return valor;
}

/* ───────────────────────────── Mensagens novas ───────────────────────────── */

/** Uma Conversa como `GET /conversas?naoLidas=true` a devolve (15-23): só o que o bloco do Início lê. */
function daLista(id: string, extra: Partial<ConversaNaLista> = {}): ConversaNaLista {
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
    atribuido: { tipo: "membro", id: THIAGO },
    adiadaAte: null,
    adiamentoMotivo: null,
    participantes: [],
    resolvidaEm: null,
    reabertaEm: null,
    reaberturas: 0,
    criadoPor: { tipo: "membro", id: THIAGO },
    criadoEm: "2026-11-01T10:00:00.000Z",
    atualizadoEm: "2026-11-02T10:00:00.000Z",
    contatoNome: `Contato ${id}`,
    estrela: false,
    naoLidas: 1,
    ultimaRecebidaEm: null,
    ...extra,
  };
}

describe("mensagens novas — as linhas que a api devolve (15-23)", () => {
  it("soma as não lidas das linhas e põe a Conversa de Mensagem mais recente primeiro", () => {
    const itens = [
      daLista("a", { naoLidas: 2, ultimaRecebidaEm: "2026-11-03T10:00:00.000Z" }),
      daLista("b", { naoLidas: 12, ultimaRecebidaEm: "2026-11-05T10:00:00.000Z" }),
      // Sem Mensagem recebida registrada: vale a última mudança da Conversa.
      daLista("c", { naoLidas: 1, ultimaRecebidaEm: null, atualizadoEm: "2026-11-04T10:00:00.000Z" }),
    ];
    const novas = mensagensNovasDasConversas(itens, 3);
    expect(novas.linhas.map((l) => [l.conversaId, l.naoLidas])).toEqual([
      ["b", 12],
      ["c", 1],
      ["a", 2],
    ]);
    expect(novas.naoLidas).toBe(15);
    expect(novas.conversas).toBe(3);
    expect(novas.parcial).toBe(false);
    expect(novas.linhas[0]).toMatchObject({ contatoNome: "Contato b", ultimaAtividade: "2026-11-05T10:00:00.000Z" });
  });

  it("o `total` da api é o número de Conversas; passando do que veio, a leitura diz que é parcial", () => {
    const novas = mensagensNovasDasConversas([daLista("a", { naoLidas: 4 })], 250);
    expect(novas.conversas).toBe(250);
    expect(novas.parcial).toBe(true);
    expect(novas.naoLidas).toBe(4);
  });

  it("linha sem não lida não entra (a api filtra, mas o domínio não confia na forma)", () => {
    const novas = mensagensNovasDasConversas([daLista("a", { naoLidas: 0 }), daLista("b", { naoLidas: 3 })], 2);
    expect(novas.linhas.map((l) => l.conversaId)).toEqual(["b"]);
    expect(novas.naoLidas).toBe(3);
  });

  it("sem linhas: tudo zero e nada parcial", () => {
    expect(mensagensNovasDasConversas([], 0)).toEqual({ linhas: [], naoLidas: 0, conversas: 0, parcial: false });
  });

  it("empate de instante desempata pelo id, para a ordem não depender da ordem da api", () => {
    const mesmoInstante = "2026-11-05T10:00:00.000Z";
    const novas = mensagensNovasDasConversas([daLista("z", { ultimaRecebidaEm: mesmoInstante }), daLista("m", { ultimaRecebidaEm: mesmoInstante })], 2);
    expect(novas.linhas.map((l) => l.conversaId)).toEqual(["m", "z"]);
  });
});

/* ───────────────────────────── Leads a atender ───────────────────────────── */

describe("Leads a atender — as Qualificações que a api recebe (15-23)", () => {
  it("o seed tem uma Qualificação chamada Lead: o id sai do Catálogo", () => {
    const state = buildProductSeed();
    expect(qualificacoesDeLead(state)).toEqual(["cat_qual_lead"]);
  });

  it("a Qualificação é lida pelo nome, sem maiúsculas nem acentos (C23: não há categoria fixa)", () => {
    const state = buildProductSeed();
    const indice = state.catalog.findIndex((c) => c.id === "cat_qual_lead");
    const item = exigir(state.catalog[indice], "cat_qual_lead");
    state.catalog[indice] = { ...item, name: "  LEAD " };
    expect(qualificacoesDeLead(state)).toEqual(["cat_qual_lead"]);
    state.catalog[indice] = { ...item, name: "Lead frio" };
    expect(qualificacoesDeLead(state)).toEqual([]);
  });

  it("só a Definição de Qualificação conta: uma Origem chamada Lead não é Qualificação", () => {
    const state = buildProductSeed();
    const indice = state.catalog.findIndex((c) => c.id === "cat_qual_lead");
    const item = exigir(state.catalog[indice], "cat_qual_lead");
    state.catalog.push({ ...item, id: "cat_origem_lead", kind: "origem", name: "Lead" });
    expect(qualificacoesDeLead(state)).toEqual(["cat_qual_lead"]);
  });
});

/* ───────────────────────────── A janela do período ───────────────────────────── */

describe("janelaDoResumo — dias civis no fuso do Espaço de Trabalho", () => {
  // Segunda-feira, 21/09/2026, 12:00 em São Paulo.
  const agora = new Date("2026-09-21T15:00:00Z");

  const contigua = (periodo: (typeof PERIODOS_DO_RESUMO)[number]) => {
    const janela = janelaDoResumo(periodo, agora, FUSO);
    const primeiro = exigir(janela.baldes[0], "balde");
    const ultimo = exigir(janela.baldes.at(-1), "balde");
    expect(janela.inicio.getTime()).toBe(primeiro.inicio.getTime());
    expect(janela.fim.getTime()).toBe(agora.getTime());
    expect(ultimo.fim.getTime()).toBe(agora.getTime());
    janela.baldes.slice(1).forEach((balde, i) => expect(balde.inicio.getTime()).toBe(janela.baldes[i]?.fim.getTime()));
    for (const balde of janela.baldes) expect(isoNoFuso(balde.inicio, FUSO)).toMatch(/T00:00$/);
    // A anterior tem a mesma duração e termina onde esta começa.
    expect(janela.inicio.getTime() - janela.anteriorInicio.getTime()).toBe(agora.getTime() - janela.inicio.getTime());
    return janela;
  };

  it("semana: os 7 últimos dias civis, hoje incluso, com o dia da semana abreviado", () => {
    const janela = contigua("semana");
    expect(janela.baldes.map((b) => b.rotulo)).toEqual(["ter", "qua", "qui", "sex", "sáb", "dom", "seg"]);
    expect(janela.inicio.toISOString()).toBe("2026-09-15T03:00:00.000Z");
    expect(janela.baldes.at(-1)?.rotuloLongo).toBe("segunda-feira, 21 de setembro");
    expect(janela.baldes[0]?.rotuloLongo).toBe("terça-feira, 15 de setembro");
  });

  it("mes: 30 dias civis, rotulados pelo dia do mês", () => {
    const janela = contigua("mes");
    expect(janela.baldes).toHaveLength(30);
    expect(janela.inicio.toISOString()).toBe("2026-08-23T03:00:00.000Z");
    expect(janela.baldes[0]?.rotulo).toBe("23");
    expect(janela.baldes.at(-1)?.rotulo).toBe("21");
    expect(janela.baldes[9]?.rotulo).toBe("1");
    expect(janela.baldes[9]?.rotuloLongo).toBe("terça-feira, 1 de setembro");
  });

  it("trimestre: 13 semanas (91 dias civis), a mais antiga primeiro", () => {
    const janela = contigua("trimestre");
    expect(janela.baldes).toHaveLength(13);
    expect(janela.inicio.toISOString()).toBe("2026-06-23T03:00:00.000Z");
    expect(janela.baldes[0]?.rotulo).toBe("23/06");
    expect(janela.baldes.at(-1)?.rotulo).toBe("15/09");
    expect(janela.baldes.at(-1)?.rotuloLongo).toBe("semana de 15/09 a 21/09");
    for (const balde of janela.baldes.slice(0, -1)) expect(balde.fim.getTime() - balde.inicio.getTime()).toBe(7 * DIA);
  });

  it("ano: os 12 meses do calendário, o corrente (parcial) incluso", () => {
    const janela = contigua("ano");
    expect(janela.baldes.map((b) => b.rotulo)).toEqual(["out", "nov", "dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set"]);
    expect(janela.inicio.toISOString()).toBe("2025-10-01T03:00:00.000Z");
    expect(janela.baldes[0]?.rotuloLongo).toBe("outubro de 2025");
    expect(janela.baldes.at(-1)?.rotuloLongo).toBe("setembro de 2026");
  });

  it("o dia vira no fuso pedido, nunca no da máquina — com horário de verão também", () => {
    // Nova York volta o relógio em 01/11/2026; Santiago pula a meia-noite de 06/09/2026.
    const casos = [
      ["America/New_York", "2026-11-03T17:00:00Z"],
      ["America/Santiago", "2026-09-08T17:00:00Z"],
      ["Asia/Kolkata", "2026-09-21T15:00:00Z"],
      [FUSO, "2026-09-21T02:30:00Z"], // 23:30 do dia 20 em São Paulo: "hoje" ainda é 20
    ] as const;
    for (const [fuso, quando] of casos) {
      const janela = janelaDoResumo("mes", new Date(quando), fuso);
      expect(janela.baldes).toHaveLength(30);
      const hoje = diaCivilNoFuso(new Date(quando), fuso);
      expect(diaCivilNoFuso(exigir(janela.baldes.at(-1), "balde").inicio, fuso), fuso).toBe(hoje);
      for (const balde of janela.baldes) {
        // O início é o PRIMEIRO instante do dia: um milissegundo antes ainda é o dia anterior.
        const dia = diaCivilNoFuso(balde.inicio, fuso);
        expect(diaCivilNoFuso(new Date(balde.inicio.getTime() - 1), fuso) < dia, `${fuso} ${dia}`).toBe(true);
      }
    }
    expect(janelaDoResumo("semana", new Date("2026-09-21T02:30:00Z"), FUSO).baldes.at(-1)?.rotulo).toBe("dom");
  });
});

/* ───────────────────────────── Estatísticas ───────────────────────────── */

/** O CRM do Membro como `GET /crm/inicio/estatisticas` o devolve; tudo vazio por padrão. */
function crmDoMembro(extra: Partial<EstatisticasDoCrm> = {}): EstatisticasDoCrm {
  return {
    desde: "2026-01-01T00:00:00.000Z",
    ate: "2026-12-31T23:59:59.999Z",
    fuso: FUSO,
    mensagensEnviadas: [],
    conversasResolvidas: [],
    negociosGanhos: [],
    ...extra,
  };
}

/** O dia civil no fuso do Espaço de `base ± n dias` (o seed nasce às 09:00 UTC, 06:00 em São Paulo: sem virar de dia). */
const diaDe = (instante: number, fuso = FUSO): string => diaCivilNoFuso(new Date(instante), fuso);

describe("estatisticasDoMembro — o CRM vem por argumento (15-23)", () => {
  it("mensagensEnviadas: 3 hoje vão ao último balde; o período anterior soma os dias anteriores", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    const crm = crmDoMembro({
      mensagensEnviadas: [
        { dia: diaDe(base), quantidade: 3 },
        { dia: diaDe(base - DIA), quantidade: 1 },
        { dia: diaDe(base - 8 * DIA), quantidade: 2 }, // semana anterior (hoje − 13 .. hoje − 7)
        { dia: diaDe(base - 20 * DIA), quantidade: 9 }, // fora das duas janelas
        { dia: diaDe(base + DIA), quantidade: 5 }, // depois de `agora`
      ],
    });
    const leitura = estatisticasDoMembro(state, THIAGO, "semana", agora, crm).metricas.mensagensEnviadas;
    expect([leitura.valor, leitura.anterior]).toEqual([4, 2]);
    expect(leitura.porBalde).toEqual([0, 0, 0, 0, 0, 1, 3]);
    expect(leitura.valorMonetario).toBeNull();
  });

  it("os baldes de mês, trimestre e ano recebem o dia no balde que o contém", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    const crm = crmDoMembro({ mensagensEnviadas: [{ dia: diaDe(base - 10 * DIA), quantidade: 4 }] });

    const mes = estatisticasDoMembro(state, THIAGO, "mes", agora, crm).metricas.mensagensEnviadas;
    expect(mes.porBalde.at(-11)).toBe(4);
    expect(mes.porBalde.reduce((x, y) => x + y, 0)).toBe(4);

    // 13 baldes de 7 dias, o primeiro começa em hoje − 90: hoje − 10 é o deslocamento 80, balde 11.
    const trimestre = estatisticasDoMembro(state, THIAGO, "trimestre", agora, crm).metricas.mensagensEnviadas;
    expect(trimestre.porBalde[11]).toBe(4);
    expect(trimestre.valor).toBe(4);

    const ano = estatisticasDoMembro(state, THIAGO, "ano", agora, crm).metricas.mensagensEnviadas;
    expect(ano.valor).toBe(4);
    expect(ano.porBalde.reduce((x, y) => x + y, 0)).toBe(4);
  });

  it("o dia vem no fuso do Espaço: 'hoje' em Kolkata cai no último balde, mesmo que em UTC seja outro dia", () => {
    const state = buildProductSeed();
    Object.assign(state.workspace.locale, { timezone: "Asia/Kolkata" });
    const agora = new Date("2026-09-21T20:00:00Z"); // 01:30 do dia 22 em Kolkata
    expect(diaDe(agora.getTime(), "Asia/Kolkata")).toBe("2026-09-22");
    const crm = crmDoMembro({ fuso: "Asia/Kolkata", conversasResolvidas: [{ dia: "2026-09-22", quantidade: 2 }, { dia: "2026-09-21", quantidade: 1 }] });
    const leitura = estatisticasDoMembro(state, THIAGO, "semana", agora, crm).metricas.conversasResolvidas;
    expect(leitura.porBalde).toEqual([0, 0, 0, 0, 0, 1, 2]);
  });

  it("tarefasConcluidas continua do store, e soma com o que o CRM trouxe nas outras métricas", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    const tarefa = exigir(state.tasks.find((t) => t.listId === "lst_pos_venda"), "tarefa");
    tarefa.completedAt = iso(base + HORA);
    tarefa.assignees = [thiago];
    const metricas = estatisticasDoMembro(state, THIAGO, "semana", agora, crmDoMembro({ mensagensEnviadas: [{ dia: diaDe(base), quantidade: 3 }] })).metricas;
    expect(metricas.tarefasConcluidas.valor).toBe(1);
    expect(metricas.mensagensEnviadas.valor).toBe(3);
  });

  it("tarefasConcluidas: Responsável, fora da lixeira e visível a quem olha; a anterior conta à parte", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    const posVenda = state.tasks.filter((t) => t.listId === "lst_pos_venda");
    expect(posVenda.length).toBeGreaterThanOrEqual(5);
    const concluir = (task: Task, quando: number, responsaveis: ActorRef[] = [thiago]) => {
      task.completedAt = iso(quando);
      task.assignees = responsaveis;
    };
    const [hoje, haTres, anterior, deOutro, naLixeira] = posVenda;
    concluir(exigir(hoje, "tarefa"), base + HORA);
    concluir(exigir(haTres, "tarefa"), base - 3 * DIA);
    concluir(exigir(anterior, "tarefa"), base - 8 * DIA);
    concluir(exigir(deOutro, "tarefa"), base - DIA, [{ kind: "member", id: "mem_julia" }]);
    concluir(exigir(naLixeira, "tarefa"), base - DIA);
    exigir(naLixeira, "tarefa").lifecycle = "naLixeira";

    const leitura = estatisticasDoMembro(state, THIAGO, "semana", agora, undefined).metricas.tarefasConcluidas;
    expect([leitura.valor, leitura.anterior]).toEqual([2, 1]);
    expect(leitura.porBalde).toEqual([0, 0, 0, 1, 0, 0, 1]);
    expect(leitura.valorMonetario).toBeNull();

    // Reaberta, a Tarefa perde o Momento de conclusão e sai da conta.
    delete exigir(haTres, "tarefa").completedAt;
    expect(estatisticasDoMembro(state, THIAGO, "semana", agora, undefined).metricas.tarefasConcluidas.valor).toBe(1);

    // RN-PAI-10 — a Lista ficou privada sem concessão a Thiago: o que ele não vê não conta.
    const lista = exigir(state.lists.find((l) => l.id === "lst_pos_venda"), "lst_pos_venda");
    lista.isPrivate = true;
    expect(state.grants.some((g) => g.subjectId === THIAGO && (g.resourceId === lista.id || g.resourceId === lista.parentId))).toBe(false);
    const semAcesso = estatisticasDoMembro(state, THIAGO, "semana", agora, undefined).metricas.tarefasConcluidas;
    expect([semAcesso.valor, semAcesso.anterior]).toEqual([0, 0]);
  });

  it("conversasResolvidas: cada dia do CRM entra com a quantidade que veio (não há Registro de Atividade no store)", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    const crm = crmDoMembro({
      conversasResolvidas: [
        { dia: diaDe(base - DIA), quantidade: 2 },
        { dia: diaDe(base - 2 * DIA), quantidade: 1 },
        { dia: diaDe(base - 10 * DIA), quantidade: 4 }, // anterior
      ],
    });
    const leitura = estatisticasDoMembro(state, THIAGO, "semana", agora, crm).metricas.conversasResolvidas;
    expect([leitura.valor, leitura.anterior]).toEqual([3, 4]);
    expect(leitura.porBalde).toEqual([0, 0, 0, 0, 1, 2, 0]);
  });

  it("negociosGanhos: soma os Valores numa moeda só; duas moedas, sem Valor ou só valor zero, nada de soma (RN-PAI-13)", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    const ganhos = (...dias: Array<readonly [number, string, number, number]>) =>
      crmDoMembro({ negociosGanhos: dias.map(([antes, moeda, quantidade, valor]) => ({ dia: diaDe(base - antes * DIA), moeda, quantidade, valor })) });
    const ler = (crm: EstatisticasDoCrm) => estatisticasDoMembro(state, THIAGO, "semana", agora, crm).metricas.negociosGanhos;

    const brl = ler(ganhos([1, "BRL", 2, 27994], [3, "BRL", 1, 0], [9, "BRL", 1, 5000]));
    expect([brl.valor, brl.anterior]).toEqual([3, 1]);
    expect(brl.porBalde).toEqual([0, 0, 0, 1, 0, 2, 0]);
    // O Negócio sem Valor conta, mas não soma nem escolhe moeda.
    expect(brl.valorMonetario).toEqual({ amount: 27994, currency: "BRL" });

    // Uma segunda moeda COM Valor na janela: somar seria converter sem taxa.
    const misturada = ler(ganhos([1, "BRL", 2, 27994], [2, "USD", 1, 3000]));
    expect(misturada.valor).toBe(3);
    expect(misturada.valorMonetario).toBeNull();

    // Moeda diferente mas Valor zero: não conta como moeda.
    expect(ler(ganhos([1, "BRL", 1, 100], [2, "USD", 1, 0])).valorMonetario).toEqual({ amount: 100, currency: "BRL" });

    // Só ganhos sem Valor, ou nenhum ganho: nada a somar.
    expect(ler(ganhos([1, "BRL", 1, 0])).valorMonetario).toBeNull();
    expect(ler(crmDoMembro()).valorMonetario).toBeNull();
  });

  it("sem resposta do CRM (carregando) ou com série null (Papel sem `ler`), o CRM é zero e as Tarefas seguem", () => {
    const state = buildProductSeed();
    const agora = agoraDoSeed(state);
    for (const crm of [undefined, crmDoMembro({ mensagensEnviadas: null, conversasResolvidas: null, negociosGanhos: null })]) {
      const metricas = estatisticasDoMembro(state, THIAGO, "mes", agora, crm).metricas;
      expect([metricas.mensagensEnviadas.valor, metricas.conversasResolvidas.valor, metricas.negociosGanhos.valor]).toEqual([0, 0, 0]);
      expect(metricas.negociosGanhos.valorMonetario).toBeNull();
    }
  });

  it("devolve as quatro métricas, na ordem declarada, com um número por balde", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    const crm = crmDoMembro({
      mensagensEnviadas: [{ dia: diaDe(base), quantidade: 2 }],
      conversasResolvidas: [{ dia: diaDe(base - DIA), quantidade: 1 }],
      negociosGanhos: [{ dia: diaDe(base - 2 * DIA), moeda: "BRL", quantidade: 1, valor: 10 }],
    });
    for (const periodo of PERIODOS_DO_RESUMO) {
      const estatisticas = estatisticasDoMembro(state, THIAGO, periodo, agora, crm);
      expect(Object.keys(estatisticas.metricas)).toEqual([...METRICAS_DO_RESUMO]);
      for (const metrica of METRICAS_DO_RESUMO) {
        const leitura = estatisticas.metricas[metrica];
        expect(leitura.metrica).toBe(metrica);
        expect(leitura.porBalde).toHaveLength(estatisticas.janela.baldes.length);
        expect(leitura.porBalde.reduce((x, y) => x + y, 0)).toBe(leitura.valor);
      }
    }
  });
});

describe("janelasDeConsultaDoCrm e juntarEstatisticasDoCrm (15-23)", () => {
  // Segunda-feira, 21/09/2026, 12:00 em São Paulo.
  const agora = new Date("2026-09-21T15:00:00Z");

  it("duas janelas por período, cada uma dentro dos 400 dias que a api aceita (o ano inteiro e o anterior não cabem numa só)", () => {
    for (const periodo of PERIODOS_DO_RESUMO) {
      const janela = janelaDoResumo(periodo, agora, FUSO);
      const { atual, anterior } = janelasDeConsultaDoCrm(janela, FUSO);
      for (const consulta of [atual, anterior]) {
        expect(conferirJanelaDeEstatisticas(consulta.desde, consulta.ate, FUSO), periodo).toEqual({ ok: true });
      }
    }
    const ano = janelasDeConsultaDoCrm(janelaDoResumo("ano", agora, FUSO), FUSO);
    expect((Date.parse(ano.anterior.ate) - Date.parse(ano.anterior.desde)) / DIA).toBeGreaterThan(300);
  });

  it("a atual começa no início do primeiro balde e termina no fim do dia de hoje; a anterior termina um ms antes da atual", () => {
    const janela = janelaDoResumo("semana", agora, FUSO);
    const { atual, anterior } = janelasDeConsultaDoCrm(janela, FUSO);
    expect(atual.desde).toBe(janela.inicio.toISOString());
    expect(isoNoFuso(new Date(atual.ate), FUSO)).toMatch(/^2026-09-21T23:59/);
    expect(diaCivilNoFuso(new Date(Date.parse(atual.ate) + 1), FUSO)).toBe("2026-09-22");
    expect(Date.parse(anterior.ate) + 1).toBe(janela.inicio.getTime());
    // A anterior abre no início de um dia do fuso, para a api devolver o dia inteiro.
    expect(isoNoFuso(new Date(anterior.desde), FUSO)).toMatch(/T00:00$/);
  });

  it("as janelas não mudam com o relógio do minuto: a chave do SWR fica estável o dia inteiro", () => {
    for (const periodo of PERIODOS_DO_RESUMO) {
      const a = janelasDeConsultaDoCrm(janelaDoResumo(periodo, agora, FUSO), FUSO);
      const b = janelasDeConsultaDoCrm(janelaDoResumo(periodo, new Date(agora.getTime() + 60_000), FUSO), FUSO);
      expect(b, periodo).toEqual(a);
    }
  });

  it("juntar põe as séries das duas janelas numa só; série null nas duas continua null", () => {
    const atual = crmDoMembro({ desde: "2026-09-15T03:00:00.000Z", ate: "2026-09-22T02:59:59.999Z", mensagensEnviadas: [{ dia: "2026-09-21", quantidade: 1 }], conversasResolvidas: null });
    const anterior = crmDoMembro({ desde: "2026-09-08T03:00:00.000Z", ate: "2026-09-15T02:59:59.999Z", mensagensEnviadas: [{ dia: "2026-09-10", quantidade: 2 }], conversasResolvidas: null });
    const junto = exigir(juntarEstatisticasDoCrm(atual, anterior), "junta");
    expect(junto.mensagensEnviadas).toEqual([{ dia: "2026-09-10", quantidade: 2 }, { dia: "2026-09-21", quantidade: 1 }]);
    expect(junto.conversasResolvidas).toBeNull();
    expect(junto.negociosGanhos).toEqual([]);
    expect([junto.desde, junto.ate, junto.fuso]).toEqual(["2026-09-08T03:00:00.000Z", "2026-09-22T02:59:59.999Z", FUSO]);
  });

  it("sem uma das respostas, a junta usa só a que chegou", () => {
    const so = crmDoMembro({ mensagensEnviadas: [{ dia: "2026-09-21", quantidade: 1 }] });
    expect(juntarEstatisticasDoCrm(so, undefined)).toBe(so);
    expect(juntarEstatisticasDoCrm(undefined, so)).toBe(so);
    expect(juntarEstatisticasDoCrm(undefined, undefined)).toBeUndefined();
  });
});

/* ───────────────────────────── Recortes de Minhas Tarefas ───────────────────────────── */

describe("recortesDeTarefas — os números das abas de Minhas Tarefas", () => {
  it("a call de hoje é agenda e semana antes da hora; depois dela, vencida", () => {
    // O seed completo: as Reuniões do processo comercial moravam, no seed do produto, na Pasta "Meus negócios",
    // que saiu com o CRM antigo (15-31) — o seed do produto não tem mais Tarefa de hoje para o Thiago.
    const state = buildSeed();
    const base = baseDoSeed(state);
    const call = exigir(state.tasks.find((t) => t.id === "tsk_call_ref"), "tsk_call_ref");
    expect(call.dueDate?.form).toBe("instant");
    const reunioesDeHoje = ["tsk_reuniao_1", "tsk_call_ref", "tsk_reuniao_2", "tsk_reuniao_3"];

    const cedo = recortesDeTarefas(state, THIAGO, new Date(base));
    expect(cedo.minhas).toHaveLength(6);
    expect(cedo.hoje.map((t) => t.id)).toEqual(reunioesDeHoje);
    expect(cedo.semana.map((t) => t.id)).toEqual(["tsk_call_ref", "tsk_reuniao_2", "tsk_reuniao_3", "tsk_seed_3"]);
    expect(cedo.vencidas.map((t) => t.id)).toEqual(["tsk_seed_1", "tsk_reuniao_1"]);

    const tarde = recortesDeTarefas(state, THIAGO, agoraDoSeed(state));
    expect(tarde.hoje.map((t) => t.id)).toEqual(reunioesDeHoje);
    expect(tarde.vencidas.map((t) => t.id)).toEqual(["tsk_seed_1", ...reunioesDeHoje.slice(0, 1), "tsk_call_ref", "tsk_reuniao_2", "tsk_reuniao_3"]);
    expect(tarde.semana.map((t) => t.id)).toEqual(["tsk_seed_3"]);
    // Vencimento mais próximo primeiro; sem data ao fim.
    const chaves = tarde.minhas.map((t) => String(t.dueDate?.value ?? "9999"));
    expect(chaves).toEqual([...chaves].sort());
  });
});
