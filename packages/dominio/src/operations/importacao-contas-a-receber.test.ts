/**
 * A prova de que o replay de uma Conta a receber histórica é MUDO — nenhuma
 * das seis Automações da Lista (R2/R2b/R3/R4/R5/R6) percebe que a importação
 * aconteceu — no mesmo molde de `importacao-contas-a-pagar.test.ts` (Plan
 * 03-09), com os dois casos próprios desta Lista: o Vínculo ao cliente
 * (D5-12) e a lacuna "sem-cliente" quando ele não vem.
 *
 * O bootstrap usado é `buildGestaoBootstrap`, que monta a configuração do
 * Financeiro (Contas a pagar E Contas a receber) com as Automações e sem
 * Tarefas fictícias (`../bootstrap-gestao.ts`, `applyContasAReceber(state,
 * clock, { fixtures: false })`) — as seis Automações `aut_cr_*` estão
 * ativas, então "nenhuma Execução" não é uma asserção vazia.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import type { DataState } from "../state";
import type { Contact, Id } from "../types";
import { CP, CR } from "./financeiro";
import {
  contaAReceberJaImportada,
  importarContaAReceberHistorica,
  ORIGEM_CONTAS_A_RECEBER,
  type EntradaDeContaAReceberHistorica,
} from "./importacao-contas-a-receber";

const AGORA = "2026-09-24T12:00:00.000Z";
const OPERADOR: Id = "mem_maryane";

const NASCEU = "2025-02-19T12:55:00.000Z";
const ENTROU_PARA_RECEBER = "2025-02-19T12:55:00.000Z";
const FOI_RECEBIDA = "2025-03-15T09:12:00.000Z";

function contatoFicticio(id: Id): Contact {
  return {
    id,
    workspaceId: "ws_n1",
    createdBy: { kind: "member", id: OPERADOR },
    createdAt: AGORA,
    lifecycle: "ativo",
    firstName: "Gabriela",
    lastName: "Melo",
    ownerMemberId: CR.comercialId,
    creationMode: "manual",
    description: "",
    identifiers: [],
    consents: [],
    addresses: [],
    tagIds: [],
    fieldValues: [],
    comments: [],
  };
}

function entradaBase(overrides: Partial<EntradaDeContaAReceberHistorica> = {}): EntradaDeContaAReceberHistorica {
  return {
    legacyTaskId: "868cpd8zg",
    titulo: "7ª Parcela – Gabriela Melo",
    statusFinalId: CR.status.recebido,
    criadaEm: NASCEU,
    fechadaEm: FOI_RECEBIDA,
    // Fora de ordem cronológica de propósito: é como o export chega.
    transicoes: [
      { em: FOI_RECEBIDA, statusId: CR.status.recebido, nomeLegado: "recebido" },
      { em: ENTROU_PARA_RECEBER, statusId: CR.status.paraReceber, nomeLegado: "para receber" },
    ],
    campos: {
      [CP.fields.centroDeCusto]: "Marcos Paulo",
      [CR.fields.tipo]: CR.tipos.parcela,
      [CR.fields.numeroParcela]: 7,
      [CP.fields.valor]: 20000,
    },
    lacunas: [],
    ...overrides,
  };
}

describe("importarContaAReceberHistorica", () => {
  let s: DataState;

  beforeEach(() => {
    s = buildGestaoBootstrap({ agora: AGORA });
  });

  it("(a) replay mudo: nenhuma Automação da Lista dispara, e a Tarefa nasce no Status final", () => {
    // A prova não pode ser vazia: as seis Automações precisam estar lá para
    // que "nenhuma rodou" signifique alguma coisa.
    const ativas = s.automations.filter((a) => a.scopeId === CR.listId && a.lifecycle === "ativo");
    expect(ativas.length).toBeGreaterThanOrEqual(6);

    const tarefasAntes = s.tasks.length;
    const r = importarContaAReceberHistorica(s, OPERADOR, entradaBase());
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(s.automationExecutions.length).toBe(0);
    expect(s.tasks.length).toBe(tarefasAntes + 1);
    expect(r.value.comments.length).toBe(0);
    expect(r.value.statusId).toBe(CR.status.recebido);
    expect(r.value.provenance?.sourceName).toBe(ORIGEM_CONTAS_A_RECEBER);
  });

  it("(b) a trilha carrega a data original de cada transição, e createdAt é a data de criação, não a da importação", () => {
    const entrada = entradaBase();
    const r = importarContaAReceberHistorica(s, OPERADOR, entrada);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    const registros = s.activity.filter((a) => a.objectId === r.value.id);
    const status = registros.filter((a) => a.action === "Status alterado");
    expect(status.length).toBe(entrada.transicoes.length);
    expect(status.map((a) => a.at).sort()).toEqual(entrada.transicoes.map((t) => t.em).sort());

    expect(r.value.createdAt).toBe(NASCEU);
    expect(r.value.completedAt).toBe(FOI_RECEBIDA);

    const maiorDoHistorico = [...entrada.transicoes].map((t) => t.em).sort().at(-1)!;
    expect(registros.every((a) => a.at <= maiorDoHistorico)).toBe(true);
  });

  it("(c) reimportar o mesmo legacyTaskId é recusado e nada muda (T-3-02)", () => {
    const primeira = importarContaAReceberHistorica(s, OPERADOR, entradaBase());
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);

    const tarefasAntes = s.tasks.length;
    const atividadesAntes = s.activity.length;

    expect(contaAReceberJaImportada(s, "868cpd8zg")).toBe(true);
    const segunda = importarContaAReceberHistorica(s, OPERADOR, entradaBase({ titulo: "Outro título, mesma linha" }));
    expect(segunda.ok).toBe(false);
    expect(s.tasks.length).toBe(tarefasAntes);
    expect(s.activity.length).toBe(atividadesAntes);
  });

  it("(d) clienteRef vira Vínculo Tarefa → Contato com linkRole “cliente”, e nenhuma lacuna “sem-cliente” nasce", () => {
    const gabriela = contatoFicticio("cnt_teste_gabriela");
    s.contacts.push(gabriela);

    const r = importarContaAReceberHistorica(s, OPERADOR, entradaBase({ clienteRef: { tipo: "contact", id: gabriela.id } }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    const vinculo = s.links.find((l) => l.fromType === "task" && l.fromId === r.value.id && l.toType === "contact" && l.toId === gabriela.id);
    expect(vinculo).toBeDefined();
    expect(vinculo?.role).toBe(CR.linkRole);

    const lacunaSemCliente = s.activity.find((a) => a.objectId === r.value.id && a.action === "Lacuna de importação" && a.detail === "sem-cliente");
    expect(lacunaSemCliente).toBeUndefined();
  });

  it("(e) sem clienteRef, a Tarefa nasce com a lacuna “sem-cliente” registrada e nenhum Contato inventado", () => {
    const contatosAntes = s.contacts.length;
    const r = importarContaAReceberHistorica(s, OPERADOR, entradaBase());
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(s.contacts.length).toBe(contatosAntes);
    expect(s.links.some((l) => l.fromType === "task" && l.fromId === r.value.id)).toBe(false);
    const lacuna = s.activity.find((a) => a.objectId === r.value.id && a.action === "Lacuna de importação" && a.detail === "sem-cliente");
    expect(lacuna).toBeDefined();
  });

  it("(f) Status final desconhecido é recusa, antes de criar qualquer coisa (T-3-08)", () => {
    const tarefasAntes = s.tasks.length;
    const atividadesAntes = s.activity.length;
    const r = importarContaAReceberHistorica(s, OPERADOR, entradaBase({ statusFinalId: "st_cr_inexistente" }));
    expect(r.ok).toBe(false);
    expect(s.tasks.length).toBe(tarefasAntes);
    expect(s.activity.length).toBe(atividadesAntes);
  });

  it("clienteRef apontando para um id fora do CRM é recusado, sem criar Tarefa nem Vínculo", () => {
    const tarefasAntes = s.tasks.length;
    const r = importarContaAReceberHistorica(s, OPERADOR, entradaBase({ clienteRef: { tipo: "contact", id: "cnt_nao_existe" } }));
    expect(r.ok).toBe(false);
    expect(s.tasks.length).toBe(tarefasAntes);
    expect(s.links.length).toBe(0);
  });

  it("D5-16/CR-06: dataPagamento (CivilDate, já resolvido pelo mapeador) grava exatamente o dia recebido no Campo “Data de pagamento”", () => {
    const r = importarContaAReceberHistorica(s, OPERADOR, entradaBase({ dataPagamento: "2025-03-14" }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const campo = r.value.fieldValues.find((f) => f.definitionId === CR.fields.dataPagamento);
    expect(campo?.value).toBe("2025-03-14");
  });

  it("CR-06: dataPagamento fora do formato AAAA-MM-DD desfaz a importação, com a categoria do Campo (nunca grava lixo)", () => {
    const tarefasAntes = s.tasks.length;
    const r = importarContaAReceberHistorica(s, OPERADOR, entradaBase({ dataPagamento: "2025-03-15T09:12:00.000Z" }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.field).toBe(CR.fields.dataPagamento);
    expect(s.tasks.length).toBe(tarefasAntes);
  });
});
