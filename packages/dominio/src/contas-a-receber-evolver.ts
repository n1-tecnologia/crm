/**
 * Evolver idempotente de "Contas a receber" (D5-02b, Plan 05-10): fecha
 * EXATAMENTE o que a conferência somente-leitura de 05-09
 * (`05-CONFERENCIA-WS-N1.md`) achou — cria o que falta, confere o que existe,
 * nunca sobrescreve. Molde de `solicitacao-de-pagamento-evolver.ts` (Plan
 * 02-08); os tipos `DiffDeConfiguracao`/`DivergenciaDeConfiguracao` são
 * IMPORTADOS de lá, não duplicados.
 *
 * O catálogo esperado nasce de `buildGestaoBootstrap()` — o MESMO `DataState`
 * de produção da Fase 1 (`bootstrap-gestao.ts`), que já chama
 * `applyContasAReceber(state, clock, { fixtures: false })` internamente: a
 * mesma técnica do conferidor de 05-09
 * (`apps/api/src/bootstrap/conferir-contas-a-receber.ts::construirEsperado`),
 * só que reaproveitando o construtor de estado que o próprio `dominio` já
 * expõe em vez de montar um segundo esqueleto de `DataState` vazio aqui. O
 * evolver nunca diverge do seed por cópia manual.
 *
 * Três regras duras, iguais ao molde de 02-08:
 *   1. NUNCA remove nada — Status, Campo, Automação, Concessão ou Visão a
 *      mais no estado é divergência reportada, nunca item deletado. Nenhuma
 *      linha deste arquivo chama `.filter()`/`.splice()` para tirar um
 *      elemento de uma coleção do catálogo.
 *   2. NUNCA toca `state.tasks` nem qualquer Comentário ou valor de Campo já
 *      gravado — este arquivo não lê nem escreve `state.tasks` em nenhuma
 *      linha.
 *   3. Ids são sempre os literais de `CR` (`operations/financeiro.ts`), nunca
 *      gerados por contador de sequência — reexecutar não pode produzir um id
 *      diferente do já gravado.
 *
 * D5-13 — os seis Status ficam os seis, e o evolver nunca propõe remover
 * `estornado` nem `descartado`: `estornado` (`entryFromStatusIds:
 * [S.recebido]`) só é alcançável a partir de `recebido` — é exatamente o que
 * um estorno é, a reversão de um recebimento. `descartado` tem outro
 * significado ("não será mais cobrado") e outra entrada (qualquer Status não
 * fechado). Fundir os dois perderia essa distinção e mentiria no relatório.
 */

import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { CR } from "./operations/financeiro";
import { memberActor, recordActivity } from "./operations/activity";
import type { DiffDeConfiguracao, DivergenciaDeConfiguracao } from "./solicitacao-de-pagamento-evolver";
import { fail, ok, type DataState, type OperationResult } from "./state";
import type { Automation, FieldDefinition, Grant, Id, StatusDefinition, View } from "./types";

/** Reexportados do evolver de 02-08 (mesmos tipos, sem gêmeos) — `apps/api` importa daqui. */
export type { DiffDeConfiguracao, DivergenciaDeConfiguracao };

/** Os 6 ids do catálogo (seção 8 da spec) — R1 é a operação `createReceivableSeries`, R7 é a Recorrência de uma Tarefa (Plan 05-10, Task 3), nenhum dos dois é uma Automação `aut_cr_*`. */
const AUTOMACAO_IDS: readonly Id[] = ["aut_cr_r2", "aut_cr_r2b", "aut_cr_r3", "aut_cr_r4", "aut_cr_r5", "aut_cr_r6"];

/**
 * Serialização canônica (chaves em ordem alfabética) — cópia deliberada de
 * `apps/api/src/persistencia/repositorio.ts::canonico`: `packages/dominio`
 * não importa de `apps/api` (a regra de dependência do monorepo, ver
 * `CONTEXT.md` raiz), e este arquivo precisa da mesma comparação estável de
 * JSON que o conferidor de 05-09 usa para `entryRequirements`,
 * `entryFromStatusIds`, `conditions` e `actions`.
 */
function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  const partes: string[] = [];
  for (const chave of Object.keys(valor as object).sort()) {
    const v = (valor as Record<string, unknown>)[chave];
    if (v === undefined) continue;
    partes.push(`${JSON.stringify(chave)}:${canonico(v)}`);
  }
  return `{${partes.join(",")}}`;
}

function ordenarIds(ids: readonly Id[] | undefined): readonly Id[] {
  return ids ? [...ids].sort() : [];
}

function versaoPublicada(automacao: Automation): Automation["versions"][number] | undefined {
  return automacao.versions.find((v) => v.state === "publicada") ?? automacao.versions.at(-1);
}

function conferirCampos(
  divergentes: DivergenciaDeConfiguracao[],
  id: Id,
  pares: ReadonlyArray<readonly [campo: string, esperado: string, encontrado: string]>,
): void {
  for (const [campo, esperado, encontrado] of pares) {
    if (esperado !== encontrado) divergentes.push({ id, campo, esperado, encontrado });
  }
}

function formatarDivergencias(divergentes: readonly DivergenciaDeConfiguracao[]): string {
  const linhas = divergentes.map((d) => `${d.id}.${d.campo}: esperado "${d.esperado}", encontrado "${d.encontrado}"`);
  return `Configuração da Lista "Contas a receber" diverge do catálogo — nada foi sobrescrito:\n${linhas.join("\n")}`;
}

/**
 * Evolui a configuração da Lista "Contas a receber" sobre um `DataState` já
 * bootstrapado pela Fase 1 (Espaço "Gestão" › Pasta "Financeiro" › a própria
 * Lista, criada por `bootstrapGestao()` com `{ fixtures: false }` —
 * D5-02b). Reaplicar é seguro: a segunda chamada sobre o próprio resultado
 * devolve `ok` com `criados` e `divergentes` vazios — o que a conferência de
 * 05-09 já provou contra `ws_n1` (zero divergências nas cinco seções).
 */
export function evoluirConfiguracaoDeContasAReceber(
  state: DataState,
  actingMemberId: Id,
): OperationResult<DiffDeConfiguracao> {
  const listaExistente = state.lists.find((l) => l.id === CR.listId);
  if (!listaExistente) {
    return fail(
      `Lista "Contas a receber" (${CR.listId}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`,
    );
  }

  const agora = new Date().toISOString();
  const ator = memberActor(actingMemberId);
  const catalogo = buildGestaoBootstrap({ workspaceId: state.workspace.id, agora });
  const listaCatalogo = catalogo.lists.find((l) => l.id === CR.listId);
  if (!listaCatalogo) {
    throw new Error(`Lista "${CR.listId}" ausente do catálogo — bug no seed, não no evolver.`);
  }

  const criados: string[] = [];
  const conferidos: string[] = [];
  const divergentes: DivergenciaDeConfiguracao[] = [];

  const registrarCriacao = (objectType: string, objectId: Id, objectName: string): void => {
    criados.push(objectId);
    recordActivity(state, { actor: ator, action: "criar", objectType, objectId, objectName, at: agora });
  };

  /* ── Lista ─────────────────────────────────────────────────────────────── */
  conferirCampos(divergentes, listaExistente.id, [
    ["name", listaCatalogo.name, listaExistente.name],
    ["parentId", listaCatalogo.parentId, listaExistente.parentId],
  ]);
  conferidos.push(listaExistente.id);

  /* ── Status (D5-13 — nunca removido; os dois "nunca usados" ficam) ──────
   * `estornado` (entryFromStatusIds: [S.recebido]) é a reversão de um
   * recebimento; `descartado` é "não será mais cobrado", com outra entrada.
   * Nenhum ramo abaixo tira um Status do Conjunto — divergência é o único
   * desfecho de um Status a mais ou adulterado. */
  if (!listaExistente.statusSet) {
    throw new Error(`Lista "${CR.listId}" sem Conjunto de Status — estado inconsistente, fora do que este evolver corrige.`);
  }
  for (const statusCatalogo of listaCatalogo.statusSet!.definitions) {
    const existente = listaExistente.statusSet.definitions.find((s: StatusDefinition) => s.id === statusCatalogo.id);
    if (!existente) {
      listaExistente.statusSet.definitions.push({ ...statusCatalogo });
      registrarCriacao("status", statusCatalogo.id, statusCatalogo.name);
      continue;
    }
    conferirCampos(divergentes, statusCatalogo.id, [
      ["name", statusCatalogo.name, existente.name],
      ["color", statusCatalogo.color, existente.color],
      ["category", statusCatalogo.category, existente.category],
      ["order", String(statusCatalogo.order), String(existente.order)],
      ["entryRequirements", canonico(statusCatalogo.entryRequirements ?? []), canonico(existente.entryRequirements ?? [])],
      ["entryFromStatusIds", canonico(ordenarIds(statusCatalogo.entryFromStatusIds)), canonico(ordenarIds(existente.entryFromStatusIds))],
    ]);
    conferidos.push(statusCatalogo.id);
  }
  // Status a mais na Lista, fora do catálogo — nunca removido, só reportado.
  for (const extra of listaExistente.statusSet.definitions) {
    if (!listaCatalogo.statusSet!.definitions.some((s) => s.id === extra.id)) {
      divergentes.push({ id: extra.id, campo: "presença", esperado: "ausente do catálogo", encontrado: `Status "${extra.name}" presente mas não previsto no catálogo` });
    }
  }

  /* ── Campos ────────────────────────────────────────────────────────────── */
  for (const id of Object.values(CR.fields)) {
    const campoCatalogo = catalogo.fieldDefinitions.find((f) => f.id === id);
    if (!campoCatalogo) continue; // bug no seed, não no evolver
    const existente = state.fieldDefinitions.find((f) => f.id === id);
    if (!existente) {
      state.fieldDefinitions.push({ ...campoCatalogo });
      registrarCriacao("fieldDefinition", campoCatalogo.id, campoCatalogo.name);
      continue;
    }
    conferirCampos(divergentes, id, [
      ["name", campoCatalogo.name, existente.name],
      ["type", campoCatalogo.type, existente.type],
      ["required", String(campoCatalogo.required), String(existente.required)],
      ["options", canonico(campoCatalogo.options ?? []), canonico(existente.options ?? [])],
    ]);
    conferidos.push(id);
  }
  // Campo a mais LIGADO A ESTA LISTA, fora do catálogo — nunca removido, só
  // reportado. Escopado por `definedAtId` para não acusar Campos de "Contas a
  // pagar" ou de outra Lista da mesma Pasta/Espaço.
  for (const extra of state.fieldDefinitions as readonly FieldDefinition[]) {
    if (extra.definedAtType !== "list" || extra.definedAtId !== CR.listId) continue;
    if (!Object.values(CR.fields).some((id) => id === extra.id)) {
      divergentes.push({ id: extra.id, campo: "presença", esperado: "ausente do catálogo", encontrado: `Campo "${extra.name}" presente na Lista mas não previsto no catálogo` });
    }
  }

  /* ── Automações (aut_cr_r2..r6 — R1 é operação, R7 é Recorrência) ────────── */
  for (const id of AUTOMACAO_IDS) {
    const automacaoCatalogo = catalogo.automations.find((a) => a.id === id);
    if (!automacaoCatalogo) continue; // bug no seed, não no evolver
    const existente = state.automations.find((a) => a.id === id);
    if (!existente) {
      state.automations.push({ ...automacaoCatalogo });
      registrarCriacao("automation", automacaoCatalogo.id, automacaoCatalogo.name);
      continue;
    }
    conferirCampos(divergentes, id, [
      ["lifecycle", automacaoCatalogo.lifecycle, existente.lifecycle],
      ["scopeType", automacaoCatalogo.scopeType, existente.scopeType],
      ["scopeId", automacaoCatalogo.scopeId, existente.scopeId],
    ]);
    const vCatalogo = versaoPublicada(automacaoCatalogo);
    const vExistente = versaoPublicada(existente);
    if (vCatalogo && vExistente) {
      conferirCampos(divergentes, id, [
        ["trigger.kind", vCatalogo.trigger?.kind ?? "", vExistente.trigger?.kind ?? ""],
        ["trigger.temporalPredicate", vCatalogo.trigger?.temporalPredicate ?? "", vExistente.trigger?.temporalPredicate ?? ""],
        ["trigger.eventSubtype", vCatalogo.trigger?.eventSubtype ?? "", vExistente.trigger?.eventSubtype ?? ""],
        ["conditions", canonico(vCatalogo.conditions), canonico(vExistente.conditions)],
        [
          "actions",
          canonico(vCatalogo.actions.map((a) => ({ order: a.order, toolId: a.toolId ?? null, controlKind: a.controlKind ?? null, params: JSON.parse(a.params) }))),
          canonico(vExistente.actions.map((a) => ({ order: a.order, toolId: a.toolId ?? null, controlKind: a.controlKind ?? null, params: JSON.parse(a.params) }))),
        ],
      ]);
    } else if (vCatalogo && !vExistente) {
      divergentes.push({ id, campo: "versaoPublicada", esperado: "presente", encontrado: "ausente" });
    }
    conferidos.push(id);
  }
  // Automação a mais no ESCOPO desta Lista, fora dos 6 ids — nunca removida, só reportada.
  for (const extra of state.automations as readonly Automation[]) {
    if (extra.scopeType !== "list" || extra.scopeId !== CR.listId) continue;
    if (!AUTOMACAO_IDS.includes(extra.id)) {
      divergentes.push({ id: extra.id, campo: "presença", esperado: "ausente do catálogo", encontrado: `Automação "${extra.name}" presente mas não prevista no catálogo` });
    }
  }

  /* ── Concessões ligadas à Lista ────────────────────────────────────────── */
  const grantsCatalogo = catalogo.grants.filter((g) => g.resourceId === CR.listId);
  for (const grantCatalogo of grantsCatalogo) {
    const existente = state.grants.find((g) => g.id === grantCatalogo.id);
    if (!existente) {
      state.grants.push({ ...grantCatalogo });
      registrarCriacao("grant", grantCatalogo.id, grantCatalogo.id);
      continue;
    }
    conferirCampos(divergentes, grantCatalogo.id, [
      [
        "permissions",
        canonico({ subjectKind: grantCatalogo.subjectKind, subjectId: grantCatalogo.subjectId, action: grantCatalogo.action, resourceType: grantCatalogo.resourceType, scope: grantCatalogo.scope }),
        canonico({ subjectKind: existente.subjectKind, subjectId: existente.subjectId, action: existente.action, resourceType: existente.resourceType, scope: existente.scope }),
      ],
    ]);
    conferidos.push(grantCatalogo.id);
  }
  for (const extra of state.grants as readonly Grant[]) {
    if (extra.resourceType !== "list" || extra.resourceId !== CR.listId) continue;
    if (!grantsCatalogo.some((g) => g.id === extra.id)) {
      divergentes.push({ id: extra.id, campo: "presença", esperado: "ausente do catálogo", encontrado: "Concessão presente na Lista mas não prevista no catálogo" });
    }
  }

  /* ── Visões ligadas à Lista ───────────────────────────────────────────── */
  const viewsCatalogo = catalogo.views.filter((v) => v.listId === CR.listId);
  for (const viewCatalogo of viewsCatalogo) {
    const existente = state.views.find((v) => v.id === viewCatalogo.id);
    if (!existente) {
      state.views.push({ ...viewCatalogo });
      registrarCriacao("view", viewCatalogo.id, viewCatalogo.name);
      continue;
    }
    conferirCampos(divergentes, viewCatalogo.id, [
      ["name", viewCatalogo.name, existente.name],
      ["filters", canonico(viewCatalogo.filters), canonico(existente.filters)],
    ]);
    conferidos.push(viewCatalogo.id);
  }
  for (const extra of state.views as readonly View[]) {
    if (extra.listId !== CR.listId) continue;
    if (!viewsCatalogo.some((v) => v.id === extra.id)) {
      divergentes.push({ id: extra.id, campo: "presença", esperado: "ausente do catálogo", encontrado: `Visão "${extra.name}" presente na Lista mas não prevista no catálogo` });
    }
  }

  /* ── Qualquer divergência recusa — nada mais muda a partir daqui ────────── */
  if (divergentes.length > 0) {
    return fail(formatarDivergencias(divergentes));
  }

  return ok({ criados, conferidos, divergentes });
}
