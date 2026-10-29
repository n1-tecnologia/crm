---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
reviewed: 2026-10-29T00:00:00Z
depth: deep
scope: "git diff --name-only f1025a1..HEAD -- packages apps (HEAD 0292960), early review: 'Rodar agenda' button removal and migration 010 not yet landed"
findings:
  blocker: 0
  high: 0
  medium: 8
  low: 3
  total: 11
status: issues_found
---

# Phase 10: Code Review Report (early)

**Method.** Source read in the priority order requested. Every finding marked "reproduzido" was confirmed with a throwaway `vite-node` script kept in the session scratchpad (outside the repo), run against `buildSeed()` in memory. No `.env` was read, no database was touched, no Docker container was started (so there is nothing to remove), no source file was modified, nothing was staged or committed.

## Scheduler verdict

**Nothing found that should block leaving the scheduler on in production for `ws_n1`.** Specifically, I looked for and did NOT find:

- **Wrong Tasks deleted permanently.** The purge set is exactly `lifecycle === "naLixeira"` AND `trashedAt` parseable AND `trashedAt + retentionDays*86400000 <= local-midnight of the civil day` AND `listId === the Lista being visited` (`tasks.ts:815-822`). A missing/invalid `trashedAt` or a missing `retentionDays` yields `undefined`/`NaN` and is skipped (fail-safe). `retentionDays` is fixed at 30 everywhere (no setter exists). Catch-up days are processed oldest first with an older "today", so they can only purge less, never more. Reproduced: a trashed parent plus its active Subtarefa are eliminated together (2 eliminated), an active Task in the same Lista is untouched.
- **Running outside the configured workspace.** With `AUTOMACOES_ESPACO_ID=ws_n1`, all five SQL statements that discover or claim work (`catalogoDeListasComAgenda`, `candidatosDaLixeira`, `recuperarTravadas`, `reivindicar`, and the recurrence source) carry the `workspace_id` filter, and `executar()` is called with the claimed row's own `workspace_id`. See MEDIUM-08 for the one exposure: the filter is opt-in.
- **Wrong actor.** `atorDoRelogio` only returns a Member who is `ativo` and for whom `containerAdminRefusal` is `undefined` (checked for the preferred, the owner, then human admins). The Agente do pipeline is not widened. Activities are signed by a human (owner/admin), which is the assumption 10-16 Q1/D-04 already asks the owner to confirm. A suspended or foreign `AUTOMACOES_ATOR_MEMBER_ID` falls through to the owner.
- **Looping or double-running a day.** One row per (workspace, Lista, day) with `for update skip locked`; lease recovery after 15 min; `maxPorVolta=200` bounds a drain; `emVoo` allows one drain at a time. A crash between commit and `fecharLinha` re-runs the day, and both purge and calendar recurrence are idempotent for the same day.
- **Does not stop on shutdown.** The worker does stop (`parar()` clears the timer and awaits the in-flight line, `drenar` checks `temporizador` between lines). The real problem is that the process itself never exits (MEDIUM-06), which is pre-existing and not caused by the scheduler.

What I would still fix soon, none of it blocking: MEDIUM-01 (the preview number that gated the irreversible purge is not the number the purge produces), MEDIUM-05 (unhandled rejection can take the whole API process down), MEDIUM-07 (a Lista no Member can sign for never runs, which becomes silent once the "Rodar agenda" button is gone), MEDIUM-08 (destructive job defaults to every workspace when one env var is empty).

## Medium

### MEDIUM-01: `automacoes:previa` does not count what the real purge eliminates, and that count gated an irreversible action

**File:** `apps/api/src/automacoes/previa.ts:85` and `packages/dominio/src/operations/tasks.ts:815-822, 841-851`
**Issue:** The preview prints `tarefasDaLixeiraVencidas(...).length` as "o que a primeira volta real eliminaria". The real run is `purgeTask`, which cascades through `descendants()` and deletes Subtarefas "mesmo as que não estavam na lixeira" (`tasks.ts:767-769`). `trashTask` does not cascade to Subtarefas (they stay `ativo` and are only effectively trashed), so the preview misses them. The same function lists a vencida Subtarefa whose mother is also vencida as its own entry, so the preview counts it twice while the purge eliminates it once. The preview is therefore neither a lower nor an upper bound. Reproduced: trashed parent + one active Subtarefa gives `tarefasDaLixeiraVencidas = 1` but `purgeExpiredTasks` eliminates 2. Q3 ("direto", no ensaio) was decided from this number. Additionally the CLI passes `relogioDoSistema.agora()` while the worker passes local midnight of the civil day (`previa.cli.ts`, `scheduler-worker.ts:642`), so a Task expiring during the current day is counted today but purged tomorrow.
**Fix:** Make the preview run the real thing on a throwaway copy, which stays read-only because the hydrated state is already in memory:
```ts
// previa.ts, in linhasDoEspaco
const copia = structuredClone(state);
const r = purgeExpiredTasks(copia, atorId ?? copia.workspace.ownerMemberId, listId, inicioDoDia(hoje));
const lixeiraVencida = r.ok ? r.value.eliminadas : 0;
```
and pass the same civil-midnight `hoje` the worker uses. Re-run the preview before any new Space is added to the trash candidates.

### MEDIUM-02: `moveContainer` / `recusaDeMover` act on, and report about, descendants the actor cannot reach

**File:** `packages/dominio/src/operations/structure.ts:759-766, 802-816, 1016-1046` (web: `mover-conteiner-dialog.tsx:218-232`, `arrastar-na-arvore.ts:187-192`)
**Issue:** `nosDaSubarvore`, `mudancasDeConfiguracao` and the mapping/aplicação loop iterate every descendant of the moved Pasta regardless of `memberReachesContainer`. Private containers cut access even for Administrador/Proprietário without a grant (`derive.ts:1196-1206`), so an Administrador who administers a Pasta but is not invited to a private Subpasta inside it can:
1. **Learn private names.** Reproduced: Rafael (Administrador) moves a Pasta that contains a private Subpasta "Diretoria" defining a Campo "Salario do CEO"; the destination Space has a Campo with the same name. The refusal is `Já existe um Campo chamado “Salario do CEO” no caminho de destino…`. The same happens for Tipo de Tarefa names (`:813-815`). The comment at `:785-789` says the cited names are only ones the actor can see; that does not hold for descendants. T-10-05/T-10-08 are not met for this path.
2. **Modify data he cannot see.** The Status remapping, Valor de Campo archiving, Tipo fallback and public link revocation run on Tasks of the private Lista (`:1039-1046`), with Atividades signed by him.
3. **Hit a dead end in the UI.** `statusSemMapeamento` (`:1020-1023`) requires a mapping for Status used by Tasks in hidden Listas. The web dialog and drag handler compute `statusEmUso` from the member-sliced state, so the user cannot map those Status and the server answers `Mapeie o status “X” para continuar.` forever.
**Fix:** Decide the rule explicitly. Simplest and safest: in `recusarMover`, refuse the move when any non-trashed descendant is unreachable by the actor, with a count-only sentence ("N contêineres abaixo que você não alcança impedem mover") and no names, mirroring the `setContainerBlock` wording. If instead the move should proceed, keep the hidden Listas out of the name-bearing refusals (use the anonymised sentence already used for Formulários at `:840`) and require the mapping to be satisfiable from what the actor sees.

### MEDIUM-03: `reorderContainers` returns the whole sibling sequence, leaking ids of private containers

**File:** `packages/dominio/src/operations/structure.ts:1127-1151`, `packages/dominio/src/derive-visibilidade.ts:313-316`, `apps/api/src/rotas/operacoes.ts` (response `value`)
**Issue:** `ok(sequencia)` returns `nova.map((c) => c.id)`, which includes the hidden siblings. The route cuts `value` through `recortarValor`, but that function only filters object nodes with an `id`; an array of strings passes through untouched. Reproduced: Rafael reorders two visible Pastas in a Space that also has a private Pasta; `recortarValor(r.value, state, RAFAEL, ocultos)` still returns the private Pasta's id (`fld_0000dy`). `filtrarOrdens` removes hidden ids from the `ordens` payload precisely because "um id também é informação", and ids here are sequential, which makes them enumerable (see MEDIUM-04).
**Fix:** Return only what the actor may know, e.g. `ok(sequencia.filter((id) => memberReachesContainer(state, actingMemberId, tipo, id)))`, or return `ok(undefined)`/the count and let the diff carry the new `order`.

### MEDIUM-04: `setContainerBlock` and `setContainerDefaultViews` reveal that a private container exists

**File:** `packages/dominio/src/operations/configuration.ts:914-922` (`setContainerDefaultViews`) and `:984-991` (`setContainerBlock`)
**Issue:** Both call `findContainer` and then `mayConfigure`, instead of the `requireContainer` that every `structure.ts` operation uses. Reproduced with a private Space the caller does not reach: Administrador gets `Você não alcança este contêiner: ele é privado e nada foi concedido a você.`; Membro comum gets `Configurar a Estrutura exige administrar…`; a nonexistent id gets `Espaço não encontrado(a).` The three answers distinguish "exists and private" from "does not exist". Ids generated after the seed are sequential (`spc_0000e5`-style), so a Membro can enumerate private containers by id. RN-ESP-15 says the container does not exist for someone who cannot reach it. No name leaks, so this is existence only.
**Fix:** Use the same gate as `structure.ts` before any permission message:
```ts
if (!container || !memberReachesContainer(state, actingMemberId, containerType, containerId)) {
  return fail(`${CONTAINER_LABEL[containerType]} não encontrado(a).`);
}
```
and add the refusal case to `conteineres-quem-pode.test.ts`.

### MEDIUM-05: A rejection inside the scheduler drain is unhandled and can crash the API process

**File:** `apps/api/src/automacoes/scheduler-worker.ts:763` (and `:515`, `:632-636`, `:725-728`)
**Issue:** `void drenar().finally(...)` creates a promise chain with no `catch`. `recuperarTravadas()`, `semear()` and `reivindicar()` run outside the `try` in `processarUm`, and the `catch` itself calls `fecharLinha`, which can throw too. A database blip makes `drenar()` reject. Nothing in `apps/api/src` handles `unhandledRejection`; without a Sentry-installed handler Node's default is to terminate, which takes down the HTTP API with the worker. Phase 10 widened the exposure by making one tick run up to 200 `processarUm` calls. Also, `semear()` sets `ultimaSemeaduraEm` before the catalogue query succeeds (`:515`), so a failed seeding is not retried until the next civil day.
**Fix:**
```ts
void drenar()
  .catch((erro) => registrar("warn", "Volta do relógio falhou.", { causa: sanitizarErro(erro, CODIGOS_DA_AGENDA.ERRO_INESPERADO).summary }))
  .finally(() => { emVoo = undefined; terminou(); });
```
and move `ultimaSemeaduraEm = ...` to after the last insert of `semear()`.

### MEDIUM-06: SIGTERM stops the workers but the process never exits (pre-existing, not introduced by Phase 10)

**File:** `apps/api/src/index.ts:109-117, 228`
**Issue:** `aoEncerrar` installs `process.on("SIGTERM", () => void parar())`. A SIGTERM listener removes Node's default exit, and nothing calls `app.close()`, `encerrar()` or `process.exit()` on that path (they exist only in the hot-reload teardown at `:233-241`). After a deploy signal the scheduler stops, the server keeps serving, and the orchestrator waits out its grace period and sends SIGKILL, possibly in the middle of an `executar()` transaction (Postgres rolls back; the agenda row stays `processando` until the 15-minute lease recovers it, so a day is delayed, not lost).
**Fix:** In the SIGTERM path, await `Promise.all(paradas.map(p => p()))`, then `await app.close()`, `await encerrar()` and `process.exit(0)`, with a hard timeout.

### MEDIUM-07: A Lista nobody can sign for is skipped silently, and the removal of the "Rodar agenda" button makes that permanent

**File:** `apps/api/src/automacoes/scheduler-worker.ts:684-688, 705-708, 588`; `packages/dominio/src/operations/agenda-do-relogio.ts:72-83`
**Issue:** `memberReachesContainer` has no owner exception, so for a Lista inside a private Space/Pasta the owner and base admins are not candidates unless they hold a grant (reproduced: with the creator's `administrar` grant removed, `atorDoRelogio` returns `undefined`). The row closes `falhou/SEM_ATOR`, the Lista never gets its calendar recurrences generated or its trash purged, and the only trace is a `warn` log and a `falhou` row. Retry is also blunt: a `falhou` row with `tentativas < 3` is re-claimed immediately inside the same drain, so a deterministic refusal burns three attempts back to back, and a transient `CONFLITO_DE_REVISAO` (also 3 immediate tries) kills the day for good because `tentativas` is never reset. Until now a Membro could press "Rodar agenda" as a workaround; the pending removal turns the gap into silent data loss for recurring work in private containers.
**Fix:** Before removing the button, make the 10-16 checkpoint treat `SEM_ATOR > 0` in `automacoes:previa --agenda` as a blocker, list "sem ator" Listas from the preview with the container's privacy, and add a small backoff (skip rows whose `locked_at`/`concluido_em` is within the last `intervaloMs`) so retries are spread across ticks.

### MEDIUM-08: The destructive scheduler defaults to every workspace when `AUTOMACOES_ESPACO_ID` is empty

**File:** `apps/api/src/index.ts:210`, `apps/api/src/automacoes/scheduler-worker.ts:355-402, 517`
**Issue:** `...(process.env.AUTOMACOES_ESPACO_ID ? { workspaceId } : {})`. If the variable is lost on a redeploy or is blank in a new environment, the worker covers every workspace in the database, including the ~14 test Spaces mentioned in T-10-42. With the third catalogue source, any Lista holding a Task in trash enters the clock, and Q3 = "direto" means there is no ensaio for it: the first lap permanently eliminates what is past retention. The `.env.example` warns about `AUTOMACOES_LISTA_ID` but not about this.
**Fix:** Fail closed for the purge, e.g. refuse to start when `AUTOMACOES_WORKER_ATIVO=true` and `AUTOMACOES_ESPACO_ID` is empty unless an explicit `AUTOMACOES_TODOS_OS_ESPACOS=true` is set; at minimum log the covered scope at startup (`app.log.info({ espaco: ... })`).

## Low

### LOW-01: Trashing a container leads to its Tasks being purged while the container stays in the trash forever

**File:** `packages/dominio/src/operations/structure.ts:1208-1240` with `packages/dominio/src/operations/tasks.ts:830-856`
**Issue:** `trashContainer` stamps every descendant Task with the container's `trashedAt`. Thirty days later the clock eliminates all those Tasks, but no operation ever purges the container, and `restoreList`/`restoreContainer` "devolve o que foi com ele". Reproduced: a trashed Lista with two Tasks, after the purge, still exists with 0 Tasks. The UI text ("guarda por 30 dias") is honoured, but the restored container comes back empty and the empty trashed shell never leaves the trash.
**Fix:** Either purge the empty container together (new rule, needs owner OK), or skip Tasks whose `trashedAt` equals an ancestor container's `trashedAt` and show the container's own eliminação date in the trash page.

### LOW-02: Calendar-day arithmetic adds 86 400 000 ms to a local midnight

**File:** `apps/api/src/automacoes/scheduler-worker.ts:55, 88-92`
**Issue:** On a server whose TZ observes DST, `local midnight + 24 h` can land on 23:00 of the same date or 01:00 of the next, which duplicates or skips a civil day in `todosOsDiasCiveisPendentes`. Pre-existing from Phase 3; the server TZ is not pinned anywhere I could see, and the purge instant is also derived from it.
**Fix:** Step with `new Date(y, m, d + 1)` instead of adding milliseconds, and pin `TZ` in the deployment.

### LOW-03: Tree reorder has no remedy for the hidden-siblings write set (declared A3/A4, noted only for the fixed folders)

**File:** `packages/dominio/src/operations/structure.ts:1068-1085`
**Issue:** Per the declared A4 any non-Convidado Membro who reaches a Space can reorder its Pastas and Listas, including the fixed "Meus negócios" Pasta (reproduced for `mem_julia`, base Membro). Listed only so the owner's pending A4 confirmation (10-17) is made with that concrete consequence in view. Not counted as a defect.
**Fix:** If the owner answers "administrar", replace `mayBuild(pai)` with `containerAdminRefusal(state, actingMemberId, pai.type, pai.id)` in `recusaDeReordenar`.

## Checked, no finding

- `moveContainer` authority and structure rules: suspended Member, Convidado, destination unreachable (no name leaked), destination archived/trashed, cycle, depth, fixed structures, "Meus negócios" subtree, name collision (cites only the moved item's own name and the destination).
- Status mapping, B37 field archiving (never deletes), Task Type fallback and public link revocation (`active=false`; the public endpoint reads `active`, `scale.ts:632`) behave as described and are shared with `moveTask`.
- Weekly capacity and Carga removal: operation, schema and registry entries gone together; stale `kind: "carga"` views are tolerated by `abaDaView` until 010; extra `weeklyCapacityMinutes` in old JSON is ignored.
- Route layer: `POST /operacoes/:nome` returns 403 for a suspended Member before touching anything; the four new operations have strict zod schemas; the `blocks` schema rejects `"list"`.
- Web: drag handlers sit on a flat row (no bubbling from nested lists), zone logic is pure and consistent with the domain refusals, drag is disabled for Convidado and non-administrators, `gravando` is released on every path because the store's `enviar` never rejects, keyboard alternative ("Mover para…", Subir/Descer) exists, hooks are not called conditionally, `?aba=` is whitelisted.

## Not reported on purpose (declared in plans/summaries)

A3 slot-reoccupation reorder, A4 `mayBuild` as "editar no pai", A8 Responsáveis who lose `ver`, Q1 human authorship of the clock's Atividades, the count-only phrase for unreachable Listas in `setContainerBlock` (B38a), the RESEARCH §5(f) gap on Status ids stored outside Tasks.

---

_Reviewed: 2026-10-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
