/**
 * Importação histórica de Solicitações de pagamento (SOL-09, D-24/D-25).
 *
 * `importarSolicitacaoHistorica` cria, para uma linha de
 * `public.solicitacoes_pagamentos` (Supabase do `financeiro-tria`), uma
 * Tarefa JÁ FECHADA em "aprovado" ou "não aprovado" na Lista "Solicitações
 * de pagamento" (Plan 02-08). Composição sobre `createTask` +
 * `setTaskFieldValue` + `changeTaskStatus` — nunca gravando a coleção de
 * Tarefas do estado por fora dessas funções: os limites, validações e a
 * Lista continuam valendo para uma Tarefa importada como para qualquer
 * outra (T-02-02).
 *
 * O que é demonstrável, e só isso: quando a linha de origem não tem uma
 * data de criação (a tabela legada não guarda `created_at`/`inserted_at`
 * confiável — ver `apps/api/src/importacao/financeiro/CONTEXT.md`), a
 * Tarefa nasce com `createdAt` = agora e a lacuna `"data_de_criacao_ausente"`
 * é registrada — nunca `id`, vencimento ou posição física como substituto
 * (D-25). Quando a autoria não é demonstrável, o Ator é `importActor`, não
 * um Membro inventado.
 *
 * Atômica, no mesmo estilo de `submitForm` (`./scale.ts`): um `antes`
 * (contagens + contador de id legível) e um `desfazer` que reverte tudo se
 * um Campo for recusado no meio do caminho — a diferença é que aqui não há
 * consolidação de UM Registro de Atividade só: cada fato (Tarefa importada,
 * cada lacuna, o Comentário do RESUMO) é o seu próprio Registro, todos
 * atribuídos ao Ator resolvido — nunca ao operador do CLI que roda a
 * importação (`actingMemberId`, que só empresta a permissão de escrever na
 * Lista, do mesmo jeito que `form.ownerMemberId` empresta em `submitForm`).
 *
 * NÃO É registrada em `OPERACOES` (`./registro.ts`): quem importa não é um
 * Membro usando a interface (a mesma razão de `submitForm` estar de fora) —
 * só o CLI do `apps/api` (Plan 02-25) chama esta função diretamente.
 *
 * NÃO produz nenhum efeito de saída para o `automation/`: a fila
 * transacional de entrega HTTP só nasce na escrita de uma operação
 * registrada (Plan 02-09); esta função nunca passa por ali. A composição
 * com `changeTaskStatus` roda `runListAutomations` como qualquer chamada
 * normal rodaria — inofensivo aqui porque o evolver do Plan 02-08 não
 * configura nenhuma Automação na Lista "Solicitações de pagamento" — mas o
 * desenho não depende dessa ausência: esta função nunca recebe um
 * parâmetro para notificar terceiros nem cita esse conceito em código.
 *
 * Desvio do texto do plano: o catálogo de proveniência (`Provenance.kind`,
 * `types/primitives.ts`) só tem o literal em inglês `"import"` — não
 * `"importacao"`. `types/primitives.ts` está fora do território deste
 * plano (não está em `files_modified`), então esta função usa o literal
 * `"import"` já existente, que já é exatamente "importação" em inglês —
 * consistente com os demais `kind` do mesmo tipo (`"template"`,
 * `"recurrence"`, `"form"`, `"deal"`…, todos em inglês apesar do domínio
 * ser pt-BR). Documentado no SUMMARY do Plan 02-22.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import { SOL } from "../solicitacao-de-pagamento";
import type { ActorRef, Comment, FieldValue, Id, Instant, Task } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { changeTaskStatus, createTask, setTaskFieldValue } from "./tasks";

/**
 * Id literal e estável da Lista "Solicitações de pagamento"
 * (`../solicitacao-de-pagamento-evolver.ts`, `LISTA_ID`). Não exportado de
 * lá — aquele arquivo está fora do território deste plano — então o
 * literal é duplicado aqui, com a mesma disciplina de "nunca gerado por
 * sequência" que o resto do catálogo usa. Reexecutar não pode apontar para
 * uma Lista diferente.
 */
const LISTA_SOLICITACOES_ID: Id = "lst_solicitacoes_de_pagamento";

/**
 * Ator de importação: `{ kind: "system", id: "importacao:<origem>" }`, no
 * mesmo estilo de `formActor` (`./scale.ts`) — um Ator próprio que a
 * timeline reconhece como "não é um Membro", para quando a autoria da
 * linha legada não é demonstrável (D-25).
 */
export function importActor(origem: string): ActorRef {
  return { kind: "system", id: `importacao:${origem}` };
}

export interface EntradaDeImportacaoHistorica {
  readonly legacyTaskId: string;
  readonly origem: "clickup";
  readonly status: "aprovado" | "não aprovado";
  readonly titulo: string;
  readonly descricao?: string;
  readonly campos: Readonly<Record<Id, string | boolean | readonly string[]>>;
  /** `comentario` da linha legada — vira Comentário do RESUMO quando não vazio, preservando o formato. */
  readonly resumo?: string;
  /** Só quando a origem tem uma data de criação demonstrável (ver cabeçalho). */
  readonly criadaEm?: Instant;
  /** Data de fechamento demonstrável; sem ela, `completedAt` usa `criadaEm` (ou agora, se nem essa houver). */
  readonly fechadaEm?: Instant;
  readonly autoriaConhecida?: { readonly memberId: Id };
  /** Categorias já levantadas por `classificarLinha` (apps/api) — nunca o valor problemático em si. */
  readonly lacunas: readonly string[];
}

export function jaImportada(state: DataState, origem: string, legacyTaskId: string): boolean {
  return state.tasks.some(
    (t) => t.provenance?.kind === "import" && t.provenance.sourceId === legacyTaskId && t.provenance.sourceName === origem,
  );
}

/**
 * Importa uma linha histórica como Tarefa fechada. Ver o cabeçalho do
 * arquivo para o desenho completo (rollback, Ator, ausência de disparo).
 */
export function importarSolicitacaoHistorica(
  state: DataState,
  actingMemberId: Id,
  entrada: EntradaDeImportacaoHistorica,
): OperationResult<Task> {
  if (!entrada.legacyTaskId.trim()) return fail("O id da Tarefa legada não pode ficar vazio.");
  if (entrada.origem !== "clickup") return fail("Origem de importação desconhecida.");
  if (entrada.status !== "aprovado" && entrada.status !== "não aprovado") {
    return fail("Status de importação inválido: só 'aprovado' ou 'não aprovado'.");
  }
  if (!entrada.titulo.trim()) return fail("O título da Tarefa importada não pode ficar vazio.");

  // B — reimportar a mesma linha é recusado aqui; o `importacao_ledger` (Plan
  // 02-25) é a segunda barreira, no banco.
  if (jaImportada(state, entrada.origem, entrada.legacyTaskId)) {
    return fail(`A linha "${entrada.legacyTaskId}" (${entrada.origem}) já foi importada.`);
  }

  const agora = new Date().toISOString();
  const criadaEm = entrada.criadaEm ?? agora;
  const ator = entrada.autoriaConhecida ? memberActor(entrada.autoriaConhecida.memberId) : importActor(entrada.origem);
  const delegate = ator.kind !== "member" ? memberActor(actingMemberId) : undefined;
  const lacunas =
    entrada.criadaEm === undefined && !entrada.lacunas.includes("data_de_criacao_ausente")
      ? [...entrada.lacunas, "data_de_criacao_ausente"]
      : entrada.lacunas;

  // Tudo ou nada: um Campo recusado no meio desfaz Tarefa, Registros e o
  // identificador legível consumido — mesma técnica de `submitForm`.
  const antes = {
    tasks: state.tasks.length,
    activity: state.activity.length,
    readable: state.workspace.taskReadableId.next,
  };
  const desfazer = (motivo: string, field?: Id): OperationResult<Task> => {
    state.tasks.splice(antes.tasks);
    state.activity.splice(0, state.activity.length - antes.activity);
    state.workspace.taskReadableId.next = antes.readable;
    return fail(motivo, field);
  };

  // `runAutomations: false` — nada precisa ver a Tarefa enquanto Campos e
  // Status ainda não estão completos; não há automação nesta Lista hoje,
  // mas o padrão é o mesmo de `submitForm`.
  const criada = createTask(state, actingMemberId, { listId: LISTA_SOLICITACOES_ID, title: entrada.titulo }, { runAutomations: false });
  if (!criada.ok) return criada;
  let task = criada.value;

  for (const [definitionId, valor] of Object.entries(entrada.campos)) {
    const r = setTaskFieldValue(state, actingMemberId, task.id, definitionId as Id, valor as FieldValue["value"]);
    if (!r.ok) return desfazer(`Campo "${definitionId}": ${r.error}`, definitionId);
  }

  const statusAlvo = entrada.status === "aprovado" ? SOL.status.aprovado : SOL.status.naoAprovado;
  const statusMudado = changeTaskStatus(state, actingMemberId, task.id, statusAlvo);
  if (!statusMudado.ok) return desfazer(statusMudado.error);

  // Comentário do RESUMO: escrito direto em `task.comments` (não em
  // `state.tasks`) porque `addTaskComment` recusa um Ator "member" diferente
  // de `actingMemberId` ("Um Membro não comenta em nome de outro Membro") —
  // uma regra pensada para uso ao vivo, que não se aplica a reconstruir
  // autoria histórica. `task` já existe via `createTask`; só o Comentário é
  // manual, no mesmo espírito de `submitForm` escrevendo `task.fieldValues`
  // fora de `setTaskFieldValue` para os anexos.
  if (entrada.resumo !== undefined && entrada.resumo.trim() !== "") {
    const comentario: Comment = {
      id: nextId("cmt"),
      author: ator,
      ...(delegate ? { authorDelegate: delegate } : {}),
      content: entrada.resumo,
      attachments: [],
      mentions: [],
      createdAt: criadaEm,
    };
    task.comments.push(comentario);
  }

  // Remove os Registros transitórios de `createTask`/`setTaskFieldValue`/
  // `changeTaskStatus`, todos atribuídos a `actingMemberId` (o operador do
  // CLI, que só empresta a permissão) — o Ator correto substitui, com o
  // instante histórico.
  state.activity.splice(0, state.activity.length - antes.activity);

  // `createdAt` é `readonly` no tipo `Task` (RecordBase): a única forma
  // correta de honrar "usar `criadaEm` como `createdAt`" é substituir a
  // entrada de `state.tasks` por uma cópia — nunca atribuir a propriedade.
  const indice = state.tasks.findIndex((t) => t.id === task.id);
  const tarefaFinal: Task = {
    ...task,
    createdAt: criadaEm,
    provenance: { kind: "import", sourceId: entrada.legacyTaskId, sourceName: entrada.origem, at: agora },
    ...(entrada.descricao !== undefined ? { description: entrada.descricao } : {}),
    completedAt: entrada.fechadaEm ?? criadaEm,
  };
  state.tasks[indice] = tarefaFinal;
  task = tarefaFinal;

  recordActivity(state, {
    actor: ator,
    ...(delegate ? { delegate } : {}),
    action: "Tarefa importada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: entrada.origem,
    at: criadaEm,
  });
  for (const lacuna of lacunas) {
    recordActivity(state, {
      actor: ator,
      ...(delegate ? { delegate } : {}),
      action: "Lacuna de importação",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      detail: lacuna,
      at: criadaEm,
    });
  }
  if (entrada.resumo !== undefined && entrada.resumo.trim() !== "") {
    recordActivity(state, {
      actor: ator,
      ...(delegate ? { delegate } : {}),
      action: "Comentário do RESUMO",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      detail: entrada.resumo.length > 80 ? `${entrada.resumo.slice(0, 77)}…` : entrada.resumo,
      at: criadaEm,
    });
  }

  return ok(task);
}
