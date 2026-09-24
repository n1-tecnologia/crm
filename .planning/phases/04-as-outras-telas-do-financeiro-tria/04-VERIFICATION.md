---
phase: 04-as-outras-telas-do-financeiro-tria
verified: 2026-09-24T12:07:19Z
status: human_needed
score: 4/4 must-haves verified (Criterion 3 verified as sound PREPARATION, matching its documented scope)
overrides_applied: 0
deferred:
  - truth: "financeiro-tria.vercel.app pausado 30 dias, anon_read removido, AuthContext morto (D4-16 etapas 2-5)"
    addressed_in: "Execução futura do runbook (owned steps, not a later roadmap phase)"
    evidence: "04-14-PLAN.md/04-14-SUMMARY.md and ROADMAP.md Phase 4 block record this as a user-approved 'prepare-only, stop before irreversible' checkpoint decision — not an incomplete task and not deferred to a later milestone phase. Listed here for completeness, not as a phase-4 gap."
human_verification:
  - test: "Abrir cada uma das oito telas (/financeiro, /financeiro/notas-fiscais, /produtos, /plano-contas, /extratos, /workflows, /problemas, /aprovacoes-pendentes) logado como um Membro com e sem alcance à Pasta Financeiro, e comparar visualmente contagens/colunas com o painel financeiro-tria.vercel.app hoje."
    expected: "Mesmos nomes, mesma ordem de colunas, mesmas contagens (D4-01/UI-SPEC); sem alcance, o item some da navegação e a rota devolve 403."
    why_human: "Contagem e paridade visual linha-a-linha contra um sistema externo (financeiro-tria.vercel.app) não é verificável por grep — exige comparação visual ao vivo com dados reais de produção."
  - test: "Disparar 'Marcar 7 dias' e 'Emitir notas pendentes' em Notas fiscais contra o automation/ real, esperar a corrida terminar, clicar 'Atualizar agora' e conferir que as colunas Emissão/7 dias mudam."
    expected: "Toast 'Execução iniciada...' aparece imediatamente; após a corrida real terminar e o refresh, os ícones de emissaoNotaProduto/emissaoNotaServico/controleEmissao refletem o novo estado — provando que 'resultado da corrida renderizado' (D4-12) realmente acontece, não só que o código pretende que aconteça."
    why_human: "Depende do automation/ real rodando um job em segundo plano contra Postgres de produção/staging; grep só prova que o código faz a chamada e faz refresh, não que o efeito de ponta a ponta ocorre."
  - test: "Confirmar com o Financeiro (o operador humano) que reconhece as oito telas e opera nelas por uma semana, antes de avançar para a etapa 2 de D4-16."
    expected: "Confirmação nominal registrada, conforme runbook exige."
    why_human: "É literalmente uma decisão/confirmação humana listada como dona de etapa no próprio runbook — não uma verificação de código."
---

# Phase 4: As outras telas do financeiro-tria — Verification Report

**Phase Goal:** Tudo o que o Financeiro lia no painel do financeiro-tria está no CRM N1, no seu
sistema de design, lendo a API do `automation/` por um caminho autenticado — e o painel sai do ar.
**Verified:** 2026-09-24T12:07:19Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Summary Judgment

**The phase goal is substantially achieved in the codebase, with one item (Criterion 3) explicitly
and correctly NOT done by a user-approved scope decision, and a handful of items that require human
eyes/live infrastructure rather than static analysis.** I disagree with treating this as a clean
"passed": the human-verification items below are real gaps in what static analysis can prove, not
decoration, so per the verifier's own decision tree this must route to `human_needed`, not `passed`.
I found no evidence contradicting the SUMMARY narrative for Criteria 1, 2, and 4 — every specific
grep/read I ran to try to falsify a claim confirmed it instead.

## Goal Achievement

### Observable Truths (Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Oito leituras existem no CRM N1, visual do CRM N1, nenhuma regra alterada | ✓ VERIFIED (with one honestly-registered, human-decidable divergence) | All 8 routes exist and render real components backed by real data (see Artifacts table). Aprovações pendentes correctly has NO decision action (`apps/web/src/features/financeiro/componentes/tabela-de-aprovacoes.tsx:1-40` — no `onSelect`, no dialog, comment states this explicitly). Plano de contas has real CRUD-lite (import + delete, `tabela-do-plano-de-contas.tsx`) not fake. Extratos has real upload with `XMLHttpRequest` progress (`formulario-de-extrato.tsx:45-65`). One divergence: the "Plataforma" filter on Notas fiscais was not built because `NotaFiscalDto` doesn't project that field (`deferred-items.md` item 5) — correctly registered as `DECISÃO HUMANA`, not a bug, since building it would require expanding the D4-05 allowlist. This is a narrow, honest, single-field gap, not a dent in "mesma leitura de hoje" overall. |
| 2 | Nenhuma leitura usa `anon_read` nem credencial embutida; chegam autenticadas | ✓ VERIFIED | No direct Supabase anon reads for financeiro screens in `apps/web` (only `clienteDoNavegador().auth.getSession()` for obtaining the user's own JWT, in `formulario-de-extrato.tsx:85-86` and `leitura.ts:58-59` / `acoes.ts:37-38` — this is the user's session token, not a credential embedded in the bundle). Chain confirmed end to end: `apps/web/src/features/financeiro/dados/leitura.ts` → `GET {apiUrl}/financeiro/*` with `Authorization: Bearer <user JWT>` → `apps/api/src/rotas/financeiro.ts` (registered in `app.ts:181`, **after** `registrarAutenticacao(app, ...)` at `app.ts:170-174`, so it inherits the JWT hook) → `comAlcance()` (`financeiro.ts:97-107`) checks `memberReachesContainer` → `apps/api/src/automacoes/cliente-leituras-financeiro.ts` sends `Authorization: Bearer <PLATAFORMA_LEITURA_TOKEN>` → `automation/src/http/leituras-*-routes.ts`. Verified **every one of the 13 `/v1/leituras/*` routes** (6 in `leituras-plano-contas-routes.ts`, 3 in `leituras-notas-fiscais-routes.ts`, 4 in `leituras-plataforma-routes.ts`) calls `exigirCredencial(req, res, deps.tokenEsperado)` before executing. `exigirCredencial` uses `timingSafeEqual` (`leituras-plataforma-comum.ts:91,110-122`). DTOs in `leituras-plataforma-dtos.ts` are positive-allowlist projections; none of `app_key`/`app_secret`/`api_key`/`cpf_cnpj`/`telefone`/address appear, and `leituras-plataforma-dtos.test.ts` has an explicit mutation-control test (`api_key` leaks through naive spread but not through the real DTO function). Confirmed `apps/web` has zero actual `import` statements crossing into `apps/api` (the earlier grep hits on "apps/api" were all prose comments naming the backend, not import paths). **Caveat lowering confidence, not blocking:** `timingSafeEqual` itself has no test that would fail if it regressed to `===` (`deferred-items.md` item 4, confirmed still true by reading the file) — the security property "constant-time" is asserted by code review, not proven by a red test on regression. |
| 3 | `financeiro-tria.vercel.app` pode sair do ar; `anon_read`/`AuthContext` morrem com ele | ✗ NOT MET — by explicit, user-approved scope decision (PREPARE-ONLY), not a defect | Confirmed via ROADMAP.md Phase 4 block and `04-14-SUMMARY.md`: Vercel is untouched, `anon_read` policies are all still live, `AuthContext.tsx` is untouched. This is not a phase-4 gap; it's a deliberately incomplete checkpoint. **What I verified about the preparation itself (the thing that actually shipped):** the migration `financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql` (a) covers all `anon_read`-named policies (`solicitacoes_pagamentos`, `financas_mp`, `automation_workflows`, `automation_workflow_runs`), (b) covers the six `conciliador_contas_pagar_*` tables through an idempotent `do $$ ... to_regclass(...) is null then continue` loop that tolerates missing tables, (c) explicitly handles the space-named policy `"anon read conciliador_contas"` on `conciliador_contas` with its exact quoted name (lines 71-77 of the migration) — the one policy a naive blanket `drop policy anon_read` would have missed, and (d) honestly leaves `transacoes`/`produtos_cadastrados_emissao_notas` commented out pending a live Supabase Studio query, with the runbook's checklist (`06-runbook-corte-painel-financeiro.md` lines 143-160, 264) marking that query as "pendente" rather than assuming an answer. The runbook also names an owner per remaining step (Financeiro operator for weekly-use confirmation; product owner for Vercel pause and the Studio queries; executor for the pre-registered route removal). This is a well-built, honest PREPARE-ONLY artifact — not a stub pretending to be a finished cut. |
| 4 | Emissão manual de NF segue o que D10 decidir | ✓ VERIFIED | D10/D4-12 decided manual NF emission is a batch trigger on the Notas Fiscais screen, not a Task Action, and Google Sheets does not continue (`04-CONTEXT.md:158-167`). Confirmed in `tabela-de-notas-fiscais.tsx`: two buttons ("Marcar 7 dias" line 180-181, "Emitir notas pendentes" line 182-184) behind `ConfirmDialog`s (lines 239-259) dispatching `tria-invoice-mark-7days`/`tria-invoice-emit` via `executarWorkflow` (`dados/acoes.ts:89-91`), which the `apps/api` route restricts to exactly those two keys via a literal enum (`financeiro.ts:275-276`) as a third barrier against per-row emission. **On the "resultado da corrida renderizado" clause specifically** (which the orchestrator flagged as unverified): I traced it and it is satisfied by design, not missing. The UI-SPEC itself (`04-UI-SPEC.md:531-538`) defines "resultado renderizado" as the Emissão/7-dias columns changing when the person clicks "Atualizar agora" — not a synchronous report — because the automation/ call is `202 Accepted`/async by nature (`workflow-routes.ts`). `tabela-de-notas-fiscais.tsx` implements exactly this: Toast "Execução iniciada..." plus a refresh affordance (`BotaoAtualizar`), and the table's Emissão column (lines 150-158) already renders `emissaoNotaProduto`/`emissaoNotaServico`/`controleEmissao` from the DTO, so a refresh after the run genuinely shows the new state. This is a documented, spec-authorized interpretation, not an executor shortcut — I could not falsify it. |

**Score:** 3/4 truths fully verified as met; 1/4 (Criterion 3) verified as NOT met but for the correct, user-approved reason, with the preparation work that did ship independently verified as sound.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/web/src/app/(shell)/financeiro/**/page.tsx` (8 routes + `financeiro/page.tsx`) | The eight screens | ✓ VERIFIED | All 9 page files exist (`financeiro`, `notas-fiscais`, `produtos`, `plano-contas`, `extratos`, `workflows`, `problemas`, `aprovacoes-pendentes`, plus `loading.tsx` per route). Thin Server Components (20-54 lines) delegating to `features/financeiro/componentes/*` — confirmed this is App Router composition, not a stub pattern. |
| `apps/web/src/features/financeiro/componentes/tabela-do-plano-de-contas.tsx` | Lista + import em lote + apagar por id (não CRUD) | ✓ VERIFIED | Real import flow (CSV parse → `ConfirmDialog` with explicit consequence warning → `importarPlanoDeContas`) and real delete (`removerLinhaDoPlanoDeContas`). No edit/create-single UI exists, matching D4-10's explicit "sem edição nem criação avulsa" rule. |
| `apps/web/src/features/financeiro/componentes/formulario-de-extrato.tsx` | Upload real com progresso | ✓ VERIFIED | `XMLHttpRequest` with `upload.onprogress`, real POST to `apps/api`, real Bearer token from user session, states aguardando/enviando/enviado/falhou all wired. |
| `apps/web/src/features/financeiro/componentes/tabela-de-aprovacoes.tsx` | Vista legada, sem decisão | ✓ VERIFIED | No click handlers, no dialogs, no mutation calls — confirmed by absence, matching D4-11. |
| `apps/web/src/features/financeiro/componentes/tabela-de-notas-fiscais.tsx` | Nine columns + two batch triggers, no per-row emission | ✓ VERIFIED | See truth #4 above. |
| `apps/api/src/rotas/financeiro.ts` (418 lines) | Seven+ GET/POST routes, JWT + alcance guard | ✓ VERIFIED | 7 GET routes, 7 POST routes (aliquotas, importar, remover, executar workflow, repetir-passo, cancelar, extratos upload) — all wrapped in `comAlcance`. |
| `automation/src/http/leituras-plataforma-routes.ts`, `leituras-notas-fiscais-routes.ts`, `leituras-plano-contas-routes.ts`, `leituras-plataforma-dtos.ts`, `leituras-plataforma-comum.ts` | `/v1/leituras/*` authenticated surface | ✓ VERIFIED | All 13 routes call `exigirCredencial`; all mounted in `automation/src/server.ts:55,61,66`; DTOs are positive-allowlist with a mutation-control test. |
| `financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql` | The cut migration | ✓ VERIFIED as sound preparation (not applied — by design) | See truth #3. |
| `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md` | The cut runbook | ✓ VERIFIED as sound preparation | Honest checklist, named owners, grep-proof of "nobody else calls this route" for each legacy route slated for removal. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `apps/web` screens | `apps/api` | `lerDoFinanceiro()` fetch with user JWT (`leitura.ts:58-83`) | WIRED | `cache: "no-store"`, four-outcome `Leitura<T>` type (ok/semSessao/semAcesso/indisponivel) — no silent empty-list fallback (D4-15/D4-21 requirement). |
| `apps/api/src/rotas/financeiro.ts` | `automation/` `/v1/leituras/*` | `cliente-leituras-financeiro.ts` with `PLATAFORMA_LEITURA_TOKEN` Bearer | WIRED | Confirmed timeout/classification/`sanitizarErro()` reuse pattern from 03-11's `invocar-agente.ts`. |
| `apps/api` root | `rotasDeFinanceiro` | `app.register(rotasDeFinanceiro, ...)` at `app.ts:181`, after `registrarAutenticacao` at `app.ts:170-174` | WIRED | Confirmed by reading registration order directly — not inferred. |
| `automation/server.ts` | the three `/v1/leituras/*` router files | `app.use("/v1/leituras", ...)` x3 (`server.ts:55,61,66`) | WIRED | All three routers actually mounted, not just defined. |
| `automation/` dashboard/problemas/aprovações handlers | real Supabase data | `automationStore.listSolicitacoesPagamentos()`/`listSolicitacoesByEmpresa()` (`leituras-plataforma-routes.ts:154-157`) | FLOWING | Not a static/hardcoded return — traces to the same store the legacy panel reads, through the re-homed pure functions `montarMetricasDoDashboard`/`montarAtencaoDoDashboard`/`montarLinhasDeProblema`/`montarAprovacoesPendentes` in `automation/src/tenants/tria/financeiro-derivacoes.ts`. |
| `tabela-de-notas-fiscais.tsx` "Marcar 7 dias"/"Emitir notas pendentes" | `apps/api` `/financeiro/workflows/:key/executar` | `executarWorkflow()` Server Action (`acoes.ts:89-91`) | WIRED | `apps/api` further restricts `key` to a 2-item enum (`WORKFLOWS_EXECUTAVEIS`) — a third barrier against per-row emission, confirmed at `financeiro.ts:275-276`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `PainelDoDashboard` | `dashboard.metricas`/`atencao`/`problemas` | `GET /financeiro/dashboard` → `/v1/leituras/dashboard` → `montarMetricasDoDashboard(linhas)` over `automationStore.listSolicitacoesPagamentos()` | Yes | ✓ FLOWING |
| `TabelaDeNotasFiscais` | `notas` | `GET /financeiro/notas-fiscais` → `/v1/leituras/notas-fiscais` → `dtoDeNotaFiscal` over `transacoes` rows | Yes | ✓ FLOWING |
| `TabelaDoPlanoDeContas` | `linhas` | `GET /financeiro/plano-contas?empresa&tipo` → `/v1/leituras/plano-contas` → `conciliador_contas` (the same table the Agent's `matchCategory` reads) | Yes | ✓ FLOWING |
| `TabelaDeProdutos` | `produtos` | `GET /financeiro/produtos` → `/v1/leituras/produtos` → `produtos_cadastrados_emissao_notas` via `dtoDeProduto` | Yes | ✓ FLOWING |

No hardcoded-empty props or static returns were found feeding any of the eight screens.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `@n1/web` full unit suite green (includes financeiro navigation/leitura tests) | `npm run test -w @n1/web` | `Test Files 17 passed (17)`, `Tests 167 passed (167)`, 3.07s | ✓ PASS |
| Every `/v1/leituras/*` route requires credential | `grep -n "router\.\(get\|post\)\|exigirCredencial" leituras-*-routes.ts` | 13/13 handlers call `exigirCredencial` before executing | ✓ PASS |
| DTO allowlist excludes sensitive fields | Read `leituras-plataforma-dtos.ts` in full + its `.test.ts` mutation-control case | No `app_key`/`app_secret`/`api_key`/`cpf_cnpj`/`telefone`/address in any DTO; test proves naive spread WOULD leak `api_key` | ✓ PASS |
| No debt markers in phase-touched files | `grep -riE "TBD|FIXME|XXX"` across all financeiro files in both repos | No matches | ✓ PASS |

I did not run `apps/api`'s full suite or any build/typecheck command — those were pre-measured and supplied, and re-running them would have risked the same watchdog kill that ended four prior executor attempts.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| TELA-01 | The eight financeiro-tria screens, ported, authenticated, no rule changes | ✓ SATISFIED (with the Criterion 3 cut correctly deferred by decision, and one field-level UI-SPEC divergence on Notas fiscais correctly flagged as a human decision, not a defect) | See truths #1, #2, #4 above. |

No orphaned requirements found — TELA-01 is the only requirement mapped to Phase 4 and it appears in the plan frontmatter (confirmed against ROADMAP.md Phase 4 block).

### Anti-Patterns Found

None found in phase-touched files (both repos). No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` markers, no `return null`/`return {}`/`return []` stubs, no hardcoded-empty props feeding rendered data.

### Pre-Existing Issues (Not Caused By This Phase)

Carried forward from `deferred-items.md`, verified as read (not re-measured, per the supplied facts):
1. `payment-rules.test.ts` in `financeiro-tria` — 1/7 failing, pre-dates Phase 4 by two commits (`fc57b2d`, `9dc9680`).
2. `apps/api` e2e `lote-contas-a-pagar.test.ts` (d) — a Phase 3 DEC-06 timing measurement against a real Postgres pooler, timing out at 180014ms; observed failing in Wave 1 before any Phase 4 `apps/api` code reached `app.ts`.
3. `timingSafeEqual` in `exigirCredencial` has no regression-proof test (mutating it to `===` leaves all 11 cases green). This is real and it does lower confidence in Criterion 2's "constant-time" claim specifically — the property holds today by code inspection, but nothing would catch a future regression. I'm treating this as a pre-existing coverage gap on new code, not a phase-4 defect, since the code itself is correct; flagging it because a verifier that only checks "does the code call timingSafeEqual today" without noting the missing regression proof would be overconfident.

### Deliberate, User-Approved Deferrals (Not Gaps)

- **Criterion 3 (the cut)** — explicit PREPARE-ONLY checkpoint decision. Runbook and migration are ready; Vercel pause, RLS Studio queries, one week of real use, and confirmation are all owned and pending, not silently dropped.
- **The "Plataforma" filter on Notas fiscais** (`deferred-items.md` item 5) — requires expanding the D4-05 positive allowlist in the sibling repo, correctly flagged as a human decision about data exposure, not an implementation gap.

## Gaps Summary

There is no gap in this phase that resembles unfinished work disguised as done. The one criterion
not met (Criterion 3) is not met for the exact, documented, user-approved reason, and the artifacts
that make up its preparation are real and sound, not stubs. The reason this report is not `passed`
is procedural: three items above are not provable by static analysis and require either a human
sitting at the two apps side by side, a live automation/ run against real infrastructure, or an
actual person (the Financeiro operator) making a confirmation the runbook explicitly assigns to
them. None of these three are optional decoration — they are the actual remaining distance between
"the code implements the intended behavior" and "a human has seen the intended behavior occur."

## Explicit Statement on Phase Goal Achievement

**The phase goal, narrowly read as "build the eight authenticated screens without the panel going
dark yet," is achieved in the codebase.** All eight screens exist, render real data through a fully
authenticated, allowlist-projected, non-anon path, with no shortcuts or embedded credentials found
anywhere I looked, including the DTO boundary the whole phase exists to protect. Criterion 3 (the
panel actually going dark) is intentionally not part of what phase 4's code was supposed to
deliver yet — the ROADMAP's own Phase 4 entry for 04-14 records it as "PREPARADO, NÃO EXECUTADO...
falta: uma semana de uso real, confirmação do Financeiro... e só então o ponto de não retorno."

**What remains, concretely, before the full phase goal (painel sai do ar) is true:**
1. A week of real Financeiro usage of the new screens, with nominal confirmation (owner: Financeiro operator).
2. Pausing `financeiro-tria.vercel.app` on Vercel and confirming via `curl -I` (owner: product owner).
3. Running the two RLS status queries in Supabase Studio for `transacoes`/`produtos_cadastrados_emissao_notas` and pasting the real result into the runbook (owner: product owner, Studio access required).
4. Applying migration `20261001120000` with `supabase db push`, verified against the live database (owner: product owner or executor with credential), followed by removing the legacy routes/`AuthContext.tsx` and a final `npm run check` green across all three workspaces.

None of this is a defect in what Phase 4 delivered; it is the deliberately-sequenced remainder of
D4-16 that a human, not an agent, must execute and confirm.

---

_Verified: 2026-09-24T12:07:19Z_
_Verifier: Claude (gsd-verifier)_
