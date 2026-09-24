/**
 * D5-06 (`05-CONTEXT.md`): o 5º Status "em revisão" da Lista de Solicitações
 * só é alcançável pela Empresa que o declara em `Integration.statusDeclarados`
 * (05-01, `configuracao-por-empresa.ts`). Prova de `statusNaoDeclaradoPelaEmpresa`
 * (local a `./tasks.ts`), pelos cinco casos do plano (05-02, Task 1) —
 * estendida em 05-14 (CR-04) para provar que `changeTaskStatus` aplica a
 * MESMA regra, não só `statusOptionRefusal` (a dica da tela), e que a regra é
 * fail-closed quando a Tarefa não tem Empresa.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import { evoluirConfiguracaoPorEmpresa } from "../configuracao-por-empresa-evolver";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO, SOL } from "../solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes, LISTA_ID } from "../solicitacao-de-pagamento-evolver";
import type { DataState } from "../state";
import type { Id, Task } from "../types";
import { changeTaskStatus, createTask, setTaskFieldValue, statusOptionRefusal } from "./tasks";

const AGORA = "2026-09-24T12:00:00.000Z";
const ATOR: Id = "mem_maryane";

/** O id de verdade do Campo "Empresa" da Lista de Solicitações — `fld_sp_c_empresa`. */
const CAMPO_EMPRESA_DA_SOLICITACAO: Id = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === "Empresa")!.id;

const FRASE_EXATA = "Este Status pertence ao fluxo do Family Office — a Automação desta Empresa não usa “em revisão”.";
const FRASE_FAIL_CLOSED = "Este Status só vale para a Empresa que o declara — defina a Empresa da Tarefa antes de movê-la para “em revisão”.";

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

/** Quantos Registros "Status alterado" existem para esta Tarefa, agora. */
const contarStatusAlterado = (state: DataState, taskId: Id): number =>
  state.activity.filter((a) => a.objectType === "task" && a.objectId === taskId && a.action === "Status alterado").length;

describe("statusNaoDeclaradoPelaEmpresa (via statusOptionRefusal e changeTaskStatus) — D5-06 / CR-04", () => {
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

  it("(a') `changeTaskStatus` recusa a MESMA Tarefa da Tria com a MESMA frase — o backend, não só a tela", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "Tria Company");
    const statusIdAntes = task.statusId;
    const registrosAntes = contarStatusAlterado(state, task.id);

    const resultado = changeTaskStatus(state, ATOR, task.id, SOL.status.emRevisao);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? "" : resultado.error).toBe(FRASE_EXATA);

    // O statusId da Tarefa não muda e nenhum Registro "Status alterado" novo nasce.
    expect(task.statusId).toBe(statusIdAntes);
    expect(contarStatusAlterado(state, task.id)).toBe(registrosAntes);
  });

  it("(b) Tarefa de Empresa “EXO Loteamento” — que declara “em revisão” — não é recusada por esta regra", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "EXO Loteamento");
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBeUndefined();
  });

  it("(b') `changeTaskStatus` MOVE de verdade uma Tarefa da EXO Loteamento para “em revisão”", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "EXO Loteamento");
    // `task.statusId` é "para fazer" (o inicial); "em revisão" não declara
    // `entryFromStatusIds` no catálogo (`solicitacao-de-pagamento.ts`), então
    // qualquer origem serve — usa-se o inicial em vez de adivinhar outro.
    expect(task.statusId).toBe(SOL.status.paraFazer);

    const resultado = changeTaskStatus(state, ATOR, task.id, SOL.status.emRevisao);
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
    expect(task.statusId).toBe(SOL.status.emRevisao);
  });

  it("(c) a mesma Empresa “Tria Company”, Status alvo “em aprovação” — a regra não interfere", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "Tria Company");
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emAprovacao)).toBeUndefined();
  });

  it("(d) Tarefa SEM valor de Empresa — fail-closed: a regra RECUSA quando o Status é declarável por alguém", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state);
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBe(FRASE_FAIL_CLOSED);

    const resultado = changeTaskStatus(state, ATOR, task.id, SOL.status.emRevisao);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? "" : resultado.error).toBe(FRASE_FAIL_CLOSED);
    // Paridade: a mesma frase, nos dois lados.
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBe(
      resultado.ok ? undefined : resultado.error,
    );
  });

  it("(e) estado sem nenhuma Integração com statusDeclarados — nenhum Status é bloqueado por esta regra", () => {
    // Deliberadamente NÃO chama evoluirConfiguracaoPorEmpresa: state.integrations
    // fica vazio, então `declaravelPorAlguem` é sempre falso.
    const task = criarTarefaDeSolicitacao(state, "Tria Company");
    expect(state.integrations.some((i) => i.statusDeclarados?.length)).toBe(false);
    expect(statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao)).toBeUndefined();

    const resultado = changeTaskStatus(state, ATOR, task.id, SOL.status.emRevisao);
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
  });

  it("mover para o Status já vigente não é recusado por esta regra", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const task = criarTarefaDeSolicitacao(state, "Tria Company");
    // O Status vigente é "para fazer" — nenhuma Integração declara "para fazer",
    // então esta regra nunca entraria de qualquer forma; a prova real é que
    // `before.id === target.id` sai antes de qualquer checagem desta regra
    // (o próprio `changeTaskStatus` não roda o bloco de saída/entrada).
    const resultado = changeTaskStatus(state, ATOR, task.id, task.statusId);
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
  });

  it("os quatro Status de D-01 continuam alcançáveis por Tria e por Tarefa sem Empresa, via statusOptionRefusal e changeTaskStatus", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const tria = criarTarefaDeSolicitacao(state, "Tria Company");
    const semEmpresa = criarTarefaDeSolicitacao(state);
    for (const alvo of [SOL.status.paraFazer, SOL.status.emAprovacao, SOL.status.naoAprovado, SOL.status.aprovado]) {
      expect(statusOptionRefusal(state, ATOR, tria, alvo)).toBeUndefined();
      expect(statusOptionRefusal(state, ATOR, semEmpresa, alvo)).toBeUndefined();
    }

    // `changeTaskStatus` de verdade, na ordem do catálogo: "para fazer" (inicial)
    // → "em aprovação" → "aprovado"; e "para fazer" → "em aprovação" → "não aprovado".
    for (const task of [tria, semEmpresa]) {
      const paraAprovacao = changeTaskStatus(state, ATOR, task.id, SOL.status.emAprovacao);
      expect(paraAprovacao.ok, paraAprovacao.ok ? "" : paraAprovacao.error).toBe(true);
      const paraAprovado = changeTaskStatus(state, ATOR, task.id, SOL.status.aprovado);
      expect(paraAprovado.ok, paraAprovado.ok ? "" : paraAprovado.error).toBe(true);
    }
  });

  it("paridade: para toda combinação testada, `statusOptionRefusal` e o `error` de `changeTaskStatus` são iguais quando a recusa vem desta regra", () => {
    const empresas = evoluirConfiguracaoPorEmpresa(state, ATOR);
    expect(empresas.ok, empresas.ok ? "" : empresas.error).toBe(true);

    const casos: Array<{ empresa?: string }> = [{ empresa: "Tria Company" }, { empresa: undefined }];
    for (const caso of casos) {
      const task = criarTarefaDeSolicitacao(state, caso.empresa);
      const daTela = statusOptionRefusal(state, ATOR, task, SOL.status.emRevisao);
      const doBackend = changeTaskStatus(state, ATOR, task.id, SOL.status.emRevisao);
      expect(daTela).toBeDefined();
      expect(doBackend.ok).toBe(false);
      expect(doBackend.ok ? "" : doBackend.error).toBe(daTela);
    }
  });
});
