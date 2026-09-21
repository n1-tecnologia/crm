---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 10
subsystem: api
tags: [postgres, outbox, fastify, zod, backoff, lease, idempotency]

# Dependency graph
requires:
  - phase: 02-03
    provides: "migração 003-integracao-e-importacao.sql com plataforma.integration_outbox e o índice único parcial por agregado"
  - phase: 02-04
    provides: "decideProcessApproval e a origem processTask de ApprovalRequest"
  - phase: 02-05
    provides: "submitForm e o padrão de operação síncrona sem I/O externo"
provides:
  - "outbox.ts: catálogo EVENTOS (três eventos .strict()) e gravarEventos() transacional"
  - "unidade-de-trabalho.ts: OpcoesExecucao<T>.eventos(valor, state) gravado entre gravar() e commit (D-18)"
  - "outbox-worker.ts: criarOutboxWorker (lease for update skip locked, backoff com jitter, sanitizarErro)"
  - "index.ts: inicialização condicional do worker sob OUTBOX_WORKER_ATIVO"
affects: ["02-13", "02-17", "02-21", "02-24", "fase 3 motor de automações"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Evento de saída produzido explicitamente por opcoes.eventos(valor, state) na rota — nunca deduzido do diferenca"
    - "Lease de fila por UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED) — sem transação explícita, atômico por ser uma única instrução"
    - "Relogio injetado (apps/api/src/testes/relogio.ts) também em código de produção, não só em teste — primeiro uso real da previsão do Plan 02-01"

key-files:
  created:
    - apps/api/src/persistencia/outbox.ts
    - apps/api/src/persistencia/outbox-worker.ts
    - apps/api/src/persistencia/outbox.test.ts
    - apps/api/src/persistencia/outbox-worker.test.ts
  modified:
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/index.ts

key-decisions:
  - "Payload dos três eventos segue literalmente o <action> do Plan 02-10 (taskId/readableId/listId/origin; taskId/commentId/parentCommentId/authorMemberId; taskId/approvalId/decision/source/decidedByMemberId) — mais rico que o §8 mínimo de docs/08-migracao-financeiro/04-contrato-plataforma-v1.md (que só cita eventId/taskId/.../occurredAt). eventId e occurredAt não entram no payload: já existem como colunas id/created_at da própria linha do outbox, e o worker os acrescenta no envelope HTTP na hora de entregar."
  - "apps/api/.env.example não foi tocado: as variáveis OUTBOX_DESTINO_URL/OUTBOX_TOKEN/OUTBOX_WORKER_ID/OUTBOX_WORKER_ATIVO ficaram fora de files_modified deste plano (esse arquivo pertence ao Plan 02-09, que roda em paralelo na mesma wave e ainda não tem SUMMARY neste worktree) — documentadas em comentário no próprio index.ts para não colidir com o outro plano."
  - "backoff(tentativa) é indexado pela tentativa que ACABOU de falhar (1=primeira), não pela próxima — a primeira entrega em si não tem espera (roda assim que a linha é reivindicada); a escada de RESEARCH.md (5s/30s/2min/10min/30min, depois 30min) vale a partir da PRIMEIRA falha."

patterns-established:
  - "OpcoesExecucao<T> genérico: quem chama executar() tipa eventos(valor: T, state) contra o T real da operação, sem cast"

requirements-completed: [SOL-07]

# Metrics
duration: ~50min
completed: 2026-09-21
---

# Phase 02 Plan 10: Outbox transacional e worker de entrega Summary

**Evento de saída nasce no mesmo commit da Tarefa (D-18) e é entregue por um worker com lease exclusiva no banco, backoff com jitter e erro sanitizado — SOL-07 tem a metade da plataforma que faltava.**

## Performance

- **Duration:** ~50min
- **Tasks:** 3/3 completed
- **Files modified:** 6 (2 novos de produção, 2 novos de teste, 2 modificados)

## Accomplishments

- `outbox.ts`: catálogo `EVENTOS` com os três eventos da fase (`solicitacao.criada.v1`, `solicitacao.comentario-criado.v1`, `solicitacao.aprovacao-decidida.v1`), cada payload `.strict()`, e `gravarEventos()` que insere no `pg.Client` da transação corrente, sem I/O de rede.
- `unidade-de-trabalho.ts` estendida: `OpcoesExecucao<T>.eventos?(valor, state)` é chamada entre `gravar()` e `cliente.query("commit")` — Tarefa e evento são a mesma transação; uma recusa do domínio ou um payload inválido não deixa nem um nem outro.
- `outbox-worker.ts`: `criarOutboxWorker()` reivindica com `for update skip locked` (duas instâncias nunca entregam o mesmo evento), classifica 2xx/permanente (400/401/403/404/422)/transitório (rede, timeout, 408, 429, 5xx), aplica `backoff()` com jitter ±20% e nunca grava erro cru — `sanitizarErro()` remove `Bearer`, CPF/CNPJ e URL com query string antes de `last_error_summary`/log.
- `index.ts`: o worker só liga sob `OUTBOX_WORKER_ATIVO === "true"` e para no `SIGTERM`; `buildApp()` continua sem saber que ele existe.
- Fault-Injection Matrix provada em `outbox.test.ts` (6 casos, commit atômico/rollback/índice único/payload sem vazamento) e `outbox-worker.test.ts` (6 casos contra Postgres real + 9 casos puros de `backoff`/`sanitizarErro` que rodam sempre, sem `DATABASE_URL`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Catálogo de eventos e gravação transacional na UoW** - `ca06096` (feat)
2. **Task 2: Worker de entrega com lease, backoff e erro sanitizado** - `287d32f` (feat)
3. **Task 3: Provas de atomicidade, lease e sanitização** - `40f6c6f` (test)

**Plan metadata:** commitado junto deste SUMMARY (docs)

## Files Created/Modified

- `apps/api/src/persistencia/outbox.ts` - `EVENTOS`, `EventoDeSaida`, `gravarEventos(cliente, workspaceId, eventos)`
- `apps/api/src/persistencia/outbox-worker.ts` - `criarOutboxWorker`, `backoff`, `sanitizarErro`, `LinhaOutbox`
- `apps/api/src/persistencia/unidade-de-trabalho.ts` - `OpcoesExecucao<T>.eventos`, chamada a `gravarEventos` antes do commit
- `apps/api/src/index.ts` - inicialização/parada condicional do worker
- `apps/api/src/persistencia/outbox.test.ts` - casos (a)-(f) da Fault-Injection Matrix (transação)
- `apps/api/src/persistencia/outbox-worker.test.ts` - casos (g)-(n) (entrega, lease, backoff, sanitização)

## Decisions Made

- Payload dos três eventos segue o `<action>` do PLAN.md literalmente (mais campos que o mínimo do contrato v1 §8); `eventId`/`occurredAt` vêm das colunas `id`/`created_at` da própria linha, não do payload — o worker monta o envelope HTTP combinando os dois na hora de entregar.
- `apps/api/.env.example` não foi editado: as variáveis `OUTBOX_*` pertencem a `files_modified` do Plan 02-09 (mesma wave, execução paralela, sem SUMMARY neste worktree ainda) — documentado em comentário em `index.ts` para não colidir.
- `backoff(tentativa)` é indexado pela tentativa que falhou (1 = a primeira, sem espera prévia); a escada de 5s/30s/2min/10min/30min vale a partir da primeira falha, não da primeira tentativa.
- `outbox-worker.ts` importa `Relogio`/`relogioDoSistema` de `apps/api/src/testes/relogio.ts` em código de PRODUÇÃO — é exatamente o que o `02-01-SUMMARY.md` previu ("os planos 02-10/02-17/02-24 vão usar"); `apps/api/src/testes/CONTEXT.md` ainda diz "nenhum arquivo de produção importa esta pasta", frase que fica desatualizada a partir deste plano (fora de `files_modified`, não corrigida aqui).

## Deviations from Plan

None - plano executado como escrito. As três decisões acima são preenchimento de lacuna de especificação (payload exato, indexação do backoff) e coordenação de escopo entre planos paralelos (`.env.example`), não desvio de comportamento.

## Issues Encountered

- `apps/api/.env` não existe neste worktree (gitignorado, não herdado) — `DATABASE_URL` ausente, então os 12 casos que dependem de Postgres real (`outbox.test.ts` (a)-(f), `outbox-worker.test.ts` (g)-(l)) pulam em vez de rodar, exatamente como `persistencia.test.ts`/`integracao.test.ts` já fazem (D-DEC-09). Os 9 casos puros (`backoff`, `sanitizarErro`) rodam e passam sempre. `npm run check` está verde nos três workspaces (dominio 288, web 53, api 220 passando + 64 puladas) — a verificação "com `DATABASE_URL`" fica para quando um ambiente com Postgres real rodar esta suíte (ou para `/gsd-verify-phase 2`).

## User Setup Required

None - nenhuma configuração externa manual introduzida por este plano (as variáveis `OUTBOX_*` de ambiente pertencem à documentação de `.env.example` do Plan 02-09).

## Next Phase Readiness

- `executar()` está pronto para qualquer rota da Fase 2 passar `eventos` e ganhar outbox de graça (Plans 02-13, 02-21 — Formulário público e decisão de aprovação).
- O worker entrega para `OUTBOX_DESTINO_URL` + o caminho de webhook por tipo de evento; falta a rota `POST /webhooks/plataforma/*` do lado do `automation/` existir de verdade para a entrega ter para onde ir (fora do escopo de `apps/api`).
- Pendência explícita para a próxima verificação de fase: rodar `outbox.test.ts`/`outbox-worker.test.ts` contra Postgres real (`DATABASE_URL` definida) para fechar V02-07A/V02-03C com banco de verdade, não só com os casos puros.
- `apps/api/.env.example` ainda não documenta `OUTBOX_*` — se o Plan 02-09 não cobrir isso, é um gap a fechar antes do worker ir para produção.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: apps/api/src/persistencia/outbox.ts
- FOUND: apps/api/src/persistencia/outbox-worker.ts
- FOUND: apps/api/src/persistencia/outbox.test.ts
- FOUND: apps/api/src/persistencia/outbox-worker.test.ts
- FOUND: apps/api/src/persistencia/unidade-de-trabalho.ts
- FOUND: apps/api/src/index.ts
- FOUND: .planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-10-SUMMARY.md
- FOUND commit: ca06096 (Task 1)
- FOUND commit: 287d32f (Task 2)
- FOUND commit: 40f6c6f (Task 3)
