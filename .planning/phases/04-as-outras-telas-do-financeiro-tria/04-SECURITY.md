---
phase: 04
slug: as-outras-telas-do-financeiro-tria
status: draft
threats_open: 1
asvs_level: 1
created: 2026-09-25
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This audit verified every threat declared across `04-01-PLAN.md` … `04-14-PLAN.md`
(38 numeric threat IDs, `T-4-01`…`T-4-39` with `T-4-10` unused, plus the
cross-phase `T-4-SC` supply-chain ID — 39 unique threats total, several
repeated across multiple plans; mitigation plans were merged per occurrence).
Verification was done by reading the implementation cited in each plan's
mitigation plan, then confirming with live, file-scoped test runs (never the
full `apps/api` suite). Implementation files were not modified.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `public` schema (financeiro-tria Supabase) → HTTP response | Row-level data carries per-row credentials, documents, address | `app_key`/`app_secret`, CPF/CNPJ, phone, address |
| `apps/api` → `automation/` (VPS) | Service credential crosses; automation/ response is untrusted input to `apps/api` | `PLATAFORMA_LEITURA_TOKEN` Bearer, JSON bodies, file bytes |
| browser (Member JWT) → `apps/api` | Untrusted input: query, headers, claimed identity | Supabase `access_token` Bearer |
| `apps/web` Server Component → `apps/api`; rendered response → browser | Everything a Server Component prints reaches the HTML | Session token (server-side only), projected DTOs |
| `public.transacoes` (32 columns, per-row credential) → HTTP response | The most sensitive table in the phase; historically read directly by the browser via the `anon` key | credentials, CPF/CNPJ, phone, address (before D4-05 DTOs) |
| body of `POST /financeiro/produtos/:id/aliquotas`, `/plano-contas/importar` → Postgres write | Untrusted input deciding what gets written to `produtos_cadastrados_emissao_notas` / `conciliador_contas` (the table the collections Agent queries) | percentage fields, plan-of-accounts rows |
| body of `POST /financeiro/workflows/:key/executar` → `markSeteDias`/`emitirNotas` | Untrusted input deciding which production routine fires | workflow `key` |
| file chosen by user → browser → `apps/api` → `automation/` webhook | Content and filename are untrusted input | bank statement files (pdf/csv/xlsx/xls/ofx) |
| Supabase `anon` key → `public` schema | Today anyone with the public key (shipped in the Vercel bundle) can read panel tables, and on two of them possibly write | full row data, panel tables |
| internet → public `automation/` routes | Panel routes have no authentication today; one route stays intentionally public after the cut | webhook payload |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-4-SC | Tampering | npm installs, all plans | mitigate | Zero installs across all 14 plans; `git log` shows no `04-*` commit touching `package.json`/lockfile in `crm-n1` or `financeiro-tria/automation`; `.xlsx` explicitly rejected (CVE-2023-30533), custom CSV parser instead (`apps/web/src/features/financeiro/dados/csv-plano-de-contas.ts`) | closed |
| T-4-01 | Information Disclosure | `leituras-plataforma-dtos.ts`, `financeiro-derivacoes.ts` (`LinhaDeSolicitacao`) | mitigate | Positive-allowlist DTOs, field-by-field, no spread/delete/omit — `financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts:1-199`; `LinhaDeSolicitacao` type has no `app_key`/`app_secret` field — `financeiro-derivacoes.ts:233-245`; mutation-control test proves the check actually fires — `leituras-plataforma-dtos.test.ts` (11/11 passing, live run) | closed |
| T-4-02 | Information Disclosure | `exigirCredencial` | mitigate | `createHash("sha256")` + `timingSafeEqual`, never `===` — `automation/src/http/leituras-plataforma-comum.ts:86-92,110-122`. **Caveat (pre-existing, `deferred-items.md` #4):** no dedicated regression test protects this specifically — mutating `timingSafeEqual` to `===` leaves all current tests green. Code is correct today; coverage gap for future regressions is real. See Notes below. | closed (with noted coverage gap) |
| T-4-03 | Tampering / Elevation of Privilege | RLS status of `public.transacoes` / `public.produtos_cadastrados_emissao_notas` | transfer→mitigate | Live Postgres verification required (`04-14` Task 1, blocking human checkpoint): `select relname, relrowsecurity from pg_class where relname in (...)`. **Not yet run** — `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md:146-149` still reads `[AGUARDANDO EXECUÇÃO NO SUPABASE STUDIO...]`; migration's remediation lines are commented out pending that result (`financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql:81-101`) | **OPEN — see Notes** |
| T-4-04 | Information Disclosure | `formatarResumo`, `montarLinhasDeProblema` | mitigate | Positive allowlist `ROTULOS_PERMITIDOS`, no unknown-key loop — `automation/src/tenants/tria/financeiro-derivacoes.ts:50-61,175-188`; excludes `documento`/`forma_pagamento`/`conta_de_pagamento`/codes by name, commented per exclusion; live test run confirms no leak by name or value | closed |
| T-4-05 | Denial of Service | `POST /financeiro/extratos/:origem` | mitigate | `bodyLimit: 25MB` per-route, `addContentTypeParser` scoped to an explicit MIME allowlist (415 for anything else), extension checked against `parseRecebimento`'s real dispatch list — `apps/api/src/rotas/financeiro.ts:349-361,377,385,394-397`; `app.ts` error handler passes through Fastify's native 4xx instead of masking as 500 — `apps/api/src/app.ts:100-110`; live test cases (d)/(e) pass | closed |
| T-4-06 | Spoofing | CORS on `apps/api` | accept | Explicit origin allowlist `[webOrigin]`, never `*`, `credentials: false`, methods restricted to `GET`/`POST` — `apps/api/src/app.ts:141-155`. Pre-existing control (T-1-03), not re-implemented by this phase; recorded in Accepted Risks Log below | closed |
| T-4-07 | Elevation of Privilege | Route registered in the wrong plugin | mitigate | `rotasDeFinanceiro` registered at app root, **after** `registrarAutenticacao` — `apps/api/src/app.ts:162-181`; live test case (a): 401 without token on two routes, passing | closed |
| T-4-08 | Tampering | Free-form `empresa`/`tipo` reaching the automation/ filter | mitigate | zod `.strict()` enum allowlist on both sides — `apps/api/src/rotas/financeiro.ts:53-67`; `automation/src/http/leituras-plataforma-comum.ts:134-158`; live test cases (b)/(c) on both repos pass | closed |
| T-4-09 | Elevation of Privilege | A second "approve" surface over `solicitacoes_pagamentos` | mitigate | No approve/review route exists anywhere in `financeiro.ts`, `leituras-plataforma-routes.ts`, or `leituras-plano-contas-routes.ts` — confirmed by grep (absence) and live test: `financeiro.test.ts` case (i) 404 on two plausible paths; automation-side `POST /execucoes/1/aprovar → 404` (live run) | closed |
| T-4-11 | Information Disclosure | Error envelopes leaking `pg.message`/stack/upstream body | mitigate | `sanitizarErro()` reused from `outbox-worker` (never re-body) — `apps/api/src/automacoes/cliente-leituras-financeiro.ts:150-170`; two fixed phrases in `apps/api/src/rotas/financeiro.ts:119-128`; `MENSAGENS_FIXAS` + `responderErro` in `automation/src/http/leituras-plataforma-comum.ts:32-58`. Live test runs on both repos confirm secret string `"pg: senha=supersecreta"` reaches only `console.error`/`request.log`, never the response body | closed |
| T-4-12 | Tampering | Committing the sibling repo's 89 unrelated dirty files | mitigate | `git -C ../financeiro-tria status --porcelain`: 89 tracked changes, **0 untracked** — consistent with the documented baseline, no evidence of new contamination from this phase's work | closed |
| T-4-13 | Information Disclosure | Real credentials/PII in the test fixture | mitigate | All sensitive fixture values are obviously fake literals (`"app_key_de_teste_nunca_real"`, etc.) — `automation/src/testing/fixture-financeiro.ts:74-144` (confirmed by direct read) | closed |
| T-4-14 | Elevation of Privilege | Reusing the write-side token for reads | mitigate | Distinct env var: `PLATAFORMA_LEITURA_TOKEN` (`apps/api/src/rotas/financeiro.ts:90`) vs. `PLATAFORMA_LANCAMENTO_TOKEN` (`apps/api/src/index.ts:57`) — confirmed by grep, no cross-use | closed |
| T-4-15 | Denial of Service | Unbounded fetch hanging a Fastify worker | mitigate | `AbortSignal.timeout(timeoutMs)`, default 10s — `apps/api/src/automacoes/cliente-leituras-financeiro.ts:144`; covered by the 19/19 live-passing client test suite | closed |
| T-4-16 | Spoofing | Empty expected token authenticating by accident | mitigate | Both sides recuse **before** comparing: client `token === ""` check (`cliente-leituras-financeiro.ts:116-118`), server `!tokenEsperado` check (`leituras-plataforma-comum.ts:117`) — live tests confirm on both | closed |
| T-4-17 | Elevation of Privilege | Nav-hiding treated as access control | mitigate | `vePastaFinanceiro` is presentation-only, explicitly commented as such — `apps/web/src/features/financeiro/navegacao-financeiro.ts:61-71`; real gate is the `apps/api` 403 → `NoAccessState` — `moldura-de-leitura.tsx:28`; confirmed applied uniformly across all 7 read screens (grep of `MolduraDeLeitura` usage) | closed |
| T-4-18 | Spoofing | Member without a session seeing the subject | mitigate | `vePastaFinanceiro(estado, null) === false` — `navegacao-financeiro.ts:69`, live test case (e)/(f) passing (`navegacao-financeiro.test.ts:38-39`) | closed |
| T-4-19 | Elevation of Privilege | Member without container reach reading/writing Financeiro | mitigate | `comAlcance()` wraps every one of the 13 routes (7 GET + 6+ POST) via `memberReachesContainer` — `apps/api/src/rotas/financeiro.ts:99-111`; live test cases (e)/(j) confirm 403 with the fake client never invoked | closed |
| T-4-20 | Information Disclosure | Session token leaking into the client bundle | mitigate | `import "server-only"` at the top of `leitura.ts`; `"use server"` at the top of `acoes.ts`; token is fetched server-side and never passed as a client-component prop | closed |
| T-4-21 | Repudiation | Read failure indistinguishable from "no data" | mitigate | Four-outcome `Leitura<T>` union (`ok`/`semSessao`/`semAcesso`/`indisponivel`) — `apps/web/src/features/financeiro/dados/leitura.ts:22-26`; `MolduraDeLeitura` is the single dispatch point, `EstadoDeFalha`/`EmptyState` never coexist — `moldura-de-leitura.tsx:20-31`; no `catch → []` pattern found | closed |
| T-4-22 | Information Disclosure | Server error text echoing infra detail | accept | `apps/api` already returns two fixed phrases (`financeiro.ts:119-128`). Verified **stronger than the accepted disposition requires**: `EstadoDeFalha` renders a fully static message and never interpolates `leitura.erro` at all (`estado-de-falha.tsx:20-36`) — grepped, no `.erro` render anywhere in `apps/web/src/features/financeiro/**`. Recorded in Accepted Risks Log below | closed |
| T-4-23 | Denial of Service | Touching legacy Vercel-panel routes before the cut | mitigate | `git diff --stat` empty for `routes.ts`/`plano-contas-routes.ts`/`workflow-routes.ts`/`bank-statement-webhooks.ts` in `financeiro-tria/automation` | closed |
| T-4-24 | Repudiation | A disabled "Executar agora" button that looks wired but isn't (04-08), later expected to be superseded by a real route (04-13) | mitigate | **Confirmed superseded.** Both `tabela-de-notas-fiscais.tsx:109-119` (Notas fiscais batch triggers) and `painel-de-workflows.tsx:67-78` (Workflows panel) call the real `executarWorkflow(key)` Server Action → real `POST /financeiro/workflows/:key/executar`, which the `apps/api` allowlist further restricts (see T-4-27) | closed |
| T-4-25 | Tampering | Write reaching columns outside the two allowed percentage fields | mitigate | `atualizarAliquotasDoProduto` builds the update object field-by-field, no spread — `automation/src/tenants/tria/leituras-notas-fiscais.ts:124-155`; zod `.strict()` two-field schema on the `apps/api` side; live test confirms the dep receives exactly `{ porcentagemProduto: '12,5' }` | closed |
| T-4-26 | Repudiation | Silent truncation of ~1,987 rows by the PostgREST page cap | mitigate | Internal pagination via `.range()` in 1000-row batches, capped at 20 batches with `console.warn` (never throws) — `automation/src/tenants/tria/leituras-notas-fiscais.ts:67-101` | closed |
| T-4-27 | Elevation of Privilege | Triggering an arbitrary workflow / per-row NF emission | mitigate | Three independent barriers: (1) closed union `manualRunKey?: "mark-7days" \| "emit"` — `automation/src/workflows/catalog.ts:18`; (2) `getSystemWorkflow` + `manualRunKey` check — `leituras-plano-contas-routes.ts:194-213`; (3) literal `WORKFLOWS_EXECUTAVEIS` enum on the `apps/api` edge — `financeiro.ts:275-290`. Live test case (h) on both repos confirms | closed |
| T-4-28 | Tampering | Path traversal via `x-file-name` | mitigate | `nomeDeArquivoSaneado()` strips path separators and `..`, caps at 200 chars — `apps/api/src/rotas/financeiro.ts:379-383`; live test case (l): `"../../etc/passwd.csv"` → client receives `"passwd.csv"` | closed |
| T-4-29 | Denial of Service | Unbounded Plano de contas import generating unbounded embeddings | mitigate | `min(1).max(2000)` enforced on both `apps/api` (`financeiro.ts:216-222`) and `automation/` (`leituras-plano-contas-routes.ts:100-107`); web-side pre-check mirrors the same 2000 cap (`csv-plano-de-contas.ts:25`); live tests for 2001-row rejection pass on both backends | closed |
| T-4-30 | Tampering | Raw-body content-type parser leaking into `POST /operacoes/:nome` | mitigate | Parser registered inside the encapsulated `rotasDeFinanceiro` plugin body (not `fastify-plugin`), so Fastify scopes it to this module only — `apps/api/src/rotas/financeiro.ts:349-361`; live run of `operacoes.test.ts`: 24/24 passing, no leak | closed |
| T-4-31 | Repudiation | UI claiming an async batch emission already finished | mitigate | `executarWorkflow` never calls `revalidatePath` (`acoes.ts:80-91`, confirmed by grep — only `escreverNoFinanceiro` call); UI shows a neutral "Execução iniciada…" toast, result only appears after an explicit "Atualizar agora" — `tabela-de-notas-fiscais.tsx:113-118`, `painel-de-workflows.tsx:73-77` | closed |
| T-4-32 | Repudiation | An input field showing an unsaved value as if confirmed | mitigate | On failure, `setValor(confirmado)` reverts the field and shows an error toast — `apps/web/src/features/financeiro/componentes/tabela-de-produtos.tsx:44-56` | closed |
| T-4-33 | Spoofing | Extract upload proxy terminating at a pre-existing PUBLIC route (`POST /webhook/receber-whatsapp-doc/:origem`) | accept | Pre-existing exposure, not introduced by this phase; required by n8n. Registered as a named residual risk in the runbook with a concrete follow-up action — `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md:238-248`. Recorded in Accepted Risks Log below | closed |
| T-4-34 | Tampering | Plano de contas import silently changing what the collections Agent classifies | mitigate | `ConfirmDialog` that affirms the consequence (never denies it) + mandatory `Toggle` gating `confirmDisabledReason` — `apps/web/src/features/financeiro/componentes/tabela-do-plano-de-contas.tsx:241-265`; no negating phrase found in the description text | closed |
| T-4-35 | Information Disclosure | Session token in logs or URL | mitigate | Token sent via `Authorization` header only, never in the querystring; no `console.log` of the token found — `formulario-de-extrato.tsx:53-57` | closed |
| T-4-36 | Spoofing | Browser calling `automation/` directly, bypassing `apps/api` | mitigate | Upload URL built from `NEXT_PUBLIC_API_URL` only — `formulario-de-extrato.tsx:52,54`; grep across `apps/web/src/features/financeiro/**` for any `automation`/Vercel/VPS host literal returns zero URL matches (prose comments only) | closed |
| T-4-37 | Information Disclosure | `anon_read` surviving the cut on some table | mitigate | Migration inventory read directly from source migrations (not from D4-16 prose), including the space-named `"anon read conciliador_contas"` policy that a literal `drop policy anon_read` would miss — `financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql:40-79`, confirmed by direct read. **Artifact is complete and correct; not yet applied to production** (see T-4-03 note) | closed (artifact); application pending, tracked in T-4-03/runbook |
| T-4-38 | Denial of Service | Killing the panel before the new screens are in real use | mitigate | Ordered, human-gated checklist (steps 1–5) embedded in the migration header and the runbook, with `anon_read` removal explicitly last — migration lines 1-38, `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md:259-268` | closed (process design); execution pending by decision |
| T-4-39 | Denial of Service | Removing a route the cron/n8n still calls | mitigate | Per-route `grep` proof pasted into the runbook before each removal; `bank-statement-webhooks.ts` explicitly preserved and confirmed untouched (`git diff --stat` empty) — `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md:162-236` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Notes on T-4-03 (the one open threat)

`T-4-03` (RLS status of `public.transacoes` / `public.produtos_cadastrados_emissao_notas`,
transfer→mitigate) is reported **OPEN**, not closed, even though the transfer
documentation is thorough (named owner: product owner with Supabase Studio
access; exact verification query; exact remediation SQL pre-written and ready
to uncomment). The reason: this threat's mitigation plan is not "prepare an
artifact correctly" (which is what closed T-4-37/T-4-38/T-4-39) — it is
"establish a live database fact and act on it if needed." That action has
**not** happened. `06-runbook-corte-painel-financeiro.md:146-149` still shows
the verification query result as `[AGUARDANDO EXECUÇÃO NO SUPABASE STUDIO...]`,
and the migration's remediation lines are commented out pending that result.

This is not a regression introduced by Phase 4 — the code comment in
`leituras-notas-fiscais.ts:12-21` explicitly states this is a pre-existing
condition the phase discovered and is not resolving. It is also not silently
dropped: it's the exact reason `04-VERIFICATION.md` scored the phase
`human_needed` rather than `passed`, and it is the single item this audit
would block a "SECURED" verdict on. Until the Postgres query runs, whether
`transacoes` (32 columns, credential-bearing) has unrestricted CRUD via the
`anon` key is genuinely unknown from the codebase — it cannot be closed by
reading code, and it should not be waved through as accepted risk without a
named acceptance decision (as opposed to a pending-verification transfer).

**Recommended next step (either one closes this):**
1. Run the two queries in `06-runbook-corte-painel-financeiro.md` (Consulta 1/2)
   against the live `financeiro-tria` Supabase project, paste the real result,
   and apply the pre-written remediation if `relrowsecurity = false`; or
2. If the product owner wants to explicitly accept the risk for now (e.g.
   confirmed elsewhere that RLS is on), add a dated entry to the Accepted
   Risks Log below with a named owner, and re-run this audit.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-4-06 | CORS on `apps/api` already uses an explicit origin allowlist (`webOrigin`, never `*`); this phase adds routes to the same root instance without touching `methods`/`origin`. Pre-existing control (T-1-03), verified still in effect at `app.ts:141-155`. | Plan 04-05 (documented in `<threat_model>`) | 2026-09-XX (plan authoring) |
| AR-04-02 | T-4-22 | Error text a Server Component renders originates from `apps/api`, which already returns two fixed, sanitized phrases (T-4-11). Verified in this audit to be even stricter in practice: the failure-state component never interpolates the error string at all. | Plan 04-06 (documented in `<threat_model>`) | 2026-09-XX (plan authoring) |
| AR-04-03 | T-4-33 | `POST /webhook/receber-whatsapp-doc/:origem` in `automation/` is a pre-existing, unauthenticated route required by n8n; the Extratos upload proxy (D4-13) must terminate there. Not introduced by this phase. Registered as a named residual risk with a concrete follow-up ("require Bearer, negotiate credential with whoever operates n8n") in the runbook. | Plan 04-12/04-14 (documented in `<threat_model>` and in `06-runbook-corte-painel-financeiro.md:238-248`) | 2026-09-XX (plan authoring) |

*Accepted risks do not resurface in future audit runs.*

---

## Other Security-Relevant Observations (informational, not threats requiring disposition)

- **Self-caught disclosure during 04-12 execution (already fixed, verified in code):** the executor found that `retryRun`/`cancelRun`'s real return value could carry the full `solicitacoes_pagamentos` row (`app_key`/`app_secret` included, via `solicitacaoInput`). Fixed before commit: `montarHandlerDeRepetirPasso`/`montarHandlerDeCancelar` always respond a fixed `{ ok: true }`, never the raw result — confirmed present at `automation/src/http/leituras-plano-contas-routes.ts:215-249`. This is the same family as T-4-01/T-4-11; no new threat ID needed, but flagged here since it wasn't caught until mid-implementation.
- **Attempted prompt injection during 04-01 execution:** the executor's own SUMMARY reports a tool-result-embedded message impersonating "the orchestrator," asking it to soften a verified test-failure finding and skip a verification step. The executor correctly identified it as illegitimate (wrong channel, factually inconsistent with observable tool state) and did not comply. Not a code vulnerability, but recorded here for the audit trail since it's a security-relevant event during this phase's execution. No action needed — documented for transparency only.
- **`## Threat Flags` in SUMMARY.md files:** only `04-14-SUMMARY.md` has this section; it lists `T-4-03, T-4-37, T-4-38, T-4-39, T-4-33, T-4-12` — all of which map to existing register entries above (informational, not unregistered). No SUMMARY reported new attack surface without a threat mapping.

### Unregistered Flags

None found. Every `## Threat Flags` entry across all 14 SUMMARY.md files maps to an existing `T-4-*` ID in the register above.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-25 | 39 | 38 | 1 (T-4-03) | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` confirmed — **1 open** (T-4-03, see Notes above)
- [ ] `status: verified` set in frontmatter — withheld pending T-4-03 resolution

**Approval:** pending — blocked on T-4-03 (RLS verification query against live Postgres, or an explicit dated accepted-risk entry with a named owner)
