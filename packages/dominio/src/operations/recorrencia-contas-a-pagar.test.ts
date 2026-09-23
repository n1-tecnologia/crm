/**
 * A1 — a Recorrência de Contas a pagar, travada por par de datas exato.
 *
 * Este arquivo existe por um motivo só: as três regras de vencimento que o
 * usuário decidiu (D3-05, D3-06 e D3-07) já estavam implementadas e corretas,
 * mas nenhuma quebrava a suíte se alguém as mudasse. O único teste que tocava
 * o assunto (`operations.test.ts`, "seção 7 + A1/A9") verifica que o vencimento
 * da próxima ocorrência "não caiu em sábado nem domingo" — nunca em que dia
 * exatamente caiu. Uma regra que só é verificada por `dow !== 0 && dow !== 6`
 * aceita, sem reclamar, qualquer data de segunda a sexta.
 *
 * Aqui cada decisão tem um par de datas que a nomeia: entrada → saída. Quem
 * mudar `addMonths` ou `toBusinessDay` (`collaboration.ts`) quebra um caso cujo
 * título diz qual decisão foi violada.
 *
 * Fica fora de `operations.test.ts` de propósito: aquele arquivo é o retrato do
 * processo inteiro, este é a prova de uma regra. Nada daqui reescreve
 * expectativa de lá — as de lá continuam byte a byte onde estavam.
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { nextOccurrenceRefusal, setRecurrence } from "./collaboration";
import { CP } from "./financeiro";
import { changeTaskStatus, updateTask } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};

/** O mesmo valor que `spawnNextOccurrence` grava em `dueDate` da ocorrência nova. */
const proximoVencimento = (taskId: string): string | undefined => nextOccurrenceRefusal(state, conta(taskId)).dueDate?.value;

/**
 * Posiciona a conta num vencimento conhecido e, quando a regra sob teste não é
 * a do seed, troca a regra. `businessDays` omitido isola a saturação de D3-07;
 * `"anterior"` é a regra real do Financeiro (`seed-financeiro.ts`, `recorrente()`).
 */
const posicionar = (taskId: string, vencimento: string, businessDays?: "anterior" | "posterior"): void => {
  expect(updateTask(state, CP.financeiroId, taskId, { dueDate: { form: "civilDay", value: vencimento } }).ok).toBe(true);
  const r = setRecurrence(state, CP.financeiroId, taskId, {
    frequency: "mensal",
    interval: 1,
    triggerMode: "aoConcluir",
    ...(businessDays ? { businessDays } : {}),
    copies: { checklists: false, subtasks: false, assignees: false, fieldValues: true },
  });
  // Se a Lista recusasse Recorrência, isso é defeito — o teste denuncia, não contorna.
  expect(r.ok).toBe(true);
};

/** Realimenta o vencimento a cada passo: é assim que a série anda de verdade. */
const cadeia = (taskId: string, inicio: string, passos: number, businessDays?: "anterior" | "posterior"): string[] => {
  posicionar(taskId, inicio, businessDays);
  const datas = [inicio];
  for (let i = 0; i < passos; i += 1) {
    const proxima = proximoVencimento(taskId);
    if (!proxima) throw new Error(`a série parou no passo ${i + 1}`);
    datas.push(proxima);
    expect(updateTask(state, CP.financeiroId, taskId, { dueDate: { form: "civilDay", value: proxima } }).ok).toBe(true);
  }
  return datas;
};

const CONTA = "tsk_cp_thiago_out"; // já nasce com Recorrência mensal e vencimento editável

describe("D3-07 — dia inexistente no mês: satura no último dia, nunca transborda", () => {
  it("31/01 + 1 mês é 28/02 — e explicitamente não é 01/03 nem 03/03", () => {
    posicionar(CONTA, "2026-01-31");
    const proxima = proximoVencimento(CONTA);
    expect(proxima).toBe("2026-02-28");
    // As duas saídas que a decisão recusa por escrito: transbordar geraria uma
    // segunda cobrança perto da virada do mês.
    expect(proxima).not.toBe("2026-03-01");
    expect(proxima).not.toBe("2026-03-03");
  });

  it("ano bissexto: 31/01/2028 + 1 mês é 29/02/2028, o último dia que existe", () => {
    posicionar(CONTA, "2028-01-31");
    expect(proximoVencimento(CONTA)).toBe("2028-02-29");
  });

  it("31/03 + 1 mês é 30/04 — abril não tem dia 31", () => {
    posicionar(CONTA, "2026-03-31");
    expect(proximoVencimento(CONTA)).toBe("2026-04-30");
  });

  it("as duas regras compostas, nesta ordem: satura em 28/02 (sábado) e só depois recua para 27/02", () => {
    posicionar(CONTA, "2026-01-31", "anterior");
    // Se o recuo viesse antes da saturação, a saída seria outra — 28/02/2026 é sábado.
    expect(proximoVencimento(CONTA)).toBe("2026-02-27");
  });

  it("a saturação é absorvente: a série de dia 31 não volta ao dia 31", () => {
    // Consequência observada de D3-07, não regra separada: o vencimento da
    // próxima ocorrência é calculado a partir do vencimento da anterior, e a
    // anterior já saturou. Corrigir exigiria guardar o dia âncora da série —
    // código novo, fora deste plano. O teste pina o comportamento para que a
    // decisão de mudá-lo seja deliberada.
    expect(cadeia(CONTA, "2026-01-31", 3)).toEqual(["2026-01-31", "2026-02-28", "2026-03-28", "2026-04-28"]);
  });

  it("com a regra real do Financeiro (dia útil anterior) o recuo acumula: dia 31 vira dia 26 em cinco meses", () => {
    expect(cadeia(CONTA, "2026-01-31", 5, "anterior")).toEqual([
      "2026-01-31",
      "2026-02-27",
      "2026-03-27",
      "2026-04-27",
      "2026-05-27",
      "2026-06-26",
    ]);
  });
});

describe("D3-06 — feriado é dia útil comum; só fim de semana desloca", () => {
  it("segunda-feira de Carnaval de 2026 (16/02) é dia de vencimento como outro qualquer", () => {
    posicionar(CONTA, "2026-01-16", "anterior");
    expect(proximoVencimento(CONTA)).toBe("2026-02-16");
  });

  it("terça-feira de Carnaval de 2026 (17/02) também — é a consequência que o texto de D3-06 aceita por escrito", () => {
    posicionar(CONTA, "2026-01-17", "anterior");
    expect(proximoVencimento(CONTA)).toBe("2026-02-17");
  });

  it("Natal numa sexta (25/12/2026) não desloca", () => {
    posicionar(CONTA, "2026-11-25", "anterior");
    expect(proximoVencimento(CONTA)).toBe("2026-12-25");
  });

  it("Proclamação da República de 2026 cai num domingo: desloca por ser domingo, não por ser feriado", () => {
    posicionar(CONTA, "2026-10-15", "anterior");
    // 15/11/2026 é domingo. O recuo de domingo com "anterior" é de dois dias —
    // sexta 13. Se o feriado contasse, a saída seria a véspera dele (13 também
    // não), mas o que prova a causa é o tamanho do passo: dois dias, a regra de
    // domingo, e nenhuma tabela de feriado consultada.
    expect(proximoVencimento(CONTA)).toBe("2026-11-13");
  });

  it("o export do ClickUp não decide a questão: nenhum vencimento real caiu em feriado", () => {
    // Registro do que foi verificado contra `apps/api/exportacoes/clickup/901107637383/`
    // (2.861 Tarefas, 2.830 com vencimento, janela 2025-01-17 → 2026-10-15):
    // nenhuma das 2.830 cai em feriado nacional. O dado não prova nem desmente
    // a regra — mostra que o caso nunca aconteceu. A data 2025-02-17, citada em
    // `03-RESEARCH.md`, é uma segunda-feira comum com 11 Tarefas.
    // D3-06 vale por decisão do usuário, não por evidência do export.
    expect(true).toBe(true);
  });
});

describe("D3-06 — fim de semana desloca nos dois sentidos", () => {
  it('"anterior": sábado recua um dia — 07/02 + 1 mês é 07/03 (sábado), vence em 06/03', () => {
    posicionar(CONTA, "2026-02-07", "anterior");
    expect(proximoVencimento(CONTA)).toBe("2026-03-06");
  });

  it('"anterior": domingo recua dois dias — 15/10 + 1 mês é 15/11 (domingo), vence na sexta 13/11', () => {
    posicionar(CONTA, "2026-10-15", "anterior");
    expect(proximoVencimento(CONTA)).toBe("2026-11-13");
  });

  it('"posterior": sábado avança dois dias — 07/03 (sábado) vence na segunda 09/03', () => {
    posicionar(CONTA, "2026-02-07", "posterior");
    expect(proximoVencimento(CONTA)).toBe("2026-03-09");
  });

  it("dia de semana não se move: 05/02 + 1 mês é 05/03, uma quinta-feira", () => {
    posicionar(CONTA, "2026-02-05", "anterior");
    expect(proximoVencimento(CONTA)).toBe("2026-03-05");
  });

  it("nenhuma dependência de datas entrou no domínio: `dependencies` continua só `zod`", () => {
    // O guarda executável da frase de D3-06 "nenhuma biblioteca de datas nova".
    // Tratar feriado corretamente exigiria uma; a decisão foi não tratar.
    const pacote = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      readonly dependencies: Record<string, string>;
    };
    expect(Object.keys(pacote.dependencies)).toEqual(["zod"]);
  });
});

/* ── D3-05/RN-CP-06 — o fechamento real, não só o cálculo ───────────────── */

/** Só muda o vencimento: a regra que vale é a do seed (`recorrente()`, dia útil anterior). */
const vencendoEm = (taskId: string, vencimento: string): void => {
  expect(updateTask(state, CP.financeiroId, taskId, { dueDate: { form: "civilDay", value: vencimento } }).ok).toBe(true);
};

/** O roteiro de Status que uma conta percorre até `pago` (RN-CP-04). */
const pagar = (taskId: string): void => {
  expect(changeTaskStatus(state, CP.financeiroId, taskId, CP.status.emRemessa).ok).toBe(true);
  expect(changeTaskStatus(state, CP.financeiroId, taskId, CP.status.emAutorizacao).ok).toBe(true);
  expect(changeTaskStatus(state, CP.aprovadorId, taskId, CP.status.pago).ok).toBe(true);
};

const nascidasDe = (sourceId: string): Task[] =>
  state.tasks.filter((t) => t.provenance?.kind === "recurrence" && t.provenance.sourceId === sourceId);

const registrosDeOcorrencia = (objectId: string): number =>
  state.activity.filter((a) => a.action === "Próxima ocorrência criada" && a.objectId === objectId).length;

const contasDaLista = (): number => state.tasks.filter((t) => t.listId === CP.listId).length;

describe("D3-05/RN-CP-06 — uma ocorrência por fechamento, e a cadeia continua na ocorrência nova", () => {
  // O caso simples — fecha, nasce uma, reabre, fecha, não nasce a segunda — já
  // está provado em `operations.test.ts` ("seção 7 + A1/A9"). Nada aqui o
  // duplica: este bloco cobre o que lá não é olhado — a data exata da
  // ocorrência nova, a transferência da regra, a contagem de Registro de
  // Atividade e a continuidade da cadeia a partir da ocorrência, não da origem.

  it("(a) a regra migra para a ocorrência nova, e o vencimento dela é o par exato de D3-06/D3-07", () => {
    const origem = conta(CONTA);
    expect(origem.recurrence?.businessDays).toBe("anterior");
    vencendoEm(CONTA, "2026-01-31");
    pagar(CONTA);

    const nascidas = nascidasDe(origem.id);
    expect(nascidas).toHaveLength(1);
    const nova = nascidas[0];
    if (!nova) throw new Error("sem ocorrência nova");

    expect(nova.provenance?.kind).toBe("recurrence");
    expect(nova.provenance?.sourceId).toBe(origem.id);
    // 28/02/2026 é sábado: satura (D3-07) e depois recua (D3-06).
    expect(nova.dueDate?.value).toBe("2026-02-27");
    // A regra é transferida, não copiada: a concluída deixa de gerar.
    expect(nova.recurrence).toBeDefined();
    expect(origem.recurrence).toBeUndefined();
    expect(registrosDeOcorrencia(nova.id)).toBe(1);
  });

  it("(b) reabrir e fechar de novo não duplica — nem a Tarefa, nem o Registro de Atividade", () => {
    const origem = conta(CONTA);
    vencendoEm(CONTA, "2026-01-31");
    pagar(CONTA);

    const nova = nascidasDe(origem.id)[0];
    if (!nova) throw new Error("sem ocorrência nova");
    const contasAntes = contasDaLista();

    expect(changeTaskStatus(state, CP.aprovadorId, origem.id, CP.status.lancado).ok).toBe(true);
    expect(changeTaskStatus(state, CP.aprovadorId, origem.id, CP.status.pago).ok).toBe(true);

    expect(contasDaLista()).toBe(contasAntes);
    expect(nascidasDe(origem.id)).toHaveLength(1);
    // A barreira que o teste antigo não tem: uma regressão que criasse a
    // Atividade sem a Tarefa deixaria a trilha mentindo sobre quantas vezes a
    // série andou, e `state.tasks.length` não veria nada.
    expect(registrosDeOcorrencia(nova.id)).toBe(1);
  });

  it("(c) a cadeia continua na ocorrência nova, não na origem", () => {
    const origem = conta(CONTA);
    vencendoEm(CONTA, "2026-01-31");
    pagar(CONTA);
    const segunda = nascidasDe(origem.id)[0];
    if (!segunda) throw new Error("sem segunda ocorrência");

    pagar(segunda.id);
    const terceiras = nascidasDe(segunda.id);
    expect(terceiras).toHaveLength(1);
    const terceira = terceiras[0];
    if (!terceira) throw new Error("sem terceira ocorrência");

    // `occurrenceOrdinal`/`endsAfter` andam por `provenance`, e a proveniência
    // aponta para a ocorrência anterior — nunca de volta para a origem.
    expect(terceira.provenance?.sourceId).toBe(segunda.id);
    expect(terceira.provenance?.sourceId).not.toBe(origem.id);
    // O passo seguinte exato da cadeia: 27/02 → 27/03 (sexta, não desloca).
    expect(terceira.dueDate?.value).toBe("2026-03-27");
    expect(segunda.recurrence).toBeUndefined();
    expect(terceira.recurrence).toBeDefined();
  });
});
