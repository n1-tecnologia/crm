---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 07
subsystem: estrutura
tags: [dominio, api, web, visualizacoes, remocao]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "VIEW_KIND em esquemas/fragmentos.ts e TipoDeVisualizacao (10-01); a Lista sem a lente de Carga (10-06)"
provides:
  - "View.kind e VIEW_KIND sem carga: saveView carga e recusado pelo esquema (400 em POST /operacoes)"
  - "TipoDeAba/ROTULO_DA_ABA com 5 abas; abaDaView total (valor fora das abas abre na Lista)"
  - "Lista comum com 5 abas, conversacional com 4"
  - "workload, WorkloadCell e CargaDeTrabalho removidos; weekStartOf fica para a Linha do tempo"
affects: [10-17, 10-21]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 25644cb5d7073d5146995bc227190517909a296d
plan_head_after: c3ab5dd0d8e8cd8313c0a9d4045ac401792e4612

tech-stack:
  added: []
  patterns:
    - "abaDaView total: o web nunca confia que o kind salvo ainda existe (Pitfall 4)"

key-files:
  created: []
  modified:
    - packages/dominio/src/types/structure.ts
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/configuration.ts
    - packages/dominio/src/operations/operations.test.ts
    - apps/api/src/rotas/esquemas/fragmentos.ts
    - apps/api/src/rotas/esquemas/escala.test.ts
    - apps/web/src/features/estrutura/tipo-de-visualizacao.ts
    - apps/web/src/features/estrutura/tipo-de-visualizacao.test.ts
    - apps/web/src/features/estrutura/planning-views.tsx
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx

key-decisions:
  - "abaDaView aceita string | undefined e usa hasOwnProperty em ROTULO_DA_ABA: Visualizacao salva carga (antes da 010) abre na aba Lista, nunca com rotulo indefinido"
  - "A capacidade semanal (setMemberCapacity, memberCapacityMinutes) continua ate 10-21; o teste de capacidade foi separado do de weekStartOf"

requirements-completed: [EST-07]

duration: 12min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 07: A Carga sai de ponta a ponta Summary

**O tipo Carga sai de `View.kind`, do esquema `VIEW_KIND` (saveView carga vira 400), das abas da Lista e do codigo (`workload`, `WorkloadCell`, `CargaDeTrabalho`), com `abaDaView` total para as salvas antigas.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-29T09:50:00Z
- **Completed:** 2026-10-29T10:02:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Dominio e API recusam o tipo carga: `View.kind` e `VIEW_KIND` ficam com cinco tipos; a conferencia contra `View["kind"]` continua compilando.
- Na web, a Lista comum oferece 5 abas (Lista, Quadro, Calendario, Tabela, Linha do tempo) e a conversacional 4; a financeira deixa de filtrar abas.
- `abaDaView` e total: uma Visualizacao salva carga que ainda nao passou pela `010` abre na aba Lista (Pitfall 4).
- O calculo `workload`/`WorkloadCell` e o componente `CargaDeTrabalho` foram apagados; `grep workload` em `packages` e `apps` nao acha nada.

## Task Commits

1. **Task 1: Tracador - a Carga sai do tipo, do esquema e das abas** - `6daf7f8` (feat)
2. **Task 2: O calculo e o componente da Carga saem** - `c3ab5dd` (feat)

## Files Created/Modified

- `packages/dominio/src/types/structure.ts` - `View.kind` sem carga
- `packages/dominio/src/operations/configuration.ts` - rotulo da Atividade sem carga
- `packages/dominio/src/derive.ts` - sem `workload`/`WorkloadCell`; `weekStartOf` fica
- `packages/dominio/src/operations/operations.test.ts` - teste da Carga vira teste de `weekStartOf`; capacidade em teste proprio
- `apps/api/src/rotas/esquemas/fragmentos.ts` - `VIEW_KIND` sem carga
- `apps/api/src/rotas/esquemas/escala.test.ts` - saveView carga recusado (2.5.2)
- `apps/web/src/features/estrutura/tipo-de-visualizacao.ts` e `.test.ts` - 5 abas, `abaDaView` total
- `apps/web/src/features/estrutura/planning-views.tsx` - sem `CargaDeTrabalho`
- `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx` - abas e ramo de conteudo sem carga (916 linhas)

## Decisions Made

- `abaDaView(kind: string | undefined)` usa `hasOwnProperty` em `ROTULO_DA_ABA` em vez de confiar no tipo.
- A capacidade semanal fica como esta ate 10-21 (corte da revisao 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rotulo `carga` em `configuration.ts`**
- **Found during:** Task 1 (tsc do dominio)
- **Issue:** `ROTULO_DA_VISUALIZACAO: Record<TipoDeVisualizacao, string>` em `packages/dominio/src/operations/configuration.ts` ainda tinha a chave `carga`, quebrando o `tsc` depois de tirar o tipo (arquivo fora de `files_modified`).
- **Fix:** removida a linha `carga: "Carga"`.
- **Files modified:** packages/dominio/src/operations/configuration.ts
- **Verification:** `tsc --noEmit` verde em dominio, api e web.
- **Committed in:** 6daf7f8

**2. [Rule 1 - Bug] Import `useData` sem uso**
- **Found during:** Task 2 (eslint)
- **Issue:** `useData` ficou sem uso em `planning-views.tsx` depois de apagar a Carga.
- **Fix:** removido do import.
- **Committed in:** c3ab5dd

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** ambos consequencia direta da remocao; sem expansao de escopo.

## Issues Encountered

None. Um comentario do seed (`seed.ts:2862`, "a Linha do tempo e a Carga leem") menciona a Carga; fica para uma varredura de textos (fora de `files_modified`).

## Verification

- `packages/dominio`: `vitest run` 2121 testes verdes; `tsc --noEmit` verde.
- `apps/api`: `DATABASE_URL= vitest run src/rotas/esquemas/escala.test.ts` 5 verdes; `tsc --noEmit` verde.
- `apps/web`: `tsc --noEmit` verde; `vitest run src/features/estrutura` 87 verdes; eslint dos arquivos tocados limpo; `npm run verificar:tokens` 0 falhas.
- `grep workload` em `packages` e `apps` (fora de node_modules/.next): sem achados. `grep '"carga"'` fora de testes: sem achados.

## Known Stubs

None.

## Threat Flags

None. T-10-19 mitigado: `VIEW_KIND` sem carga recusa `saveView` carga; `abaDaView` total e a rede.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 10-17 (`010`) converte as Visualizacoes salvas carga; ate la elas abrem na aba Lista.
- 10-21 tira a capacidade semanal (`setMemberCapacity`, `memberCapacityMinutes`).

## Self-Check: PASSED

- Commits `6daf7f8` e `c3ab5dd` presentes no HEAD; arquivos tocados existem; `commits: 2` medido contra `plan_head_before`.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
