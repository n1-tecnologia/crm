/**
 * Plano pós-auditoria, 2.1 — "o que o Omie exige, o Status exige".
 *
 * O `/lancar` do `automation/` procura ou cadastra o fornecedor no Omie pelo
 * documento e pelo nome, e classifica pela Categoria. Antes desta regra, uma
 * conta saía de "para pagar" sem esses dados e só descobria a falta quando o
 * Agente tentava lançá-la — já em "em lançamento omie", tarde e longe de quem
 * preencheu. Agora são UMA lista só em dois lugares:
 *
 * - `erpMissingFields` (`./financeiro.ts`) — o que o Agente pede e a única
 *   conferência que a ponte do `apps/api` faz antes de chamar o Omie;
 * - a saída de "para pagar" (`dadoDePagamento`, `../seed-financeiro.ts`) — o
 *   que a tela recusa ao mover a conta.
 *
 * O caso (f) é o que prende os dois juntos: se um deles mudar sem o outro, a
 * tela e o Agente voltam a discordar, e este arquivo quebra.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { CP, erpMissingFields } from "./financeiro";
import { changeTaskStatus } from "./tasks";

let state: DataState;

function conta(id: string): Task {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

function apagar(task: Task, definitionId: string): void {
  task.fieldValues = task.fieldValues.filter((v) => v.definitionId !== definitionId);
}

function definir(task: Task, definitionId: string, value: string): void {
  apagar(task, definitionId);
  task.fieldValues.push({ definitionId, value, state: "ativo" });
}

beforeEach(() => {
  state = buildSeed();
});

describe("erpMissingFields — o que o Omie exige para achar o fornecedor e classificar a conta", () => {
  it("(a) uma conta completa do seed (DAS, Boleto, CNPJ) não deve nada ao Omie", () => {
    expect(erpMissingFields(state, conta("tsk_cp_das"))).toEqual([]);
  });

  it("(b) sem Categoria de pagamento, pede a Categoria pelo nome do Campo", () => {
    const das = conta("tsk_cp_das");
    apagar(das, CP.fields.categoria);
    expect(erpMissingFields(state, das)).toEqual(["Categoria de pagamento"]);
  });

  it("(c) sem Fornecedor, pede o Fornecedor — e não presume CNPJ para pedir um documento", () => {
    const das = conta("tsk_cp_das");
    apagar(das, CP.fields.fornecedor);
    apagar(das, CP.fields.cnpj);
    const faltando = erpMissingFields(state, das);
    expect(faltando).toContain("Fornecedor");
    expect(faltando).not.toContain("CNPJ");
    expect(faltando).not.toContain("CPF");
  });

  it("(d) o documento acompanha o tipo: Fornecedor CPF sem CPF pede o CPF, e só ele", () => {
    const das = conta("tsk_cp_das");
    definir(das, CP.fields.fornecedor, "CPF");
    expect(erpMissingFields(state, das)).toEqual(["CPF"]);
    definir(das, CP.fields.cpf, "321.654.987-00");
    expect(erpMissingFields(state, das)).toEqual([]);
  });

  it("(e) sem Nome do fornecedor, pede o Nome — mesmo com a Pessoa preenchida (o Omie cadastra pelo nome)", () => {
    const pedro = conta("tsk_cp_thiago_out");
    expect(pedro.fieldValues.some((v) => v.definitionId === CP.fields.pessoa)).toBe(true);
    apagar(pedro, CP.fields.nomeFornecedor);
    expect(erpMissingFields(state, pedro)).toEqual(["Nome do fornecedor"]);
  });
});

describe("a saída de \"para pagar\" exige o mesmo — a tela e o Agente concordam", () => {
  it("(f) a recusa de mover nomeia exatamente o que erpMissingFields pede", () => {
    const das = conta("tsk_cp_das");
    expect(das.statusId).toBe(CP.status.paraPagar);
    apagar(das, CP.fields.categoria);
    apagar(das, CP.fields.fornecedor);
    apagar(das, CP.fields.cnpj);
    apagar(das, CP.fields.nomeFornecedor);

    const pedidoDoAgente = erpMissingFields(state, das);
    expect(pedidoDoAgente).toEqual(["Categoria de pagamento", "Fornecedor", "Nome do fornecedor"]);

    const movida = changeTaskStatus(state, CP.financeiroId, das.id, CP.status.emLancamento);
    expect(movida.ok).toBe(false);
    if (!movida.ok) expect(movida.error).toBe(`Para sair de “para pagar” falta: ${pedidoDoAgente.join(", ")}.`);
    expect(das.statusId).toBe(CP.status.paraPagar);
  });

  it("(g) preenchidos os quatro, a conta sai de \"para pagar\"", () => {
    const das = conta("tsk_cp_das");
    const movida = changeTaskStatus(state, CP.financeiroId, das.id, CP.status.emLancamento);
    expect(movida.ok, movida.ok ? "" : movida.error).toBe(true);
    expect(das.statusId).toBe(CP.status.emLancamento);
  });

  it("(h) o bootstrap de produção nasce com as exigências novas na saída de \"para pagar\"", () => {
    const bootstrap = buildGestaoBootstrap({ workspaceId: "ws_teste_exigencias", agora: "2026-09-28T12:00:00.000Z" });
    const paraPagar = bootstrap.lists
      .find((l) => l.id === CP.listId)
      ?.statusSet?.definitions.find((d) => d.id === CP.status.paraPagar);
    const exigidos = (paraPagar?.exitRequirements ?? []).map((r) => (r.whenDefinitionId ? `${r.definitionId}|${r.whenValue}` : (r.definitionId ?? r.attribute)));
    expect(exigidos).toEqual(
      expect.arrayContaining([
        CP.fields.categoria,
        CP.fields.fornecedor,
        `${CP.fields.cpf}|CPF`,
        `${CP.fields.cnpj}|CNPJ`,
        CP.fields.nomeFornecedor,
      ]),
    );
  });
});
