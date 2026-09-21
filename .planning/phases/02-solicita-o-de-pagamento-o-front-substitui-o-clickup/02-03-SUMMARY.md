---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 03
subsystem: database
tags: [postgres, supabase, migrations, vitest, integration-testing, outbox-pattern, idempotency]

# Dependency graph
requires:
  - phase: 01
    provides: "apps/api Fastify + persistência (repositorio.ts, migrar.ts) sobre plataforma.registros"
provides:
  - "6 tabelas de transporte em plataforma.*: integration_outbox, http_idempotency, service_credentials, upload_sessions, upload_objects, importacao_ledger"
  - "prova de integração contra Postgres real dos invariantes de unicidade/lease dessas tabelas"
affects: ["02-10", "02-11", "02-13", "02-25"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migração numerada e imutável (apps/api/migracoes/NNN-*.sql), aplicada uma vez, registrada em plataforma.migracoes"
    - "Teste de integração que pula sem DATABASE_URL (describe.skipIf via temBanco ? describe : describe.skip, D-DEC-09)"
    - "Invariante de negócio expresso como constraint de banco (índice único parcial), não como checagem em código"

key-files:
  created:
    - apps/api/migracoes/003-integracao-e-importacao.sql
    - apps/api/src/persistencia/integracao.test.ts
  modified:
    - apps/api/src/persistencia/CONTEXT.md

key-decisions:
  - "Migração 003 aplicada contra o projeto Supabase da plataforma (epomplsskqpluxuujpxl, DEC-08), confirmado antes do apply"
  - "As seis tabelas de transporte nunca entram em hidratar()/gravar(): quem grava/lê é o código de integração/importação, direto contra pg.Client"
  - "Cada caso de teste usa um prefixo próprio por execução (RUN/WORKSPACE com timestamp+random) e limpa as próprias linhas em beforeAll/afterAll, sem tocar em plataforma.registros nem em linhas de outras execuções — necessário porque este plano roda sequencial contra o Supabase real e compartilhado"

requirements-completed: [SOL-02, SOL-05, SOL-07, SOL-09]

# Metrics
duration: ~20min (Task 3 apenas — Tasks 1 e 2 executadas em sessões anteriores)
completed: 2026-09-21
---

# Phase 02 Plan 03: Migração 003 (tabelas de transporte) Summary

**Seis tabelas de transporte no schema `plataforma` (outbox transacional, idempotência HTTP, credenciais de serviço, sessões de upload e ledger de importação) aplicadas no Supabase real, com os seis invariantes de unicidade/lease provados por teste de integração contra o banco.**

## Performance

- **Tasks:** 3/3 (Tasks 1 e 2 completas em execuções anteriores; Task 3 executada nesta sessão)
- **Files modified:** 3 (1 criado nesta sessão: `integracao.test.ts`; 1 modificado: `CONTEXT.md`; migração 003 já existia em disco, sem alteração)

## Accomplishments

- **Task 1 (execução anterior, commit `e5b8682`):** `apps/api/migracoes/003-integracao-e-importacao.sql` escrita — 6 `create table if not exists` no schema `plataforma`, seguindo a convenção idempotente de `001`/`002`, com comentário de cabeçalho em pt-BR justificando cada tabela e proibindo dado financeiro identificável em `payload`, `motivo` e `response_body`.
- **Task 2 (verificada pelo orquestrador, sem commit de código — só execução de comando):** migração aplicada de verdade contra o Supabase da plataforma:
  - Alvo confirmado: `db.epomplsskqpluxuujpxl.supabase.co` (porta 5432, database `postgres`) — o projeto da plataforma por DEC-08, não o do `financeiro-tria`.
  - Primeira execução: `aplicada  003-integracao-e-importacao.sql  (898 ms)`.
  - Segunda execução: `Nada a aplicar: o banco já está em dia.` — idempotente, como o runner exige.
  - `select nome from plataforma.migracoes order by nome` devolve exatamente `001-plataforma.sql, 002-registros-colunas-geradas.sql, 003-integracao-e-importacao.sql`.
  - As 6 tabelas de transporte existem: contagem em `information_schema.tables` (`table_schema='plataforma'`) para `integration_outbox`, `http_idempotency`, `service_credentials`, `upload_sessions`, `upload_objects`, `importacao_ledger` devolve **6 de 6**.
- **Task 3 (esta sessão, commit `93d2e40`):** `apps/api/src/persistencia/integracao.test.ts` criado com os 6 casos obrigatórios do plano, todos provados contra o Postgres real:
  - (a) `integration_outbox`: segundo insert com o mesmo `(aggregate_type, aggregate_id, 'solicitacao.criada.v1')` viola o índice único parcial; `event_type` diferente para o mesmo agregado é aceito.
  - (b) lease do outbox: duas conexões concorrentes disputando a mesma linha `pending` via `for update skip locked` — só uma reivindica (`total === 1`).
  - (c) `http_idempotency`: segunda linha com a mesma primary key composta `(service_id, route_template, idempotency_key)` é recusada.
  - (d) `upload_objects.object_key`: único entre sessões distintas — segundo insert com a mesma `object_key` em outra `session_id` é recusado.
  - (e) `importacao_ledger`: segunda linha com o mesmo `(origem, legacy_task_id)` é recusada; o mesmo `legacy_task_id` com `origem` diferente é aceito.
  - (f) `service_credentials`: duas linhas `ativa`/`rotacionando` simultâneas para o mesmo `workspace_id` são aceitas (rotação com duas versões válidas); `state` fora do `check` (`'invalida'`) é recusado.
  - Suíte inteira pula sem `DATABASE_URL` (`temBanco ? describe : describe.skip`), confirmado rodando com `DATABASE_URL=` vazio.
  - `apps/api/src/persistencia/CONTEXT.md` ganhou a seção "Tabelas de transporte (Fase 2)" explicando o papel das seis tabelas, por que nada nelas entra em `hidratar()`/`gravar()`, e o que não pode vazar em cada coluna sensível.

## Task Commits

Tasks 1 e 2 foram executadas e commitadas/verificadas em sessões anteriores a esta:

1. **Task 1: Escrever a migração 003** — `e5b8682` (feat, execução anterior, merge trazido para esta branch pelo orquestrador)
2. **Task 2: Aplicar a migração no Supabase da plataforma** — sem commit de código (execução de comando); verificado pelo orquestrador com evidência completa acima

Task desta sessão:

3. **Task 3: Teste de integração das constraints contra o Postgres real** — `93d2e40` (test)

## Files Created/Modified

- `apps/api/migracoes/003-integracao-e-importacao.sql` — já existente nesta árvore de trabalho (Task 1, execução anterior); não modificado nesta sessão (migrações são imutáveis uma vez aplicadas, DEC-10)
- `apps/api/src/persistencia/integracao.test.ts` — novo; 6 casos de teste de integração contra as tabelas de transporte
- `apps/api/src/persistencia/CONTEXT.md` — seção "Tabelas de transporte (Fase 2)" acrescentada

## Decisions Made

- Prefixar cada execução do teste com um `RUN`/`WORKSPACE` derivado de `Date.now()` + sufixo aleatório, em vez de um workspace fixo como `persistencia.test.ts`/`colunas-geradas.test.ts` usam — necessário porque este plano roda como executor sequencial contra o banco real e compartilhado (não um worktree isolado), e as seis tabelas não têm uma coluna `workspace_id` universal (`http_idempotency` e `importacao_ledger` não têm `workspace_id`; usam `service_id`/`origem` como namespace de limpeza).
- Nenhum caso de teste depende de outro nem compartilha estado além do prefixo comum, para que uma falha em um caso não invalide os demais.

## Deviations from Plan

None - plan executado como escrito no Task 3. Tasks 1 e 2 foram herdadas já completas e verificadas conforme o checkpoint resolvido pelo orquestrador (ver seção acima) — nenhuma modificação foi feita a elas nesta sessão.

## Issues Encountered

None.

## User Setup Required

None - a migração já foi aplicada pelo orquestrador contra o Supabase da plataforma; nenhuma configuração adicional é necessária.

## Next Phase Readiness

As seis tabelas de transporte existem no banco real com as constraints que os Planos 02-10 (outbox/evento), 02-11 (upload), 02-13 (idempotência HTTP/credenciais) e 02-25 (importação) vão assumir — provadas, não só descritas. Nenhum bloqueio identificado para esses planos consumirem esta migração.

## Self-Check: PASSED

- FOUND: `apps/api/src/persistencia/integracao.test.ts`
- FOUND: `apps/api/migracoes/003-integracao-e-importacao.sql`
- FOUND: seção "Tabelas de transporte (Fase 2)" em `apps/api/src/persistencia/CONTEXT.md`
- FOUND: commit `93d2e40` (Task 3)
- FOUND: commit `e5b8682` (Task 1, execução anterior)
- FOUND: commit `af627eb` (este SUMMARY.md)

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*
