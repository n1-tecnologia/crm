---
phase: "8"
slug: "canais-de-comunica-o-conex-o-e-omnichannel-preparado"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0 nos 3 workspaces |
| **Config file** | `packages/dominio/vitest.config.mts` (node), `apps/api/vitest.config.mts` (node, `fileParallelism: false`, timeouts 180 s), `apps/web/vitest.config.mts` (node; `// @vitest-environment jsdom` por arquivo `.tsx`) |
| **Quick run command** | `cd packages/dominio && npx vitest run src/crm` · `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres npx vitest run src/rotas/crm/canais.test.ts` · `cd apps/web && npx vitest run src/dados/crm src/features/crm` |
| **Full suite command** | `npm run check` (typecheck + lint + verificar:tokens + verificar:contratos + test, 3 workspaces) |
| **Estimated runtime** | ~30 s por filtro de workspace; `npm run test -w @n1/api` completo ~554 s (rodar só os arquivos tocados por tarefa) |

Testes de repositório/serviço do api rodam contra Postgres descartável: um container por plano
(`docker run -d --rm --name crm-n1-pg-08NN -e POSTGRES_PASSWORD=x -p 555NN:5432 postgres:16`) e
`DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres`. Sem `DATABASE_URL` local, pulam
(`describeComBanco` de `apps/api/src/testes/banco-crm.ts`) — nunca rodam contra o Supabase do `.env`.

Baseline conhecido: `npm run check` tem **2 falhas pré-existentes fora desta fase**
(`e2e/lote-contas-a-pagar.test.ts`, `rotas/formularios-publicos.test.ts`) — registradas em
`deferred-items.md` da Fase 7.

---

## Sampling Rate

- **After every task commit:** Run o `-- <filtro>` do workspace tocado + `npm run typecheck -w <ws>`
- **After every plan wave:** Run `npm run typecheck && npm run test -w @n1/dominio && npm run test -w @n1/web` + arquivos de Canal do api contra o container da onda
- **Before `/gsd-verify-work`:** Full suite (`npm run check` + `npm run build`) must be green, com as 2 falhas pré-existentes explicitadas
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-XX-XX | — | — | CXE-D1 | — | N/A | unit | `cd packages/dominio && npx vitest run src/crm/canais.test.ts src/crm/conversas.test.ts src/crm/mensagens.test.ts src/crm/permissoes.test.ts` | ❌ W0 | ⬜ pending |
| 08-XX-XX | — | — | CXE-D2 | — | N/A | unit | `cd packages/dominio && npx vitest run src/operations/operations.test.ts src/operations/canais.test.ts src/derive-resumo.test.ts` | ✅ (+ novo teste ❌ W0) | ⬜ pending |
| 08-XX-XX | — | — | CXE-A1 | — | invariantes no banco (INV-CXE-01/03/04/08/09/10) | integração SQL | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres npx vitest run src/repositorios/crm/canais-008.test.ts src/persistencia/migrar-seco.test.ts` | ❌ W0 | ⬜ pending |
| 08-XX-XX | — | — | CXE-A2 | T-08-xx | 401/403/404/409; `.strict()`; IDOR entre Espaços recusado | route + integração | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres npx vitest run src/rotas/crm/canais.test.ts src/rotas/crm/conversas.test.ts src/rotas/crm/mensagens.test.ts src/servicos/crm` | ❌ W0 | ⬜ pending |
| 08-XX-XX | — | — | CXE-A3 | T-08-xx | `recebida` só pelo caminho interno; `carga_bruta` fora das listagens | integração | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres npx vitest run src/repositorios/crm/mensagens.test.ts src/servicos/crm/mensagens.test.ts` | ❌ W0 | ⬜ pending |
| 08-XX-XX | — | — | CXE-A4 | — | Canal projetado nunca gravado em `registros` | integração | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres npx vitest run src/persistencia/canais-projetados.test.ts src/rotas/estado.test.ts src/persistencia/unidade-de-trabalho.test.ts src/contratos/notificar-canal.contrato.test.ts` | ❌ W0 (demais ✅) | ⬜ pending |
| 08-XX-XX | — | — | CXE-W1 | — | "Simular conexão" só para administração; marca visível | unit + componente | `cd apps/web && npx vitest run src/dados/crm/canais.test.ts src/features/crm/conectar-canal src/features/shell/rotas.test.ts` | ❌ W0 (`rotas.test.ts` ✅) | ⬜ pending |
| 08-XX-XX | — | — | CXE-W2 | — | N/A | componente + unit | `cd apps/web && npx vitest run src/features/crm/conversation-thread.test.tsx src/features/crm/inbox-columns.test.tsx` | ❌ W0 | ⬜ pending |
| 08-XX-XX | — | — | CXE-V1 | — | isolamento de Espaço no e2e | e2e + portão | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres npx vitest run src/e2e/canais-fluxo.test.ts` · `npm run check` · `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*O planner substitui `08-XX-XX` pelos ids reais das tarefas e preenche Plan/Wave/Threat Ref ao escrever os planos.*

---

## Wave 0 Requirements

- [ ] `packages/dominio/src/crm/{canais,conversas,mensagens}.test.ts` — stubs para CXE-D1; estender `permissoes.test.ts`
- [ ] Teste novo de `capacidadesDoCanal` e de `responseWindowOpenUntil` (hoje sem teste) — CXE-D2
- [ ] `apps/api/src/testes/banco-crm.ts`: `limparEspaco` apaga `mensagens`, `conversas`, `canais` **antes** de `contatos`; helpers `semearCanal`/`semearConversa` se preciso
- [ ] Fakes em memória dos serviços de Canal/Conversa/Mensagem para `buildApp({ crm })` (sem banco) — CXE-A2
- [ ] `apps/web`: `conversation-thread.test.tsx` e `inbox-columns.test.tsx` (não existem); helper de store com 2 WhatsApps; `fetch` falso e `SWRConfig provider: () => new Map()` — CXE-W2
- [ ] Container por plano: `docker run -d --rm --name crm-n1-pg-08NN -e POSTGRES_PASSWORD=x -p 555NN:5432 postgres:16`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `008` aplicada no banco da plataforma | CXE-A1 / CXE-V1 | Migração imutável contra o banco real; só o dono aplica | `npm run migrar -w @n1/api -- --seco` (1 pendente: `008`) → dono aplica `migrar` → `--seco` de novo (0 pendentes); resultado colado em `08-PROVAS.md` |
| UAT no navegador: dois WhatsApps lado a lado (oficial "Comercial" + não oficial "Suporte"), mesmo Contato, uma Conversa em cada, "Responder por" troca de aba | CXE-W1 / CXE-W2 | Jornada visual completa (cartões, orientação, simular conexão, selos, abas) | Conectar os dois Canais pela página nova, simular conexão como administrador, abrir o Contato, conferir abas por Canal e seletor "Responder por"; registrar em `08-PROVAS.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
