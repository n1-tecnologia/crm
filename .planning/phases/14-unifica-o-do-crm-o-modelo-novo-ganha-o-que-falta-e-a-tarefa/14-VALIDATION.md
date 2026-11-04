---
phase: "14"
slug: unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-04"
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `14-RESEARCH.md` § Validation Architecture (comandos rodados na sessão de pesquisa).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.1 nas três camadas |
| **Config file** | `packages/dominio/vitest.config.mts`, `apps/api/vitest.config.mts`, `apps/web/vitest.config.mts` |
| **Quick run command (domínio)** | `cd packages/dominio && npx vitest run src/crm src/derive-conversacional.test.ts src/operations/contacts.test.ts src/operations/conversations.test.ts src/operations/members-remocao.test.ts src/quem-pode.test.ts && npx tsc --noEmit` |
| **Quick run command (api, sem banco)** | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run <arquivos> && npx tsc --noEmit` |
| **Quick run command (api, com banco)** | contêiner `postgres:16` em porta alta + `DATABASE_URL=postgres://postgres:x@localhost:<porta>/postgres DATABASE_URL_MIGRACAO=<igual> npx vitest run <arquivos>` |
| **Quick run command (web)** | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados src/features/crm` |
| **Full suite command** | `npm run check` com as duas URLs no Docker migrado (cerca de 3 min) |
| **Estimated runtime** | ~180 segundos (`npm test` direto leva 13–17 min e fala com o `.env`: não usar como gate) |

---

## Sampling Rate

- **After every task commit:** quick run da camada tocada (domínio; api sem banco; web `tsc` + `src/dados`)
- **After every plan wave:** os arquivos com banco da onda no contêiner Docker (`crm-n1-pg-14NN`), mais `npx tsc --noEmit` nas três camadas
- **Before `/gsd-verify-work`:** `npm run check` no Docker migrado, repetindo uma vez se `outbox-worker.test.ts` oscilar
- **Max feedback latency:** 180 segundos

---

## Per-Task Verification Map

*Preenchido pelo planejador: uma linha por tarefa, citando o requisito `UNI-nn`, o comando exato do `<automated>` e o arquivo de teste.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-xx-xx | — | — | UNI-01 | — | Nada novo importa `funilDaLista`/`iniciar-conversa`; sem coluna de Grupo/Flow na 011 | unit | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/migracao-011.test.ts` | ❌ W0 | ⬜ pending |
| 14-xx-xx | — | — | UNI-02 | — | `contatos_estado_ck` aceita `mesclado`; consentimento recusa `decisao='talvez'`; RLS desligada | integração (Docker) | `...migracao-011.test.ts` | ❌ W0 | ⬜ pending |
| 14-xx-xx | — | — | UNI-04 | T-IDOR / corrida | Erro em `gravarNoCrm` não deixa linha; recusa não grava no CRM; 23505 vira 409 | integração (Docker) | `...servicos/crm/gesto-misto.test.ts` | ❌ W0 | ⬜ pending |
| 14-xx-xx | — | — | UNI-05..UNI-11 | T-IDOR / mass assignment | Mesclar, transferir, consentimento, mover, atribuir, lixeira, notas e sucessão aplicam as regras do domínio com `workspace_id` em todo `where` | unit + Docker | ver mapa Req → Teste em `14-RESEARCH.md` | ✅ / ❌ W0 | ⬜ pending |
| 14-xx-xx | — | — | UNI-12..UNI-17 | T-forja de referência | Referência da Tarefa conversacional lida no servidor; id de outro Espaço volta vazio | unit + rota + Docker | ver mapa Req → Teste em `14-RESEARCH.md` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/persistencia/migracao-011.test.ts` — UNI-01, UNI-02 (molde `migracao-010.test.ts`)
- [ ] `apps/api/src/servicos/crm/gesto-misto.test.ts` — UNI-04
- [ ] `apps/api/src/servicos/crm/tarefas-conversacionais.test.ts` e `apps/api/src/rotas/crm/tarefas-conversacionais.test.ts` — UNI-12, 14, 15, 16
- [ ] `packages/dominio/src/crm/consentimentos.test.ts` — UNI-07
- [ ] casos novos em `unidade-de-trabalho.test.ts` / `unidade-de-trabalho-trava.test.ts` para `lerDoCrm` (fake de cliente)
- [ ] `apps/api/src/testes/banco-crm.ts` `limparEspaco`: acrescentar `crm_de_para` e `registros_crm_antigo` (e conferir as tabelas com cascade)
- [ ] reescrever `derive-conversacional.test.ts` e os casos de Tarefa conversacional de `operations.test.ts`; ajustar `esquemas/tarefas-conversacionais.test.ts` e `quem-pode.test.ts`
- [ ] Framework install: nenhum

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 011 aplica sobre a cópia dos dados reais do CRM antigo; contagens-base anotadas | UNI-03 | A cópia é do dono e contém dado pessoal de clientes: fica só no notebook dele (D-02) | Dono tira a cópia só das coleções do CRM antigo de `plataforma.registros`; o agente sobe `postgres:16`, aplica as migrações até a 011, confere contagens e apaga o contêiner (`docker rm -f`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
