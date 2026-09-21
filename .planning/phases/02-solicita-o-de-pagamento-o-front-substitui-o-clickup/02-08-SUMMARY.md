---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 08
subsystem: database
tags: [dominio, evolver, catalogo, financeiro, solicitacao-de-pagamento, unidade-de-trabalho, cli]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-06 — CATALOGO_SOLICITACAO_DE_PAGAMENTO (4 Status, 25 Campos, 1 Tag, 5 Papéis)"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login
    provides: "bootstrap-gestao.ts, bootstrap/gestao.ts (bootstrapGestao), Unidade de Trabalho (executar), repositorio.ts (hidratar/semear/gravar)"
provides:
  - "evoluirConfiguracaoDeSolicitacoes (@n1/dominio) — evolver idempotente: cria-ou-confere Lista/Status/Campos/Tag/Papéis, nunca sobrescreve, nunca toca Tarefa/Comentário"
  - "configurarSolicitacoes (apps/api/src/bootstrap/solicitacoes.ts) — dry-run (hidrata+rollback) ou apply (Unidade de Trabalho)"
  - "npm run solicitacoes:configurar -w @n1/api — CLI com --dry-run padrão, --apply explícito, saída só com ids/contagens"
  - "ImposedLimits.tasksPerList mutável — elevação consciente registrada em Atividade"
affects: [02-13 aprovação por clique, 02-21, qualquer Plan que precise materializar a Lista de verdade antes da importação de ~1.110 Tarefas históricas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "evolver idempotente de configuração: criar-ou-conferir por id literal, divergência recusa com diff legível, nunca remove nem sobrescreve"
    - "dry-run como hidratar()+rollback dentro de uma transação própria, quando executar() perderia o valor calculado no caminho de fail"

key-files:
  created:
    - packages/dominio/src/solicitacao-de-pagamento-evolver.ts
    - packages/dominio/src/solicitacao-de-pagamento-evolver.test.ts
    - apps/api/src/bootstrap/solicitacoes.ts
    - apps/api/src/bootstrap/solicitacoes.cli.ts
    - apps/api/src/bootstrap/solicitacoes.test.ts
  modified:
    - packages/dominio/src/types/workspace.ts
    - apps/api/src/bootstrap/CONTEXT.md
    - apps/api/package.json

key-decisions:
  - "Papéis do catálogo materializam como Role (state.roles), não como Grant direta: sem ocupante padrão (D-13), o Papel é o que o evolver cria; a Grant que liga um Membro real a esse Papel nasce por convite/atribuição, fora deste evolver — 'Agente do pipeline' vira base convidado (§9 do catálogo), os outros quatro viram base membro"
  - "PermissionScope (registro|subarvore|proprios) é mais estreito que o vocabulário de negócio do catálogo (proprias|roteadas|aprovadas|todas): 'roteadas' e 'aprovadas' dependem de resolverAprovador/Status, não de um recorte estrutural — aproximado para o valor mais próximo, documentado em comentário, sem inventar campo novo em Role"
  - "Nenhum TaskType novo criado: o catálogo do Plan 02-06 não inclui um, e a Lista herda o Tipo 'Conta' já definido na Pasta 'Financeiro' (B25) — criar um Tipo próprio agora seria acrescentar um elemento fora do catálogo e fora do files_modified do plano"
  - "dry-run hidrata e dá rollback por conta própria, em vez de usar executar() com um fail proposital: executar() só devolve o diferenca/valor completo no caminho ok, então um fail intencional perderia o diff que o dry-run precisa mostrar"

patterns-established:
  - "Extra-check de divergência (elemento presente no estado mas fora do catálogo) só onde é seguro: Status (escopado dentro do statusSet da própria Lista) e Campo (escopado por definedAtId === id da Lista); Tag e Papel ficam sem esse check porque são coleções compartilhadas com o resto do Espaço e um extra ali não é necessariamente do Solicitações de pagamento"

requirements-completed: [SOL-01]

# Metrics
duration: ~16min
completed: 2026-09-21
---

# Phase 02 Plan 08: Evolver da Lista "Solicitações de pagamento" Summary

**`evoluirConfiguracaoDeSolicitacoes` materializa o catálogo do Plan 02-06 num `DataState` vivo — cria-ou-confere Lista/4 Status/25 Campos/Tag/5 Papéis sem nunca sobrescrever, eleva `tasksPerList` a 5000, e `npm run solicitacoes:configurar -w @n1/api` aplica isso contra o Postgres real em dry-run por padrão.**

## Performance

- **Duration:** ~16 min
- **Tasks:** 3 completed
- **Files modified:** 8 (5 criados, 3 modificados)

## Accomplishments
- `evoluirConfiguracaoDeSolicitacoes` (packages/dominio) evolui um `DataState` já bootstrapado pela Fase 1: localiza Espaço "Gestão"/Pasta "Financeiro" (recusa se ausentes), cria-ou-confere cada elemento do catálogo do Plan 02-06, recusa com diff legível (id, campo, esperado, encontrado) diante de qualquer divergência, e eleva `tasksPerList` de 500 para 5000 (V02-01B) só quando não há divergência.
- 8 casos de teste puro (a)-(h) provam V02-01A: criação, reaplicação sem duplicar, recusa de Status renomeado sem mudar o estado, sobrevivência de Tarefa/Comentários a uma reevolução, elevação monotônica do limite, recusa quando a Pasta "Financeiro" não existe, uma Atividade por elemento criado + 1 pela elevação, e Campo extra reportado (nunca removido).
- `configurarSolicitacoes` + `npm run solicitacoes:configurar -w @n1/api`: `--dry-run` é o padrão (hidrata, calcula o diff, faz rollback), `--apply` grava de verdade dentro da Unidade de Trabalho; saída só com ids/contagens (T-02-21), código de saída 1 em divergência.
- 4 casos de integração contra o Postgres real (pulam sem `DATABASE_URL`): dry-run não grava nada, apply cria e reaplicar é no-op, `tasksPerList` sobe e fica >= 5000, e nenhuma linha de `tasks` (Tarefa e seus Comentários embutidos) é tocada pelo apply.

## Task Commits

Each task was committed atomically:

1. **Task 1: `evoluirConfiguracaoDeSolicitacoes` — criar o ausente, comparar o existente** - `e4e076f` (feat)
2. **Task 2: Testes puros do evolver** - `c348856` (test)
3. **Task 3: Serviço, CLI e prova contra o Postgres real** - `70fd017` (feat)

**Plan metadata:** (este commit, ao final)

## Files Created/Modified
- `packages/dominio/src/solicitacao-de-pagamento-evolver.ts` - `evoluirConfiguracaoDeSolicitacoes`, `DiffDeConfiguracao`, `DivergenciaDeConfiguracao`; materializa Lista/Status/Tag/Campos/Papéis com ids literais estáveis (`lst_solicitacoes_de_pagamento`)
- `packages/dominio/src/solicitacao-de-pagamento-evolver.test.ts` - 8 casos (a)-(h) sobre `buildGestaoBootstrap()`
- `packages/dominio/src/types/workspace.ts` - `ImposedLimits.tasksPerList` deixa de ser `readonly`, com comentário explicando a decisão consciente
- `apps/api/src/bootstrap/solicitacoes.ts` - `configurarSolicitacoes({ workspaceId, actingMemberId, dryRun, tasksPerListMinimo })`
- `apps/api/src/bootstrap/solicitacoes.cli.ts` - CLI fino: `--dry-run`/`--apply`/`--workspace=`/`--membro=`/`--limite=`
- `apps/api/src/bootstrap/solicitacoes.test.ts` - 4 casos (i)-(iv) contra o Postgres real, `describe.skip` sem `DATABASE_URL`
- `apps/api/src/bootstrap/CONTEXT.md` - seção "Bootstrap × evolver (Plan 02-08)" com a tabela comparativa e a regra do `--dry-run` padrão
- `apps/api/package.json` - script `solicitacoes:configurar` (única linha acrescentada, sem reordenar nada)

## Decisions Made
- **Papéis → `Role`, não `Grant`:** o comentário do Plan 02-06 em `solicitacao-de-pagamento.ts` diz que o catálogo "é o que o evolver usa para gerar as Grants reais quando a Lista nasce", mas com `ocupantesPadrao` vazio (D-13) não há sujeito para uma Grant apontar ainda. Optei por materializar cada Papel como um `Role` (`system: false`, `base` derivado, `permissions` derivadas de `capacidades`/`escopo`) — o mesmo formato que `seed.ts` já usa para Papéis personalizados (`role_vendas`, `role_agente_crm`). A Grant que liga um Membro real a esse Papel nasce por convite/atribuição, fora deste evolver, como o próprio D-13 exige.
- **Mapeamento de `escopo` para `PermissionScope`:** "proprias" → `proprios` (equivalência direta); "roteadas"/"aprovadas"/"todas" → `subarvore` (aproximação documentada em comentário, porque o vocabulário estrutural de `Role.permissions` é mais estreito que o vocabulário de negócio do catálogo — o recorte fino continua sendo `resolverAprovador`/Status, consultado em tempo de leitura pelos Plans 02-13/02-21, não um campo novo inventado em `Role`).
- **Sem TaskType novo:** a spec (`docs/07-processos/solicitacao-de-pagamento.md` §2) menciona um "Tipo de Tarefa próprio" no ClickUp, mas o catálogo do Plan 02-06 não inclui um TaskType, e nenhum Plan da fase lista essa responsabilidade. A Lista herda o Tipo "Conta" já definido na Pasta "Financeiro" (B25); criar um Tipo aqui seria um elemento fora do catálogo e fora de `files_modified`.
- **`dry-run` hidrata e dá rollback por conta própria** em vez de usar `executar()` com um `fail` proposital — `executar()` só devolve `diferenca`/o valor completo no caminho `ok`; um `fail` intencional depois de calcular o diff perderia justamente o que o dry-run precisa mostrar (a mesma observação que o plano já registrava na Task 3, seguida à risca).
- **Extra-check de divergência só onde é seguro:** aplicado a Status (dentro do `statusSet` da própria Lista) e Campo (escopado por `definedAtId === id da Lista`); Tag e Papel não recebem esse check porque `state.tags`/`state.roles` são coleções compartilhadas com o resto do Espaço — um extra ali não é necessariamente da Lista "Solicitações de pagamento" (evita falso positivo contra as 8 Tags `conta *` de "Contas a pagar", por exemplo).

## Deviations from Plan

None - plan executed exactly as written. As escolhas acima (Papel → Role, mapeamento de escopo, ausência de TaskType, escopo do extra-check) são decisões de implementação dentro do espaço que o plano deixou em aberto ("Claude's Discretion" do CONTEXT da fase) — nenhuma altera um `must_have`, um critério de aceite ou o `threat_model` do plano.

## Issues Encountered
- O `grep -n 'nextId'` do critério de aceite da Task 1 inicialmente pegava a palavra dentro de comentários explicativos (não código) — reformulei os dois comentários para não conter a substring literal, sem perder a explicação da regra. Corrigido antes do commit da Task 1; typecheck e os 288 testes pré-existentes seguiram verdes.

## User Setup Required
None - no external service configuration required. A aplicação real (`--apply`) contra o Postgres de produção é ação manual do Financeiro/operador, fora deste plano (nenhum comando foi rodado contra um banco de verdade nesta execução — `DATABASE_URL` não está configurada neste worktree, como esperado).

## Next Phase Readiness
`evoluirConfiguracaoDeSolicitacoes` e `configurarSolicitacoes` estão prontos para qualquer operador rodar `npm run solicitacoes:configurar -w @n1/api -- --apply` contra o Espaço "Gestão" de produção, materializando a Lista "Solicitações de pagamento" ao lado de "Contas a pagar" antes da importação das ~1.110 Tarefas históricas (que exige `tasksPerList` elevado — já garantido por este evolver). Nenhum bloqueio conhecido; o Papel `rol_sp_aprovador` fica disponível como `Role` para os Plans 02-13/02-21 (aprovação por clique) atribuírem a Membros reais.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: packages/dominio/src/solicitacao-de-pagamento-evolver.ts
- FOUND: packages/dominio/src/solicitacao-de-pagamento-evolver.test.ts
- FOUND: packages/dominio/src/types/workspace.ts
- FOUND: apps/api/src/bootstrap/solicitacoes.ts
- FOUND: apps/api/src/bootstrap/solicitacoes.cli.ts
- FOUND: apps/api/src/bootstrap/solicitacoes.test.ts
- FOUND: apps/api/src/bootstrap/CONTEXT.md
- FOUND: apps/api/package.json
- FOUND commit: e4e076f (Task 1)
- FOUND commit: c348856 (Task 2)
- FOUND commit: 70fd017 (Task 3)
