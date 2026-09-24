/**
 * D5-06 (`05-CONTEXT.md`): o 5º Status "em revisão" da Lista de Solicitações
 * só é alcançável pela Empresa que o declara em `Integration.statusDeclarados`
 * (05-01, `configuracao-por-empresa.ts`). Prova de `statusNaoDeclaradoPelaEmpresa`
 * (local a `./tasks.ts`), pelos cinco casos do plano (05-02, Task 1).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import { evoluirConfiguracaoPorEmpresa } from "../configuracao-por-empresa-evolver";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO, SOL } from "../solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes, LISTA_ID } from "../solicitacao-de-pagamento-evolver";
import type { DataState } from "../state";
import type { Id, Task } from "../types";
import { createTask, setTaskFieldValue, statusOptionRefusal } from "./tasks";

const AGORA = "2026-09-24T12:00:00.000Z";
const ATOR: Id = "mem_maryane";

/** O id de verdade do Campo "Empresa" da Lista de Solicitações — `fld_sp_c_empresa`. */
const CAMPO_EMPRESA_DA_SOLICITACAO: Id = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === "Empresa")!.id;

const FRASE_EXATA = "Este Status pertence ao fluxo do Family Office — a Automação desta Empresa não usa “em revisão”.";

/** Cria uma Tarefa nova na Lista de Solicitações, com Empresa opcionalmente preenchida. */
function criarTarefaDeSolicitacao(state: DataState, empresa?: string): Task {
  const criacao = createTask(state, ATOR, { listId: LISTA_ID, title: "Solicitação de teste" });
  expect(criacao.ok, criacao.ok ? "" : criacao.error).toBe(true);
  if (!criacao.ok) throw new Error("unreachable");
  if (empresa !== undefined) {
    const gravado = setTaskFieldValue(state, ATOR, criacao.value.id, CAMPO_EMPRESA_DA_SOLICITACAO, empresa);
    expect(gravado.ok, gravado.ok ? "" : gravado.error).toBe(true);
  }
  return state.tasks.find((t) => t.id === criacao.value.id)!;
}

describe("statusNaoDeclaradoPelaEmpresa (via statusOptionRefusal) — D5-06", () => {
  let state: DataState;

  beforeEach(() => {
    state = buildGestaoBootstrap({ agora: AGORA });
    const solicitacoes = evoluirConfiguracaoDeSolicitacoes(state, ATOR);
    expect(solicitacoes.ok, solicitacoes.ok ? "" : solicitacoes.error).toBe(true);
  });

  it("(a) Tarefa de Empresa “Tria Company” recusa mover para “em revisão”, com a frase exata da UI-SPEC", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "Tria Company");
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBe(FRASE_EXATA);
  });

  it("(b) Tarefa de Empresa “EXO Loteamento” — que declara “em revisão” — não é recusada por esta regra", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "EXO Loteamento");
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBeUndefined();
  });

  it("(c) a mesma Empresa “Tria Company”, Status alvo “em aprovação” — a regra não interfere", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "Tria Company");
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emAprovacao)).toBeUndefined();
  });

  it("(d) Tarefa sem valor de Empresa — a regra não interfere", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state);
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBeUndefined();
  });

  it("(e) estado sem nenhuma Integração com statusDeclarados — nenhum Status é bloqueado por esta regra", () => {
    // Deliberadamente NÃO chama evoluirConfiguracaoPorEmpresa: state.integrations
    // fica vazio, então `declaravelPorAlguem` é sempre falso.
    const task = criarTarefaDeSolicitacao(state, "Tria Company");
    expect(state.integrations.some((i) => i.statusDeclarados?.length)).toBe(false);
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBeUndefined();
  });

  it("os quatro Status de D-01 nunca mudam de comportamento em nenhum dos casos acima", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const tria = criarTarefaDeSolicitacao(state, "Tria Company");
    const semEmpresa = criarTarefaDeSolicitacao(state);
    for (const alvo of [SOL.status.paraFazer, SOL.status.emAprovacao, SOL.status.naoAprovado, SOL.status.aprovado]) {
      expect(statusOptionRefusal(state, ATOR, tria, alvo)).toBeUndefined();
      expect(statusOptionRefusal(state, ATOR, semEmpresa, alvo)).toBeUndefined();
    }
  });
});
