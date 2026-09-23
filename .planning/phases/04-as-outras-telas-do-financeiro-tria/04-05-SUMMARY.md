---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 05
subsystem: api
tags: [fastify, financeiro, auth, alcance-derivado, http-proxy]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "criarClienteDeLeituras/ClienteDeLeituras/RespostaDeLeitura (04-02) — o cliente HTTP que este plano injeta e chama"
provides:
  - "rotasDeFinanceiro/OpcoesDeFinanceiro/EMPRESAS_PERMITIDAS — as sete leituras GET /financeiro/* na borda do apps/api"
  - "OpcoesDoApp.financeiro — ponto de injeção do cliente falso para teste, sem rede"
affects: ["as 8 telas de apps/web (D4-08) — cada page.tsx chamará um destes GET", "04-10 (as ações de escrita do Financeiro), que herda o mesmo módulo e a nota de que métodos ficam POST"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rota não-operação filha da raiz de app.ts (herda JWT de Membro), nunca do plugin de rotas de serviço — mesmo molde de rotas/estado.ts"
    - "Autorização por alcance derivado (memberReachesContainer + CP.folderId) antes de qualquer chamada de rede — nenhuma Concessão nova"
    - "Validação de query com zod .strict() ANTES de hidratar o Espaço — 400 sem custo de conexão nenhuma"
    - "Erro de fronteira traduzido em duas frases fixas (503/502); code/summary só no log, nunca no corpo"

key-files:
  created:
    - apps/api/src/rotas/financeiro.ts
    - apps/api/src/rotas/financeiro.test.ts
  modified:
    - apps/api/src/app.ts

key-decisions:
  - "Validação de query movida para ANTES de comAlcance (antes de tocar o pool/hidratar), não apenas antes do cliente HTTP: é o único jeito de os casos (b)/(c) do teste responderem 400 sem DATABASE_URL, no bloco 'sem banco'."
  - "Membro autorizado do teste é mem_maryane (CP.financeiroId, já tem Concessão em 'Gestão'); membro sem alcance é mem_rafael — em buildSeed() sem fixtures, nenhum outro Membro tem Concessão nesse Espaço privado, então qualquer um serviria, mas mem_rafael evita colisão com os ids usados pelo processo (aprovador, presidência)."

requirements-completed: [TELA-01]

# Metrics
duration: ~55min
completed: 2026-09-23
---

# Phase 4 Plan 05: As sete leituras do Financeiro na borda do apps/api Summary

**Sete rotas `GET /financeiro/*` na raiz de `app.ts`, guardadas por `memberReachesContainer(state, membro.id, "folder", CP.folderId)` e proxy ao cliente de 04-02 — D4-14 (autorização), D4-01 (o único caminho) e D4-04 (nunca o `public` do financeiro-tria) viram código.**

## Performance

- **Tasks:** 3/3 completed
- **Files modified:** 3 (2 created, 1 modified)
- **Verification:** scoped only — `npm run typecheck -w @n1/api` (green, 3 runs) and `npx vitest run src/rotas/financeiro.test.ts --testTimeout=20000` (green, ~1.2-1.3s, 4 passed/5 skipped — no `DATABASE_URL` in this worktree). `npm run check`, `npm test`, and unscoped `vitest run` were never invoked, per this run's hard anti-hang constraint. Exit codes captured without piping through `tail` (`${PIPESTATUS[0]}`-safe: redirected to a log file and checked `$?` directly).

## Accomplishments

- `apps/api/src/rotas/financeiro.ts`: `rotasDeFinanceiro`/`OpcoesDeFinanceiro`/`EMPRESAS_PERMITIDAS` — the seven `GET /financeiro/{dashboard,problemas,aprovacoes-pendentes,workflows,notas-fiscais,produtos,plano-contas}` routes, all guarded by `comAlcance` (hydrate → `memberReachesContainer` → 403 or proceed), all validating query with `.strict()` zod schemas *before* touching the pool or the automation client, all translating client failures into two fixed pt-BR messages (503 `CREDENCIAL_AUSENTE`, 502 everything else) with `code`/`summary` going only to `request.log.warn`.
- `apps/api/src/app.ts`: `rotasDeFinanceiro` registered at the root immediately after `rotasDeEstado` (inherits JWT), `OpcoesDoApp.financeiro` injection point added, and a short comment recorded near `opcoesDeCors` that 04-10's write actions will be `POST` (not `PATCH`/`DELETE`) because that's what the existing CORS `methods` allowlist already covers.
- `apps/api/src/rotas/financeiro.test.ts`: 9 test cases in two blocks — 4 in the "sem banco" block (2× 401 without token on two distinct routes, 2× 400 from the allowlist with zero client calls) that run unconditionally, and 5 in a `describe.skip`-gated block (real Postgres, DEC-09) covering 200 passthrough, 403 with zero client calls, 503, 502 with no leaked detail, and exact `?empresa=` forwarding.
- Mutation verification performed manually and documented below (not left as a comment): temporarily removed the root-level `app.register(rotasDeFinanceiro, ...)` line and registered it instead inside the service-credential plugin block (the exact Pitfall-4 mistake), reran the scoped test file, confirmed 2 of 9 tests failed, then reverted `app.ts` byte-for-byte (`diff` against a pre-mutation backup confirmed identity) and reran — 4 passed/5 skipped again.

## Task Commits

Each task was committed atomically:

1. **Task 1: O módulo de rotas, a guarda de alcance e as sete leituras** - `412c599` (feat)
2. **Task 2: Registrar na raiz de `app.ts`** - `e27f57f` (feat)
3. **Task 3: O teste — 401, 403, 200, 503 e o erro que não vaza** - `117dc29` (test)

_No plan-metadata commit for STATE.md/ROADMAP.md — this executor runs in worktree mode; the orchestrator owns those files after merge._

## Files Created/Modified

- `apps/api/src/rotas/financeiro.ts` - the seven routes, 163 lines
- `apps/api/src/rotas/financeiro.test.ts` - 9 tests across two blocks, 186 lines
- `apps/api/src/app.ts` - +7 lines (import, `OpcoesDoApp.financeiro`, the root registration, a one-line CORS-methods note)

## Decisions Made

- **Query validation runs before `comAlcance`, not just before the automation client.** The plan's own acceptance criteria for Task 3 requires cases (b)/(c) — invalid `empresa`/`tipo` — to return 400 in the "sem banco" block, which by definition has no `DATABASE_URL`. If validation happened *inside* `comAlcance` (after `pool().connect()`), those cases would fail to connect and return something other than 400 in an environment without a database. Validating first, before any pool access, makes the 400 path genuinely free of any DB dependency — which is also strictly *more* faithful to T-4-08 ("um valor livre nunca chega ao `automation/`") than validating after hydration would have been.
- **Test membro selection.** `mem_maryane` (`CP.financeiroId`) is the only Member with a Grant on the "Gestão" Space in `buildSeed()`'s default (non-fixture) output — `applyContasAPagar` is called from `seed.ts` without `fixtures: true`, so `gr_cp_aprovador`/`gr_cp_aprovador_konq`/`gr_cp_presidencia` never get pushed. Since "Gestão" is `isPrivate: true` and `memberReachesContainer` denies before checking role base whenever *any* node in the path is private and the caller has no Grant, `mem_rafael` (or any other seeded Member) reliably fails the reach check. Picked `mem_rafael` specifically to avoid any accidental overlap with the process's own fixture-only ids.

## Deviations from Plan

### Clarifications (not bugs — documented for accuracy)

**1. The mutation-testing acceptance criterion's predicted failure mode was imprecise; the underlying guarantee still holds.**
- **Found during:** Task 3, performing the mutation verification the plan's acceptance criteria requires ("mover `app.register(rotasDeFinanceiro)` para dentro do bloco `PREFIXO_ROTAS_DE_SERVICO` faz (a) falhar").
- **What actually happens:** Moving the registration breaks cases **(b)** and **(c)** (400 → 404), not case (a). The reason is Fastify's request lifecycle: the root `onRequest` auth hook (`plugins/autenticacao.ts`) inspects `request.url` and short-circuits with 401 for any unauthenticated request *before* route matching is resolved — so a request to `/financeiro/dashboard` with no token still gets 401 even when no route exists at that exact path anymore (it moved to `/v1/integrations/financeiro/dashboard` under the mutation). Cases (b)/(c) send a *valid* token, so the hook lets the request through to routing, where it now correctly 404s instead of reaching the (moved) handler that would have replied 400 — a clear, real signal of the exact defect Pitfall 4 describes.
- **Why this doesn't weaken the test:** The plan's intent — "the wrong registration location is caught by this test file" — is satisfied; only the specific case number named in the acceptance criteria's prose was wrong, not the substance. Documenting here rather than silently rewriting the plan's prediction.
- **Verification:** Full mutation run captured to `/tmp/vitest-mutation-out.log` before revert: `2 failed | 2 passed | 5 skipped (9)`, both failures showing `expected 404 to be 400`. Post-revert: `diff` against a pre-mutation backup of `app.ts` confirmed byte-identical restoration, then `npx vitest run src/rotas/financeiro.test.ts --testTimeout=20000` returned `4 passed | 5 skipped (9)`, exit code 0.
- **Files modified:** none (the mutation and its revert never left the working tree in a mutated state at any commit boundary — `git status --short` was clean before and after).
- **Committed in:** N/A (verification-only; documented here per the plan's own instruction to record the mutation check in the SUMMARY).

**Total deviations:** 1 (clarification, no code change, no scope creep).
**Impact on plan:** None on delivered behavior. `packages/dominio`, `apps/web`, and the sibling `financeiro-tria` repository were never touched by this plan, matching the plan's own file list and the phase's cross-repo isolation rule.

## Issues Encountered

None blocking. The worktree has no `apps/api/.env` (by design, per `.gitignore`), so `DATABASE_URL` is unset here — the 5 Postgres-backed test cases in `financeiro.test.ts` (d)-(h) skip in this environment and were never executed against a real database in this session. They are structurally identical to the already-proven pattern in `rotas/estado.test.ts` (same `buildSeed()`/`semear()`/`beforeAll`/`afterAll` shape), and `npm run typecheck -w @n1/api` — which does type-check the skipped block's code — passed clean.

## User Setup Required

None new. `FINANCEIRO_LEITURAS_URL`/`PLATAFORMA_LEITURA_TOKEN` were already documented (empty) in `apps/api/.env.example` by 04-02; this plan is the first to actually *read* them (`process.env.FINANCEIRO_LEITURAS_URL ?? ""` / `process.env.PLATAFORMA_LEITURA_TOKEN ?? ""`, both inside `rotasDeFinanceiro`, the single point in this module that touches `process.env`), but no new variable was introduced.

## Next Phase Readiness

- `apps/web`'s eight `page.tsx` files (D4-08, Pattern 3 of `04-RESEARCH.md`) can now fetch `GET /financeiro/{dashboard,problemas,aprovacoes-pendentes,workflows,notas-fiscais,produtos,plano-contas}` from a Server Component the same way `estado-inicial.ts` fetches `/estado` — 401/403/{503,502} are the three states to render, matching D4-15's requirement that backend unavailability is visible, never an empty list.
- `EMPRESAS_PERMITIDAS` is exported from this module specifically so the eight screens' `Empresa` filter control (D4-09) never redigit the six-item allowlist.
- 04-10 (the Financeiro write actions) extends this same file/module: the CORS `methods` allowlist (`GET`, `POST`) already covers what those actions will need, and the comment left in `app.ts` records why they'll be `POST`, not `PATCH`/`DELETE`.
- No blocker for the automation/ side of `/v1/leituras/*` (04-01/04-03) — this plan only consumes the 04-02 client, which is transport-only and was never coupled to whether the real `/v1/leituras/*` endpoints exist yet.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `apps/api/src/rotas/financeiro.ts`
- FOUND: `apps/api/src/rotas/financeiro.test.ts`
- FOUND: `apps/api/src/app.ts` (modified, `rotasDeFinanceiro` import + registration + `OpcoesDoApp.financeiro` present)
- FOUND commit `412c599` (Task 1)
- FOUND commit `e27f57f` (Task 2)
- FOUND commit `117dc29` (Task 3)
