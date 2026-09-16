---
phase: 1
slug: o-crm-n1-ganha-persist-ncia-e-login
status: draft
nyquist_compliant: false
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
| 1-W0-01 | 01 | 0 | PERS-04 | — | N/A | infra | `apps/api/src/app.ts` separa montagem de `listen()` | ❌ W0 | ⬜ pending |
| 1-01-01 | 01 | 1 | PERS-04 | T-1-01 | Sem `Authorization` → 401; token inválido → 401 | integration (`app.inject`) | `npm run test -w @n1/api -- plugins/autenticacao.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | PERS-04 | T-1-02 | Membro sem acesso ao registro → recusa do domínio, nunca 500 | integration (`app.inject`) | `npm run test -w @n1/api -- rotas/operacoes.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | PERS-04 | — | N/A | integration | `POST /operacoes/:nome` devolve `OperationResult` + diff + revisão (D-03) | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | PERS-05 | — | N/A | unit (spy em `fetch`) | `npm run test -w @n1/web -- dados/store.test.ts` — recusa do domínio nunca dispara `fetch` (D-05) | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 2 | PERS-05 | — | N/A | unit | mesmo arquivo — diff aplicado preserva a ordem fracionária | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | PERS-06 | — | N/A | integration (Postgres real) | `npm run test -w @n1/api -- bootstrap/gestao.test.ts` — Espaço vazio → Lista "Contas a pagar" sem Tarefas; só a Maryane, Proprietária | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | PERS-07 | — | N/A | integration (Postgres real) | `npm run test -w @n1/api -- persistencia/colunas-geradas.test.ts` — migração `002` aplicada; filtros usam índice | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 3 | PERS-09 | T-1-03 | Reconvite nunca cria segundo Membro; e-mail resolvido no servidor, não confiado do cliente | unit (domínio) + integration | `npm run test -w @n1/dominio -- members` + `npm run test -w @n1/api -- autenticacao/resolver-usuario.test.ts` | Parcial | ⬜ pending |
| 1-05-01 | 05 | 3 | Critério 1 | — | N/A | integration ponta a ponta | `npm run test -w @n1/api -- e2e/criar-conta.test.ts` — `inject POST /operacoes/createTask` → `inject GET /estado` → a Tarefa está lá | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Os Task IDs acima são provisórios — o planejador renumera conforme os PLAN.md que criar; o que não muda é a cobertura: todo PERS-* tem ao menos um teste automatizado.*

---

## Wave 0 Requirements

- [ ] `apps/api/src/app.ts` — montagem do Fastify separada de `listen()` (pré-requisito de todo `app.inject`)
- [ ] `apps/api/src/rotas/operacoes.test.ts` — stubs para PERS-04
- [ ] `apps/api/src/plugins/autenticacao.test.ts` — stubs para D-02 (401/403)
- [ ] `apps/web/src/dados/store.test.ts` — stubs para PERS-05 (não existe teste de `store.ts` hoje)
- [ ] `apps/api/src/bootstrap/gestao.test.ts` — stubs para PERS-06
- [ ] `apps/api/src/persistencia/colunas-geradas.test.ts` — stubs para PERS-07 (reaproveita `temBanco ? describe : describe.skip` de `persistencia.test.ts`)
- [ ] `apps/api/src/e2e/criar-conta.test.ts` — stub para o critério de sucesso 1 do ROADMAP
- [ ] Sem instalação de framework: vitest já está nos três workspaces

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A recusa aparece **na hora** na tela, sem indicador de rede | PERS-05 / D-05 | Percepção de latência não é assertável por `inject` | Logar como `maryane@n1.teste`, abrir Contas a pagar, tentar mover uma conta para `pago` (RN-CP-04 recusa): o erro aparece sem spinner |
| Ao recarregar a página, a Conta criada continua lá | Critério 1 | O teste e2e prova pelo `GET /estado`; a tela de verdade precisa de um olho | Criar uma Conta pela tela, F5, confirmar |
| Login com `maryane@n1.teste` e senha de desenvolvimento entra; `tiago@n1.teste` (removido no seed) **não entra** no Espaço bootstrapado — porque ele nem existe lá | PERS-02 / D-08 | Fluxo de cookie no navegador | Entrar com cada um; o segundo vê "Sem acesso" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
