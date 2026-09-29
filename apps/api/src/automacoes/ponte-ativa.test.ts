/**
 * `registrarPonte`/`cutucarPonte` (Plan 06-03, Task 3, D6-12) e o helper da
 * rota que decide quais gravações cutucam — puros, sem banco.
 */

import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations/financeiro";
import { tarefasAfetadasPelaOperacao } from "../rotas/operacoes";
import { cutucarPonte, registrarPonte } from "./ponte-ativa";

afterEach(() => registrarPonte(undefined));

describe("ponte-ativa", () => {
  it("sem ponte registrada, cutucar é no-op", () => {
    expect(() => cutucarPonte({ workspaceId: "ws_n1", listId: CP.listId })).not.toThrow();
  });

  it("com ponte, cutucar chama p.cutucar() — só para o par dela", () => {
    let cutucadas = 0;
    registrarPonte({ cutucar: () => (cutucadas += 1) }, { workspaceId: "ws_n1", listId: CP.listId });
    cutucarPonte({ workspaceId: "ws_n1", listId: CP.listId });
    cutucarPonte({ workspaceId: "ws_n1", listId: "lst_outra" });
    cutucarPonte({ workspaceId: "ws_outro", listId: CP.listId });
    expect(cutucadas).toBe(1);
  });

  it("cutucar nunca lança, mesmo se a ponte lançar", () => {
    registrarPonte({ cutucar: () => { throw new Error("x"); } });
    expect(() => cutucarPonte()).not.toThrow();
  });

  it("desregistrada, volta a ser no-op", () => {
    let cutucadas = 0;
    registrarPonte({ cutucar: () => (cutucadas += 1) });
    registrarPonte(undefined);
    cutucarPonte();
    expect(cutucadas).toBe(0);
  });
});

describe("tarefasAfetadasPelaOperacao — as gravações que cutucam a ponte", () => {
  const estado = buildSeed();
  const par = { workspaceId: estado.workspace.id, listId: CP.listId };

  it.each(["setTaskFieldValue", "updateTask", "changeTaskStatus", "addTaskComment", "setTaskTags", "resolveTaskComment"])(
    "%s numa conta: o par (Espaço, Lista) da conta",
    (nome) => {
      expect(tarefasAfetadasPelaOperacao(nome, ["tsk_cp_das"], undefined, estado)).toEqual([par]);
    },
  );

  it("decideProcessApproval: pela origem da Aprovação", () => {
    const valor = { origin: { kind: "processTask", taskId: "tsk_cp_das" } };
    expect(tarefasAfetadasPelaOperacao("decideProcessApproval", ["apr_1", "aprovada", {}], valor, estado)).toEqual([par]);
  });

  it("alterarStatusEmLote: um par por Lista, sem repetição", () => {
    expect(tarefasAfetadasPelaOperacao("alterarStatusEmLote", [["tsk_cp_das", "tsk_cp_trafego"], "st"], undefined, estado)).toEqual([par]);
  });

  it("outra operação, ou Tarefa que não existe: nada", () => {
    expect(tarefasAfetadasPelaOperacao("createTag", ["tsk_cp_das"], undefined, estado)).toEqual([]);
    expect(tarefasAfetadasPelaOperacao("updateTask", ["tsk_nao_existe"], undefined, estado)).toEqual([]);
  });
});
