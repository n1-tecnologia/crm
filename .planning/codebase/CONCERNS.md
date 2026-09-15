# Codebase Concerns

**Analysis Date:** 2026-09-15

## Tech Debt

**In-Memory Data State — No Persistence Wired to Frontend:**
- Issue: Every page load rebuilds the entire `DataState` from `buildProductSeed()` in memory. The persistence layer exists (`apps/api/src/persistencia/`) with full hydration, diffing, and write-back capability, but the web frontend (`apps/web/src/dados/store.ts`) doesn't call it yet.
- Files: `apps/web/src/dados/store.ts` (calls `buildProductSeed()` at line 51), `apps/web/src/dados/publico-provider.tsx`, `apps/api/src/persistencia/repositorio.ts` (hydration ready but not called)
- Impact: **Application is a prototype, not a product.** Data is lost on every page reload. Collaborative features are impossible. The migration plan (Phase 1) explicitly addresses this as the first blocking issue.
- Fix approach: Wire `store.ts:criarStore()` to call `apps/api` endpoints for hydration and operation execution instead of running operations in-memory. This is Phase 1 of the migration plan (3–4 weeks, estimated).

**PublicoProvider Maintains Old Singleton Behavior:**
- Issue: Public form routes (`/f/<segredo>`, `/p/<segredo>`) use `PublicoProvider` which hardcodes the Workspace owner as the session Member (`buildProductSeed().workspace.ownerMemberId`). This is the old singleton behavior made visible, not a new pattern. The question of "in whose name does an anonymous form response act?" (A9 in `docs/PENDENCIAS-FRONTEND.md`) remains unresolved — it should probably ignore the session and use `form.ownerMemberId` with a `sistema` Actor instead.
- Files: `apps/web/src/dados/publico-provider.tsx` (lines 18–20)
- Impact: Anonymous form responses are attributed to the Workspace owner, not to a `sistema` Actor or the form's actual owner. Audit trail is misleading for anonymous submissions.
- Fix approach: Decide whether `submitForm` should create a `sistema` Actor entry or use the form owner's Member ID, then update both `PublicoProvider` and the operation in `packages/dominio/src/operations/`.

**TLS Certificate Verification Disabled for Supabase:**
- Issue: `apps/api/src/persistencia/conexao.ts` disables TLS certificate validation (`rejectUnauthorized: false`) for all non-localhost Postgres connections with a comment: "Supabase assina o certificado com uma CA própria que o Node não conhece." The tráfego (traffic) stays encrypted; what's not verified is the server's identity.
- Files: `apps/api/src/persistencia/conexao.ts` (lines 32–35)
- Impact: Vulnerable to man-in-the-middle attacks if Supabase's certificate is intercepted. The code admits it: "Quando a CA da Supabase for fixada no repositório, isto vira `true`."
- Workaround: No active mitigation in place.
- Fix approach: Obtain Supabase's CA certificate and store it in the repo, then set `config.ssl = { ca: readFileSync(...) }` instead of disabling verification. This is a deployment concern, not a development one — likely needs coordination with infrastructure.

## Known Bugs

**Member Reinvitation Breaks When Invited Member Previously Accepted (P2):**
- Symptoms: A Member invited by email (`invitedIdentity` set), who then accepted (and `invitedIdentity` was cleared per B27), and who is later removed from the Workspace — when re-invited by the same email, a new Member record is created instead of reactivating the old one. This violates INV-ET-04.
- Files: `packages/dominio/src/operations/members.ts` (the `inviteMember` operation), the `invitedIdentity` matching logic
- Trigger: 1) Invite a user by email. 2) User accepts and becomes a Member (invitedIdentity cleared). 3) Member is removed. 4) Same user is invited again by email. Expected: same Member reactivated. Actual: new Member created.
- Root cause: The system matches reinvitations by `invitedIdentity`, but once accepted, that field is cleared. The matching should use a `userId` from a global user directory, but that doesn't exist in the prototype — it's a backend feature.
- Workaround: Don't remove accepted Members, or track their original email separately.
- Severity: Blocks the feature of member removal/reinvitation in production until a user directory exists. Noted as **P2 (pending)** in `docs/PENDENCIAS-FRONTEND.md:135–148`.

## Security Considerations

**Session and Authentication Architecture:**
- Risk: The system transitioned from a choosable Membro (old singleton) to a resolved Membro based on Supabase Auth user identity. The new pattern is per-tree (via `StoreProvider`), not per-module, so SSR doesn't leak sessions between requests. However, the `PublicoProvider` still hardcodes the Workspace owner, and there's no validation that the authenticated Supabase user actually has a Member record in the acting Workspace.
- Files: `apps/web/src/dados/sessao-provider.tsx`, `apps/web/src/dados/store.ts`, `apps/api/src/autenticacao/`
- Current mitigation: In-memory prototype, so no actual authentication API is live. Auth is mocked.
- Recommendations: When Phase 1 wires the frontend to the backend, ensure that `/entrar` validates the Supabase user against the Workspace's Member list before setting `session.memberId`. This is mentioned in Phase 1 deliverables: "Supabase Auth / `/entrar` deixa de escolher Membro e passa a autenticar; Membro resolvido pelo Espaço de Trabalho."

**Credentials in Migration Plan:**
- Risk: The migration plan (`docs/08-migracao-financeiro/03-plano-de-migracao.md:199`) lists "Credenciais Omie no histórico do git e por linha em duas tabelas" as a known risk. Omie API credentials are stored in `tenants/marcos-paulo/config.ts` (noted in Phase 0: "Rotação das credenciais Omie do Marcos Paulo — Estão no histórico do git").
- Impact: Omie credentials are discoverable in git history if not rotated.
- Fix approach: Phase 0 of the migration plan schedules "Rotação das credenciais Omie do Marcos Paulo" as a task. Ensure this is done before Phase 2 goes live and the frontend becomes the primary interface.

## Performance Bottlenecks

**Large UI Components — Limited Reactivity:**
- Problem: Several UI files exceed 1,000 lines, which makes them difficult to refactor and reason about:
  - `apps/web/src/features/estrutura/financeiro/contas-view.tsx` — 1,038 lines
  - `apps/web/src/features/crm/conversation-thread.tsx` — 1,246 lines
  - `apps/web/src/app/(shell)/estrutura/tarefas/[tarefa]/page.tsx` — 1,485 lines
  - `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx` — 1,179 lines
- Files: Listed above
- Impact: Harder to test in isolation, higher risk of unintended re-renders, slower to modify.
- Improvement path: Break these into smaller, composable components. The architecture is component-based, but the granularity is coarse. Start with `conversation-thread.tsx` and `contas-view.tsx`, which are business-logic-heavy.

**Full DataState Hydration on Every Operation:**
- Problem: When the persistence layer is wired (Phase 1), every operation will hydrate the entire Workspace state from Postgres (estimated ~900 registros = 475 KB for a typical Espaço). This is acceptable for prototyping but will hit limits if a Workspace grows to thousands of Tasks and Contacts.
- Files: `apps/api/src/persistencia/repositorio.ts` (the `hidratar` function, lines 63–100)
- Impact: Scalability cap around 2,000–3,000 records per Workspace before hydration becomes slow. Comments acknowledge this: "Se um dia um Espaço de Trabalho crescer a ponto de isso doer, a saída é carregar um recorte."
- Improvement path: Defer to Phase 3 or later. When needed, implement selective hydration by loading only the relevant List and its records, not the entire Workspace. The `DataState` format supports this; the loading query just needs a `where` clause.

**In-Memory Seed Generation:**
- Problem: `buildProductSeed()` is called on every page load and every new operation in the web frontend. It generates ~900 records in memory each time.
- Files: `apps/web/src/dados/store.ts:51`, `apps/web/src/dados/publico-provider.tsx:19`, `packages/dominio/src/seed-produto.ts`
- Impact: Negligible in the prototype (seed generation is < 10 ms), but this pattern must not persist once the frontend reads from the database.
- Fix approach: Once Phase 1 wires persistence, remove all `buildProductSeed()` calls from the frontend. Keep them only in tests and the migration script.

## Fragile Areas

**Migration from ClickUp — Adapter Dependency:**
- Files: `packages/dominio/`, `docs/08-migracao-financeiro/` (entire folder), future `adapters/plataforma.ts` in `financeiro-tria` repository
- Why fragile: The plan to migrate the financial backend from ClickUp to the CRM N1 depends on two separate repositories staying in sync. The current `financeiro-tria/automation` backend and the new `crm-n1/apps/api` will have an HTTP interface between them. If the contract diverges (e.g., a Tarefa field is added or removed), the adapter breaks.
- Safe modification: Document the contract between `adapters/plataforma.ts` and the `apps/api` endpoints in a separate spec before Phase 2 begins. The 7 methods (`getTask`, `createComment`, `getCommentReplies`, `updateTaskStatus`, `updateTaskDueDate`, `addTaskTag`, `listPaymentRequestTasks`) are listed in `docs/08-migracao-financeiro/03-plano-de-migracao.md:13–20` but the exact request/response schema is not.
- Test coverage: Phase 2 will need integration tests that exercise the adapter against a running `apps/api` to catch schema drift early.

**Complex Permission Model with No Centralized Validation:**
- Files: `packages/dominio/src/operations/` (all files), `packages/dominio/src/state.ts`, `packages/dominio/src/derive.ts`
- Why fragile: The ontology defines 9 permission concepts (A9.1 in `ontologia/DECISOES-E-PENDENCIAS.md`): (Sujeito, Ação, Recurso, Escopo, Origem). Each operation validates permissions inline, but there's no centralized permission check function. This makes it easy to miss a check or check the wrong thing.
- Safe modification: When adding a new operation, always check against the ontology's permission rules (B1–B100 in the decisions file) **before** implementing. The test suite covers the happy path; permission edge cases need explicit tests.
- Test coverage: The 214 tests in `packages/dominio/src/operations/operations.test.ts` cover the main flows but don't systematically test permission boundaries.

**PublicoProvider and StoreProvider Separation:**
- Files: `apps/web/src/dados/publico-provider.tsx`, `apps/web/src/dados/store.ts`, `apps/web/src/dados/sessao-provider.tsx`
- Why fragile: Public routes and authenticated routes use different providers with slightly different semantics. `PublicoProvider` hardcodes the owner Member; `StoreProvider` is generic. If the semantics of "acting Member" changes (e.g., to support a `sistema` Actor for A9), both providers must be updated in sync.
- Safe modification: Consolidate them into a single provider that accepts a session as a parameter, rather than hardcoding it in `PublicoProvider`. This is a small refactor (~30 lines).
- Test coverage: Routes under `/f/` and `/p/` have no tests today (public routes are not in the test suite).

## Scaling Limits

**Workspace Isolation via Single-Tenant Queries:**
- Current capacity: The system assumes one `workspace_id` per request and filters all queries by it. This is safe and enforces multi-tenancy, but it means every query must include the filter or risk cross-tenant leaks.
- Limit: No architectural issue; the schema enforces it with primary keys like `(workspace_id, colecao, id)`. The risk is operational: a developer forgetting to include `where workspace_id = ...` in a new query.
- Scaling path: Add a comment in `apps/api/src/persistencia/repositorio.ts` and `apps/api/src/rotas/` reminding developers to always filter by `workspace_id`. Consider a lint rule or query builder helper to catch violations.

**Single Workspace Per User Session:**
- Current capacity: The session holds one `memberId`, which implies one Workspace. The ontology allows a User to be a Member of multiple Workspaces (A1.4), but the session doesn't.
- Limit: Switching Workspaces requires logging out and back in.
- Scaling path: Design a Workspace switcher in the UI (not blocking, noted as possible future work).

## Dependencies at Risk

**Zustand Without Server State Persistence:**
- Risk: Zustand is used for client-side state management, but the state is not persisted. Once Phase 1 wires the backend, the store will read from `apps/api`, but there's no plan yet for local caching or offline support.
- Impact: Every navigation or refresh reloads from the server. This is fine for the LAN or cloud use case, but poor for mobile or low-bandwidth scenarios.
- Migration plan: Not addressed in the Phase 1–5 roadmap. Consider adding a cache layer (e.g., IndexedDB) in Phase 4 or later.

**Supabase Tight Coupling:**
- Risk: The system assumes Supabase for both Auth and Postgres. The connection string is in `apps/api/.env`, and the Auth flow is Supabase-specific (`@supabase/supabase-js`).
- Impact: Switching to a different Auth provider or database requires rewriting `apps/api/src/autenticacao/` and the entire pool logic.
- Migration plan: Not a concern for the current roadmap, but worth noting if the product changes deployment strategy.

## Missing Critical Features

**User Directory Not Implemented:**
- Problem: The ontology defines a global Usuário entity (A1.4), but the system doesn't model it. Members are created and removed in isolation. This blocks **P2** (member reinvitation) and makes it impossible to track which email address belongs to which Usuário across Workspaces.
- Blocks: P2, member invitations, multi-workspace users
- Architecture impact: Requires adding a `users` table to the schema and updating the Auth flow to create/link users on first login. This is mentioned as a Phase 1 decision but is deferred.

**No Event Bus / Webhooks Infrastructure:**
- Problem: The migration plan needs `apps/api` to fire webhooks when a Task is created, so that `financeiro-tria/automation` can respond. There's no event infrastructure yet.
- Blocks: Phase 2 of the migration plan
- Architecture: The `apps/api/src/rotas/` endpoints exist, but there's no subscription mechanism for `financeiro-tria` to listen to them. This needs design.

**Automation Engine Not Yet Implemented:**
- Problem: The ontology defines Automations (B38–B100), and the seed includes mock automations (e.g., `seed-financeiro.ts` defines A1–A9 and R1–R7 for the financial domain). But there's no runtime engine to execute them.
- Blocks: Phase 2 and beyond
- Scope: This is listed in the migration plan as a large item: "Motor de Automações (evento + agenda)" with HIGH risk, G (grande) size. It's the infrastructure cost for o CRM N1 to stop being a prototype.

## Test Coverage Gaps

**No Tests for Public Routes:**
- What's not tested: Routes `/f/<segredo>` and `/p/<segredo>` (public form submissions) have no test coverage.
- Files: `apps/web/src/app/` public routes
- Risk: The form submission flow (`submitForm` operation) can break without detection.
- Priority: Medium — this is a customer-facing feature.

**No Permission Edge Case Tests:**
- What's not tested: The 214 tests in `packages/dominio/src/operations/operations.test.ts` cover the happy path but don't systematically test permission rejections (e.g., what happens when a Guest tries to delete a Contato, or when a permission is revoked mid-operation).
- Files: `packages/dominio/src/operations/operations.test.ts`
- Risk: Permission violations may ship undetected.
- Priority: High — the permission model is complex and foundational.

**No Tests for Persistence / Hydration:**
- What's not tested: The `apps/api` persistence layer (`repositorio.ts`, `persistencia.test.ts`) has tests, but they require a live Postgres instance and are skipped in CI if `DATABASE_URL` is not set. Once Phase 1 wires the frontend to the backend, there are no end-to-end tests that load a page, perform an operation, and verify it persisted.
- Files: `apps/api/src/persistencia/persistencia.test.ts`, `apps/web/` (no integration tests with `apps/api`)
- Risk: Sync bugs between the in-memory frontend and Postgres backend can go undetected through Phase 1 and into Phase 2.
- Priority: Critical for Phase 1.

**No Tests for Member Authentication / Session Resolution:**
- What's not tested: The flow from Supabase Auth login to Member resolution has no coverage.
- Files: `apps/api/src/autenticacao/`, `apps/web/src/dados/sessao-provider.tsx`
- Risk: Auth bugs (e.g., wrong Member is loaded) go undetected.
- Priority: Critical for Phase 1.

---

*Concerns audit: 2026-09-15*
