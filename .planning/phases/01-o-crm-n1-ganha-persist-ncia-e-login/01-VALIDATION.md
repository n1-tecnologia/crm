---
phase: 1
slug: o-crm-n1-ganha-persist-ncia-e-login
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 nos três workspaces |
| **Config file** | `apps/api/vitest.config.mts` (timeouts de 60 s para Postgres) · `apps/web/vitest.config.mts` · `packages/dominio/vitest.config.mts` |
| **Quick run command** | `npm run test -w @n1/api` / `npm run test -w @n1/web` / `npm run test -w @n1/dominio` — conforme o workspace tocado |
| **Full suite command** | `npm run check` (typecheck + lint + tokens + testes nos três workspaces) |
| **Estimated runtime** | ~15 s sem `DATABASE_URL` (integração pula); ~40 s com o Supabase real (cada ida e volta custa ~234 ms) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -w <workspace tocado>` + `npm run typecheck -w <workspace tocado>`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green **e** a prova hidratado ≡ seed valendo contra o Supabase real (`DATABASE_URL` definido)
- **Max feedback latency:** 45 segundos

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | PERS-04 | T-1-SC | `fastify` conferido por pessoa antes do `npm install` | checkpoint (blocking-human) | `npm view fastify repository.url` contém `fastify/fastify` | n/a | ⬜ pending |
| 1-03-01 | 03 | 1 | PERS-04, PERS-05 | T-1-04 | `OPERACOES` explícito; `ehNomeDeOperacao` por `Object.hasOwn` (rejeita `__proto__`) | unit (domínio) | `npm run test -w @n1/dominio` — `src/operations/registro.test.ts` | ❌ criado na task | ⬜ pending |
| 1-03-02 | 03 | 1 | PERS-04, PERS-05 | — | N/A | unit (domínio) | `npm run test -w @n1/dominio -- src/operations/id-sequence.test.ts src/diferenca.test.ts` | ❌ criado na task | ⬜ pending |
| 1-06-01 | 06 | 1 | PERS-07 | T-1-13 | SQL sem `concurrently` (roda em transação), índices parciais | static | `grep -c "generated always as"` = 3; `grep -c "create index if not exists"` = 6; sem `concurrently` | ❌ criado na task | ⬜ pending |
| 1-06-02 | 06 | 1 | PERS-07 | T-1-13 | [BLOCKING] migração aplicada uma vez, registrada | infra | `npm run migrar -w @n1/api` → `aplicada 002-…` ou `Nada a aplicar` | n/a | ⬜ pending |
| 1-06-03 | 06 | 1 | PERS-07 | — | N/A | integration (Postgres real) | `npm run test -w @n1/api -- src/persistencia/colunas-geradas.test.ts src/persistencia/persistencia.test.ts` | ❌ criado na task | ⬜ pending |
| 1-02-01 | 02 | 2 | PERS-04 | T-1-03, T-1-06 | CORS por allowlist; 500 sem stack; 404 JSON | integration (`app.inject`, sem banco) | `npm run test -w @n1/api -- src/app.test.ts` | ❌ criado na task | ⬜ pending |
| 1-02-02 | 02 | 2 | PERS-04 | T-1-01, T-1-02 | Sem `Authorization` → 401; token inválido → 401; não-Membro/removido → 403 | integration (`app.inject`, stubs) + Postgres (bloco `temBanco`) | `npm run test -w @n1/api -- src/plugins/autenticacao.test.ts src/app.test.ts` | ❌ criado na task | ⬜ pending |
| 1-02-03 | 02 | 2 | PERS-04 | — | N/A | static + manual | `node -e` (scripts `dev` com concurrently) + greps em `.env.example`/CONTEXT.md | n/a | ⬜ pending |
| 1-07-01 | 07 | 2 | PERS-05 | T-1-11 | Token só em `authorization` para `apiUrl`; nunca em log | unit (`vi.stubGlobal("fetch")`) | `npm run test -w @n1/web -- src/dados/transporte.test.ts` | ❌ criado na task | ⬜ pending |
| 1-07-02 | 07 | 2 | PERS-05 | T-1-15 | Recusa do domínio nunca dispara `fetch` (D-05); `revisaoAnterior` divergente/409 → re-hidrata (D-06) | unit (transporte falso) | `npm run test -w @n1/web -- src/dados/store.test.ts` | ❌ criado na task | ⬜ pending |
| 1-07-03 | 07 | 2 | PERS-05 | — | N/A | typecheck + lint + tokens + manual | `npm run typecheck -w @n1/web && npm run lint -w @n1/web && npm run verificar:tokens -w @n1/web && npm run test -w @n1/web` | n/a | ⬜ pending |
| 1-04-01 | 04 | 3 | PERS-04 | — | N/A | integration (Postgres real) | `npm run test -w @n1/api -- src/persistencia/persistencia.test.ts` (4 testes de PERS-01, com `.length` e `revisao`) | ✅ existe (ajustado) | ⬜ pending |
| 1-04-02 | 04 | 3 | PERS-04 | T-1-04, T-1-02 | 404 para nome fora do registro/`__proto__`; Membro da sessão injetado; recusa em 200 | integration (`app.inject`; blocos com e sem banco) | `npm run test -w @n1/api -- src/rotas/operacoes.test.ts src/rotas/estado.test.ts` | ❌ criado na task | ⬜ pending |
| 1-05-01 | 05 | 3 | PERS-06 | — | N/A | unit (domínio — os 214 intactos) | `npm run test -w @n1/dominio` + `git diff --stat` vazio nos 3 test files originais | ✅ existe | ⬜ pending |
| 1-05-02 | 05 | 3 | PERS-06 | — | N/A | unit (domínio, puro) | `npm run test -w @n1/dominio -- src/bootstrap-gestao.test.ts` | ❌ criado na task | ⬜ pending |
| 1-05-03 | 05 | 3 | PERS-06 | T-1-12 | Bootstrap recusa Espaço não vazio (segunda execução não grava) | integration (Postgres real) | `npm run test -w @n1/api -- src/bootstrap/gestao.test.ts` | ❌ criado na task | ⬜ pending |
| 1-08-01 | 08 | 4 | PERS-09 | — | N/A | unit (domínio, arquivo novo) | `npm run test -w @n1/dominio` — `src/operations/members-reconvite.test.ts` | ❌ criado na task | ⬜ pending |
| 1-08-02 | 08 | 4 | PERS-09 | T-1-08 | `userId` do cliente descartado; e-mail resolvido no servidor (Admin API) | integration (Postgres; Auth quando `SUPABASE_*`) | `npm run test -w @n1/api` — `src/servicos/convidar-membro.test.ts`, `src/autenticacao/resolver-usuario.test.ts` | ❌ criado na task | ⬜ pending |
| 1-09-01 | 09 | 5 | Critério 1 (PERS-01/02/04/05/06) | T-1-12 | Só `ws_e2e_teste` é tocado | integration ponta a ponta (`inject`) | `npm run test -w @n1/api -- src/e2e/criar-conta.test.ts` | ❌ criado na task | ⬜ pending |
| 1-09-02 | 09 | 5 | Critério 4; PERS-08 (documental) | — | N/A | full suite | `npm run check` (sem e com `DATABASE_URL`) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs alinhados aos PLAN.md 01-01..01-09 (2026-09-16). Não há plano "Wave 0" separado: cada arquivo de teste nasce na mesma task que implementa o comportamento, e toda task tem `<automated>` — nenhuma task referencia um teste que ainda não existe. PERS-08 não tem teste: é item documental bloqueado por D11.*

---

## Wave 0 Requirements

Cada pré-requisito de teste nasce na task que o usa (não há plano de scaffolding separado):

- [ ] `apps/api/src/app.ts` — `buildApp()` sem `listen()` → Plan 01-02 Task 1 (pré-requisito de todo `app.inject`)
- [ ] `apps/api/src/app.test.ts` e `apps/api/src/plugins/autenticacao.test.ts` → Plan 01-02 Tasks 1–2 (401/403 sem infraestrutura)
- [ ] `packages/dominio/src/operations/registro.test.ts`, `id-sequence.test.ts`, `diferenca.test.ts` → Plan 01-03
- [ ] `apps/api/src/rotas/operacoes.test.ts`, `estado.test.ts` → Plan 01-04 Task 2 (PERS-04)
- [ ] `apps/web/src/dados/transporte.test.ts`, `store.test.ts` → Plan 01-07 Tasks 1–2 (PERS-05; transporte falso em vez de mock de `fetch` no store)
- [ ] `packages/dominio/src/bootstrap-gestao.test.ts` (puro) e `apps/api/src/bootstrap/gestao.test.ts` (Postgres) → Plan 01-05 (PERS-06)
- [ ] `apps/api/src/persistencia/colunas-geradas.test.ts` → Plan 01-06 Task 3 (PERS-07; padrão `temBanco ? describe : describe.skip`)
- [ ] `packages/dominio/src/operations/members-reconvite.test.ts`, `apps/api/src/servicos/convidar-membro.test.ts`, `apps/api/src/autenticacao/resolver-usuario.test.ts` → Plan 01-08 (PERS-09)
- [ ] `apps/api/src/e2e/criar-conta.test.ts` → Plan 01-09 Task 1 (critério 1 do ROADMAP; fecha a lacuna "sem teste ponta a ponta tela → Postgres")
- [ ] Sem instalação de framework de teste: vitest já está nos três workspaces

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A recusa aparece **na hora** na tela, sem indicador de rede | PERS-05 / D-05 | Percepção de latência não é assertável por `inject` | Logar como `maryane@n1.teste`, abrir Contas a pagar, tentar mover uma conta para `pago` (RN-CP-04 recusa): o erro aparece sem spinner |
| Ao recarregar a página, a Conta criada continua lá | Critério 1 | O teste e2e prova pelo `GET /estado`; a tela de verdade precisa de um olho | Criar uma Conta pela tela, F5, confirmar |
| Login com `maryane@n1.teste` e senha de desenvolvimento entra; `tiago@n1.teste` (removido no seed) **não entra** no Espaço bootstrapado — porque ele nem existe lá | PERS-02 / D-08 | Fluxo de cookie no navegador | Entrar com cada um; o segundo vê "Sem acesso" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-16 (plan-checker: dimensões 8a–8d satisfeitas pelos 9 planos; `wave_0_complete` vira `true` quando a onda 0 rodar)
