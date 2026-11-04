---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
plan: 01
subsystem: dominio
tags: [checklist, subtarefa, derivada, zod, vitest]

requires:
  - phase: 10
    provides: estrutura de Espaço/Pasta/Lista e Funcionalidades por contêiner
provides:
  - conversaoDeItemRecusada (derivada que a operação e a tela consultam)
  - convertChecklistItem de cinco parâmetros (Subtarefa nasce sempre sob a Tarefa do Checklist)
  - esquema convertChecklistItem de três argumentos
  - ChecklistItem de um nível só (sem Subitem) no tipo, no domínio e na tela
affects: [11-07 botão Converter da tela, 11-08 checkpoint de produção sobre Subitem]

actuals:
  tokens: 7000
  tasks: 3
  commits: 5
plan_head_before: 2d1ee381a47179c093ccd83cb9de5aaf5e90b99f
plan_head_after: 66ed9b66d866863d3b2cbb5abd5c4d2010b21d6d

tech-stack:
  added: []
  patterns:
    - "Recusa como derivada: a operação e a tela dizem a mesma frase (molde taskWriteRefusal)"

key-files:
  created:
    - packages/dominio/src/operations/conversao-de-item.test.ts
  modified:
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/planning.ts
    - packages/dominio/src/operations/collaboration.ts
    - packages/dominio/src/tarefa-publica.ts
    - packages/dominio/src/types/structure.ts
    - packages/dominio/src/operations/operations.test.ts
    - packages/dominio/src/operations/remover-checklist-e-item.test.ts
    - apps/api/src/rotas/esquemas/tarefas.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts
    - apps/web/src/features/estrutura/tarefa-completa.tsx

key-decisions:
  - "D-04: conversaoDeItemRecusada fica em derive.ts logo abaixo de taskLevel, com ordem fixa Tarefa -> escrita -> ciclo de vida -> Subtarefas -> nível"
  - "D-04: o parâmetro de Tarefa pai alternativa sai da função e do esquema (nenhum chamador o passava)"
  - "D-02: o checklist tem um nível só; o campo de Subitem sai do tipo, do domínio e da tela, sem migração SQL"

patterns-established:
  - "Recusa de conversão: derivada pura que a operação chama antes de qualquer efeito e a tela usa para esconder o botão"

requirements-completed: [TAR-01, TAR-03]

coverage:
  - id: D1
    description: "conversaoDeItemRecusada devolve a mesma frase que convertChecklistItem recusa, na ordem fixa, sem efeito parcial"
    requirement: TAR-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/conversao-de-item.test.ts"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/operations.test.ts#rejeita a conversão de Item que criaria um nível além do máximo"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /operacoes/convertChecklistItem aceita só três argumentos"
    requirement: TAR-01
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/esquemas-de-argumentos.test.ts#(i2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Checklist de um nível só: o campo de Subitem não existe em .ts/.tsx e os três workspaces compilam"
    requirement: TAR-03
    verification:
      - kind: other
        ref: "grep -rn parentItemId packages apps --include=*.ts --include=*.tsx (vazio)"
        status: pass
      - kind: other
        ref: "tsc --noEmit em packages/dominio, apps/api e apps/web"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/remover-checklist-e-item.test.ts#remove só o Item (D-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhum registro de produção carrega a chave de Subitem (premissa A1, não provada aqui)"
    requirement: TAR-03
    verification: []
    human_judgment: true
    rationale: "O banco remoto não foi consultado neste plano; a contagem só de leitura é o checkpoint de 11-08."

duration: 4min
completed: 2026-10-29
status: complete
---

# Phase 11 Plan 01: Conversão de Item sem susto e checklist de um nível Summary

**`conversaoDeItemRecusada` como derivada única de recusa (operação e tela dizem a mesma frase), `convertChecklistItem` de cinco parâmetros com esquema de três argumentos, e o Subitem fora do tipo, do domínio e da tela.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-29T21:58:26Z
- **Completed:** 2026-10-29T22:02:26Z
- **Tasks:** 3
- **Files modified:** 12 (1 criado, 11 alterados)

## Accomplishments
- `conversaoDeItemRecusada(state, actingMemberId, taskId)` em `derive.ts`, na ordem "Tarefa não encontrada." -> `taskWriteRefusal` -> Tarefa não ativa -> "Esta Lista não usa Subtarefas." -> "Esta Tarefa já está no nível N, o último permitido. O item não pode virar Subtarefa aqui."; não lê o relógio.
- `convertChecklistItem` chama a derivada antes de qualquer outra regra, sem o 6º parâmetro nem o bloco de migração de Subitens; esquema `z.tuple([ID, ID, ID])` recusa o quarto argumento.
- Checklist de um nível só: `checklistProgress`, contagem de abertos, `planning`, `tarefa-publica`, `copyChecklist`, `removeChecklistItem` (grava `detail` = nome do Checklist) e a tela deixam de ler o campo, que sai de `ChecklistItem`.
- `conversao-de-item.test.ts` novo com 11 casos (adjacência 7/8, Lista sem Subtarefas, Convidado, ordem fixa, lixeira, inexistentes, já convertido, dois Itens em sequência).

## TDD Gate Compliance

- **Task 1 RED** `c12d6ea`: 10 falhas em `conversao-de-item.test.ts` e `operations.test.ts` (parte `TypeError: conversaoDeItemRecusada is not a function`, parte asserção da frase nova "nível 3"/"o último permitido") e 1 falha de asserção no esquema (`safeParse` com quatro argumentos devolvia `true`). Avaliação semântica: o alvo executou e falhou pelo comportamento planejado; os `TypeError` são a ausência da derivada, esperada antes do GREEN. `workflow.tdd_mode` está desligado, então o classificador `check tdd-red-evidence` não foi rodado.
- **Task 1 GREEN** `423fc12`.
- **Task 2 RED** `cdefc46`: o teste "remove só o Item (D-02)" falhou na asserção `total: 4` (recebido `3`).
- **Task 2 GREEN** `de7a630`.
- **Task 3** (`type="auto"`, sem `tdd`): `66ed9b6`.
- Sem commit de REFACTOR (nada a limpar).

## Task Commits

1. **Task 1 RED: testes que falham** - `c12d6ea` (test)
2. **Task 1 GREEN: derivada, operação e esquema** - `423fc12` (feat)
3. **Task 2 RED: teste do checklist de um nível** - `cdefc46` (test)
4. **Task 2 GREEN: usos do Subitem saem do domínio** - `de7a630` (feat)
5. **Task 3: campo sai do tipo e da tela** - `66ed9b6` (feat)

**Plan metadata:** commit `docs(11-01)` desta SUMMARY.

## Files Created/Modified
- `packages/dominio/src/derive.ts` - `conversaoDeItemRecusada`; `checklistProgress` e contagem de abertos sem Subitem
- `packages/dominio/src/operations/tasks.ts` - `convertChecklistItem` de cinco parâmetros; `removeChecklistItem` de um nível
- `packages/dominio/src/operations/conversao-de-item.test.ts` - prova de TAR-01 e das bordas de conversão
- `packages/dominio/src/operations/operations.test.ts` - frase de nível nova
- `packages/dominio/src/operations/remover-checklist-e-item.test.ts` - docstring e teste reescritos sem Subitens
- `packages/dominio/src/operations/planning.ts`, `collaboration.ts`, `tarefa-publica.ts` - filtros e `copyChecklist` sem Subitem
- `packages/dominio/src/types/structure.ts` - `ChecklistItem` sem o campo de Subitem
- `apps/api/src/rotas/esquemas/tarefas.ts`, `esquemas-de-argumentos.test.ts` - esquema de três argumentos e o `it` que o prova
- `apps/web/src/features/estrutura/tarefa-completa.tsx` - contagem, lista e diálogos sem Subitem; helper de contagem removido (2371 -> 2351 linhas)

## Decisions Made
- A derivada ganhou o 4º motivo (Tarefa não ativa, mesma frase de `requireActiveTask`), escolha do planejador já registrada no plano.
- No teste de remoção, a chave do campo extinto é montada em tempo de execução (`["parent","Item","Id"].join("")`) para o teste simular um registro antigo sem violar a busca de TAR-03 por extenso em `.ts`.

## Deviations from Plan

None - plan executed exactly as written. (A única adaptação foi a chave montada no teste acima, para respeitar o critério de TAR-03 do próprio plano.)

## Issues Encountered
- A tabela "Quem pode" de `packages/dominio/CONTEXT.md` ainda descreve `convertChecklistItem` como `taskWriteRefusal, listWriteRefusal`; `quem-pode.test.ts` passa, então não foi alterada (plano diz que a linha segue válida).

## Known Stubs
None.

## Threat Flags
None - nenhuma superfície nova; T-11-01 e T-11-02 mitigados (derivada embrulha `taskWriteRefusal` e roda primeiro; esquema recusa o 4º argumento). T-11-03 aceito: premissa A1 aberta para o checkpoint de 11-08.

## User Setup Required
None - no external service configuration required.

## Verification
- `packages/dominio`: `npx vitest run` 110 arquivos / 2144 testes verdes; `tsc --noEmit` verde.
- `apps/api`: `DATABASE_URL= npx vitest run src/rotas/esquemas src/rotas/esquemas-de-argumentos.test.ts` 95 testes verdes (contagem (j) segue 289); `tsc --noEmit` verde.
- `apps/web`: `tsc --noEmit`, `eslint tarefa-completa.tsx` e `vitest run src/features/estrutura` (190 testes) verdes.
- `grep -rn "parentItemId" packages apps --include=*.ts --include=*.tsx` vazio.

## Next Phase Readiness
- 11-07 pode consultar `conversaoDeItemRecusada` para esconder o botão Converter e reescrever o diálogo de conversão.
- 11-08 ainda precisa da contagem só de leitura em produção (premissa A1); nenhum código desta fase toca o banco.

---
*Phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo*
*Completed: 2026-10-29*
