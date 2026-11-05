---
phase: "14"
slug: unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

"Docker NN" = o comando com Postgres 16 descartável `crm-n1-pg-14NN` na porta `556NN` (14-13 usa `55673`), que roda `npm run --silent migrar` (aplica até a 011) antes do `vitest`, como está no `<automated>` de cada plano. Nunca contra o `.env`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-1 | 14-01 | 1 | UNI-02 | T-14-02 | 011 aplica; `mesclado` sai de `GET /contatos/:id` e some da lista | tracer, Docker | Docker 01: `src/servicos/crm/contatos.test.ts` + `tsc` nas três camadas | ✅ (caso novo) | ✅ green |
| 14-01-2 | 14-01 | 1 | UNI-01, UNI-02 | T-14-01, T-14-03 | restrições, idempotência, falha no meio, RLS, sem Grupo/Flow; guardas D-06 | integração + fonte | Docker 01: `migracao-011.test.ts migrar-seco.test.ts`; domínio e api: `sem-listas-espelho.test.ts` | ❌ W0 | ✅ green |
| 14-02-1 | 14-02 | 1 | UNI-13 | T-14-04 | leituras por id com estado sem CRM antigo; `alvoConferido` | unit | `cd packages/dominio && npx vitest run src/derive-conversacional.test.ts ...` | ✅ (casos novos) | ✅ green |
| 14-02-2 | 14-02 | 1 | UNI-12, UNI-15, UNI-16 | T-14-04 | operações `…NasTabelas` fora de `OPERACOES` | unit | `npx vitest run src/operations/tarefa-conversacional-nas-tabelas.test.ts ...` | ❌ W0 | ✅ green |
| 14-03-1 | 14-03 | 2 | UNI-04 | T-14-08 | `lerDoCrm` no mesmo cliente; nada muda para os chamadores | unit (fakes) | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/unidade-de-trabalho.test.ts ...` | ✅ (casos novos) | ✅ green |
| 14-03-2 | 14-03 | 2 | UNI-04 | T-14-06, T-14-07 | tudo ou nada; recusa como valor; 23505 → 409; recorte igual | Docker | Docker 03: `gesto-misto.test.ts operacoes.test.ts estado.test.ts ...` | ❌ W0 | ✅ green |
| 14-04-1 | 14-04 | 2 | UNI-05 | T-14-09 | `mesclado` somente leitura no serviço de Contatos | Docker | Docker 04: `contatos.test.ts` | ✅ (casos novos) | ✅ green |
| 14-04-2 | 14-04 | 2 | UNI-05 | T-14-09 | Negócio e vínculo recusam `mesclado` | Docker | Docker 04: `negocios.test.ts empresas.test.ts contatos.test.ts` | ✅ (casos novos) | ✅ green |
| 14-05-1 | 14-05 | 2 | UNI-08 | T-14-10, T-14-11, T-14-12 | mover com e sem colisão; outro Espaço 404 | unit + Docker + rota | domínio `src/crm/conversas.test.ts`; Docker 05: `servicos/crm/conversas.test.ts rotas/crm/conversas.test.ts` | ✅ (casos novos) | ✅ green |
| 14-05-2 | 14-05 | 2 | UNI-09 | T-14-10 | atribuir só a Membro ativo/Agente do Espaço | unit + Docker + rota | idem 14-05-1 + `mensagens.test.ts` | ✅ (casos novos) | ✅ green |
| 14-06-1 | 14-06 | 3 | UNI-10 | T-14-13, T-14-14, T-14-15 | nota com autor da sessão; outro Espaço 404 | unit + Docker + rota | domínio `src/crm/notas.test.ts`; Docker 06: `servicos/crm/notas.test.ts rotas/crm/notas.test.ts` | ❌ W0 | ✅ green |
| 14-06-2 | 14-06 | 3 | UNI-06 | T-14-14 | transferir; principal; origem protegida (INV-CON-01) | unit + Docker + rota | Docker 06: `servicos/crm/contatos.test.ts rotas/crm/contatos.test.ts servicos/crm/conversas.test.ts` | ✅ (casos novos) | ✅ green |
| 14-07-1 | 14-07 | 4 | UNI-09 | — | lixeira só resolvida; restaurar; `estado=ativo` não lista | unit + Docker | Docker 07: `servicos/crm/conversas.test.ts rotas/crm/conversas.test.ts mensagens.test.ts` | ✅ (casos novos) | ✅ green |
| 14-07-2 | 14-07 | 4 | UNI-09 | T-14-16, T-14-17, T-14-18 | marcação por Membro; filtros; `q` sem injeção | unit + Docker | Docker 07: idem | ✅ (casos novos) | ✅ green |
| 14-08-1 | 14-08 | 5 | UNI-07 | — | `consentimentoVigente` (concedido, revogado depois, `todos`) | unit | `cd packages/dominio && npx vitest run src/crm/consentimentos.test.ts` | ❌ W0 | ✅ green |
| 14-08-2 | 14-08 | 5 | UNI-07 | T-14-19, T-14-20, T-14-21 | só inserção; finalidade no Catálogo | Docker + rota | Docker 08: `servicos/crm/consentimentos.test.ts rotas/crm/consentimentos.test.ts` | ❌ W0 | ✅ green |
| 14-08-3 | 14-08 | 5 | UNI-07 | T-14-19 | `SEM_CONSENTIMENTO` com modelo injetado | Docker | Docker 08: `servicos/crm/mensagens.test.ts rotas/crm/mensagens.test.ts` | ✅ (casos novos) | ✅ green |
| 14-09-1 | 14-09 | 6 | UNI-05 | — | `validarMesclagem`; Vínculos reapontados; `mergeContacts` igual | unit | `cd packages/dominio && npx vitest run src/crm/mesclagem.test.ts src/operations/vinculos-da-mesclagem.test.ts ...` | ❌ W0 | ✅ green |
| 14-09-2 | 14-09 | 6 | UNI-05 | T-14-22, T-14-23, T-14-24 | move tudo; colisão RN-CXE-10; único admin; concorrência sem deadlock | Docker | Docker 09: `servicos/crm/mesclagem.test.ts gesto-misto.test.ts` | ❌ W0 | ✅ green |
| 14-09-3 | 14-09 | 6 | UNI-05 | T-14-22 | rota `.strict()` | rota (falso) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/rotas/crm/mesclagem.test.ts ...` | ❌ W0 | ✅ green |
| 14-10-1 | 14-10 | 7 | UNI-11 | T-14-25 | sucessão nas tabelas no mesmo commit; Conversas liberadas | Docker (e2e) | Docker 10: `rotas/operacoes.test.ts rotas/estado.test.ts` | ✅ (casos novos) | ✅ green |
| 14-10-2 | 14-10 | 7 | UNI-11 | T-14-26 | prévia só para Administrador/Proprietário ativo | Docker + rota | Docker 10: `servicos/crm/sucessao.test.ts rotas/crm/sucessao.test.ts` | ❌ W0 | ✅ green |
| 14-11-1 | 14-11 | 7 | UNI-05, 06, 07, 10 | — | clientes da api | web unit | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados/crm` | ❌ W0 | ✅ green |
| 14-11-2 | 14-11 | 7 | UNI-07, UNI-10 | T-14-27 | seções Notas e Consentimentos | web (jsdom) | `cd apps/web && npx tsc --noEmit && npx vitest run src/features/crm/ficha-de-contato.test.tsx src/dados/crm` | ✅ (casos novos) | ✅ green |
| 14-11-3 | 14-11 | 7 | UNI-05, UNI-06 | T-14-28 | Mesclar com… e Transferir | web (jsdom) + human-check | `cd apps/web && npx tsc --noEmit && npx vitest run src/features/crm src/dados/crm` | ✅ (casos novos) | ✅ green |
| 14-12-1 | 14-12 | 8 | UNI-17 | — | validação com `Canal[]` | unit | `cd packages/dominio && npx vitest run src/operations/canais.test.ts ...` | ✅ (casos novos) | ✅ green |
| 14-12-2 | 14-12 | 8 | UNI-17 | T-14-29, T-14-30 | projeção desligada; `canais` forjado trocado | Docker | Docker 12: `operacoes-canais-da-lista.test.ts operacoes.test.ts estado.test.ts` | ❌ W0 | ✅ green |
| 14-12-3 | 14-12 | 8 | UNI-17 | — | telas passam `useCanais` | web `tsc` + testes | `cd apps/web && npx tsc --noEmit && npx vitest run src/features/estrutura src/dados` | ✅ | ✅ green |
| 14-13-1 | 14-13 | 9 | UNI-12 | — | `abrirConversaNoCliente` igual a `POST /conversas` | Docker | Docker 13 (porta 55673): `servicos/crm/conversas.test.ts rotas/crm/conversas.test.ts` | ✅ (caso novo) | ✅ green |
| 14-13-2 | 14-13 | 9 | UNI-12 | T-14-31, T-14-33 | 1 Conversa nas tabelas, 0 em `registros`; D-07 | Docker + rota | Docker 13: `servicos/crm/tarefas-conversacionais.test.ts rotas/crm/tarefas-conversacionais.test.ts gesto-misto.test.ts` | ❌ W0 | ✅ green |
| 14-13-3 | 14-13 | 9 | UNI-14 | T-14-32, T-14-34 | resumo em lote; outro Espaço vazio | Docker + rota | Docker 13: idem | ❌ W0 | ✅ green |
| 14-14-1 | 14-14 | 10 | UNI-15 | T-14-36 | trocar Canal; Conversa antiga intacta | Docker + rota | Docker 14: `servicos/crm/tarefas-conversacionais.test.ts rotas/crm/tarefas-conversacionais.test.ts` | ✅ (casos novos) | ✅ green |
| 14-14-2 | 14-14 | 10 | UNI-16 | T-14-35, T-14-37 | ligar/criar Negócio; Vínculo recusado não deixa Negócio | Docker + rota | Docker 14: idem + `servicos/crm/negocios.test.ts rotas/crm/negocios.test.ts` | ✅ (casos novos) | ✅ green |
| 14-15-1 | 14-15 | 10 | UNI-14 | — | uma chamada para 50 Tarefas | web unit | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados/crm/tarefas-conversacionais.test.ts` | ❌ W0 | ✅ green |
| 14-15-2 | 14-15 | 10 | UNI-14 | T-14-38 | cartão, tabela, Reunião e Lista pelo resumo | web | `cd apps/web && npx tsc --noEmit && npx vitest run src/features/estrutura src/dados` | ✅ | ✅ green |
| 14-15-3 | 14-15 | 10 | UNI-14 | T-14-39 | ficha da Tarefa pelo resumo | web + human-check | idem | ✅ | ✅ green |
| 14-16-1 | 14-16 | 11 | UNI-12 | T-14-41 | diálogo pela api; D-07; guarda D-06 da web | web | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados/crm src/sem-listas-espelho.test.ts src/features/estrutura` | ❌ W0 | ✅ green |
| 14-16-2 | 14-16 | 11 | UNI-15, UNI-16 | T-14-40 | fio e ficha da Tarefa pela api | web | `cd apps/web && npx tsc --noEmit && npx vitest run src/features/crm src/features/estrutura src/dados` | ✅ | ✅ green |
| 14-16-3 | 14-16 | 11 | UNI-11 | — | diálogo de Membros com as contagens | web + human-check | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados` | ✅ | ✅ green |
| 14-17-1 | 14-17 | 12 | UNI-12 | T-14-42 | quatro antigas fora de `OPERACOES`; 404 | unit + Docker | domínio `quem-pode.test.ts operations.test.ts ...`; Docker 17: `rotas/operacoes.test.ts esquemas/...` | ✅ (casos ajustados) | ✅ green |
| 14-17-2 | 14-17 | 12 | UNI-13 | — | `derive-conversacional.test.ts` sem CRM antigo no estado | unit | `cd packages/dominio && npx vitest run src/derive-conversacional.test.ts src/derive-conversacional-antigo.test.ts ...` | ❌ W0 (o `-antigo`) | ✅ green |
| 14-18-1 | 14-18 | 13 | todos | T-14-43 | gate `npm run check` no Docker migrado | gate | Docker 18 + `npm run check` | — | ✅ green |
| 14-18-2 | 14-18 | 13 | — | — | `CONTEXT.md` e status | doc | `grep -c "A partir da Fase 14" CONTEXT.md` | — | ✅ green |
| 14-19-1 | 14-19 | 14 | UNI-03 | T-14-46 | cópia fora do repositório | manual (dono, feito pelo agente a pedido dele) | `test -s <pasta>/registros-crm-antigo.csv` | — | ✅ green |
| 14-19-2 | 14-19 | 14 | UNI-03 | T-14-44, T-14-45 | 011 sobre a cópia; contagens iguais; contêiner apagado | Docker + doc | ver `14-19-PLAN.md` Task 2 | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Cada teste novo nasce DENTRO da tarefa que o usa (TDD por tarefa); nenhuma tarefa depende de um `MISSING`.

- [x] `apps/api/src/persistencia/migracao-011.test.ts` — UNI-01, UNI-02 (14-01, Task 2)
- [x] `packages/dominio/src/sem-listas-espelho.test.ts` e `apps/api/src/sem-listas-espelho.test.ts` — UNI-01 (14-01, Task 2); `apps/web/src/sem-listas-espelho.test.ts` (14-16, Task 1)
- [x] `apps/api/src/testes/banco-crm.ts` `limparEspaco` com `crm_de_para` e `registros_crm_antigo` (14-01, Task 2)
- [x] `packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.test.ts` — UNI-12, 15, 16 (14-02, Task 2)
- [x] casos `lerDoCrm` em `unidade-de-trabalho.test.ts` (14-03, Task 1) e `apps/api/src/servicos/crm/gesto-misto.test.ts` — UNI-04 (14-03, Task 2)
- [x] `packages/dominio/src/crm/notas.test.ts`, `apps/api/src/servicos/crm/notas.test.ts`, `apps/api/src/rotas/crm/notas.test.ts` — UNI-10 (14-06)
- [x] `packages/dominio/src/crm/consentimentos.test.ts`, `apps/api/src/servicos/crm/consentimentos.test.ts`, `apps/api/src/rotas/crm/consentimentos.test.ts` — UNI-07 (14-08)
- [x] `packages/dominio/src/crm/mesclagem.test.ts`, `packages/dominio/src/operations/vinculos-da-mesclagem.test.ts`, `apps/api/src/servicos/crm/mesclagem.test.ts`, `apps/api/src/rotas/crm/mesclagem.test.ts` — UNI-05 (14-09)
- [x] `apps/api/src/servicos/crm/sucessao.test.ts`, `apps/api/src/rotas/crm/sucessao.test.ts` — UNI-11 (14-10)
- [x] `apps/web/src/dados/crm/notas.test.ts`, `consentimentos.test.ts` (14-11)
- [x] `apps/api/src/rotas/operacoes-canais-da-lista.test.ts` — UNI-17 (14-12)
- [x] `apps/api/src/servicos/crm/tarefas-conversacionais.test.ts` e `apps/api/src/rotas/crm/tarefas-conversacionais.test.ts` — UNI-12, 14, 15, 16 (14-13, 14-14)
- [x] `apps/web/src/dados/crm/tarefas-conversacionais.test.ts` — UNI-14 (14-15)
- [x] `derive-conversacional.test.ts` reescrito e `derive-conversacional-antigo.test.ts`; `esquemas/tarefas-conversacionais.test.ts` e `quem-pode.test.ts` ajustados (14-17)
- [x] Framework install: nenhum

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 011 aplica sobre a cópia dos dados reais do CRM antigo; contagens-base anotadas | UNI-03 | A cópia é do dono e contém dado pessoal de clientes: fica só no notebook dele (D-02) | Dono tira a cópia só das coleções do CRM antigo de `plataforma.registros`; o agente sobe `postgres:16`, aplica as migrações até a 011, confere contagens e apaga o contêiner (`docker rm -f`) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validada em 2026-11-04 pelo plano 14-18 (gate `npm run check` em Postgres 16 de Docker migrado até a 011, registrado em `14-PROVAS.md`). Web 1032 e domínio 2322 testes passam; a api passa tudo menos o flake de baseline de `outbox-worker.test.ts` (h a k), que isolado em banco novo passa 15/15, e, em outra rodada, o par de `colunas-geradas.test.ts`, que isolado passa 8/8. Os `<human-check>` dos planos 14-11, 14-15 e 14-16 (e a prova de tela do 14-12) viram prova manual do dono depois da migração, e o ensaio D-02 (14-19) é manual e segue pendente.

**Atualização de 2026-11-05:** o plano 14-19 foi concluído (ensaio da 011 sobre a cópia dos dados reais, `14-ENSAIO.md`); as linhas 14-19-1 e 14-19-2 estão verdes. Nenhuma lacuna Nyquist nova: a auditoria da fase (State A) não achou requisito UNI sem verificação automatizada ou manual declarada.
