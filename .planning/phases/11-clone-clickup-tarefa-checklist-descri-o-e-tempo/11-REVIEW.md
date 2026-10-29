---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
reviewed: 2026-10-29T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - apps/api/src/rotas/esquemas-de-argumentos.test.ts
  - apps/api/src/rotas/esquemas/tarefas.ts
  - apps/api/src/rotas/operacoes.test.ts
  - apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx
  - apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx
  - apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx
  - apps/web/src/app/(shell)/notificacoes/page.tsx
  - apps/web/src/design/components.tsx
  - apps/web/src/features/estrutura/collaboration-editors.tsx
  - apps/web/src/features/estrutura/conversao-de-item.test.tsx
  - apps/web/src/features/estrutura/conversao-de-item.tsx
  - apps/web/src/features/estrutura/descricao-da-tarefa.test.tsx
  - apps/web/src/features/estrutura/descricao-da-tarefa.tsx
  - apps/web/src/features/estrutura/mencoes.test.tsx
  - apps/web/src/features/estrutura/mencoes.ts
  - apps/web/src/features/estrutura/tarefa-completa.tsx
  - apps/web/src/features/estrutura/task-editors.tsx
  - apps/web/src/features/estrutura/tempo-da-tarefa.test.tsx
  - apps/web/src/features/estrutura/tempo.test.ts
  - apps/web/src/features/estrutura/tempo.ts
  - apps/web/src/features/tarefa/alteracao-de-descricao.test.tsx
  - apps/web/src/features/tarefa/alteracao-de-descricao.tsx
  - apps/web/src/features/tarefa/feed-de-atividade.test.tsx
  - apps/web/src/features/tarefa/feed-de-atividade.tsx
  - apps/web/src/features/tarefa/timeline.test.tsx
  - apps/web/src/features/tarefa/timeline.tsx
  - ontologia/DECISOES-E-PENDENCIAS.md
  - packages/dominio/CONTEXT.md
  - packages/dominio/src/derive-visibilidade.test.ts
  - packages/dominio/src/derive.ts
  - packages/dominio/src/descricao-da-tarefa.ts
  - packages/dominio/src/operations/automations-motor.test.ts
  - packages/dominio/src/operations/collaboration.ts
  - packages/dominio/src/operations/conversao-de-item.test.ts
  - packages/dominio/src/operations/descricao-da-tarefa.test.ts
  - packages/dominio/src/operations/mencao-na-descricao.test.ts
  - packages/dominio/src/operations/operations.test.ts
  - packages/dominio/src/operations/pessoa-da-conta.test.ts
  - packages/dominio/src/operations/planning.ts
  - packages/dominio/src/operations/remover-checklist-e-item.test.ts
  - packages/dominio/src/operations/tasks.ts
  - packages/dominio/src/tarefa-publica.ts
  - packages/dominio/src/tempo-registrado.test.ts
  - packages/dominio/src/types/structure.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-29
**Depth:** standard (changed hunks since `2d1ee38`; untouched code in `derive.ts`, `tasks.ts` and `tarefa-completa.tsx` was not reviewed)
**Files Reviewed:** 44
**Status:** issues_found

## Summary

The domain layer holds up. `updateTask` refilters `descriptionMentions` on every write, `membrosMencionadosNaDescricao` is the single read path, and the layering rule is respected (`descricao-da-tarefa.ts` imports only types). The D-14 visibility test shows the "Descrição alterada" records, including `before`/`after`, are cut by `visibilidadePara`. The API schema is `.strict()` and member-only. The removal of `parentItemId` leaves no reader or writer behind (a repository-wide grep finds none). It was also read-only before the phase: nothing wrote it except the recurrence copy, so no persisted subitems are orphaned.

No security vulnerability and no data-loss path found. The four warnings are correctness and robustness defects:
- one ordering assumption in the notification query that the codebase itself documents as unreliable;
- stale state in the toast link;
- two gaps in `DialogoDeConversao` (double-submit, silent vanish on a stale URL).

The two questions the caller asked are answered at the end of this report.

## Warnings

### WR-01: `pendingMentions` takes the "most recent edit" from array position, which `newestFirst` documents as unreliable

**File:** `packages/dominio/src/derive.ts:1412-1413`
**Issue:** The `at` of a description notification comes from `state.activity.find(...)`, with the comment "vem do mais novo para o mais velho: o primeiro Registro é o mais recente". The same file documents the opposite for `newestFirst` (derive.ts:1196-1201): "A posição no array não serve: o seed empilha com `push` e `recordActivity` insere com `unshift`, então o mesmo índice significa o oposto nos dois."

- `recordActivity` uses `unshift`, so a live session happens to work.
- Hydrated state comes back ordered by the persisted `ordem` (`aplicarDiferenca` / `hidratar`), and nothing in the reviewed code ties that to newest-first.
- Any `push`-seeded or imported "Descrição alterada" record makes `.find` return the oldest edit.

Result: the "Menções a você" ordering silently depends on an invariant that the file's own docs deny. The test (`mencao-na-descricao.test.ts`) only exercises the `unshift` path.
**Fix:** Pick the latest by value, not by position:
```ts
const alteracao = newestFirst(
  state.activity.filter((a) => a.objectId === task.id && a.action === ACAO_DESCRICAO_ALTERADA),
)[0];
```
Hoist an index of the latest edit per task out of the per-task loop if the cost matters.

### WR-02: `linkDoAviso` outlives the notice it belongs to, so a later notice can show "Abrir" pointing at the wrong Tarefa

**File:** `apps/web/src/features/estrutura/tarefa-completa.tsx:205, 374-382, 775-781, 849-863`
**Issue:** The "Abrir" link is a separate state from `notice`. It is cleared only by the Toast's `onDismiss`. Every other writer of the notice (`report` at 374-382, 443, 455, 627, 1911) and the error path of the conversion (`onErro`: `setNotice(null)`) leaves `linkDoAviso` untouched.

- Convert an Item: `notice` = "Item convertido… Abrir" and `linkDoAviso` = the Subtarefa id.
- If an error then replaces the notice (`setNotice(null)` unmounts the Toast without calling `onDismiss`), the link stays set.
- Any later `report(...)` ("Comentário enviado.", "Item concluído.") then renders "Abrir" pointing at that old Subtarefa.

The same defect existed for the next recurrence (`proximaOcorrencia`). Phase 11 widened it to every conversion and gave the state a second purpose.
**Fix:** Make the link part of the notice so they cannot diverge:
```ts
const [aviso, setAviso] = useState<{ texto: string; abrir?: string } | null>(null);
// report():          setAviso({ texto: message })
// conversão/recorr.: setAviso({ texto, abrir: id })
// erro:              setAviso(null)
```
Or call `setLinkDoAviso(null)` in `report` and in every `setNotice(null)` branch.

### WR-03: `DialogoDeConversao` has no double-submit guard; a double click ends in an error banner after a successful conversion

**File:** `apps/web/src/features/estrutura/conversao-de-item.tsx:70-83, 85-93`
**Issue:** `converter` runs `runConfirmado` (local op, server send), then `onFechar()`, which is an async `router.replace`. Until the URL changes, the dialog is still mounted and the Converter button is live. The store only mutates `data` when the server diff comes back (`rodarNaCopia` works on a clone), so a second click still sees the Item as unconverted and passes the local check.

- It sends a second `convertChecklistItem`.
- The server refuses ("Este Item já foi convertido.") or answers `conflito` plus `rehidratar`.
- `onErro` then runs `setNotice(null)` and `setError(...)`.

The user sees the success notice replaced by an error for an operation that worked. No duplicate Subtarefa is created (the server enforces `item.converted`), but the message misleads. `ConfirmDialog` already offers `confirmCarregando` plus `confirmDisabledReason` for this ("engole o clique"), and it is not used here.
**Fix:** Hold a `useRef`/`useState` "enviando" flag in `DialogoDeConversao`. Return early from `converter` if it is set, and pass `confirmCarregando` and `confirmDisabledReason="Convertendo…"` to `ConfirmDialog`.

### WR-04: Item converted elsewhere makes the dialog vanish silently and leaves `?converter-item=` in the URL

**File:** `apps/web/src/features/estrutura/conversao-de-item.tsx:68`; `apps/web/src/features/estrutura/tarefa-completa.tsx:213-219, 767-781`
**Issue:** `if (!item || item.converted !== undefined) return null;` handles "already converted" by rendering nothing. The parent keeps rendering `<DialogoDeConversao>` for as long as `converting` (the query param) is non-null. Consequences:

- If a rehydration (revision polling, or the rehydrate after a conflict) lands while the dialog is open, the confirm dialog disappears with no message. The user's click is lost without explanation.
- The `?converter-item=<checklist>:<item>` param stays in the address bar. It is never cleaned, and it is shareable and bookmarkable. Opening that URL later shows nothing, with no feedback.
- The case "Item stale on screen but already converted on the server" is handled correctly (the server refusal reaches `onErro`), but the dialog case is not.

No test covers an already-converted Item; `conversao-de-item.test.tsx:166` covers only "Item doesn't exist".
**Fix:** In `DialogoDeConversao`, when `!item || item.converted`, call `onFechar()` from an effect (and, for the converted case, `onErro("Este Item já foi convertido.")`), then return `null`. Add a test for the converted Item case.

## Info

### IN-01: Trash button loses its right alignment when "Converter em Subtarefa" is hidden

**File:** `apps/web/src/features/estrutura/tarefa-completa.tsx:1727-1745`; `apps/web/src/features/estrutura/conversao-de-item.tsx:41-46`
**Issue:** The `ml-auto` that pushes the row's actions to the right was on the Converter button. The trash button in the non-converted branch has no `ml-auto` (only the converted branch does). Now that `BotaoDeConversao` returns `null` in Listas without Subtarefas, on the last level and for non-writers, the remove icon sits right after the Item text instead of at the right edge, inconsistent with rows where Converter shows.
**Fix:** Add `ml-auto` to the trash button class in that branch. The Converter button then needs a `ml-2` or none, so only one element carries the auto margin.

### IN-02: Escape/Enter in the description editor: the discarded `aoTeclar` return is safe, but fragile and inconsistent with `CommentComposer`

**File:** `apps/web/src/features/estrutura/task-editors.tsx:100-102` (vs. 622-623); `apps/web/src/features/estrutura/mencoes.ts:97-123`
**Issue:** Checked in code, not a defect today (see Answers). The editor calls `mencoes.aoTeclar(event)` and ignores the boolean, while `CommentComposer` does `if (...) return`. It is correct only because the description textarea has no other key handling. Add a Ctrl+Enter-to-save or any other shortcut later and the missing `return` becomes a live bug (Enter/Esc would act on both the menu and the shortcut).
**Fix:** `if (mencoes.aoTeclar(event)) return;` for symmetry, or a one-line comment saying the return is deliberately ignored.

### IN-03: Mention matching is looser than the UI that creates it (prefix names, no leading boundary, renamed members)

**File:** `packages/dominio/src/descricao-da-tarefa.ts:282-307`; `apps/web/src/features/estrutura/mencoes.ts:128-130`
**Issue:** Three edge cases of `mencionaNoTexto`, all of which fail quietly:

- **Prefix names.** `mencaoEmPosicao` checks a boundary only after the name. Choose "Ana" from the menu, then keep typing " Lima": `@Ana Lima` still matches "Ana" (the boundary is a space), so Ana is notified for a mention meant for Ana Lima. The highlight (`segmentosComMencoes`, longest name first) is right, but the notification list is not.
- **No leading boundary.** `joao@Ana` counts as a mention. The UI requires whitespace before `@` (`arrobaEmCurso`).
- **Rename.** If a Membro's `displayName` changes, the stored `@OldName` no longer matches. `membrosMencionadosNaDescricao` drops the mention on read, and the next `updateTask` drops it for good from `descriptionMentions`.

D-09 makes the text the source of truth, so this is by design, but it is undocumented in the glossary and untested.
**Fix:** Optionally require a non-word character before `@` in `mencaoEmPosicao`. Note the rename caveat in the `descricao-da-tarefa.ts` header.

### IN-04: A stale client sending the old 4-argument `convertChecklistItem` gets a 400

**File:** `apps/api/src/rotas/esquemas/tarefas.ts:61`
**Issue:** The tuple went from `[ID, ID, ID, opcional(ID)]` to `[ID, ID, ID]`. `JSON.stringify` turns a trailing `undefined` into `null`, so a web bundle loaded before the deploy that still passes `parentTaskId` gets a schema 400 instead of a graceful error. Low impact (the old UI never had a way to choose another parent; the extra argument was always `undefined`), and `(i2)` documents the new contract.
**Fix:** Accept and ignore a trailing `null`/`undefined` for one release (`opcional(z.null())`), or just note it in the deploy checklist.

## Answers to the two open questions

**1. `task-editors.tsx` description `onKeyDown` discarding `mencoes.aoTeclar`'s return: no unintended behavior.**

- **Escape** with the menu open: `aoTeclar` calls `preventDefault()` and `stopPropagation()` on the React event, which calls native `stopPropagation()` at the React root. The only Escape-closes-the-panel listener (`useModal` in `design/components.tsx:1597-1604`) is on `document` in the bubble phase, so it never sees the key. The menu closes; the panel and unsaved text stay. A second Escape (menu closed, `sugestoes` empty) closes the panel, as expected. This is the same path `CommentComposer` already relies on.
- **Enter/Tab** with the menu open: `preventDefault()` plus `mencionar(...)`. There is no save-on-Enter in the description editor (saving is the "Salvar" button), so nothing else can fire. Ctrl/Cmd+Enter is deliberately not captured by `aoTeclar` and has no handler in the editor.
- **Arrow keys:** `preventDefault()` plus a change of the active option.

The discarded return is therefore an inconsistency, not a bug (IN-02).

**2. `DialogoDeConversao` when the Item was already converted elsewhere:** two different outcomes.

- **Local copy stale, server already converted** (the usual two-tab case): the dialog is shown, the user confirms, and the local op passes. The send then fails on the server ("Este Item já foi convertido."); the store rehydrates on conflict and `onErro` surfaces the message. This is correct.
- **Local copy refreshed while the dialog is open, or the URL opened later:** `if (!item || item.converted !== undefined) return null;` hides the dialog with no message and leaves `?converter-item=` in the URL (WR-04).

On top of that, a fast double click can produce a success followed by that same error banner (WR-03).

---

_Reviewed: 2026-10-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
