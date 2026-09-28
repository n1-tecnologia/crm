/**
 * Wave 0 de PAG-01: a prova de que o replay de uma Conta a pagar histórica é
 * MUDO — nenhuma das sete Automações da Lista percebe que a importação
 * aconteceu — e de que "tempo em 'para pagar'" continua mensurável a partir
 * só do que a importação gravou (D3-04).
 *
 * O bootstrap usado é `buildGestaoBootstrap`, que monta a configuração do
 * Financeiro **com as Automações** e sem Tarefas fictícias
 * (`../bootstrap-gestao.ts`, `applyContasAPagar(state, clock, { fixtures:
 * false })`). É isso que torna a asserção "nenhuma Execução de Automação"
 * não-vazia: o caso (a) afirma primeiro que há sete Automações ativas na
 * Lista, e só depois que nenhuma rodou.
 *
 * Fixtures inventadas, no molde dos fictícios de `../seed-financeiro.ts`
 * (T-3-07): nenhum CPF, CNPJ, chave Pix ou código de barras real entra no
 * repositório. Os instantes do histórico são ISO-8601 fixos e legíveis; a
 * forma crua do `status_history` (epoch-ms em string) é conversão do Plan
 * 03-10 e aparece aqui só como transições já em ISO e FORA de ordem
 * cronológica, para provar que a operação reordena.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import type { DataState } from "../state";
import type { Id } from "../types";
import { CP } from "./financeiro";
import {
  contaAPagarJaImportada,
  importarContaAPagarHistorica,
  ORIGEM_CONTAS_A_PAGAR,
  type EntradaDeContaAPagarHistorica,
} from "./importacao-contas-a-pagar";

const AGORA = "2026-09-23T12:00:00.000Z";
const OPERADOR: Id = "mem_maryane";

/** Um ciclo real, em datas legíveis: nasce, entra em autorização, é paga. */
const NASCEU = "2025-01-16T13:19:38.000Z";
const ENTROU_PARA_PAGAR = "2025-01-16T13:19:38.000Z";
const ENTROU_EM_AUTORIZACAO = "2025-02-10T10:05:00.000Z";
const FOI_PAGA = "2025-02-15T18:21:23.000Z";

function entradaBase(overrides: Partial<EntradaDeContaAPagarHistorica> = {}): EntradaDeContaAPagarHistorica {
  return {
    legacyTaskId: "868c0qx31",
    titulo: "Papelaria Aurora ME — material de escritório",
    statusFinalId: CP.status.pago,
    criadaEm: NASCEU,
    fechadaEm: FOI_PAGA,
    // Fora de ordem cronológica de propósito: é como o export chega.
    transicoes: [
      { em: FOI_PAGA, statusId: CP.status.pago, nomeLegado: "pago" },
      { em: ENTROU_PARA_PAGAR, statusId: CP.status.paraPagar, nomeLegado: "para pagar" },
      { em: ENTROU_EM_AUTORIZACAO, statusId: CP.status.emAutorizacao, nomeLegado: "em autorização bancária" },
    ],
    campos: {
      [CP.fields.centroDeCusto]: "TRIA",
      [CP.fields.categoria]: "Administrativo",
      [CP.fields.nomeFornecedor]: "Papelaria Aurora ME",
      [CP.fields.valor]: 1234.56,
    },
    lacunas: [],
    ...overrides,
  };
}

/**
 * "Tempo em 'para pagar'", em código: lê só `state.activity`, sem nenhum dado
 * auxiliar. O array vive em ordem inversa da cronológica (`recordActivity`
 * faz `unshift`), então ordena por `at` antes de procurar o par
 * entrada → próxima transição.
 */
function diasEmStatus(state: DataState, taskId: Id, nomeDoStatus: string): number | undefined {
  const registros = state.activity
    .filter((a) => a.objectId === taskId && a.action === "Status alterado")
    .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
  const indice = registros.findIndex((a) => a.after === nomeDoStatus);
  const entrada = indice === -1 ? undefined : registros[indice];
  const saida = indice === -1 ? undefined : registros[indice + 1];
  if (!entrada || !saida) return undefined;
  return (Date.parse(saida.at) - Date.parse(entrada.at)) / 86_400_000;
}

describe("importarContaAPagarHistorica", () => {
  let s: DataState;

  beforeEach(() => {
    s = buildGestaoBootstrap({ agora: AGORA });
  });

  it("(a) replay mudo: nenhuma Automação da Lista dispara, nenhuma recorrência fantasma, nenhum Comentário", () => {
    // A prova não pode ser vazia: as Automações precisam estar lá para que
    // "nenhuma rodou" signifique alguma coisa.
    const ativas = s.automations.filter((a) => a.scopeId === CP.listId && a.lifecycle === "ativo");
    expect(ativas.length).toBeGreaterThanOrEqual(6); // A2–A6 e A9 (A7 saiu no plano pós-auditoria, 1.5)

    const tarefasAntes = s.tasks.length;
    const r = importarContaAPagarHistorica(s, OPERADOR, entradaBase({ responsaveis: [OPERADOR] }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(s.automationExecutions.length).toBe(0);
    expect(s.tasks.length).toBe(tarefasAntes + 1);
    expect(r.value.comments.length).toBe(0);
    expect(r.value.assignees).toEqual([{ kind: "member", id: OPERADOR }]);
    expect(r.value.statusId).toBe(CP.status.pago);
    expect(r.value.provenance?.sourceName).toBe(ORIGEM_CONTAS_A_PAGAR);
  });

  it("(b) a trilha carrega a data original de cada transição, não a da importação", () => {
    const entrada = entradaBase();
    const r = importarContaAPagarHistorica(s, OPERADOR, entrada);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    const registros = s.activity.filter((a) => a.objectId === r.value.id);
    const status = registros.filter((a) => a.action === "Status alterado");
    expect(status.length).toBe(entrada.transicoes.length);
    expect(status.map((a) => a.at).sort()).toEqual(entrada.transicoes.map((t) => t.em).sort());

    expect(r.value.createdAt).toBe(NASCEU);
    expect(r.value.completedAt).toBe(FOI_PAGA);

    // ISO-8601 em UTC compara lexicograficamente: nenhum Registro desta
    // Tarefa pode ser posterior ao fim do histórico — se algum fosse, teria
    // sido datado com o relógio da importação.
    const maiorDoHistorico = [...entrada.transicoes].map((t) => t.em).sort().at(-1)!;
    expect(registros.every((a) => a.at <= maiorDoHistorico)).toBe(true);
  });

  it("(c) tempo em “para pagar” é mensurável: 30 dias entre a entrada e a transição seguinte", () => {
    const entrou = "2025-03-01T09:00:00.000Z";
    const saiu = "2025-03-31T09:00:00.000Z";
    const r = importarContaAPagarHistorica(
      s,
      OPERADOR,
      entradaBase({
        legacyTaskId: "868c5wva6",
        criadaEm: entrou,
        fechadaEm: saiu,
        transicoes: [
          { em: saiu, statusId: CP.status.pago, nomeLegado: "pago" },
          { em: entrou, statusId: CP.status.paraPagar, nomeLegado: "para pagar" },
        ],
      }),
    );
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    const dias = diasEmStatus(s, r.value.id, "para pagar");
    expect(dias).toBeDefined();
    expect(dias!).toBeGreaterThanOrEqual(29);
    expect(dias!).toBeLessThanOrEqual(31);
  });

  it("(d) conta ainda aberta: sem completedAt, e o Registro de entrada guarda o instante original", () => {
    const r = importarContaAPagarHistorica(
      s,
      OPERADOR,
      entradaBase({
        legacyTaskId: "868c0rjvb",
        statusFinalId: CP.status.paraPagar,
        fechadaEm: undefined,
        transicoes: [{ em: ENTROU_PARA_PAGAR, statusId: CP.status.paraPagar, nomeLegado: "para pagar" }],
      }),
    );
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.completedAt).toBeUndefined();
    const entradaEmParaPagar = s.activity.find(
      (a) => a.objectId === r.value.id && a.action === "Status alterado" && a.after === "para pagar",
    );
    expect(entradaEmParaPagar?.at).toBe(ENTROU_PARA_PAGAR);
  });

  it("(e) o vencimento vive só no campo nativo: nenhum Valor de Campo o duplica", () => {
    const vencimento = { form: "civilDay", value: "2025-02-14" } as const;
    const r = importarContaAPagarHistorica(s, OPERADOR, entradaBase({ vencimento }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.dueDate).toEqual(vencimento);
    expect(JSON.stringify(r.value.fieldValues)).not.toContain(vencimento.value);
  });

  it("(f) reimportar a mesma linha é recusado e nada muda (T-3-02)", () => {
    const primeira = importarContaAPagarHistorica(s, OPERADOR, entradaBase());
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);

    const tarefasAntes = s.tasks.length;
    const atividadesAntes = s.activity.length;

    expect(contaAPagarJaImportada(s, "868c0qx31")).toBe(true);
    const segunda = importarContaAPagarHistorica(s, OPERADOR, entradaBase({ titulo: "Outro título, mesma linha" }));
    expect(segunda.ok).toBe(false);
    expect(s.tasks.length).toBe(tarefasAntes);
    expect(s.activity.length).toBe(atividadesAntes);
  });

  it("(g) Status final desconhecido é recusa, nunca uma conta silenciosamente em “para pagar” (T-3-08)", () => {
    const tarefasAntes = s.tasks.length;
    const r = importarContaAPagarHistorica(s, OPERADOR, entradaBase({ statusFinalId: "st_cp_inexistente" }));
    expect(r.ok).toBe(false);
    expect(s.tasks.length).toBe(tarefasAntes);
  });

  it("(h) Campo que a Lista não enxerga desfaz tudo: Tarefa, Registros e o identificador legível", () => {
    const tarefasAntes = s.tasks.length;
    const atividadesAntes = s.activity.length;
    const legivelAntes = s.workspace.taskReadableId.next;

    const r = importarContaAPagarHistorica(
      s,
      OPERADOR,
      entradaBase({ campos: { [CP.fields.centroDeCusto]: "TRIA", fd_cr_situacao: "em dia" } }),
    );
    expect(r.ok).toBe(false);
    expect(s.tasks.length).toBe(tarefasAntes);
    expect(s.activity.length).toBe(atividadesAntes);
    expect(s.workspace.taskReadableId.next).toBe(legivelAntes);
  });

  it("(i) autoria e lacunas: Ator de importação por padrão, Membro quando o de-para resolve (PREP-04)", () => {
    const semAutoria = importarContaAPagarHistorica(s, OPERADOR, entradaBase());
    expect(semAutoria.ok, semAutoria.ok ? "" : semAutoria.error).toBe(true);
    if (!semAutoria.ok) throw new Error("unreachable");

    const esperado = { kind: "system", id: `importacao:${ORIGEM_CONTAS_A_PAGAR}` };
    expect(semAutoria.value.createdBy).toEqual(esperado);
    const registros = s.activity.filter((a) => a.objectId === semAutoria.value.id);
    expect(registros.length).toBeGreaterThan(0);
    expect(registros.every((a) => a.actor.kind === "system" && a.actor.id === esperado.id)).toBe(true);
    expect(registros.every((a) => a.delegate?.kind === "member" && a.delegate.id === OPERADOR)).toBe(true);

    const comAutoria = importarContaAPagarHistorica(
      s,
      OPERADOR,
      entradaBase({ legacyTaskId: "868c0ruxv", autoriaConhecida: { memberId: OPERADOR } }),
    );
    expect(comAutoria.ok, comAutoria.ok ? "" : comAutoria.error).toBe(true);
    if (!comAutoria.ok) throw new Error("unreachable");
    expect(comAutoria.value.createdBy).toEqual({ kind: "member", id: OPERADOR });

    // O histórico termina em "pago", o Status final classificado é "negado":
    // divergência é lacuna auditável, não recusa.
    const divergente = importarContaAPagarHistorica(
      s,
      OPERADOR,
      entradaBase({ legacyTaskId: "868c0rzzz", statusFinalId: CP.status.negado }),
    );
    expect(divergente.ok, divergente.ok ? "" : divergente.error).toBe(true);
    if (!divergente.ok) throw new Error("unreachable");
    const lacuna = s.activity.find(
      (a) =>
        a.objectId === divergente.value.id &&
        a.action === "Lacuna de importação" &&
        a.detail === "status_final_diverge_do_historico",
    );
    expect(lacuna).toBeDefined();
  });
});
