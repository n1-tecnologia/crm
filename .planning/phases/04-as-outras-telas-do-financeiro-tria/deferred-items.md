# Deferred Items — Phase 04 (as-outras-telas-do-financeiro-tria)

Out-of-scope discoveries logged during execution, per the executor's scope
boundary rule. None of these are fixed by the plan that discovered them.

## 04-01 — Task 3 (`npm test` no `automation/`)

**Found during:** `cd ../financeiro-tria/automation && npm test` (full suite run, required
by 04-01's `<verification>`).

**Issue:** `src/tenants/tria/payment-rules.test.ts` — case "resolve responsavel por
centro de custo com fallback" fails:

```
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /FINQ/i.
Input: 'Elifas'
```

**Scope check:** `git diff --stat -- automation/src/tenants/tria/payment-rules.test.ts
automation/src/tenants/tria/payment-rules.ts` returns empty — neither file is part of
the 89 pre-existing dirty files, nor touched by any commit of this plan (`git log
--oneline -3` on `payment-rules.ts` shows only pre-Phase-4 commits). The failure is
pre-existing in the `financeiro-tria` repository at `main` HEAD, unrelated to
`fixture-financeiro.ts`/`leituras-plataforma-dtos.ts`/`leituras-plataforma-dtos.test.ts`
(this plan's three files).

**Why not fixed:** Out of scope per the executor's scope boundary — "only auto-fix
issues directly caused by the current task's changes." `resolveResponsible`'s fallback
logic belongs to a different subsystem (Solicitação de pagamento, Phase 0/2), not to
this plan's DTO/allowlist surface.

**Net effect on `npm test`:** 95/96 passing (1 pre-existing failure, unrelated). The
three new files added by 04-01 (`fixture-financeiro.ts`, `leituras-plataforma-dtos.ts`,
`leituras-plataforma-dtos.test.ts`) do not regress this number — it was already 95/96
before this plan's commits landed (verified: neither file this test depends on has any
diff from `main` HEAD).

**Suggested owner:** whoever next touches `payment-rules.ts`/`resolveResponsible` — most
likely a plan revisiting Solicitação de pagamento fallback rules, not a Phase 4 plan.

## 04-01 — `npm run check` in `crm-n1` (diligence run, not required by Task 1-3 acceptance)

**Found during:** running `npm run check` from the `crm-n1` root, per the plan's
`<verification>` instruction to prove the phase "didn't bleed" into `crm-n1`.

**Result:** `typecheck` (3 workspaces), `lint`, `verificar:tokens`, `@n1/dominio` tests
(480 passing) and `@n1/web` tests (144 passing) all green. `@n1/api` tests had 2
failures:

- `src/e2e/lote-contas-a-pagar.test.ts` — case "(d) o piso e o teto do lock (DEC-06)"
  timed out at 180024ms (matches `testTimeout: 180_000` in `apps/api/vitest.config.mts`)
- `src/rotas/classificacoes.test.ts` — case "(f)/(g)/(h)/(k) resposta do aprovador
  designado..." timed out at 180014ms

**Scope check:** `git status --porcelain` in `crm-n1` shows zero source-file changes
from this plan (only `.planning/` docs). Neither failing test file is part of
`files_modified` for plan 04-01, which touches only `../financeiro-tria`.

**Why not fixed:** Out of scope. Both failures are consistent with the many
production/database-access blockers already tracked in `STATE.md` for Phase 3 plans
(03-07, 03-08, 03-10, 03-11, 03-13, 03-15) — tests that require a live Postgres
connection via the Supabase pooler timing out or behaving differently depending on
environment/network conditions, not a regression introduced by this plan.

**Suggested owner:** whoever picks up the Phase 3 production-access blockers, or
whoever runs `/gsd-verify-phase` next with real `DATABASE_URL`/production access
available.
