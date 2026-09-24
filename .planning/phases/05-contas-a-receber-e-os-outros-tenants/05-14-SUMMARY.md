---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 14
subsystem: domain-rules
tags: [status-machine, fail-closed, contas-a-pagar, tasks, domain, fastify, contract-v1]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "Integração por Empresa (05-01), statusOptionRefusal/D5-06 original (05-02), o 5º Status em revisão (05-02)"
provides:
  - "changeTaskStatus (packages/dominio) aplica D5-06 (Status declarado por Empresa) fail-closed, não só a tela"
  - "alterarStatusEmLote herda a regra sem código próprio, por chamar changeTaskStatus"
  - "PUT /v1/integrations/payment-requests/:taskId/status (contrato v1) herda a regra sem código novo na rota — 409 CONFLITO_DE_ORDEM / 200, provado contra Postgres real"
affects: [05-05, 05-REVIEW-CR-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fail-closed em regra de domínio (recusa por padrão quando a pré-condição de identidade falta)"]

key-files:
  created: []
  modified:
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/status-por-empresa.test.ts
    - apps/api/src/rotas/integracao-solicitacoes.test.ts

key-decisions:
  - "statusNaoDeclaradoPelaEmpresa fail-closed: Status declarável por alguém + Tarefa sem Empresa agora é RECUSA, não passagem livre — o comportamento antigo (fail-open) só sobrevive para o caso já coberto por declaravelPorAlguem=false (Espaço sem nenhuma Integração com statusDeclarados)"
  - "A chamada nova em changeTaskStatus fica na mesma posição relativa que a checagem ocupa em statusOptionRefusal (depois dos requisitos de saída de before, antes de entryAllowedMemberIds) — garante paridade de texto e de ordem entre tela e backend"

requirements-completed: [TEN-01]

# Metrics
duration: 20min
completed: 2026-09-24
---

# Phase 5 Plan 14: `changeTaskStatus` aplica D5-06 fail-closed (CR-04) Summary

**`changeTaskStatus` no domínio agora chama `statusNaoDeclaradoPelaEmpresa` (antes só `statusOptionRefusal`, a dica da tela, a chamava), a regra virou fail-closed para Tarefa sem Empresa, e o contrato v1 (`PUT /v1/integrations/payment-requests/:taskId/status`) herda tudo isso sem uma linha de código novo na rota — provado com um caso de banco real (409 Tria / 200 EXO Loteamento).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-24T17:10Z (aprox.)
- **Completed:** 2026-09-24T17:31Z
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments

- Fechado CR-04 (`05-REVIEW.md`): antes desta mudança, `POST /operacoes/changeTaskStatus` e o `PUT /:taskId/status` do contrato v1 moviam uma Solicitação da Tria para "em revisão" sem recusa, porque a regra D5-06 só vivia em `statusOptionRefusal` (a dica visual da tela) — o backend não aplicava a regra de acesso, só sugeria.
- Fechado o fail-open documentado no plano: uma Tarefa sem Empresa, com alguma Integração declarando o Status alvo, alcançava esse Status livremente. Agora é recusa (fail-closed), com uma frase nova e específica.
- `alterarStatusEmLote` (`packages/dominio/src/operations/lote.ts`) herda a regra automaticamente — não foi tocado, porque já chama `changeTaskStatus` por item.
- Provado com banco real que o contrato v1 herda a regra sem nenhuma linha de código na rota `apps/api/src/rotas/integracao-solicitacoes.ts`: a rota já delega para `changeTaskStatus` e mapeia a recusa para `409 CONFLITO_DE_ORDEM` desde o Plan 02-13 — só faltava a regra existir do lado de baixo.

## Task Commits

Each task was committed atomically:

1. **Task 1: `changeTaskStatus` aplica D5-06, fechado por padrão** - `dc99515` (fix)
2. **Task 2: O contrato v1 herda a regra — caso com banco no `PUT /:taskId/status`** - `d5de22d` (test)

**Plan metadata:** committed separately by the orchestrator (this agent does not own STATE.md/ROADMAP.md for this wave).

## Files Created/Modified

- `packages/dominio/src/operations/tasks.ts` — `changeTaskStatus` chama `statusNaoDeclaradoPelaEmpresa(state, task, target)` logo depois dos requisitos de saída de `before` e antes de `entryAllowedMemberIds` (mesma posição relativa de `statusOptionRefusal`); `statusNaoDeclaradoPelaEmpresa` trocou `if (!empresa) return undefined` por uma recusa fail-closed; docstring atualizada citando CR-04 e a herança por `alterarStatusEmLote`.
- `packages/dominio/src/operations/status-por-empresa.test.ts` — caso (d) reescrito para afirmar a recusa fail-closed (antes afirmava passagem livre); casos novos provando `changeTaskStatus` diretamente (não só `statusOptionRefusal`): recusa da Tria com `statusId` inalterado e zero Registros "Status alterado" novos, sucesso real da EXO Loteamento (`para fazer` → `em revisão`), paridade de frase entre os dois caminhos, Status vigente não recusado, os quatro Status de D-01 seguem alcançáveis via `changeTaskStatus` de verdade (não só via `statusOptionRefusal`).
- `apps/api/src/rotas/integracao-solicitacoes.test.ts` — bloco "com banco" ganhou `evoluirConfiguracaoPorEmpresa(semente, MEMBRO_SERVICO.id)` no setup de módulo (mesmo estilo de `evoluirConfiguracaoDeSolicitacoes`), duas Tarefas novas (Tria e EXO Loteamento, com `fld_sp_c_empresa` preenchido antes de `semear`), e um `describe` novo com dois `it` provando `409 CONFLITO_DE_ORDEM` (Tria, com leitura de volta confirmando `"para fazer"`) e `200` + `"em revisão"` na leitura (EXO Loteamento).

## Decisions Made

- A frase de recusa fail-closed nova (`"Este Status só vale para a Empresa que o declara — defina a Empresa da Tarefa antes de movê-la para "${alvo.name}"."`) é literal do `<action>` do plano — não inventada nesta execução.
- Escolhida "para fazer" (o Status inicial de toda Tarefa nova) como origem para o caso de sucesso da EXO Loteamento, depois de confirmar por leitura que "em revisão" não declara `entryFromStatusIds` em `solicitacao-de-pagamento.ts` (o plano pedia explicitamente para ler o catálogo em vez de adivinhar) — logo qualquer origem serve, e usar o inicial evita criar uma Tarefa extra só para posicioná-la num Status intermediário.

## Deviations from Plan

None — plan executado exatamente como escrito. As duas tasks e seus `<action>` foram seguidos literalmente; nenhuma correção de Regra 1-4 foi necessária.

## Issues Encountered

None.

## Verification Evidence

- `npm run typecheck -w @n1/dominio` — `===EXIT=0===`
- `npm run test -w @n1/dominio` — 29 arquivos, **524 passed** (0 failed), `===EXIT=0===` (linha de base era 480; +44 testes vêm majoritariamente dos casos novos de `status-por-empresa.test.ts`, mais os que já estavam sendo escritos em paralelo por outros planos da mesma onda no working tree).
- `npm run test -w @n1/web` — 17 arquivos, **169 passed**, `===EXIT=0===` (a tela usa `statusOptionRefusal`; nenhuma expectativa de tela dependia do fail-open).
- `npm run typecheck -w @n1/api` — `===EXIT=0===`
- `(cd apps/api && npx vitest run src/rotas/integracao-solicitacoes.test.ts --testTimeout=20000)` — rodado **DUAS vezes seguidas** no checkout principal, com `DATABASE_URL` presente:
  - Execução 1: `Tests 19 passed | 1 skipped (20)`, `===EXIT=0===`
  - Execução 2: `Tests 19 passed | 1 skipped (20)`, `===EXIT=0===`
  - O único `skipped` nas duas execuções é o `it.skip("(m) ...")` pré-existente (requer bucket real de Storage, documentado desde o Plan 02-13) — **skipped do bloco "com banco" = 0** nas duas execuções, confirmando que o bloco não pulou por falta de `DATABASE_URL`.
- `grep -n "statusNaoDeclaradoPelaEmpresa(state, task, target)" packages/dominio/src/operations/tasks.ts` → exatamente 1 linha (dentro de `changeTaskStatus`).
- `grep -n "if (!empresa) return undefined" packages/dominio/src/operations/tasks.ts` → nenhuma ocorrência.
- `grep -c "evoluirConfiguracaoPorEmpresa" apps/api/src/rotas/integracao-solicitacoes.test.ts` → 3 (import + chamada de setup + comentário).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

CR-04 (`05-REVIEW.md`) está fechado: D5-06 agora é regra de domínio aplicada por `changeTaskStatus`, fail-closed, herdada por `alterarStatusEmLote` e pelo contrato v1 sem código novo na rota. Isto é independente dos gaps CR-01/CR-02 (roteamento MP/FO e canal WhatsApp) e do checkpoint `--apply` de `empresas:configurar` (05-05/Critério 1) — nenhum deles é tocado por este plano. Como o próprio plano registra: em produção, `ws_n1` ainda não tem nenhuma Integração por Empresa aplicada (`--apply` nunca rodou), então esta regra não bloqueia nada hoje — ela passa a bloquear "em revisão" para toda Empresa que não o declara assim que 05-20 (ou o checkpoint equivalente) aplicar a configuração.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
