/**
 * Every action generates an Activity Record with actor and, when there is one,
 * delegate actor (A6.2). Nothing in this store mutates without passing here.
 */

import type { DataState } from "../state";
import type { ActivityRecord, ActorRef, Id } from "../types";

let sequence = 0;

/** Deterministic ids keep the seed reproducible across reloads. */
export function nextId(prefix: string): Id {
  sequence += 1;
  return `${prefix}_${sequence.toString(36).padStart(6, "0")}`;
}

/** Restarts the counter — used by the tests so ids do not leak between cases. */
export function resetIdSequence(at = 0): void {
  sequence = at;
}

const PADRAO_ID = /^[a-z]+_([0-9a-z]{6,})$/;

/**
 * Coloca o contador de `nextId` acima de todo id já presente no estado.
 *
 * `sequence` é um contador de módulo, não parte do estado: no navegador ele
 * sobrevivia porque o seed rodava no mesmo processo, mas um processo novo do
 * `apps/api` começaria em 0 e geraria um id que já existe no banco — o
 * `upsert` de `gravar()` sobrescreveria um registro real. Chamado antes de
 * rodar a operação tanto na Unidade de Trabalho (Plan 01-04) quanto no
 * `run()` do web (Plan 01-07): com o mesmo estado, os dois lados geram os
 * MESMOS ids, o que faz o `result.value` local do web (que a tela usa para
 * navegar) coincidir com o que o servidor grava.
 *
 * Percorre recursivamente TODO o estado (objetos e arrays, incluindo ids
 * aninhados: comentários dentro de Tarefa, mensagens dentro de Conversa,
 * itens de memória, lançamentos de tempo — todos nascem de `nextId`). Um id
 * literal como `mem_thiago` também casa a expressão (sufixo em base 36) e só
 * empurra o contador para cima — inofensivo. Custo: uma passada por ~900
 * registros, milissegundos.
 */
export function syncIdSequence(state: DataState): void {
  let maior = 0;

  const visitar = (valor: unknown): void => {
    if (Array.isArray(valor)) {
      for (const item of valor) visitar(item);
      return;
    }
    if (valor === null || typeof valor !== "object") return;
    const registro = valor as Record<string, unknown>;
    if (typeof registro.id === "string") {
      const encontrado = PADRAO_ID.exec(registro.id);
      if (encontrado) {
        const numero = parseInt(encontrado[1]!, 36);
        if (!Number.isNaN(numero) && numero > maior) maior = numero;
      }
    }
    for (const chave of Object.keys(registro)) visitar(registro[chave]);
  };

  visitar(state);
  resetIdSequence(maior);
}

export interface RecordActivityInput {
  readonly actor: ActorRef;
  readonly delegate?: ActorRef;
  readonly action: string;
  readonly objectType: string;
  readonly objectId: Id;
  readonly objectName: string;
  readonly result?: ActivityRecord["result"];
  readonly before?: string;
  readonly after?: string;
  readonly detail?: string;
  readonly at?: string;
}

export function recordActivity(state: DataState, input: RecordActivityInput): ActivityRecord {
  const record: ActivityRecord = {
    id: nextId("act"),
    workspaceId: state.workspace.id,
    actor: input.actor,
    ...(input.delegate ? { delegate: input.delegate } : {}),
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId,
    objectName: input.objectName,
    at: input.at ?? new Date().toISOString(),
    result: input.result ?? "ok",
    ...(input.before !== undefined ? { before: input.before } : {}),
    ...(input.after !== undefined ? { after: input.after } : {}),
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
  };
  state.activity.unshift(record);
  return record;
}

/** The acting Member as an ActorRef. */
export const memberActor = (memberId: Id): ActorRef => ({ kind: "member", id: memberId });

export const systemActor: ActorRef = { kind: "system", id: "sistema" };
