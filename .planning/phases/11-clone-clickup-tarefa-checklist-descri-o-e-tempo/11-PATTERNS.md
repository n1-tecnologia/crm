# Fase 11: Clone ClickUp: Tarefa - Mapa de padrões

**Mapeado:** 2026-10-29
**Arquivos analisados:** 17 (8 testes novos, 9 módulos novos ou alterados de forma relevante)
**Análogos encontrados:** 17 / 17 (todos os análogos são rastreados no git; verificado com `git ls-files` para `derive.ts`, `derive-resumo.test.ts`, `task-editors.tsx`, `timeline.test.tsx`, `sem-codigo-de-regra.test.ts`)

## Classificação dos arquivos

| Arquivo novo/alterado | Papel | Fluxo de dados | Análogo mais próximo | Qualidade |
|---|---|---|---|---|
| `packages/dominio/src/derive.ts` (`conversaoDeItemRecusada`) | derivado | request-response (leitura pura) | `derive.ts:509` `taskLevel` + `:1137` `taskWriteRefusal` | exato |
| `packages/dominio/src/derive.ts` (`tempoRegistrado`) | derivado | transform | `derive.ts:490` `subtaskProgress` | exato |
| `packages/dominio/src/derive.ts` (`membrosMencionadosNaDescricao`, `pendingMentions` união) | derivado | transform | `derive.ts:1293` `pendingMentions` | exato |
| `packages/dominio/src/operations/tasks.ts` (`updateTask`, `convertChecklistItem`) | operação | CRUD | `tasks.ts:1818-1822` (`addTaskComment`) e `tasks.ts:1505-1514` | exato |
| `packages/dominio/src/operations/conversao-de-item.test.ts` | teste | CRUD | `operations/remover-checklist-e-item.test.ts` | exato |
| `packages/dominio/src/operations/descricao-da-tarefa.test.ts` | teste | CRUD | `operations/remover-checklist-e-item.test.ts` | exato |
| `packages/dominio/src/tempo-registrado.test.ts` | teste (derivado puro) | transform | `packages/dominio/src/derive-resumo.test.ts` | papel igual |
| `apps/web/src/features/estrutura/mencoes.ts` (`useMencoes`) | hook | event-driven | `task-editors.tsx:472-548` (`CommentComposer`) | exato (extração) |
| `apps/web/src/features/estrutura/mencoes.test.tsx` | teste web | event-driven | `features/tarefa/timeline.test.tsx` | exato |
| `apps/web/src/features/estrutura/descricao-da-tarefa.tsx` | componente | transform | `features/tarefa/timeline.tsx` (`Rico`, só `<span>`) | parcial |
| `apps/web/src/features/estrutura/conversao-de-item.tsx` + `.test.tsx` | componente + teste | request-response | `bulk-status-bar.test.tsx` (StoreProvider + Transporte falso) | papel igual |
| `apps/web/src/features/estrutura/tempo.ts` + `tempo.test.ts` | utilitário | transform | `collaboration-editors.tsx:170-174` (`minutos`) | exato (extração) |
| `apps/web/src/features/tarefa/alteracao-de-descricao.tsx` + `.test.tsx` | componente + teste | request-response | `timeline.tsx:272-303` (`LinhaDeAtividade`) | exato |
| `apps/web/src/features/tarefa/feed-de-atividade.test.tsx` | teste web | request-response | `timeline.test.tsx` | exato |

## Atribuições de padrão

### Derivados novos em `derive.ts` (`conversaoDeItemRecusada`, `tempoRegistrado`, `membrosMencionadosNaDescricao`)

**Regra do arquivo:** todo derivado recebe `state` (e `memberId` quando há visibilidade), devolve valor puro e nunca lê relógio. Quando precisa de "agora" (`notificacoesDoMembro`) recebe `now: Date` como parâmetro.

**Padrão de derivado sobre Subtarefas** (`derive.ts:489-497`), molde para `tempoRegistrado` (filtro por `effectiveLifecycleOfTask(...) === "ativo"`, só `state`):
```typescript
/** DO-STA-06 — only direct subtasks that are effectively `ativo` count. */
export function subtaskProgress(state: DataState, taskId: Id): { done: number; total: number } | null {
  const children = state.tasks.filter(
    (t) => t.parentTaskId === taskId && effectiveLifecycleOfTask(state, t.id) === "ativo",
  );
  if (children.length === 0) return null;
  const done = children.filter((c) => isTerminalCategory(statusCategory(state, c))).length;
  return { done, total: children.length };
}
```

**Proteção contra ciclo** (`derive.ts:509-515`), copiar o `Set` de visitados para a recursão de Subtarefas em `tempoRegistrado`:
```typescript
export function taskLevel(state: DataState, task: Task): number {
  let level = 0;
  let parentId = task.parentTaskId;
  const seen = new Set<Id>([task.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    level += 1;
```

**Remoção de `parentItemId` no mesmo arquivo** (`derive.ts:499-506`, único ponto que muda além de `:687`):
```typescript
export function checklistProgress(task: Task): { done: number; total: number } | null {
  const countable = task.checklists.flatMap((c) =>
    c.items.filter((i) => i.parentItemId === undefined && i.converted === undefined),
  );
```
(vira `c.items.filter((i) => i.converted === undefined)`).

**Esqueleto de `conversaoDeItemRecusada`:** usar o da RESEARCH.md (Pattern 1), reutilizando `taskWriteRefusal` (`derive.ts:1137`), `effectiveListConfig` (`:183`), `taskLevel` (`:509`).

### `pendingMentions` e `notificacoesDoMembro` (`derive.ts:1293-1390`)

**Núcleo atual a estender** (`derive.ts:1293-1312`): filtros `effectiveLifecycleOfTask(...) !== "ativo"` e `!memberSeesTask(...)` antes do laço. A variante `descricao` entra nesse mesmo laço, com o filtro extra `isTerminalCategory(statusCategory(state, task))` (usado em `derive.ts:1346`, `tarefasAbertasDoMembro`):
```typescript
for (const task of state.tasks) {
  if (effectiveLifecycleOfTask(state, task.id) !== "ativo") continue;
  if (!memberSeesTask(state, memberId, task.id)) continue;
  for (const comment of task.comments) {
    ...
    found.push({ task, comment });
  }
}
return found.sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt));
```

**Consumidores que quebram na união** (todos precisam estreitar por `tipo`):
- `derive.ts:1351` (campo `mencoes` da interface `NotificacoesDoMembro`) e `:1378-1379`:
```typescript
const mencoes = pendingMentions(state, memberId);
const observadas = comentariosObservados(state, memberId, new Set(mencoes.map((m) => m.comment.id)));
```
  Trocar para filtrar `m.tipo === "comentario"` antes do `Set`.
- `comentariosObservados` (`:1320`) **não muda** (continua `{ task, comment }`).
- `app/(shell)/notificacoes/page.tsx`, `operations/pessoa-da-conta.test.ts:223,225`, `operations/automations-motor.test.ts:268,269`: ajustar para `p.tipo === "comentario" && p.comment.id === ...`.
- Sino, `app-shell.tsx:368`, `panorama-do-robo.ts:43`, `respostas-do-robo.ts:120,124` só usam `.total`/`.length`: não mudam.

### `updateTask` / `convertChecklistItem` em `tasks.ts`

**Validação de Membro inexistente, copiar de `addTaskComment`** (`tasks.ts:1818-1822`):
```typescript
for (const mention of input.mentions ?? []) {
  if (mention.type === "member" && !state.members.some((m) => m.id === mention.id)) {
    return fail("A menção aponta para um Membro que não existe.");
  }
}
```

**Bloco da descrição a alterar** (`tasks.ts:1511-1514`; o Título logo acima, `:1507-1510`, já é o molde de `before`/`after`):
```typescript
mudancas.push({ action: "Título alterado", before: task.title, after: title });
...
if (input.description !== undefined && input.description !== task.description) {
  mudancas.push({ action: "Descrição alterada" });
  task.description = input.description;
}
```

**Tipo de entrada a estender** (`tasks.ts:1473-1482`, `UpdateTaskInput`): acrescentar `readonly descriptionMentions?: ReadonlyArray<{ readonly type: "member"; readonly id: Id }>;`. Validar antes de mutar (Pitfall 2 da RESEARCH).

### `operations/conversao-de-item.test.ts` e `operations/descricao-da-tarefa.test.ts` (teste de domínio, CRUD)

**Análogo:** `packages/dominio/src/operations/remover-checklist-e-item.test.ts` (linhas 8-24 e 55-67). Molde: `buildSeed()` num `beforeEach`, ids do seed como constantes, helper que relê a Tarefa do `state`, `Result` com `if (!x.ok) throw new Error(x.error)`.
```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { checklistProgress } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { convertChecklistItem, removeChecklist, removeChecklistItem } from "./tasks";

const THIAGO = "mem_thiago";
const TAREFA = "tsk_seed_1";
const CHECKLIST = "chk_seed_1";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const tarefa = () => state.tasks.find((t) => t.id === TAREFA)!;
```
```typescript
const conversao = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");
if (!conversao.ok) throw new Error(conversao.error);
const subtarefaId = conversao.value.id;
...
const registro = state.activity.find((a) => a.action === "Item de Checklist removido");
expect(registro?.before).toBe("...");
```
Testar "mudou `task.description` por atribuição direta, sem a lista, e `pendingMentions` não avisa" (invariante D-09) com `tarefa().description = "..."` como o rollback faz. Para "nível máximo", a cadeia `tsk_seed_3 -> 6 -> 7 -> 8` (nível 3, `maxSubtaskDepth: 3`, `seed.ts:2099`). Teste existente a atualizar: `operations.test.ts:~270-280` (`"nível 4"` vira `"nível 3"` + `"o último permitido"`). Apagar `remover-checklist-e-item.test.ts:41-53` (teste de Subitens) e atualizar o docstring `:1-7`.

### `tempo-registrado.test.ts` (derivado puro, sem relógio)

**Análogo:** `packages/dominio/src/derive-resumo.test.ts` (topo: comentário "Nenhum teste lê o relógio da máquina", `import { describe, expect, it } from "vitest"`, constantes `THIAGO`, imports de `./seed`, `./derive`). Estilo: ficar em `packages/dominio/src/` (nível do `derive`), importar `buildSeed` de `./seed` e `tempoRegistrado` de `./derive`; montar lançamentos empurrando em `task.timeEntries` (`TimeEntry`: `types/structure.ts:334-342`; aberto = sem `end`, fechado = `end` + `durationMinutes`). Casos: 30 + 45 + aberto = 75 e `emAndamento: true`; Subtarefa de 20 = `minutosComSubtarefas` 95; Subtarefa na lixeira não soma.

### `features/estrutura/mencoes.ts` (`useMencoes`)

**Analogo:** `apps/web/src/features/estrutura/task-editors.tsx:488-548` (`CommentComposer`), a fonte da extração. Partes para virar funções puras e hook:
```typescript
const arroba = (() => {
  const antes = texto.slice(0, caret);
  const m = /(^|\s)@([^\s@]*(?:\s[^\s@]*){0,2})$/.exec(antes);
  const consulta = m?.[2];
  return consulta !== undefined ? { inicio: antes.length - consulta.length - 1, consulta } : null;
})();
const sugestoes = arroba && !sugestoesFechadas
  ? members
      .filter((m) => m.state === "ativo")
      .filter((m) => normalizar(m.displayName).includes(normalizar(arroba.consulta)))
      .slice(0, 6)
  : [];
```
```typescript
const mencionar = (membro: { readonly id: string; readonly displayName: string }) => {
  if (!arroba) return;
  const antes = texto.slice(0, arroba.inicio);
  const depois = texto.slice(caret);
  const novo = `${antes}@${membro.displayName} ${depois}`;
  const novoCaret = antes.length + membro.displayName.length + 2;
  ...
  requestAnimationFrame(() => { const el = campo.current; if (!el) return; el.focus({ preventScroll: true }); el.setSelectionRange(novoCaret, novoCaret); });
};
// no envio:
mentions: mencoes.filter((m) => texto.includes(`@${m.nome}`)).map((m) => ({ type: "member", id: m.id })),
```
Há uma segunda cópia em `features/tarefa/timeline.tsx` (`arrobaEmCurso`, `normalizarBusca`, ~`:367`): extrair as funções puras, não refatorar o `Compositor` agora (10 testes de seletor).

### `mencoes.test.tsx`, `conversao-de-item.test.tsx`, `alteracao-de-descricao.test.tsx`, `feed-de-atividade.test.tsx` (web)

**Análogo principal:** `apps/web/src/features/tarefa/timeline.test.tsx`. Pragma na linha 1, `StoreProvider` real sobre `Transporte` falso (sem `fetch`), `cleanup` em `afterEach`:
```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
```
(`timeline.test.tsx:1-20`). Reaproveitar tal qual (copiar para cada arquivo novo ou, se o planejador preferir, extrair para um helper de teste): `ordensDeTodasAsColecoes` (`:23-35`), `transporteFalso` (`:41-54`), `montarTarefa` (`:57-66`, clona `state.tasks[0]` com `structuredClone` e zera coleções), `atividade(state, overrides)` (`:72-83`), `renderizar(...)` (`:85-92`) e o `beforeEach` (`:98-102`):
```typescript
function renderizar(state: DataState, ordens: Ordens, transporte: Transporte, memberId: string, task: Task, readOnly = false) {
  const fmt = makeFormatters(state.workspace.locale);
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
      <Timeline task={task} fmt={fmt} readOnly={readOnly} />
    </StoreProvider>,
  );
}
```
**Molde do Ator de integração** (`timeline.test.tsx:239-262`, caso (f)): empurra `atividade(...)` com `actor: { kind: "integration", id: "itg_omie" }`, `before`/`after`/`detail` sensíveis e afirma `container.textContent` sem o conteúdo. Para "Ver alteração": usar `queryByRole("button", { name: "Ver alteração" })` nulo para integração e para registro sem `before`/`after`; `before: ""` conta como presente (testar `!== undefined`, não truthiness). Molde de digitação no campo: `fireEvent.change(campo, { target: { value: "Olá" } })` e `fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true })` (`:268-281`), para o menu do "@Jú".
**Alternativa** (componente sem rota): `bulk-status-bar.test.tsx:1-30` usa o mesmo molde com `useRun` dentro de um componente de teste.
**Guarda de regra:** `features/estrutura/sem-codigo-de-regra.test.ts` varre textos de `features/estrutura` e `app/(shell)/estrutura`: nenhum texto novo pode ter `(RN-…)`, `(B..)`, `(A..)`.

### `features/tarefa/alteracao-de-descricao.tsx` (componente compartilhado Timeline + Feed)

**Análogo:** `features/tarefa/timeline.tsx:272-303` (`LinhaDeAtividade`) e `features/tarefa/feed-de-atividade.tsx:196-222`. As duas guardas de integração a unificar:
```typescript
// timeline.tsx:282-284 e :295
const ehIntegracao = record.actor.kind === "integration";
{!ehIntegracao && (record.before || record.after) ? ` (${record.before ?? "—"} → ${record.after ?? "—"})` : ""}
```
```typescript
// feed-de-atividade.tsx:196-198 e :218-219
const antesDepois = record.before || record.after ? ` (${record.before ?? "—"} → ${record.after ?? "—"})` : "";
const seguro = record.actor.kind === "integration" ? { ...record, before: undefined, after: undefined } : record;
```
No Feed a linha é montada como `string` (`textoDaLinha`, usada também no filtro de busca em `:225`); para "Descrição alterada" a string não leva `(antes → depois)`, e o botão é renderizado à parte. Mesma omissão em `auditoria/page.tsx:280-282` e `design/components.tsx:1338-1341`. Chave do caso especial: `objectType === "task" && action === "Descrição alterada"`.

### `features/estrutura/tempo.ts` e linha/editor de tempo

**Analogo:** `collaboration-editors.tsx:170-174` (formatador a mover/exportar) e `:198-199` (a soma local que passa a vir de `tempoRegistrado`):
```typescript
function minutos(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}
...
const fechados = task.timeEntries.filter((e) => e.end !== undefined);
const total = fechados.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
```
O `useAgora` (`:176-185`) fica onde está (cronômetro ao vivo, à parte do total). `tempo.test.ts`: teste puro do formatador (`0 -> "0 min"`, `135 -> "2 h 15 min"`), sem jsdom.

## Padrões compartilhados

### Retorno de operação como valor
**Fonte:** `tasks.ts` (`fail(...)`, `ok(...)`). **Aplica-se a:** `convertChecklistItem`, `updateTask`. Nunca lança exceção; testes usam `if (!r.ok) throw new Error(r.error)`.

### Recusa de escrita
**Fonte:** `derive.ts:1137` `taskWriteRefusal`, embrulhado por `mayWriteTask` em `tasks.ts:~1259`. **Aplica-se a:** `conversaoDeItemRecusada` (derive) e `convertChecklistItem` (chama o derive primeiro).

### Visibilidade ("ver")
**Fonte:** `derive.ts:1300` `memberSeesTask(state, memberId, task.id)`. **Aplica-se a:** `pendingMentions` (variante descrição) e qualquer leitor novo por Membro.

### Ator de integração nunca mostra `before`/`after`/`detail` (T-02-10)
**Fonte:** `timeline.tsx:282-284`, `feed-de-atividade.tsx:218-219`. **Aplica-se a:** `alteracao-de-descricao.tsx`, qualquer renderizador novo de Atividade.

### Esquemas de `apps/api`
**Fonte:** `apps/api/src/rotas/esquemas/tarefas.ts` (`UPDATE_TASK_INPUT` `:24-34`, `convertChecklistItem` `:59`; objetos `.strict()`, `satisfies EsquemasCompletos`). **Teste:** `esquemas-de-argumentos.test.ts:15-33` (casos (a)(b)(c) de `updateTask`) para o caso novo de `descriptionMentions` e de `convertChecklistItem` com 3 argumentos.

## Sem análogo

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `features/estrutura/descricao-da-tarefa.tsx` (destaque do `@Nome`) | componente | transform | Não existe divisão de texto em `<span>` por nome de Membro; o mais próximo é o `Rico` de `timeline.tsx` (só negrito/itálico, nunca HTML). Usar a RESEARCH.md (Don't Hand-Roll); nunca `dangerouslySetInnerHTML` |
| Prova de "o cartão do Quadro não converte" (D-03) | teste | leitura de fonte | Usar o molde de `sem-codigo-de-regra.test.ts` (lê `.tsx` do disco); `cartao-de-tarefa.tsx` só importa `checklistProgress` (`:17`) |
| Teste de `tarefa-completa.tsx` inteira | teste | — | Nenhum teste a renderiza hoje; testar os componentes extraídos (`conversao-de-item.tsx`, `descricao-da-tarefa.tsx`) |

## Metadados

**Escopo de busca:** `packages/dominio/src` (derive, operations, testes), `apps/web/src/features/{estrutura,tarefa}`, `apps/api/src/rotas/esquemas` (via RESEARCH.md).
**Arquivos lidos nesta passagem:** `derive.ts` (trechos), `remover-checklist-e-item.test.ts`, `timeline.test.tsx` (trechos), `timeline.tsx` (trecho), `feed-de-atividade.tsx` (trecho), `task-editors.tsx` (trecho), `collaboration-editors.tsx` (trecho), `tasks.ts` (trechos), `bulk-status-bar.test.tsx` e `derive-resumo.test.ts` (cabeçalhos).
**Data:** 2026-10-29
