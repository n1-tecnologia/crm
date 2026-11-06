/**
 * O resumo do Membro no Início: mensagens novas, Leads a atender e as
 * estatísticas do período.
 *
 * O seed nasce de HOJE às 09:00 UTC (`BASE` em seed.ts). Nenhum teste lê o
 * relógio da máquina: `agora` sai de um instante do próprio seed, para o
 * resultado não mudar com a hora do dia em que a suíte roda.
 */

import { describe, expect, it } from "vitest";
import { buildProductSeed } from "./seed-produto";
import { resolveConversation } from "./operations/conversations";
import {
  METRICAS_DO_RESUMO,
  PERIODOS_DO_RESUMO,
  estatisticasDoMembro,
  janelaDoResumo,
  mensagensNovasDasConversas,
  qualificacoesDeLead,
} from "./derive-resumo";
import { diaCivilNoFuso, recortesDeTarefas } from "./recortes-de-tarefas";
import { isoNoFuso } from "./relogio";
import type { DataState } from "./state";
import type { ConversaNaLista } from "./crm/conversas";
import type { ActivityRecord, ActorRef, Deal, Task } from "./types";

const THIAGO = "mem_thiago";
const FUSO = "America/Sao_Paulo"; // UTC−3, sem horário de verão desde 2019
const HORA = 3_600_000;
const DIA = 24 * HORA;
const thiago: ActorRef = { kind: "member", id: THIAGO };

/** O `BASE` do seed (hoje, 09:00 UTC), lido de um registro: o Contato `cnt_31` nasce em `at(2)`. */
function baseDoSeed(state: DataState): number {
  const criado = state.contacts.find((c) => c.id === "cnt_31")?.createdAt;
  if (!criado) throw new Error("seed sem cnt_31");
  const base = Date.parse(criado) + 2 * DIA;
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

  it("a Definição arquivada continua valendo para quem já a tem; só Qualificação conta", () => {
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

describe("estatisticasDoMembro", () => {
  it("mensagensEnviadas: as 13 de Thiago (há 12,12,11,11,11,9,9,9,9,7,7,1,0 dias) no mês; 2 na semana e 11 na anterior", () => {
    const state = buildProductSeed();
    const agora = agoraDoSeed(state);

    const mes = estatisticasDoMembro(state, THIAGO, "mes", agora).metricas.mensagensEnviadas;
    expect([mes.valor, mes.anterior]).toEqual([13, 0]);
    expect(mes.porBalde.reduce((a, b) => a + b, 0)).toBe(13);
    expect(mes.porBalde.slice(-13)).toEqual([2, 3, 0, 4, 0, 2, 0, 0, 0, 0, 0, 1, 1]);

    const semana = estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.mensagensEnviadas;
    expect([semana.valor, semana.anterior]).toEqual([2, 11]);
    expect(semana.porBalde).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(semana.valorMonetario).toBeNull();

    for (const periodo of ["trimestre", "ano"] as const) {
      const leitura = estatisticasDoMembro(state, THIAGO, periodo, agora).metricas.mensagensEnviadas;
      expect(leitura.valor, periodo).toBe(13);
      expect(leitura.porBalde.reduce((a, b) => a + b, 0), periodo).toBe(13);
    }

    // Nota interna não é Mensagem enviada; a Conversa na lixeira sai da conta.
    const sdr = exigir(state.conversations.find((c) => c.id === "cnv_sdr_1"), "cnv_sdr_1");
    sdr.lifecycle = "naLixeira";
    expect(estatisticasDoMembro(state, THIAGO, "mes", agora).metricas.mensagensEnviadas.valor).toBe(0);
  });

  it("uma Mensagem depois de `agora` não conta — nem no período, nem no balde", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    // Às 09:00 UTC em ponto, a de "hoje às 09:00" é exatamente `agora` e conta; um minuto antes, não.
    expect(estatisticasDoMembro(state, THIAGO, "semana", new Date(base)).metricas.mensagensEnviadas.valor).toBe(2);
    expect(estatisticasDoMembro(state, THIAGO, "semana", new Date(base - 60_000)).metricas.mensagensEnviadas.valor).toBe(1);
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

    const leitura = estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.tarefasConcluidas;
    expect([leitura.valor, leitura.anterior]).toEqual([2, 1]);
    expect(leitura.porBalde).toEqual([0, 0, 0, 1, 0, 0, 1]);
    expect(leitura.valorMonetario).toBeNull();

    // Reaberta, a Tarefa perde o Momento de conclusão e sai da conta.
    delete exigir(haTres, "tarefa").completedAt;
    expect(estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.tarefasConcluidas.valor).toBe(1);

    // RN-PAI-10 — a Lista ficou privada sem concessão a Thiago: o que ele não vê não conta.
    const lista = exigir(state.lists.find((l) => l.id === "lst_pos_venda"), "lst_pos_venda");
    lista.isPrivate = true;
    expect(state.grants.some((g) => g.subjectId === THIAGO && (g.resourceId === lista.id || g.resourceId === lista.parentId))).toBe(false);
    const semAcesso = estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.tarefasConcluidas;
    expect([semAcesso.valor, semAcesso.anterior]).toEqual([0, 0]);
  });

  it("conversasResolvidas: o Registro que `resolveConversation` grava, com Thiago como Ator", () => {
    const state = buildProductSeed();
    const resultado = resolveConversation(state, THIAGO, "cnv_1");
    expect(resultado.ok).toBe(true);
    const registro = exigir(state.activity.find((r) => r.objectId === "cnv_1" && r.actor.id === THIAGO), "registro");
    expect(registro.action).toBe("Conversa resolvida");
    // O Registro leva o relógio da máquina; `agora` vem dele, não de `new Date()`.
    const agora = new Date(Date.parse(registro.at) + 60_000);
    expect(estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.conversasResolvidas.valor).toBe(1);
    // As resolvidas do seed são de Julia.
    expect(estatisticasDoMembro(state, "mem_julia", "mes", agora).metricas.conversasResolvidas.valor).toBeGreaterThan(0);
  });

  it("conversasResolvidas: conta cada ato, pelo instante do Registro; recusado, mesclagem e lixeira ficam fora", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    let n = 0;
    const registrar = (quando: number, objectId: string, extra: Partial<Pick<ActivityRecord, "action" | "result" | "actor">> = {}) => {
      n += 1;
      state.activity.push({
        id: `act_teste_${n}`,
        workspaceId: state.workspace.id,
        actor: thiago,
        action: "Conversa resolvida",
        objectType: "conversation",
        objectId,
        objectName: objectId,
        at: iso(quando),
        result: "ok",
        ...extra,
      });
    };
    registrar(base - DIA, "cnv_1");
    registrar(base - 2 * DIA, "cnv_1"); // resolver, reabrir e resolver de novo: dois atos
    registrar(base - 10 * DIA, "cnv_2"); // janela anterior
    registrar(base - DIA, "cnv_3", { result: "denied" });
    registrar(base - DIA, "cnv_4", { action: "Conversa resolvida por mesclagem" });
    registrar(base - DIA, "cnv_5", { actor: { kind: "member", id: "mem_julia" } });
    registrar(base - DIA, "cnv_inexistente"); // objeto eliminado (RN-PAI-30)
    const naLixeira = exigir(state.conversations.find((c) => c.lifecycle === "naLixeira"), "Conversa na lixeira");
    registrar(base - DIA, naLixeira.id);

    const leitura = estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.conversasResolvidas;
    expect([leitura.valor, leitura.anterior]).toEqual([2, 1]);
    expect(leitura.porBalde).toEqual([0, 0, 0, 0, 1, 1, 0]);
  });

  it("negociosGanhos: Proprietário, ganho, pelo encerramento; soma numa moeda só (RN-PAI-13)", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const agora = agoraDoSeed(state);
    // Nenhum Negócio do seed é de Thiago: seis quaisquer, reescritos abaixo.
    expect(state.deals.some((deal) => deal.ownerMemberId === THIAGO && deal.situation === "ganho")).toBe(false);
    const negocios = state.deals.filter((d) => d.lifecycle === "ativo");
    expect(negocios.length).toBeGreaterThanOrEqual(6);
    const ganhar = (deal: Deal, quando: number, valor?: Deal["value"]) => {
      deal.ownerMemberId = THIAGO;
      deal.situation = "ganho";
      deal.closedAt = iso(quando);
      if (valor) deal.value = valor;
      else delete deal.value;
    };
    const [a, b, c, d, e, f] = negocios;
    ganhar(exigir(a, "negócio"), base - DIA, { amount: 16997, currency: "BRL" });
    ganhar(exigir(b, "negócio"), base - 2 * DIA, { amount: 10997, currency: "BRL" });
    ganhar(exigir(c, "negócio"), base - 3 * DIA); // sem Valor: conta, não soma
    ganhar(exigir(d, "negócio"), base - 9 * DIA, { amount: 5000, currency: "BRL" }); // anterior
    ganhar(exigir(e, "negócio"), base - DIA, { amount: 1000, currency: "BRL" });
    exigir(e, "negócio").lifecycle = "naLixeira";
    const deOutro = exigir(f, "negócio");
    deOutro.situation = "ganho";
    deOutro.closedAt = iso(base - DIA);
    deOutro.ownerMemberId = "mem_rafael";

    const leitura = estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.negociosGanhos;
    expect([leitura.valor, leitura.anterior]).toEqual([3, 1]);
    expect(leitura.porBalde).toEqual([0, 0, 0, 1, 1, 1, 0]);
    expect(leitura.valorMonetario).toEqual({ amount: 27994, currency: "BRL" });

    // Uma segunda moeda na janela: somar seria converter sem taxa. Nada de soma.
    exigir(c, "negócio").value = { amount: 3000, currency: "USD" };
    const misturada = estatisticasDoMembro(state, THIAGO, "semana", agora).metricas.negociosGanhos;
    expect(misturada.valor).toBe(3);
    expect(misturada.valorMonetario).toBeNull();

    // Nenhum ganho no período: nada a somar.
    expect(estatisticasDoMembro(state, "mem_julia", "semana", agora).metricas.negociosGanhos.valorMonetario).toBeNull();
  });

  it("devolve as quatro métricas, na ordem declarada, com um número por balde", () => {
    const state = buildProductSeed();
    const agora = agoraDoSeed(state);
    for (const periodo of PERIODOS_DO_RESUMO) {
      const estatisticas = estatisticasDoMembro(state, THIAGO, periodo, agora);
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

/* ───────────────────────────── Recortes de Minhas Tarefas ───────────────────────────── */

describe("recortesDeTarefas — os números das abas de Minhas Tarefas", () => {
  it("a call de hoje é agenda e semana antes da hora; depois dela, vencida", () => {
    const state = buildProductSeed();
    const base = baseDoSeed(state);
    const call = exigir(state.tasks.find((t) => t.id === "tsk_call_ref"), "tsk_call_ref");
    expect(call.dueDate?.form).toBe("instant");

    const cedo = recortesDeTarefas(state, THIAGO, new Date(base));
    expect(cedo.minhas).toHaveLength(3);
    expect(cedo.hoje.map((t) => t.id)).toEqual(["tsk_call_ref"]);
    expect(cedo.semana.map((t) => t.id)).toEqual(["tsk_call_ref"]);
    expect(cedo.vencidas).toEqual([]);

    const tarde = recortesDeTarefas(state, THIAGO, agoraDoSeed(state));
    expect(tarde.hoje.map((t) => t.id)).toEqual(["tsk_call_ref"]);
    expect(tarde.vencidas.map((t) => t.id)).toEqual(["tsk_call_ref"]);
    expect(tarde.semana).toEqual([]);
    // Vencimento mais próximo primeiro; sem data ao fim.
    const chaves = tarde.minhas.map((t) => String(t.dueDate?.value ?? "9999"));
    expect(chaves).toEqual([...chaves].sort());
  });
});
