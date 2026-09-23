/**
 * `alterarStatusEmLote` — o fechamento em lote das contas (PAG-05, critério
 * 5): um gesto muda o Status de N Tarefas de uma vez, alcançável por
 * `POST /operacoes/alterarStatusEmLote`.
 *
 * A operação existe porque CON-CP-11 é um fato datado, não uma conveniência
 * de tela: em 2026-09-08 11:58:06, 61 Tarefas com vencimento 2026-09-04 foram
 * fechadas no mesmo segundo. O ClickUp fazia isso; até este plano, a
 * plataforma não tinha para onde apontar o mesmo gesto.
 *
 * **Não reimplementa nada de `changeTaskStatus`.** Permissão
 * (`mayWriteTaskStatus`/`taskWriteRefusal`/`memberSeesTask`), RN-CP-02
 * (requisitos de saída do Status), RN-CP-04 (`entryAllowedMemberIds`) e A1 —
 * tudo isso vem de UMA chamada de `changeTaskStatus` por item. É isso que
 * impede um endpoint de lote de virar um furo de permissão (T-3-45): uma
 * checagem feita uma vez para o conjunto deixaria passar o que uma checagem
 * por item pega. A única exceção — o curto-circuito `jaEstava` — consulta
 * `memberSeesTask` diretamente, e só porque decidir "já está lá" é uma
 * resposta sobre a Tarefa sem chamar `changeTaskStatus` nenhuma vez.
 *
 * **A1 aqui é a Regra de Recorrência da própria Tarefa** (D3-05:
 * `task.recurrence`, `collaboration.ts::spawnNextOccurrence`, chamada por
 * `changeTaskStatus` na entrada em categoria terminal) — não é um dos nove
 * `Automation` da Lista (`aut_cp_a1`..`aut_cp_a9` não existem; A1 não está no
 * catálogo de Automações, `seed-financeiro.ts` diz isso com todas as letras).
 * Este módulo não importa `./automations` nem `./collaboration`: a ocorrência
 * nova nasce dentro de `changeTaskStatus` e é achada aqui por `provenance`,
 * nunca gerada por este arquivo.
 *
 * **A forma da transação — uma, e o porquê com números.** 61 transações (uma
 * `executar()` por conta) leriam ~1,16 milhão de linhas (61 hidratações de
 * ~19 mil linhas cada, o Espaço inteiro por chamada — D-DEC-01). Uma
 * transação só lê ~19 mil linhas, a MESMA hidratação que qualquer
 * `createTask` já paga hoje, mais 61 fechamentos puros em memória. 61 < 250 —
 * a constante que 03-10 justificou para a importação histórica — não é uma
 * segunda decisão: é a mesma regra aplicada a um N menor, que produz um lote
 * só. `LIMITE_DO_LOTE` é o que mantém "uma transação" uma decisão e não um
 * acidente: acima dele, o argumento de 03-10 volta a valer e picotar é
 * trabalho de quem chama, não desta função.
 *
 * **Idempotente contra o `state` que recebe.** Uma Tarefa já no Status alvo
 * volta `jaEstava` sem nenhuma escrita; o mesmo lote pode rodar de novo em
 * conflito de revisão (`unidade-de-trabalho.ts`, `tentativas: 3`) sem
 * duplicar nada — a mesma garantia que 03-10 escreveu para o lote dela,
 * aplicada aqui à barreira que esta operação tem (`task.statusId`, que só
 * existe no estado hidratado — ao contrário de `importacao_ledger`, que é
 * consultável antes de hidratar).
 *
 * Não faz I/O nenhum: sem rede, sem disco, sem variável de ambiente
 * (`../../CONTEXT.md`, a regra de dependência).
 */

import { memberSeesTask, statusDefinition } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Id } from "../types";
import { memberActor, recordActivity } from "./activity";
import { changeTaskStatus } from "./tasks";

/**
 * 117 contas em `para pagar` no export real (03-10); o lote real de CON-CP-11
 * foi 61. 200 cobre com folga a população inteira que o gesto alcança de
 * verdade e transforma "selecionei as 2.861" numa recusa imediata do
 * domínio, antes de qualquer escrita — em vez de um lock de minutos. Acima
 * de 200 o argumento de 03-10 (picotar) volta a valer, e quem pica é o
 * chamador, não esta função.
 */
export const LIMITE_DO_LOTE = 200;

export type ResultadoDoItem = "alterada" | "jaEstava" | "recusada" | "parcial";

export interface ItemDeLote {
  readonly taskId: Id;
  readonly resultado: ResultadoDoItem;
  /**
   * Omitidos quando a Tarefa não existe ou o Membro não a enxerga (T-3-45):
   * o relatório nunca conta a quem não pode ver que a Tarefa existe e como
   * ela se chama.
   */
  readonly readableId?: string;
  readonly titulo?: string;
  readonly motivo?: string;
  readonly ocorrenciaCriadaId?: Id;
}

export interface RelatorioDeLote {
  readonly statusId: Id;
  readonly solicitadas: number;
  readonly alteradas: number;
  readonly jaEstavam: number;
  readonly recusadas: number;
  readonly parciais: number;
  readonly ocorrenciasCriadas: number;
  readonly itens: readonly ItemDeLote[];
}

interface ContagensDaLista {
  alteradas: number;
  jaEstavam: number;
  recusadas: number;
  parciais: number;
}

/**
 * Muda o Status de várias Tarefas num só gesto. Cada item é resolvido
 * independentemente — a recusa de uma não derruba as outras (os 61 fatos são
 * independentes; a atomicidade que 03-10 precisa é entre duas metades do
 * MESMO fato, Tarefa + linha de ledger, nunca entre fatos independentes).
 * Ver o cabeçalho do arquivo para o desenho completo.
 */
export function alterarStatusEmLote(
  state: DataState,
  actingMemberId: Id,
  taskIds: readonly Id[],
  statusId: Id,
): OperationResult<RelatorioDeLote> {
  /* 1 — Guardas do gesto, todas antes de qualquer escrita. */
  if (taskIds.length === 0) {
    return fail("Selecione ao menos uma Tarefa para fechar em lote.");
  }
  if (taskIds.length > LIMITE_DO_LOTE) {
    return fail(`Um lote fecha no máximo ${LIMITE_DO_LOTE} Tarefas por vez; ${taskIds.length} foram selecionadas.`);
  }
  if (new Set(taskIds).size !== taskIds.length) {
    return fail("A lista de Tarefas tem um id repetido.");
  }

  const itens: ItemDeLote[] = [];
  const porLista = new Map<Id, ContagensDaLista>();
  let ocorrenciasCriadas = 0;

  const contarNaLista = (listId: Id, chave: keyof ContagensDaLista): void => {
    const atual = porLista.get(listId) ?? { alteradas: 0, jaEstavam: 0, recusadas: 0, parciais: 0 };
    atual[chave] += 1;
    porLista.set(listId, atual);
  };

  /* 2 — cada Tarefa, na ordem de entrada. */
  for (const taskId of taskIds) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      itens.push({ taskId, resultado: "recusada", motivo: "Tarefa não encontrada." });
      continue;
    }

    // A ÚNICA regra de permissão que o lote consulta por conta própria — a
    // mesma frase que `taskWriteRefusal` usa (`../derive.ts`) — e só porque
    // o passo seguinte (jaEstava) responderia sobre a Tarefa sem nunca
    // chamar `changeTaskStatus`. Escrever a regra de escrita aqui duplicaria
    // o que `taskWriteRefusal` já decide.
    if (!memberSeesTask(state, actingMemberId, taskId)) {
      itens.push({ taskId, resultado: "recusada", motivo: "Você não tem acesso a esta Tarefa." });
      continue;
    }

    if (task.statusId === statusId) {
      // T-3-46 — SEM chamar `changeTaskStatus`: com `before.id === target.id`
      // a função pula as guardas de saída/entrada mas ainda regrava
      // `statusId`, escreve um Registro com `before === after` e REDISPARA
      // `runListAutomations` — A2 removeria o Financeiro de Responsável de
      // novo a cada reexecução do mesmo lote.
      itens.push({ taskId, resultado: "jaEstava", readableId: task.readableId, titulo: task.title });
      contarNaLista(task.listId, "jaEstavam");
      continue;
    }

    const antesDaChamada = state.tasks.length;
    const resultado = changeTaskStatus(state, actingMemberId, taskId, statusId);

    if (resultado.ok) {
      const nascida = state.tasks
        .slice(antesDaChamada)
        .find((t) => t.provenance?.kind === "recurrence" && t.provenance.sourceId === taskId);
      itens.push({
        taskId,
        resultado: "alterada",
        readableId: task.readableId,
        titulo: task.title,
        ...(nascida ? { ocorrenciaCriadaId: nascida.id } : {}),
      });
      if (nascida) ocorrenciasCriadas += 1;
      contarNaLista(task.listId, "alteradas");
      continue;
    }

    // `ok: false` — `changeTaskStatus` recusa sempre ANTES de mutar, com uma
    // exceção: a falha de `spawnNextOccurrence`, depois de já ter gravado o
    // Status, registrado a Atividade e rodado as Automações. Comparar
    // `task.statusId` com o alvo distingue os dois sem depender do texto da
    // mensagem — `task` é a MESMA referência que `changeTaskStatus` mutou.
    const mutou = task.statusId === statusId;
    itens.push({
      taskId,
      resultado: mutou ? "parcial" : "recusada",
      readableId: task.readableId,
      titulo: task.title,
      // O `motivo` é LITERALMENTE `resultado.error` — o domínio já nomeia
      // Campo e Membro em pt-BR, nunca valor; reescrever aqui criaria uma
      // segunda voz para a mesma regra.
      motivo: resultado.error,
    });
    if (mutou) contarNaLista(task.listId, "parciais");
    else contarNaLista(task.listId, "recusadas");
  }

  const alteradas = itens.filter((i) => i.resultado === "alterada").length;
  const jaEstavam = itens.filter((i) => i.resultado === "jaEstava").length;
  const recusadas = itens.filter((i) => i.resultado === "recusada").length;
  const parciais = itens.filter((i) => i.resultado === "parcial").length;

  /* 3 — o Registro consolidado (T-3-48), um por Lista com pelo menos uma
   * mudança real (`alterada`/`parcial`) — nunca quando nada mudou, para a
   * reexecução não poluir a trilha. */
  const ator = memberActor(actingMemberId);
  for (const [listId, contagens] of porLista) {
    if (contagens.alteradas === 0 && contagens.parciais === 0) continue;
    const nomeDaLista = state.lists.find((l) => l.id === listId)?.name ?? listId;
    const nomeDoAlvo = statusDefinition(state, listId, statusId)?.name ?? statusId;
    recordActivity(state, {
      actor: ator,
      action: "Status alterado em lote",
      objectType: "list",
      objectId: listId,
      objectName: nomeDaLista,
      after: nomeDoAlvo,
      // Só contagens — nenhum título de Tarefa, nenhum valor, nenhum nome de
      // fornecedor (D-25).
      detail: `${contagens.alteradas} alterada(s), ${contagens.jaEstavam} já estava(m), ${contagens.recusadas} recusada(s), ${contagens.parciais} parcial(is)`,
    });
  }

  /* 4 — o lote nunca devolve `ok: false` por causa de um item: recusa de
   * item é valor dentro do relatório. */
  return ok({
    statusId,
    solicitadas: taskIds.length,
    alteradas,
    jaEstavam,
    recusadas,
    parciais,
    ocorrenciasCriadas,
    itens,
  });
}
