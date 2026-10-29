---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
fixed_at: 2026-10-29T00:00:00Z
review_path: .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-10-29
**Source review:** .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01..WR-04; IN-01..IN-04 out of scope by instruction)
- Fixed: 4
- Skipped: 0

Edits and commits ran in the main checkout on branch `fase-11` (no worktree), because the caller asked for explicit-path commits there and a hand-rolled worktree has no `node_modules` to run the verification. Every commit lists its paths explicitly; the user's unrelated uncommitted work was not touched.

Verification ran in the main checkout, without a database:
- `packages/dominio`: `npx vitest run src/operations/mencao-na-descricao.test.ts` (16 passed) and `npx tsc --noEmit` (clean).
- `apps/web`: `npx vitest run src/features/estrutura/conversao-de-item.test.tsx` (12 passed), `npx tsc --noEmit` (clean), `npx eslint` on the three touched files (clean).

## Fixed Issues

### WR-01: `pendingMentions` takes the "most recent edit" from array position

**Files modified:** `packages/dominio/src/derive.ts`, `packages/dominio/src/operations/mencao-na-descricao.test.ts`
**Commit:** db243dc
**Applied fix:** `state.activity.find(...)` became `newestFirst(state.activity.filter(...))[0]`, as the review suggested. The now-wrong comment about array order was replaced. New test: two "Descrição alterada" records get distinct instants, and a mention Comment sits between them. The expected order (`descricao`, then `comentario`) is asserted, then asserted again after reversing `state.activity`. With the old `find`, the reversed order picked the oldest edit and flipped the result. The index of the latest edit per task was not hoisted out of the loop (the review marked it optional).

Logic change (ordering): fixed: requires human verification.

### WR-02: `linkDoAviso` outlives the notice it belongs to

**Files modified:** `apps/web/src/features/estrutura/tarefa-completa.tsx`
**Commit:** c09d5ac
**Applied fix:** The two states (`notice`, `linkDoAviso`) were replaced by one `aviso: { texto, abrir? } | null`. `setNotice(texto)` was kept as a thin wrapper that stores `{ texto }` (or null) and so drops any link, which leaves the other `setNotice` call sites unchanged. Only the two writers that carry a link (`changeStatus` with a next occurrence, `onConvertida`) call `setAviso({ texto, abrir })`. The Toast reads `aviso.texto` and `aviso.abrir`, and its `onDismiss` is `setAviso(null)`. The file went from 2,304 to 2,298 lines. No regression test: no test mounts `TarefaCompleta`, and building that harness was not cheap. The fix is structural (the link can no longer outlive its notice) and type-checked.

### WR-03: `DialogoDeConversao` has no double-submit guard

**Files modified:** `apps/web/src/features/estrutura/conversao-de-item.tsx`, `apps/web/src/features/estrutura/conversao-de-item.test.tsx`
**Commit:** 2a82b6c (shared with WR-04, because both live in the same component)
**Applied fix:** A synchronous `useRef` flag (`enviou`) makes `converter` return early on a second call, and a `useState` (`enviando`) passes `confirmCarregando` and `confirmDisabledReason="Convertendo…"` to `ConfirmDialog`. If the local operation refuses, the flag is reset (that path closes the dialog anyway). New test: two consecutive clicks send exactly one `gravar` call, with no `onErro`, and the button ends `aria-disabled`. Checked that the test fails (2 calls instead of 1) when the guard and the loading props are all removed.

### WR-04: Item converted elsewhere makes the dialog vanish silently

**Files modified:** `apps/web/src/features/estrutura/conversao-de-item.tsx`, `apps/web/src/features/estrutura/conversao-de-item.test.tsx`
**Commit:** 2a82b6c
**Applied fix:** A `useEffect` runs once when the Item is missing or already converted. It calls `onFechar()` (which removes `?converter-item=`) and, for the converted case only, `onErro("Este Item já foi convertido.")`; the component still renders `null`.

Adaptation to the suggestion: the effect is skipped when this dialog is the one that submitted (`enviou.current`). Without that, a successful conversion, once the server diff marks the Item `converted`, would make the still-mounted dialog report "já foi convertido" right after the success. A second ref (`avisou`) makes the effect fire once, so changing callback identities cannot re-trigger it. Tests: the Item-missing test now also asserts `onFechar` is called once and `onErro` is not; a new test marks the Item converted and asserts no dialog, the `onErro` message, and one `onFechar`.

## Skipped Issues

None.

---

_Fixed: 2026-10-29_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
