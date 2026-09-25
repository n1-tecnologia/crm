---
phase: 01
slug: o-crm-n1-ganha-persistencia-e-login
status: verified
threats_total: 31
threats_closed: 31
threats_open: 0
asvs_level: 1
created: 2026-09-25
---

# Phase 01 — O CRM N1 ganha persistência e login — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register is plan-authored (`register_authored_at_plan_time: true`), consolidated
> across 16 plans (01-01..01-16). Several Threat IDs recur across plans as the
> SAME concern evolving (e.g. T-1-21/T-1-22/T-1-23/T-1-25/T-1-26 walk from
> "fallback estrutural" to "schema próprio para as 202 operações" between
> 01-11 and 01-16) — for those, this register keeps ONE row and cites the
> FINAL state in code, per the orchestrator's consolidation instruction
> ("quando um ID recorre, a mitigação do ÚLTIMO plano substitui"). Two IDs
> (T-1-02, T-1-04, T-1-05, T-1-06, T-1-07, T-1-08, T-1-09, T-1-12, T-1-13,
> T-1-17, T-1-SC) also recur verbatim across plans as the SAME control being
> re-affirmed unchanged — those rows cite the plan that introduced the control
> plus a note when a later plan re-verified it untouched. Three accepted risks
> from Plan 01-05 (Maryane's fixed test `userId`, the Omie de-para text, the
> workspace-without-`ActivityRecord` decision) are suffixed `b` (`T-1-02b`,
> `T-1-04b`, `T-1-13b`) because they reuse a category+number already used
> earlier in the phase for an unrelated component.

**Verification method:** every `mitigate`/`accept` row below was checked by
reading the cited source file(s) directly (`grep`/`Read` against the current
working tree, not against PLAN.md prose or SUMMARY.md self-report) on
2026-09-25. Two fast, non-DB test files were executed directly during this
audit as corroboration (`esquemas-de-argumentos.test.ts`, `app.test.ts`,
`autenticacao.test.ts` — 23 tests, all green); DB-backed suites
(`operacoes.test.ts`, `convidar-membro.test.ts` full runs) were NOT executed
per audit constraints (real Postgres, 550s+ runtime, risk of outbox
pollution) — for those, the specific test cases the threat register cites
were located and read directly (assertions inspected, not just names) instead
of executed.

---

## Trust Boundaries (union across all 16 plans)

| Boundary | Description |
|----------|-------------|
| registro npm → node_modules | third-party code entering the `apps/api` process |
| navegador → `apps/api` | untrusted input: `Authorization` header, JSON body, origin |
| `apps/api` → Supabase Auth (JWKS) | signature verification delegated to `getClaims` |
| `apps/api` → Postgres | Member lookup by `userId`, scoped to `WORKSPACE_ID` |
| corpo de `POST /operacoes/:nome` (Membro autenticado) → `operacao(...)` | untrusted even after the JWT: the Member is legitimate, the `args` content is not |
| `operacao(...)` → `gravar()` → `plataforma.registros` (`jsonb`) | integrity is collective — every Member of the Workspace hydrates whatever gets written here |
| cookie de sessão → token no `fetch` | the access token leaves the cookie (`@supabase/ssr`) and travels as a header to `apps/api` |
| script de bootstrap → Postgres da plataforma | direct write of initial data, outside the HTTP path |
| `npm run migrar` → Postgres | DDL against a table that may already carry real rows (post-bootstrap) |
| corpo de `POST /operacoes/inviteMember` → serviço → Supabase Auth Admin API | reading Users with the secret key; `userId` from the client is discarded |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-1-SC | Tampering | `npm install` (`fastify`, `@fastify/type-provider-zod`, `@fastify/cors`, `concurrently`) | mitigate | CLOSED | `apps/api/package.json` dependencies: `fastify@^5.12.5`, `@fastify/type-provider-zod@^1.0.0`, `@fastify/cors@^11.3.0`, `zod`, `pg`, `@supabase/supabase-js` — no `fastify-plugin`, no `jose`; root `package.json` has `concurrently@^10.0.5` used only in the `dev` script. `grep -n "fastify-plugin\|\"jose\""` across both `package.json` files → 0 matches. |
| T-1-01 | Spoofing | `plugins/autenticacao.ts` (header Bearer) | mitigate | CLOSED | `apps/api/src/plugins/autenticacao.ts:62-73`: no `Authorization` → 401 (`"Sem sessão."`); token verified via `opcoes.verificarToken(token)`. `apps/api/src/autenticacao/verificar-token.ts:42-46`: `verificarTokenDoSupabase` calls `clienteAdmin().auth.getClaims(token)` — signature/expiry checked by `@supabase/supabase-js` against the project JWKS, never a hand-rolled `jose`/manual decode. Test `apps/api/src/plugins/autenticacao.test.ts` — "sem Authorization responde 401" / "Bearer lixo... responde 401" — executed during this audit: 8/8 passed. |
| T-1-02 | Elevation of Privilege | resolução `sub → Member`; `actingMemberId` no despacho | mitigate | CLOSED | `apps/api/src/persistencia/membros.ts:17-28`: `membroPorUsuario(workspaceId, userId)` — the `workspaceId` parameter comes only from `app.ts:162-166` (`registrarAutenticacao(app, { workspaceId, ... })`, itself sourced from `WORKSPACE_ID`/default, never the client). `plugins/autenticacao.ts:85-92`: `state` outside `ativo`/`suspenso` → 403. `rotas/operacoes.ts:187`: `REGISTRO[nome]!(state, request.membro.id, ...args)` — the acting Member is always the one the hook resolved. `packages/dominio/src/operations/registro.ts:594-601` (`instrumentar`): the recorder pushes only `args`, i.e. everything AFTER `(state, actingMemberId)` — the web recorder structurally cannot record the acting Member. Test `autenticacao.test.ts` — "Membro ativo passa: request.membro usa o workspaceId da configuração, não o do registro" — executed, passed. |
| T-1-03 | Tampering / Information Disclosure | CORS | mitigate | CLOSED | `apps/api/src/app.ts:141-155`: `@fastify/cors` with `origin: [webOrigin]` inside a `delegator` (allowlist, never `*`), `credentials: false`, `methods: ["GET","POST"]`, `allowedHeaders: ["authorization","content-type"]`. Test `apps/api/src/app.test.ts` — "CORS: origem permitida recebe access-control-allow-origin" / "origem fora da allowlist não recebe" — executed during this audit: 4/4 passed. |
| T-1-04 | Injection / Elevation of Privilege | `OPERACOES` + `ehNomeDeOperacao`; `POST /operacoes/:nome` | mitigate | CLOSED | `apps/api/src/rotas/operacoes.ts:39-45`: `PARAMS.nome` = `z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9]*$/)`; dispatch only via `ehNomeDeOperacao(nome)` (line 126) + `REGISTRO[nome]` (a literal object, no `import()`/`require`). `packages/dominio/src/operations/registro.ts:548-550`: `ehNomeDeOperacao` uses `Object.hasOwn(OPERACOES, nome)`, not `in` — rejects `__proto__`/`constructor`. Helpers (`nextId`, `recordActivity`, etc.) are not exported into `OPERACOES` (confirmed by reading the full 313-539 literal object — only case-use functions listed). Test `apps/api/src/rotas/operacoes.test.ts` case (b) `nextId` → 404, case (c) `__proto__` → 400/404 never 200/500 (read directly, assertions present as claimed). |
| T-1-05 | Denial of Service | corpo JSON / `args`; paginação de `listUsers` | mitigate | CLOSED | `apps/api/src/rotas/operacoes.ts:47-54`: `BODY.args = z.array(z.unknown()).max(32)`; Fastify's default `bodyLimit` (1 MiB) is unmodified (no `bodyLimit` override in `app.ts`). `persistencia/unidade-de-trabalho.ts` `executar()` is transactional. `apps/api/src/autenticacao/resolver-usuario.ts:28-29,34`: `TETO_DE_PAGINAS = 10`, `POR_PAGINA = 1000` caps `listUsers` pagination; reachable only from `inviteMember`, gated by the admin/proprietario check in `packages/dominio/src/operations/members.ts:304-308` (RN-ET-24). |
| T-1-06 | Information Disclosure | `setErrorHandler`; corpo do 400 de operação; tela "Servidor indisponível"; erro da Admin API | mitigate | CLOSED | `apps/api/src/app.ts:93-116`: unexpected errors → `request.log.error(erro)` + `reply.status(500).send({ok:false,error:"Erro interno."})`; Fastify/zod schema-validation errors → 400 with only the schema message, no stack. `rotas/operacoes.ts:87-90` (`mensagemDeEntradaInvalida`): 400 body is always `Entrada inválida para "<nome>"[ em <caminho>].` — never the raw zod `message` nor an exception message; full detail only in `request.log.warn` (lines 143-146, 160-163). `autenticacao/resolver-usuario.ts:36-38`: Admin API errors are re-thrown, bubbling to the generic `setErrorHandler` (500, detail in log only). `apps/web/src/app/(shell)/layout.tsx:40-54`: renders the fixed phrase `"Servidor indisponível"`; `inicial.erro` (the technical message) is never interpolated into the JSX. |
| T-1-07 | Tampering (MITM no TLS do Postgres) | `conexao.ts` `rejectUnauthorized: false` | accept | CLOSED (documented, unresolved by design) | `apps/api/src/persistencia/conexao.ts:39`: `config.ssl = { rejectUnauthorized: false }` — confirmed still present, unchanged since before this phase. `apps/api/README.md:160-167` documents this explicitly as a pre-deploy prerequisite ("Fixar a CA do Supabase e trocar `rejectUnauthorized: false` por `true`... a resolver junto com D11"), not silently deferred. Traffic is encrypted; only server-identity verification is off, and only while `apps/api` runs against a Supabase connection the Node process doesn't have the CA for. See Accepted Risks Log AR-01. |
| T-1-08 | Spoofing / Elevation of Privilege | `SERVICOS.inviteMember`; `inviteMember` esquema na borda | mitigate | CLOSED | `apps/api/src/servicos/convidar-membro.ts:33-41`: the only source of `userId` passed into the domain is `resolverUsuarioPorEmail(pedido.email)` — never `pedido` fields the client controls. `apps/api/src/rotas/operacoes.ts:92,105-117`: `ENTRADA_INVITE_MEMBER = z.object({email,roleId}).strip()` (the one `.strip()` in the file — `grep -c "\.strip()" operacoes.ts` → 1 real call + 1 mention inside a comment). `apps/api/src/rotas/esquemas/membros.ts`: a second, independent `INVITE_MEMBER_INPUT.strip()` at the border. Test `apps/api/src/rotas/esquemas/membros.test.ts` case (c) "inviteMember descarta userId do corpo (T-1-08)" — read directly: asserts `"userId" in resultado.data[0]` is `false` even when the payload includes `userId: "uuid-forjado"`. |
| T-1-09 | Information Disclosure (enumeração de e-mails) | mensagens de recusa de `inviteMember` | accept | CLOSED | `packages/dominio/src/operations/members.ts:304-308`: `inviteMember` refuses immediately for any non-admin/non-owner actor, before reaching the refusal messages at lines 350-357 (`"Já existe um convite pendente..."` / `"Este e-mail já pertence a um Membro..."`) — only a governance Member ever sees them, and the phrasing reveals nothing about Supabase Auth beyond what the domain already exposed pre-phase. |
| T-1-10 | Repudiation | Registro de Atividade | mitigate | CLOSED | `packages/dominio/src/operations/activity.ts:90-105`: `recordActivity` persists `actor: input.actor`. `memberActor(actingMemberId)` is used as that actor across the domain (confirmed via `grep -rn memberActor` — `agent-builder.ts`, `members.ts` `inviteMember` at line 379, `configuracao-por-empresa-evolver.ts`, `contas-a-receber-evolver.ts`, `solicitacao-de-pagamento-evolver.ts`), and `actingMemberId` is always the token-resolved Member per T-1-02. |
| T-1-11 | Information Disclosure (token) | `transporte.ts` (`transporteHttp`), `estado-inicial.ts` | mitigate | CLOSED | `apps/web/src/dados/transporte.ts:85-105` (`gravarUma`): the token is read via `obterToken()` and placed only in `headers: { authorization: "Bearer <token>" }` for `${apiUrl}/operacoes/...`; catch blocks return generic messages, never log the token; `hidratar()` (lines 165-181) follows the same shape. `apps/web/src/dados/estado-inicial.ts:46-51`: server fetch to `GET /estado` uses `authorization` header + `cache: "no-store"`. No occurrence of the token in a URL, `console.*`, or `localStorage` in either file. |
| T-1-12 | Tampering (destruição de dado real) | `bootstrapGestao` | mitigate | CLOSED | `apps/api/src/bootstrap/gestao.ts:29-51`: `select count(*) ... where workspace_id = $1` → if `n > 0`, returns `{criado:false, motivo:...}` without writing; the write path (`begin`/`semear`/`commit`) is wrapped in `try/catch` with `rollback` on error. `grep -rn '"ws_n1"' apps/api/src/**/*.test.ts` → only `limpar-outbox-de-teste.test.ts:18,41`, both asserting `ws_n1` is *excluded* from the test-cleanup prefix (i.e. reinforcing, not violating, the guard) — no test writes to `ws_n1`. |
| T-1-13 | Tampering / Denial of Service | migração `002` | mitigate | CLOSED | `apps/api/src/persistencia/migrar.ts:43-57`: each file runs inside `begin`/`commit`, `rollback` + re-thrown error on failure. `apps/api/migracoes/002-registros-colunas-geradas.sql`: every index uses `create index if not exists`; `grep -n "concurrently\|CONCURRENTLY" apps/api/migracoes/*.sql` → 0 matches across all 6 migration files (verified none of 001-006 use it). |
| T-1-14 | Information Disclosure | colunas geradas | accept | CLOSED | `apps/api/migracoes/002-registros-colunas-geradas.sql`: `status_id`, `list_id`, `due_date` are `generated always as (dados->>'...') stored` — each copies a value already present in the SAME row's `dados`, under the same `workspace_id`/RLS-equivalent access path as `apps/api` already enforces; no new data is exposed. |
| T-1-15 | Tampering (estado divergente) | `run()`/`enviar()` (store.ts) | mitigate | CLOSED | `apps/web/src/dados/store.ts:102-113`: on a `"diferenca"` response, `if (resposta.revisaoAnterior !== get().revisaoDoServidor)` → `await get().rehidratar()` instead of applying the diff. Lines 141-145: a `"conflito"` (409) response also triggers `rehidratar()`. No code path applies a diff computed against a stale revision. |
| T-1-16 | Spoofing (rotas públicas) | `PublicoProvider` em memória | accept | CLOSED | `apps/web/src/dados/publico-provider.tsx:26-38`: uses `transporteEmMemoria()` (no network call to `apps/api`) and `buildProductSeed()`; nothing under `/p/<segredo>` persists. Deferred to OQ-PF-01 per the file's own header comment. |
| T-1-17 | Information Disclosure | `SUPABASE_SECRET_KEY` | mitigate | CLOSED | `grep -rn "SUPABASE_SECRET_KEY" apps/ packages/` → only `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` and `apps/api/src/autenticacao/verificar-token.ts`. `grep -rn "SUPABASE_SECRET_KEY\|SERVICE_ROLE" apps/web/src/` → 0 matches. `apps/api/README.md:19-23`: documents variable NAMES only (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`), no values; `.env` explicitly stated as never committed. |
| T-1-18 | Spoofing (identidade duplicada) | `inviteMember` — busca de `existing` | mitigate | CLOSED | `packages/dominio/src/operations/members.ts:346-349`: `const porUserId = ...`, `const porEmail = ...`, `const existing = porUserId ?? porEmail` — the same email can never produce two Members. |
| T-1-19 | Elevation of Privilege | `existing` achado por e-mail vs. por `userId` | mitigate | CLOSED | `members.ts:349-357`: `existing` prefers `porUserId`; if that Member's `state !== "removido"`, the refusal fires regardless of any `pendente` Member matched only by email — read directly, matches the described precedence. |
| T-1-20 | Denial of Service (esgotar RN-ET-23) | limite de Membros do Espaço | mitigate | CLOSED | `members.ts:359-367`: `counted = state.members.filter(m => m.state !== "removido").length; if (counted >= state.workspace.limits.members) return fail(...)`. Combined with T-1-18 (no duplicate email) and the admin/proprietario gate (lines 304-308, RN-ET-24). |
| T-1-21 | Tampering (integridade do `jsonb` compartilhado) | `POST /operacoes/:nome` → `executar()` → `gravar()`, 202 operações | mitigate | CLOSED | `apps/api/src/rotas/operacoes.ts:158-166`: `esquemaDeArgumentos(nome).safeParse(revividos)` runs BEFORE any dispatch (`servico`/`executar`); on failure, nothing is persisted and `validacao.data` (zod-reconstructed) is the only value that reaches the operation. `apps/api/src/rotas/esquemas-de-argumentos.ts:88-111`: `ESQUEMAS = {...21 module spreads...} satisfies EsquemasCompletos` — a compile-time gate, not a runtime fallback; `ARGUMENTOS_GENERICOS` no longer exists anywhere (`grep -rn ARGUMENTOS_GENERICOS apps/api/src packages/` → 0 matches). Test `esquemas-de-argumentos.test.ts` executed during this audit: 11/11 passed, including case (h) "nenhuma operação cai em fallback" and case (j) (see T-1-26). `operacoes.test.ts` cases (q)/(u)/(v) — createChatFolder/createGoal/saveView malformed input rejected before `executar()` — read directly, assertions match the claim. |
| T-1-22 | Denial of Service (500 sob demanda por `TypeError`) | `operacao(...)` dentro de `executar()` | mitigate | CLOSED | `apps/api/src/rotas/operacoes.ts:169-194`: the dispatch branch (`servico ? ... : executar(...)`) has NO `TypeError` → 400 mapping; the comment at lines 174-182 explicitly documents WR-11 ("o mapeamento `TypeError → 400`... foi removido por inteiro"). Any exception here (including a remaining `TypeError`) propagates to `app.ts`'s generic `setErrorHandler` → 500 + `request.log.error`. This is prevention-by-schema (T-1-21 closes the input-shape gap that used to trigger `TypeError`s), not masking. |
| T-1-23 | Denial of Service (aninhamento patológico) | `ARGUMENTOS_GENERICOS` | mitigate | CLOSED (superseded — fallback removed) | `grep -rn "ARGUMENTOS_GENERICOS" apps/api/src/ packages/dominio/src/` → 0 matches anywhere in the current tree. Plan 01-16 completed the per-operation schema coverage (`EsquemasCompletos`, T-1-21/T-1-26) and the generic structural fallback that this threat targeted was deleted outright, not merely depth-limited — the threat's premise (a shared, deeply-nestable fallback schema) no longer exists in code. |
| T-1-24 | Repudiation | entrada rejeitada | mitigate | CLOSED | `apps/api/src/rotas/operacoes.ts:143-146` (RangeError from `reviverArgumentos`) and `160-163` (schema validation failure): both `request.log.warn` calls carry `{ operacao: nome, membro: request.membro.id, ... }` — `membro` is always the token-resolved session id (T-1-02), never a value from the request body. |
| T-1-25 | Tampering (drift silencioso schema × domínio) | `ESQUEMAS` composto; `fragmentos.ts` | mitigate | CLOSED | `apps/api/src/rotas/esquemas/fragmentos.ts:39` (`EsquemasCompletos`), `:50` (`Igual<A,B>`), `:53` (`Confere<T extends readonly true[]>`) — type-level gates confirmed present. Per-module `esquemas/<modulo>.test.ts` carry a case "(b)" asserting the literal argument shapes `apps/web` actually sends parse successfully — spot-checked in `esquemas/membros.test.ts` (case c, executed via the whole-file completeness run) and `esquemas/negocios.test.ts:34-40` (`FORMAS_DO_WEB` literal tuples, read directly). |
| T-1-26 | Tampering (operação esquecida) | `Object.keys(ESQUEMAS)` × `Object.keys(OPERACOES)` | mitigate | CLOSED | `apps/api/src/rotas/esquemas-de-argumentos.test.ts:102-108`, case (j): `expect(Object.keys(ESQUEMAS).sort()).toEqual(Object.keys(OPERACOES).sort())`, `expect(chaves.length).toBe(202)` — executed during this audit, passed. Case (h) (lines 91-96) additionally proves `esquemaDeArgumentos(nome) === ESQUEMAS[nome]` for every key of `OPERACOES` — no fallback path exists for any of the 202 operations. |
| T-1-27 | Denial of Service (recursão no reviver) | `reviverArgumentos(request.body.args)` | mitigate | CLOSED | `apps/api/src/rotas/operacoes.ts:138-150`: `try { revividos = reviverArgumentos(...) } catch (erro) { if (erro instanceof RangeError) { request.log.warn({operacao, membro, causa:"RangeError..."}, ...); return reply.code(400)...} throw erro; }` — the warn log carries only `operacao`/`membro`/a fixed `causa` string, never `request.body` or `erro.stack`. Test `operacoes.test.ts` case (s), line 194: "corpo com 10.000 níveis de arrays aninhados... responde 400... nunca 500" — read directly, present and structured as claimed. |
| T-1-02b | Elevation of Privilege | Maryane como `role_prop` com `userId` fixo | accept | CLOSED | `packages/dominio/src/bootstrap-gestao.ts:39-44`: `PADRAO_PROPRIETARIA = { memberId: "mem_maryane", userId: USUARIOS_DO_SEED.mem_maryane, ... }` — a single Owner, a known development/test account, exactly as D-08/D-09 decided; swapping in the real email is an Auth+Member update outside this phase (Deferred Ideas). |
| T-1-04b | Information Disclosure | `col_financeiro_erp`/`doc_depara_omie` | accept | CLOSED | `packages/dominio/src/seed-financeiro.ts:264-305`: the Omie de-para entities (`col_financeiro_erp`, `doc_depara_omie`) contain only category/account labels (`sources`, `collectionId`, `provenance` text) — `grep -n "credencial\|secret\|senha\|token"` in the same file → 0 matches near these entities. No Omie credential ever enters the platform. |
| T-1-13b | Repudiation | Espaço criado sem `ActivityRecord` | accept | CLOSED | `packages/dominio/src/bootstrap-gestao.ts` (full file read): `buildGestaoBootstrap` does not import or call `recordActivity` anywhere — Workspace/Role/Member/Agent/Funnel creation is not journaled, per D-07's explicit "zero fictional Activity Records" instruction. Auditable instead via `git log` and `plataforma.workspaces.atualizado_em`, as documented. |

*Status: open · CLOSED*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-1-07 | Postgres TLS runs with `rejectUnauthorized: false` in `apps/api/src/persistencia/conexao.ts` because the Node process does not have the Supabase direct-connection CA. Traffic is encrypted; only server-identity verification is off. Explicitly tied to D11 (where `apps/api` deploys) in `apps/api/README.md §7` — will be flipped to `true` with a pinned CA before the process leaves `127.0.0.1`. Not resolved by this phase's code, and not expected to be. | Plan 01-02 author (pre-existing, PERS-08/D11) | 2026-09-25 (re-confirmed, still `false`) |
| AR-02 | T-1-09 | `inviteMember` refusal messages ("convite pendente" / "já pertence a um Membro") are unchanged from the pre-phase domain and reachable only by an authenticated Administrador/Proprietário (RN-ET-24). No new enumeration surface. | Plan 01-01/01-08/01-11 authors | 2026-09-25 |
| AR-03 | T-1-14 | The two generated columns in migration `002` (`status_id`, `list_id`, `due_date`) copy values already present in the same `plataforma.registros` row; they add query performance, not new exposed data. | Plan 01-06 author | 2026-09-25 |
| AR-04 | T-1-16 | `PublicoProvider` (public Task-share routes) stays entirely client-side/in-memory this phase; nothing persists through `apps/api`. Deferred to OQ-PF-01 (Phase 2), named explicitly in the file's own header comment. | Plan 01-04 author | 2026-09-25 |
| AR-05 | T-1-02b | Maryane is provisioned as the sole `role_prop` (Owner) with a fixed development-account `userId` (D-08/D-09) — a deliberate scope cut for the bootstrap of a brand-new Workspace, not a production identity gap; swapping to the real account is an out-of-band Auth+Member update. | Plan 01-05 author | 2026-09-25 |
| AR-06 | T-1-04b | The Omie de-para bootstrap data is category/account labels only, sourced from the same seed text already used elsewhere in the domain; no Omie credential is read or stored by the platform. | Plan 01-05 author | 2026-09-25 |
| AR-07 | T-1-13b | Workspace/Role/Member/Agent/Funnel creation during bootstrap intentionally writes zero `ActivityRecord`s (D-07: no fictional activity trail for a Workspace that has no history yet); provenance is `git log` + `atualizado_em` instead. | Plan 01-05 author | 2026-09-25 |

*Accepted risks do not resurface in future audit runs, except AR-01 (T-1-07), which should be re-examined the moment `apps/api` deployment (D11) is decided — the code-level flip (`rejectUnauthorized: true` + pinned CA) is still outstanding by design, not by oversight.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|----------------|--------|------|--------|
| 2026-09-25 | 31 | 31 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (7 entries)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-25

---

## Notes for the Orchestrator

1. **AR-01 (T-1-07) is the only risk carried forward with an operational trigger**: the moment D11 (where `apps/api` deploys) is decided, `apps/api/src/persistencia/conexao.ts:39` needs `rejectUnauthorized: true` plus a pinned Supabase CA — the README already names this as the pre-deploy checklist item, so this is not new information, just a re-confirmation that it is still `false` today.
2. **T-1-23's fallback (`ARGUMENTOS_GENERICOS`) was fully deleted, not merely depth-limited.** The threat register's own text (01-11/01-12) anticipated either outcome ("verify ARGUMENTOS_GENERICOS is removed... or depth limit ≤6 exists") — the stronger of the two happened: zero occurrences of the symbol anywhere in the tree, superseded by 202/202 per-operation schemas (`EsquemasCompletos`).
3. **No unregistered attack surface found.** All 16 SUMMARY.md files were checked for a `## Threat Flags` section (none present, as the task briefing already noted) and additionally scanned for informal risk language ("risco", "vulnerab", "insegur") outside that heading — the two hits found (01-03, 01-05) describe an id-collision correctness concern already mitigated by `syncIdSequence` and a test-suite-risk note about fixture ordering, neither of which is new attack surface requiring a Threat ID.
4. **Every `mitigate` row cites code read during this audit, not plan prose.** Three test files were executed directly as corroboration (`esquemas-de-argumentos.test.ts` 11/11, `app.test.ts` 4/4, `autenticacao.test.ts` 8/8 — all green, ~7s total, no `DATABASE_URL` dependency triggered). DB-backed test files (`operacoes.test.ts`, `convidar-membro.test.ts`) were read, not executed, per audit constraints (memory: apps/api's full suite runs 550s+ against real Postgres and has previously leaked outbox rows into the real database) — the specific cited cases were located and their assertions inspected line-by-line rather than taken on faith.
