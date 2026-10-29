/**
 * Fase 10, 2.3.1 e 2.3.2 (D-08, D-11, EST-05, EST-06) — mover e reordenar
 * contêineres pela API REAL, contra o Postgres local: `POST
 * /operacoes/moveContainer` e `POST /operacoes/reorderContainers` gravam, e um
 * `hidratar` novo do Espaço devolve o lugar e a ordem pedidos ("a ordem nova
 * continua depois de recarregar"). O domínio já prova as regras em memória; este
 * arquivo prova que elas atravessam a rota e a persistência.
 *
 * Só Postgres local (`describeComBanco`): sem `DATABASE_URL` em `localhost`, o
 * bloco inteiro pula — e o job que o roda precisa conferir que NÃO pulou.
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { createFolder, createList, createTask } from "@n1/dominio/operations";
import { encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { describeComBanco, prepararBancoCrm } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

describeComBanco("mover e reordenar contêineres — gravam e sobrevivem a hidratar de novo (EST-05, EST-06)", () => {
  let espaco: EspacoDeVazamento;
  let app: ReturnType<typeof appDoEspaco>;
  let proprietario: string;
  let espacoId: string;
  let pastaA: string;
  let pastaB: string;
  let listas: [string, string, string];
  let tarefaId: string;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("mover");
    const estado = espaco.estado;
    proprietario = espaco.membros.proprietario.id;
    espacoId = estado.spaces.find((s) => s.lifecycle === "ativo")?.id ?? "";
    expect(espacoId, "o seed precisa de um Espaço ativo").not.toBe("");

    const pasta = (name: string): string => {
      const r = createFolder(estado, proprietario, { name, parentType: "space", parentId: espacoId });
      if (!r.ok) throw new Error(r.error);
      return r.value.id;
    };
    const lista = (name: string, folderId: string): string => {
      const r = createList(estado, proprietario, { name, parentType: "folder", parentId: folderId });
      if (!r.ok) throw new Error(r.error);
      return r.value.id;
    };
    pastaA = pasta("Mover — origem");
    pastaB = pasta("Mover — destino");
    listas = [lista("M0", pastaA), lista("M1", pastaA), lista("M2", pastaA)];
    const tarefa = createTask(estado, proprietario, { listId: listas[1], title: "Tarefa que acompanha a Lista" });
    if (!tarefa.ok) throw new Error(tarefa.error);
    tarefaId = tarefa.value.id;

    await semearEspacoDeVazamento(espaco);
    app = appDoEspaco(espaco);
  });

  afterAll(async () => {
    await app?.close();
    if (espaco) await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  const chamar = (nome: string, args: unknown[], token: string = TOKENS_DE_VAZAMENTO.proprietario) =>
    app.inject({ method: "POST", url: `/operacoes/${nome}`, headers: { authorization: `Bearer ${token}` }, payload: { args, revisao: 0 } });

  /** O Espaço como o Postgres o devolve agora, numa leitura nova. */
  async function relido(): Promise<DataState> {
    const cliente = await pool().connect();
    try {
      return (await hidratar(cliente, espaco.workspaceId)).state;
    } finally {
      cliente.release();
    }
  }

  it("reorderContainers grava a ordem pedida e um hidratar novo a devolve (0, 1, 2)", async () => {
    const [m0, m1, m2] = listas;
    const resposta = await chamar("reorderContainers", ["list", { type: "folder", id: pastaA }, [m2, m0, m1]]);
    expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
    expect((resposta.json() as { ok: boolean }).ok, resposta.body.slice(0, 300)).toBe(true);

    const estado = await relido();
    const ordem = (id: string) => estado.lists.find((l) => l.id === id)?.order;
    expect([ordem(m2), ordem(m0), ordem(m1)]).toEqual([0, 1, 2]);
    expect(estado.activity.some((a) => a.action === "Ordem alterada" && a.objectId === pastaA)).toBe(true);
  });

  it("moveContainer grava o pai novo e as Tarefas continuam na mesma Lista depois de hidratar", async () => {
    const [, m1] = listas;
    const resposta = await chamar("moveContainer", ["list", m1, { parentType: "folder", parentId: pastaB }]);
    expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
    expect((resposta.json() as { ok: boolean }).ok, resposta.body.slice(0, 300)).toBe(true);

    const estado = await relido();
    const movida = estado.lists.find((l) => l.id === m1);
    expect(movida?.parentType).toBe("folder");
    expect(movida?.parentId).toBe(pastaB);
    expect(estado.tasks.find((t) => t.id === tarefaId)?.listId).toBe(m1);
    expect(estado.activity.some((a) => a.action === "Lista movida" && a.objectId === m1)).toBe(true);
  });
});
