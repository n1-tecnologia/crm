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
um container por plano (`docker run -d --rm --name crm-n1-pg-07NN -e POSTGRES_PASSWORD=x -p 554NN:5432 postgres:16`) e
`DATABASE_URL=postgres://postgres:x@localhost:554NN/postgres`. Sem `DATABASE_URL` local (host `localhost`/`127.0.0.1`), pulam (`describeComBanco` de `apps/api/src/testes/banco-crm.ts`) — nunca rodam contra o Supabase do `.env`.

---

## Sampling Rate

- **After every task commit:** o `-- <filtro>` do workspace tocado + `npm run typecheck -w <ws>`
- **After every plan wave:** `npm run typecheck && npm run test -w @n1/dominio && npm run test -w @n1/web` + arquivos CRM do api contra o container
- **Before `/gsd-verify-work`:** `npm run check` verde
- **Max feedback latency:** 60 seconds (por filtro)

---

## Per-Task Verification Map

Preenchido pelo planner/executor a partir dos critérios derivados do RESEARCH.md (CRM-D1, CRM-A1, CRM-A2, CRM-A3, CRM-W1, CRM-W2, CRM-V1).

Cada plano com banco usa o SEU container (`crm-n1-pg-07NN`, porta 554NN) — os planos da mesma onda não disputam banco. `DB(n)` abaixo = `DATABASE_URL=postgres://postgres:x@localhost:n/postgres`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | CRM-D1, CRM-A1, CRM-W1, CRM-V1 | T-07-01, T-07-02, T-07-05, T-07-08 | Contato criado/listado no Espaço da sessão; corpo `.strict()`; teste só em host local; `@n1/dominio/crm/*` resolve sem tocar o `package.json` do domínio | e2e (tracer) | `cd apps/api && DB(55471) npx vitest run src/rotas/crm/contatos.test.ts` + `npm run typecheck` + `cd apps/api && node -e "require.resolve('@n1/dominio/crm/contatos')"` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | CRM-W1 | T-07-07 | Novo Contato pela tela grava pela mesma rota do traçador; token só no header | typecheck + lint + route | `cd apps/web && npx tsc --noEmit && npx eslint "src/app/(shell)/crm/contatos/page.tsx"` + `cd apps/api && DB(55471) npx vitest run src/rotas/crm/contatos.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 2 | CRM-D1, CRM-A1 | T-07-03, T-07-40 | Convidado 403; Proprietário inválido 409 (D-11, D-14) | unit + route | `cd packages/dominio && npx vitest run src/crm/permissoes.test.ts` + `cd apps/api && DB(55472) npx vitest run src/rotas/crm/contatos.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 2 | CRM-A2, CRM-V1 | T-07-04, T-07-06, T-07-07 | CORS só allowlist; SQLSTATE sem nome de constraint; token só no header | integração + route + unit | `cd apps/api && DB(55472) npx vitest run src/servicos/crm/transacao.test.ts src/app.test.ts` + `cd apps/web && npx vitest run src/dados/crm/cliente-crm.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 3 | CRM-D1 | — | N/A | unit | `cd packages/dominio && npx vitest run src/crm/normalizacao.test.ts src/crm/contatos.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-02 | 03 | 3 | CRM-A2 | T-07-10, T-07-11, T-07-12 | D-09/RN-CON-11 com 409; `q` escapado; datas `AAAA-MM-DD` | integração | `cd apps/api && TZ=America/Sao_Paulo DB(55473) npx vitest run src/servicos/crm/contatos.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-03 | 03 | 3 | CRM-A1 | T-07-02 | campos proibidos no corpo → 400; DELETE sem corpo | route | `cd apps/api && DB(55473) npx vitest run src/rotas/crm/contatos.test.ts` | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 | 3 | CRM-D1 | — | N/A | unit | `cd packages/dominio && npx vitest run src/crm/funis.test.ts` | ❌ W0 | ⬜ pending |
| 7-04-02 | 04 | 3 | CRM-A2 | T-07-13, T-07-15 | só admin configura Funil; D-07 409; destino de migração do mesmo Espaço | integração | `cd apps/api && DB(55474) npx vitest run src/servicos/crm/funis.test.ts` | ❌ W0 | ⬜ pending |
| 7-04-03 | 04 | 3 | CRM-A1 | T-07-14, T-07-16 | `padrao` fora do corpo; arrays limitados | route | `cd apps/api && DB(55474) npx vitest run src/rotas/crm/funis.test.ts src/rotas/crm/contatos.test.ts` | ❌ W0 | ⬜ pending |
| 7-05-01 | 05 | 4 | CRM-A2, CRM-D1 | T-07-17, T-07-20 | trigger corrigido: lixeira encerra vínculos, restaurar exige admin (D-12) | integração SQL + unit | `cd apps/api && DB(55475) npx vitest run src/repositorios/crm/admin-da-empresa.test.ts` + `cd packages/dominio && npx vitest run src/crm/empresas.test.ts` | ❌ W0 | ⬜ pending |
| 7-05-02 | 05 | 4 | CRM-A2 | T-07-17, T-07-18, T-07-19 | Empresa+admin atômico; último admin 409; referências do mesmo Espaço | integração | `cd apps/api && TZ=America/Sao_Paulo DB(55475) npx vitest run src/servicos/crm/empresas.test.ts` | ❌ W0 | ⬜ pending |
| 7-05-03 | 05 | 4 | CRM-A1 | T-07-18 | corpo composto validado; restaurar sem corpo | route | `cd apps/api && DB(55475) npx vitest run src/rotas/crm src/repositorios/crm` | ❌ W0 | ⬜ pending |
| 7-06-01 | 06 | 4 | CRM-W1 | T-07-22 | mutações certas, DELETE sem corpo, invalidação | unit | `cd apps/web && npx vitest run src/dados/crm` | ❌ W0 | ⬜ pending |
| 7-06-02 | 06 | 4 | CRM-W1 | T-07-21 | formulário pré-valida; 409 com link | componente | `cd apps/web && npx vitest run src/features/crm/formulario-de-contato.test.tsx` | ❌ W0 | ⬜ pending |
| 7-06-03 | 06 | 4 | CRM-W1 | T-07-21 | ficha nova; D-09 visível; recuo legado | componente | `cd apps/web && npx vitest run src/features/crm/ficha-de-contato.test.tsx` | ❌ W0 | ⬜ pending |
| 7-07-01 | 07 | 5 | CRM-W1 | — | N/A | unit | `cd apps/web && npx vitest run src/dados/crm/funis.test.ts` | ❌ W0 | ⬜ pending |
| 7-07-02 | 07 | 5 | CRM-W1 | T-07-24 | escrita de Funil só admin na tela | componente | `cd apps/web && npx vitest run src/features/crm/ficha-de-funil.test.tsx` | ❌ W0 | ⬜ pending |
| 7-07-03 | 07 | 5 | CRM-W1 | T-07-25 | mapeamento validado antes do envio | componente | `cd apps/web && npx vitest run src/features/crm/dialogos-de-funil.test.tsx` | ❌ W0 | ⬜ pending |
| 7-08-01 | 08 | 5 | CRM-D1 | — | N/A | unit | `cd packages/dominio && npx vitest run src/crm/negocios.test.ts` | ❌ W0 | ⬜ pending |
| 7-08-02 | 08 | 5 | CRM-A3 | T-07-26, T-07-28 | reabrir ganho só admin (situação do banco); referências do mesmo Espaço | integração | `cd apps/api && TZ=America/Sao_Paulo DB(55478) npx vitest run src/servicos/crm/negocios.test.ts` | ❌ W0 | ⬜ pending |
| 7-08-03 | 08 | 5 | CRM-A1, CRM-A3 | T-07-27 | `situacao`/`estado` fora do corpo | route | `cd apps/api && TZ=America/Sao_Paulo DB(55478) npx vitest run src/rotas/crm src/servicos/crm src/repositorios/crm` | ❌ W0 | ⬜ pending |
| 7-09-01 | 09 | 5 | CRM-W1 | T-07-31 | admin obrigatório no formulário (D-08) | unit + componente | `cd apps/web && npx vitest run src/dados/crm/empresas.test.ts src/features/crm/formulario-de-empresa.test.tsx` | ❌ W0 | ⬜ pending |
| 7-09-02 | 09 | 5 | CRM-W1 | T-07-30 | último admin protegido; lixeira encerra vínculos | componente | `cd apps/web && npx vitest run src/features/crm/ficha-de-empresa.test.tsx` | ❌ W0 | ⬜ pending |
| 7-09-03 | 09 | 5 | CRM-W1 | — | N/A | typecheck + lint + tokens | `cd apps/web && npx tsc --noEmit && npx eslint ...` + `npm run verificar:tokens` | ✅ | ⬜ pending |
| 7-10-01 | 10 | 6 | CRM-W2 | T-07-33 | Regras do Funil antes do envio | unit + componente | `cd apps/web && npx vitest run src/dados/crm/negocios.test.ts src/features/crm/dialogo-de-encerramento.test.tsx` | ❌ W0 | ⬜ pending |
| 7-10-02 | 10 | 6 | CRM-W2 | T-07-32 | otimista revertido na recusa | componente | `cd apps/web && npx vitest run src/features/crm/quadro-do-funil.test.tsx` | ❌ W0 | ⬜ pending |
| 7-11-01 | 11 | 7 | CRM-W1 | T-07-34 | ficha de Negócio; recuo `DealScreen` | componente | `cd apps/web && npx vitest run src/features/crm/ficha-de-negocio.test.tsx` | ❌ W0 | ⬜ pending |
| 7-11-02 | 11 | 7 | CRM-W1 | — | N/A | componente | `cd apps/web && npx vitest run src/features/crm src/dados/crm` | ❌ W0 | ⬜ pending |
| 7-12-01 | 12 | 8 | CRM-V1 | T-07-36, T-07-37 | `--seco` não escreve; e2e só em host local | integração + e2e | `cd apps/api && TZ=America/Sao_Paulo DB(55482) npx vitest run src/persistencia/migrar-seco.test.ts src/e2e/crm-fluxo.test.ts` | ❌ W0 | ⬜ pending |
| 7-12-02 | 12 | 8 | CRM-V1 | — | N/A | portão | `npm run check` + `npm run build` | ✅ | ⬜ pending |
| 7-13-01 | 13 | 9 | CRM-V1 | T-07-38 | conferência seca antes do migrar em produção (D-12) | manual (dono) | `npm run migrar -w @n1/api -- --seco` (dono) | ✅ | ⬜ pending |
| 7-13-02 | 13 | 9 | CRM-V1, CRM-W1, CRM-W2 | T-07-38 | confirmação somente-leitura; UAT | prova + UAT | `grep -c "aplicada  007-crm.sql" .planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-PROVAS.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/dominio/src/crm*.test.ts` — normalização, regras e permissão
- [ ] Helper de teste do api: aponta Postgres local, roda `migrar()`, `workspace_id` único, limpeza no `afterAll`
- [ ] Serviços falsos injetados por `buildApp({ crm })` para os testes de rota sem banco (`rotas/crm/*.test.ts`); repositórios e serviços provados contra Postgres local
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
