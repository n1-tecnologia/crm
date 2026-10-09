---
phase: "7"
slug: "crm-contatos-empresas-funis-e-negocios"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0 nos 3 workspaces |
| **Config file** | `packages/dominio/vitest.config.mts`, `apps/api/vitest.config.mts` (`fileParallelism:false`), `apps/web/vitest.config.mts` (jsdom por arquivo `.tsx`) |
| **Quick run command** | `npm run test -w @n1/dominio -- crm` · `npm run test -w @n1/api -- rotas/crm` · `npm run test -w @n1/web -- dados/crm` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~30 s por filtro de workspace; `npm run test -w @n1/api` completo ~554 s |

Testes de repositório/serviço do api rodam contra Postgres descartável:
`docker run -d --rm -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16` e
`DATABASE_URL=postgres://postgres:x@localhost:55432/postgres`. Sem `DATABASE_URL`, pulam (`temBanco ? describe : describe.skip`).

---

## Sampling Rate

- **After every task commit:** o `-- <filtro>` do workspace tocado + `npm run typecheck -w <ws>`
- **After every plan wave:** `npm run typecheck && npm run test -w @n1/dominio && npm run test -w @n1/web` + arquivos CRM do api contra o container
- **Before `/gsd-verify-work`:** `npm run check` verde
- **Max feedback latency:** 60 seconds (por filtro)

---

## Per-Task Verification Map

Preenchido pelo planner/executor a partir dos critérios derivados do RESEARCH.md (CRM-D1, CRM-A1, CRM-A2, CRM-A3, CRM-W1, CRM-W2, CRM-V1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-xx-xx | xx | x | CRM-D1 | — | N/A | unit | `npm run test -w @n1/dominio -- crm` | ❌ W0 | ⬜ pending |
| 7-xx-xx | xx | x | CRM-A1 | T-7-xx | 401 sem token; 403 Papel sem escrita; 404 de outro Espaço; `workspaceId` do corpo ignorado | route | `npm run test -w @n1/api -- rotas/crm` | ❌ W0 | ⬜ pending |
| 7-xx-xx | xx | x | CRM-A2/A3 | T-7-xx | integridade (409) aplicada no backend | integração | `DATABASE_URL=postgres://postgres:x@localhost:55432/postgres npm run test -w @n1/api -- repositorios/crm servicos/crm` | ❌ W0 | ⬜ pending |
| 7-xx-xx | xx | x | CRM-W1/W2 | — | N/A | componente | `npm run test -w @n1/web -- features/crm` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/dominio/src/crm*.test.ts` — normalização, regras e permissão
- [ ] Helper de teste do api: aponta Postgres local, roda `migrar()`, `workspace_id` único, limpeza no `afterAll`
- [ ] Fakes em memória dos repositórios para `rotas/crm/*.test.ts` sem banco
- [ ] Fixture de Membro/Papel para a consulta de permissão
- [ ] `apps/web`: helper de `fetch` falso e `SWRConfig` com `provider: () => new Map()`
- [ ] `npm install swr@2.5.1 -w @n1/web`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo real login → criar Empresa (com admin) → Negócio → mover de Etapa → ganhar | CRM-W1 | depende de JWT real do Supabase e do browser | UAT guiado com `npm run dev` (web 3001, api 3002) apontando a um banco com a 007 aplicada |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
