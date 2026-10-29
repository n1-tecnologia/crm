---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 20
subsystem: dominio
tags: [est-09, d-15, blocks, inheritance-mode, prova-de-tipo]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-01: setContainerDefaultViews e defaultViews nos contêineres"
provides:
  - "blocks existe só em Space e Folder (saiu de StructuralContainerBase)"
  - "InheritanceMode = herdado | sobrescrito; o bloqueio mora só em blocks"
  - "conteiner-sem-bloqueio.test.ts: prova de tipo por @ts-expect-error sob tsc --noEmit"
affects: [10-02, 10-08, 10-10, 10-11, 10-17]

actuals:
  tokens: 6500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Prova de tipo: @ts-expect-error num teste coberto pelo include do tsconfig; o tsc falha com 'Unused directive' se o tipo afrouxar"

key-files:
  created:
    - packages/dominio/src/types/conteiner-sem-bloqueio.test.ts
  modified:
    - packages/dominio/src/types/structure.ts
    - packages/dominio/src/operations/configuration.ts
    - packages/dominio/src/operations/structure.ts
    - packages/dominio/src/solicitacao-de-pagamento-evolver.ts
    - packages/dominio/src/seed.ts
    - packages/dominio/src/seed-financeiro.ts
    - packages/dominio/src/seed-comercial.ts
    - packages/dominio/src/seed-pos-venda.ts
    - packages/dominio/src/seed-contas-a-receber.ts
    - apps/web/src/features/estrutura/container-settings.tsx

key-decisions:
  - "blockedAbove pula nós de tipo list e estreita o contêiner com 'blocks' in ancestor (sem as): um blocks legado no jsonb de uma Lista não influencia nenhum nó (T-10-47)."
  - "planning.ts (doPai) não precisou de edição: já lia blocks só de Pasta e Espaço e compila com o tipo novo."

patterns-established:
  - "Limpeza mecânica apontada pelo tsc fica no mesmo plano da troca de tipo para não deixar o tsc vermelho entre planos"

requirements-completed: [EST-09]

coverage:
  - id: D1
    description: "Um literal de Lista com blocks não compila; Space e Folder mantêm blocks; blockedAbove sobre Lista abaixo de Espaço que bloqueia devolve a frase; blocks legado numa Lista é inerte"
    requirement: EST-09
    verification:
      - kind: unit
        ref: "packages/dominio/src/types/conteiner-sem-bloqueio.test.ts#EST-09 — a Lista não tem `blocks`"
        status: pass
      - kind: command
        ref: "cd packages/dominio && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "InheritanceMode só aceita herdado e sobrescrito; gravar o terceiro modo deixa de compilar"
    requirement: EST-09
    verification:
      - kind: unit
        ref: "packages/dominio/src/types/conteiner-sem-bloqueio.test.ts#o modo de bloqueio não existe em InheritanceMode"
        status: pass
      - kind: command
        ref: "cd packages/dominio && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os três workspaces compilam e a tela de Configurações do contêiner segue abrindo sem mudança visível"
    requirement: EST-09
    verification:
      - kind: command
        ref: "apps/api tsc --noEmit; apps/web tsc --noEmit; eslint container-settings.tsx"
        status: pass
    human_judgment: true
    rationale: "Compilação e lint provam que o arquivo compila; que a tela abre igual no navegador não foi exercitado (nenhum teste de interface cobre esta tabela, que sai em 10-08)."

duration: 6min
completed: 2026-10-29
status: complete
plan_head_before: 06227890c742d2a386d610f2b0d649a731767c75
plan_head_after: c1a44252734ea72c5c1253b590c256d7d429b0cb
commits: 2
---

# Phase 10 Plan 20: Lista sem bloqueio Summary

**`blocks` agora só existe em Espaço e Pasta e `InheritanceMode` perdeu o modo de bloqueio, ambos provados por `@ts-expect-error` sob `tsc --noEmit`; `blockedAbove` ignora um `blocks` legado em Lista.**

## Performance

- **Duration:** 6 min
- **Tasks:** 2
- **Files modified:** 11 (1 criado)

## Accomplishments

- `blocks` saiu de `StructuralContainerBase` e entrou em `Space` e `Folder`, com comentário em pt-BR (abaixo da Lista só há Tarefa, que não configura nada).
- `blockedAbove` não lê `blocks` de Lista; os `blocks: {}` de `createList`, da Lista de modelo, do evolver de Solicitação de pagamento e dos seeds de Lista foram retirados.
- `InheritanceMode` virou `"herdado" | "sobrescrito"`; `container-settings.tsx` perdeu a chave e a cor do modo removido e lê `blocks` só quando o contêiner o tem.
- `conteiner-sem-bloqueio.test.ts` prova os dois fatos de tipo e, em tempo de execução, que `blockedAbove` segue devolvendo a frase para uma Lista abaixo de um Espaço que bloqueia e ignora o `blocks` legado na própria Lista.

## Task Commits

1. **Task 1 (tracer): a Lista deixa de ter blocks do tipo ao seed** - `59ebb1c`
2. **Task 2: o modo de bloqueio sai de InheritanceMode** - `c1a4425`

RED (semantic assessment): na Task 2 o `@ts-expect-error` foi escrito antes da troca do tipo e o `tsc` falhou com `TS2578: Unused '@ts-expect-error' directive`, a falha planejada. Na Task 1 o tipo e o teste entraram no mesmo commit: o `tsc` vermelho que o `@ts-expect-error` produziria sem a troca de tipo é o mesmo que a Task 2 mostrou, e a troca de tipo exigia as limpezas para o `tsc` ficar verde (corte da revisão 1). Plano `type: execute`; o classificador `tdd-red-evidence` não foi exigido.

Tracer gate: modo `end-of-phase`, verify só automatizado, reexecutado e verde antes da Task 2.

## Decisions Made

Ver `key-decisions` no frontmatter. Na Task 1 o `InheritanceMode` ficou temporariamente com o terceiro modo para que `container-settings.tsx` compilasse com a correção mínima; a Task 2 o removeu, como o plano previa.

## Deviations from Plan

None - plan executed exactly as written. (`planning.ts` não precisou de edição, como o plano antecipava com "conferir que compila".)

## Issues Encountered

None.

## Verification

- `packages/dominio`: `vitest run` completo, 104 arquivos / 2007 testes verdes; `tsc --noEmit` limpo; `grep -c bloqueado types/structure.ts` = 0.
- `apps/api` e `apps/web`: `tsc --noEmit` limpos; `eslint container-settings.tsx` limpo.
- Suíte completa do monorepo e e2e não rodados, conforme orientação do orquestrador.

## Known Stubs

None.

## Threat Flags

None - T-10-47 mitigado (`blockedAbove` só lê `blocks` de Espaço e Pasta; teste cobre o legado em Lista). A chave antiga no jsonb sai pela `010` (10-17).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-02: `setContainerBlock` pode nascer aceitando só Espaço e Pasta. A sequência de `container-settings.tsx` segue 10-20 → 10-08 → 10-10 → 10-11. Nenhum bloqueio.

## Self-Check: PASSED

- `conteiner-sem-bloqueio.test.ts` presente; commits `59ebb1c` e `c1a4425` presentes na branch.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
