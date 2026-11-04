---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
plan: 03
subsystem: dominio
tags: [tempo, derivada, agregado, vitest, jsdom]

requires:
  - phase: 11-01
    provides: checklist de um nivel e derivadas no padrao de derive.ts
provides:
  - tempoRegistrado (derive.ts) com minutos, lancamentos, emAndamento e minutosComSubtarefas
  - features/estrutura/tempo.ts com minutos, textoDoTempo e valorDaLinhaDeTempo
  - TaskTime lendo o numero do dominio
affects: [11-07 linha Rastrear tempo de tarefa-completa.tsx, 11-08 UAT]

actuals:
  tokens: 6500
  tasks: 2
  commits: 4
plan_head_before: 3364b37718891e14be5130554710ce8bb85b32ce
plan_head_after: fd424e95d0e9d08d86e0ab14f5f57fbfac89e0d8

tech-stack:
  added: []
  patterns:
    - "Agregado derivado sem relogio: soma so o fechado, desce por parentTaskId com Set de visitados e para em filha nao ativa"
    - "Formatador unico: editor e linha partem de textoDoTempo(tempo).total"

key-files:
  created:
    - packages/dominio/src/tempo-registrado.test.ts
    - apps/web/src/features/estrutura/tempo.ts
    - apps/web/src/features/estrutura/tempo.test.ts
    - apps/web/src/features/estrutura/tempo-da-tarefa.test.tsx
  modified:
    - packages/dominio/src/derive.ts
    - apps/web/src/features/estrutura/collaboration-editors.tsx

key-decisions:
  - "D-15: lancamentos conta o cronometro aberto (A2) e minutosComSubtarefas ignora Subtarefa fora de ativo e tudo abaixo dela (A3)"
  - "D-16: tempoRegistrado depende so de state; um teste le o codigo-fonte do corpo e recusa Date e now("
  - "Pitfall 9: o docstring obriga quem chamar no servidor a passar o recorte do Membro"

patterns-established:
  - "Numero de tela vem de uma derivada do dominio e de um formatador de modulo-folha, nunca de soma local no componente"

requirements-completed: [TAR-07]

coverage:
  - id: D1
    description: "tempoRegistrado soma so fechados, conta o aberto em lancamentos, liga emAndamento por qualquer Membro e agrega Subtarefas ativas em qualquer nivel"
    requirement: TAR-07
    verification:
      - kind: unit
        ref: "packages/dominio/src/tempo-registrado.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bordas: zero, so aberto, so fechados, lixeira com neta, aberto so na Subtarefa, neta, ciclo, sem durationMinutes, chamadas iguais, corpo sem relogio"
    requirement: TAR-07
    verification:
      - kind: unit
        ref: "packages/dominio/src/tempo-registrado.test.ts#tempoRegistrado — bordas (TAR-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TaskTime mostra Total registrado, em andamento e, so com tempo nas Subtarefas, o total com Subtarefas"
    requirement: TAR-07
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/tempo-da-tarefa.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "valorDaLinhaDeTempo comeca pelo mesmo total do editor e diz Iniciar sem registros"
    requirement: TAR-07
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/tempo.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "A3 (o total da mae cai quando uma Subtarefa vai para a lixeira) e A2 (N registros conta o aberto) sao premissas do planejador"
    requirement: TAR-07
    verification: []
    human_judgment: true
    rationale: "owner-confirmation pendente: o dono precisa aceitar as duas leituras na UAT de 11-08."

duration: 5min
completed: 2026-10-29
status: complete
---

# Phase 11 Plan 03: Tempo registrado derivado no dominio Summary

**`tempoRegistrado(state, taskId)` em `derive.ts` (so fechados, sem relogio, agregado com Subtarefas ativas), o formatador unico `features/estrutura/tempo.ts` e o `TaskTime` mostrando "em andamento" e "N com Subtarefas".**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-29T22:08:00Z
- **Completed:** 2026-10-29T22:13:00Z
- **Tasks:** 2 (cada uma com RED e GREEN)
- **Files modified:** 6 (4 criados, 2 alterados)

## Accomplishments
- `tempoRegistrado` devolve `{ minutos, lancamentos, emAndamento, minutosComSubtarefas }`: 75 min, 3 lancamentos e `emAndamento` para 30 + 45 fechados e um aberto; 95 com uma Subtarefa de 20 min.
- Subtarefa na lixeira (e a neta dela) deixa de somar; ciclo forjado em `parentTaskId` termina; cronometro aberto so na Subtarefa nao liga `emAndamento` da mae.
- `minutos()` saiu de `collaboration-editors.tsx` para `tempo.ts` (uma copia so); `TaskTime` usa `tempoRegistrado` e `textoDoTempo` no lugar da soma local.
- `valorDaLinhaDeTempo` pronto para a linha "Rastrear tempo" de 11-07: "Iniciar" sem registros, senao `total · N registro(s) · em andamento · X com Subtarefas`.

## TDD Gate Compliance

- **Task 1 RED** `4d26644`: 3 falhas no dominio (`TypeError: tempoRegistrado is not a function`) e 2 no editor (asserção de "em andamento" e de "1 h 35 min com Subtarefas" sobre o texto antigo "Total registrado: 1 h 15 min"). Avaliacao semantica: o alvo executou e falhou pelo comportamento planejado. `workflow.tdd_mode` desligado, entao `check tdd-red-evidence` nao foi rodado.
- **Task 1 GREEN** `6c53924` (derivada, `tempo.ts` com `minutos`/`textoDoTempo`, `TaskTime`).
- **Task 2 RED** `a74c37c`: 5 falhas em `tempo.test.ts` (`valorDaLinhaDeTempo is not a function`, mais os casos que o usam). Os 10 casos de borda do dominio entraram no mesmo commit e ja passavam, porque a derivada da Task 1 foi escrita com o `Set` de visitados e a parada em filha nao ativa (o proprio plano pedia isso): sao guardas de regressao, nao prova de feature.
- **Task 2 GREEN** `fd424e9` (`valorDaLinhaDeTempo`).
- Sem commit de REFACTOR (nada a limpar).

## Task Commits

1. **Task 1 RED** - `4d26644` (test)
2. **Task 1 GREEN** - `6c53924` (feat)
3. **Task 2 RED** - `a74c37c` (test)
4. **Task 2 GREEN** - `fd424e9` (feat)

**Plan metadata:** commit `docs(11-03)` desta SUMMARY.

## Files Created/Modified
- `packages/dominio/src/derive.ts` - `TempoRegistrado` e `tempoRegistrado` ao lado de `subtaskProgress`
- `packages/dominio/src/tempo-registrado.test.ts` - prova de TAR-07 e das bordas no dominio (13 casos)
- `apps/web/src/features/estrutura/tempo.ts` - `minutos`, `textoDoTempo`, `valorDaLinhaDeTempo`
- `apps/web/src/features/estrutura/tempo.test.ts` - formatador e linha (8 casos)
- `apps/web/src/features/estrutura/tempo-da-tarefa.test.tsx` - `TaskTime` sob `StoreProvider` real (2 casos)
- `apps/web/src/features/estrutura/collaboration-editors.tsx` - `TaskTime` sem soma local; `minutos` importado

## Decisions Made
Ver `key-decisions`. Nada fora do que o plano ja decidia. A descida por `parentTaskId` foi escrita como busca com pilha e `Set` de visitados (nao recursiva), o que cobre ciclo e profundidade sem estourar pilha.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None.

## Threat Flags
None - T-11-09 aceito, como no plano: o docstring de `tempoRegistrado` registra o aviso do Pitfall 9 e nenhum leitor de servidor usa a funcao nesta fase.

## User Setup Required
None - no external service configuration required.

## Verification
- `packages/dominio`: `npx vitest run` 112 arquivos / 2182 testes verdes; `tsc --noEmit` verde.
- `apps/web`: `npx vitest run src/features/estrutura` 21 arquivos / 200 testes verdes; `tsc --noEmit` e `eslint` dos arquivos tocados verdes.
- Acceptance: `export function tempoRegistrado` 1; `^function minutos` em `collaboration-editors.tsx` 0; `tempoRegistrado(` no editor 1; `export function minutos` em `tempo.ts` 1.
- Nenhum teste ou migracao rodou contra o banco de producao.

## Next Phase Readiness
- 11-07 troca o valor da linha "Rastrear tempo" de `tarefa-completa.tsx` por `valorDaLinhaDeTempo(tempoRegistrado(state, task.id))`.
- Premissas A2 e A3 seguem com owner-confirmation pendente para a UAT de 11-08.

## Self-Check: PASSED

---
*Phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo*
*Completed: 2026-10-29*
