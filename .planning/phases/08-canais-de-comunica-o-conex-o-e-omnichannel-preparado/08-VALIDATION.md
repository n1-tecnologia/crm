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
| 08-01-01 | 08-01 | 1 | CXE-D1, CXE-A1, CXE-A2, CXE-A4, CXE-W1 | T-08-01..T-08-06, T-08-08 | 403 Membro; corpo `.strict()`; isolamento por Espaço; guarda `to_regclass`; projeção fora de `registros`; `CHECK` provedor×tipo; slug inválido → `notFound` | unit + integração (008) + route + componente (tracer, ponta a ponta) | `cd packages/dominio && npx vitest run src/crm/canais.test.ts src/crm/permissoes.test.ts` · `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55581/postgres npx vitest run src/rotas/crm/canais.test.ts src/persistencia/canais-projetados.test.ts` · `cd apps/web && npx vitest run src/features/crm/conectar-provedor.test.tsx` · `npm run typecheck` | ❌ W0 (criado na tarefa) | ⬜ pending |
| 08-01-02 | 08-01 | 1 | CXE-W1 | T-08-02 | `content-type` só com corpo; 409 rico; invalidação só no sucesso | unit | `cd apps/web && npx vitest run src/dados/crm/canais.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 08-02 | 2 | CXE-D2, CXE-D1 | T-08-09..T-08-11 | não oficial sem janela; Canal sem provider = oficial; `configurarCanal` recusa relacional | unit | `cd packages/dominio && npx vitest run src/operations/capacidades-do-canal.test.ts src/operations/canais.test.ts src/operations/operations.test.ts src/derive-resumo.test.ts` | ✅ suítes + ❌ W0 (novo teste) | ⬜ pending |
| 08-02-02 | 08-02 | 2 | CXE-D2 | T-08-09 | nenhum leitor de janela/modelo por tipo | typecheck + grep + componente | `npm run typecheck` · gate `git grep` da tarefa · `cd apps/web && npx vitest run src/features/crm src/dados/crm` | ✅ | ⬜ pending |
| 08-03-01 | 08-03 | 2 | CXE-D1 | — | transições puras do Canal | unit | `cd packages/dominio && npx vitest run src/crm/canais.test.ts` | ✅ (08-01) | ⬜ pending |
| 08-03-02 | 08-03 | 2 | CXE-A2 | T-08-12, T-08-15..T-08-18 | Papel por ação; Fila/Origem do mesmo Espaço; guarda entre acervos; revisão | integração | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55583/postgres npx vitest run src/servicos/crm/canais.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-03 | 08-03 | 2 | CXE-A2 | T-08-13, T-08-14 | IDOR → 404; PATCH `.strict()`; ações sem corpo | route | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55583/postgres npx vitest run src/rotas/crm/canais.test.ts src/servicos/crm/canais.test.ts` | ✅ (08-01) | ⬜ pending |
| 08-04-01 | 08-04 | 2 | CXE-A1 | T-08-19 | 17 invariantes da 008 no banco; idempotência | integração SQL | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55584/postgres npx vitest run src/repositorios/crm/canais-008.test.ts src/persistencia/migrar-seco.test.ts` | ❌ W0 | ⬜ pending |
| 08-04-02 | 08-04 | 2 | CXE-A2 | T-08-20, T-08-21 | Contato com Conversa → 409, nunca 500 | integração | `cd apps/api && TZ=America/Sao_Paulo DATABASE_URL=postgres://postgres:x@localhost:55584/postgres npx vitest run src/servicos/crm/contatos.test.ts src/rotas/crm/contatos.test.ts` | ✅ estender | ⬜ pending |
| 08-05-01 | 08-05 | 2 | CXE-D1 | — | INV-CXE-05; transições A4.5 | unit | `cd packages/dominio && npx vitest run src/crm/conversas.test.ts` | ❌ W0 | ⬜ pending |
| 08-05-02 | 08-05 | 2 | CXE-D1 | T-08-22..T-08-24 | `recebida` fora do envio humano; sem carga no tipo; RN-CXE-19 por (tipo, provedor) | unit | `cd packages/dominio && npx vitest run src/crm/mensagens.test.ts` | ❌ W0 | ⬜ pending |
| 08-05-03 | 08-05 | 2 | CXE-W2 | — | abas por Canal; padrão de resposta; separador | unit | `cd packages/dominio && npx vitest run src/derive-conversacional.test.ts src/derive-resumo.test.ts` | ❌ W0 | ⬜ pending |
| 08-06-01 | 08-06 | 3 | CXE-A2 | — | repositórios escopados; `carga_bruta` fora das colunas | typecheck | `cd apps/api && npx tsc --noEmit` | — | ⬜ pending |
| 08-06-02 | 08-06 | 3 | CXE-A2, CXE-A3 | T-08-25..T-08-29 | Conversa + 1ª Mensagem atômicas; uma aberta por par; Identificador do tipo | integração | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55586/postgres npx vitest run src/servicos/crm/conversas.test.ts` | ❌ W0 | ⬜ pending |
| 08-06-03 | 08-06 | 3 | CXE-A2 | T-08-26 | corpo e `mensagem` aninhada `.strict()` | route | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55586/postgres npx vitest run src/rotas/crm/conversas.test.ts src/servicos/crm/conversas.test.ts src/rotas/crm/canais.test.ts` | ❌ W0 | ⬜ pending |
| 08-07-01 | 08-07 | 3 | CXE-A4 | T-08-30..T-08-32 | Canal projetado nunca gravado em `registros`; operação que o altera lança | integração | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55587/postgres npx vitest run src/persistencia/canais-projetados.test.ts src/persistencia/unidade-de-trabalho.test.ts src/persistencia/unidade-de-trabalho-trava.test.ts src/contratos/notificar-canal.contrato.test.ts` | ✅ (08-01) + ✅ suítes | ⬜ pending |
| 08-07-02 | 08-07 | 3 | CXE-A4 | — | a regra da ponte documentada | grep | `grep -c "canais-projetados" apps/api/src/persistencia/CONTEXT.md` | ✅ | ⬜ pending |
| 08-08-01/02 | 08-08 | 3 | CXE-W1 | T-08-33..T-08-35 | slug validado no Server Component; o servidor decide o Papel | typecheck + lint + tokens + componente (regressão do traçador) | `cd apps/web && npx tsc --noEmit && npx eslint …` · `cd apps/web && npx vitest run src/features/crm/conectar-provedor.test.tsx` (Task 2) · `npm run verificar:tokens` | — | ⬜ pending |
| 08-08-03 | 08-08 | 3 | CXE-W1 | T-08-33, T-08-34 | quatro cartões; formulário grava por REST; `notFound` | componente | `cd apps/web && npx vitest run src/features/crm/conectar-canal.test.tsx src/features/shell/rotas.test.ts` | ❌ W0 (`rotas.test.ts` ✅) | ⬜ pending |
| 08-09-01/02 | 08-09 | 3 | CXE-W1 | T-08-36..T-08-38 | "Simular conexão" só para administração; marca visível; demo × relacional | unit + componente | `cd apps/web && npx vitest run src/features/crm/ficha-do-canal.test.tsx src/dados/crm/canais.test.ts` | ❌ W0 | ⬜ pending |
| 08-10-01/02 | 08-10 | 3 | CXE-W2 | T-08-39..T-08-41 | troca de Canal nunca muda `channelId`; nada de HTML cru | typecheck + grep + componente | `npm run typecheck` · gate `git grep` da tarefa · `cd apps/web && npx vitest run src/features/crm src/features/estrutura` | ✅ | ⬜ pending |
| 08-10-03 | 08-10 | 3 | CXE-W2 | T-08-40 | dois WhatsApps: abas, padrão de resposta, troca | componente | `cd apps/web && npx vitest run src/features/crm/conversation-thread.test.tsx` | ❌ W0 | ⬜ pending |
| 08-11-01/02 | 08-11 | 3 | CXE-W2 | T-08-42, T-08-43 | nome do Canal na lista; filtro com provedor | componente | `cd apps/web && npx vitest run src/features/crm/inbox-columns.test.tsx` | ❌ W0 | ⬜ pending |
| 08-12-01..03 | 08-12 | 4 | CXE-A3, CXE-A2 | T-08-44..T-08-49 | `recebida` só interna e idempotente; `carga_bruta` fora de toda resposta; janela no servidor | integração + route | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55592/postgres npx vitest run src/repositorios/crm/mensagens.test.ts src/servicos/crm/mensagens.test.ts src/rotas/crm/mensagens.test.ts` | ❌ W0 | ⬜ pending |
| 08-13-01 | 08-13 | 5 | CXE-V1, CXE-A2, CXE-A3, CXE-A4 | T-08-50, T-08-51 | isolamento de Espaço no e2e "dois WhatsApps" | e2e | `cd apps/api && TZ=America/Sao_Paulo DATABASE_URL=postgres://postgres:x@localhost:55593/postgres npx vitest run src/e2e/canais-fluxo.test.ts` | ❌ W0 | ⬜ pending |
| 08-13-02 | 08-13 | 5 | CXE-V1 | — | docs da api | grep | `grep -c "Rotas REST da Caixa de Entrada (Fase 8)" apps/api/src/rotas/CONTEXT.md` | ✅ | ⬜ pending |
| 08-14-01..03 | 08-14 | 6 | CXE-A1, CXE-V1 | T-08-52..T-08-54 | decisão do dono sobre o contrato; `--seco` antes/depois; aplicação pelo dono | manual (dono) + grep | `npm run migrar -w @n1/api -- --seco` (dono) · `test -f 08-PROVAS.md` | ❌ (`08-PROVAS.md`) | ⬜ pending |
| 08-15-01..03 | 08-15 | 7 | CXE-V1, CXE-W1, CXE-W2 | T-08-55..T-08-57 | portão com as duas falhas pré-existentes nomeadas; nada de HTML cru; UAT | portão + manual | `npm run check` · `npm run build` · UAT de `08-PROVAS.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Ids preenchidos pelo planner em 2026-10-12 (15 planos, 7 ondas). Porta do Postgres de cada plano = 55580 + número do plano; container `crm-n1-pg-08NN`.*

---

## Wave 0 Requirements

- [ ] `packages/dominio/src/crm/{canais,conversas,mensagens}.test.ts` — criados em 08-01 (canais) e 08-05 (conversas, mensagens); `permissoes.test.ts` estendido em 08-01 — CXE-D1
- [ ] Teste novo de `capacidadesDoCanal` e de `responseWindowOpenUntil` (hoje sem teste) — `operations/capacidades-do-canal.test.ts`, 08-02 — CXE-D2
- [ ] `apps/api/src/testes/banco-crm.ts`: `limparEspaco` apaga `mensagens`, `conversas`, `canais` **antes** de `contatos`, e `semearCanal` — 08-01
- [ ] Fakes em memória dos serviços de Canal/Conversa/Mensagem para `buildApp({ crm })` (sem banco) — dentro de cada `rotas/crm/*.test.ts` (08-01, 08-03, 08-06, 08-12) — CXE-A2
- [ ] `apps/web`: `conectar-provedor.test.tsx` (08-01, a fatia web do traçador: página → `POST /canais` → re-hidratação → lista com selos), `conversation-thread.test.tsx` (08-10) e `inbox-columns.test.tsx` (08-11), com store de 2 WhatsApps e `transporteEmMemoria()`; `fetch` falso e `SWRConfig provider: () => new Map()` nos testes de 08-08/08-09 — CXE-W2, CXE-W1
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
