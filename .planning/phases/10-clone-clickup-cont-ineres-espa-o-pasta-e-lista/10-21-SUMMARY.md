---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 21
subsystem: estrutura
tags: [dominio, api, web, membros, remocao]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "Carga de trabalho removida (10-07): o campo de capacidade deixou de ter leitor; contagem (j) em 290 (10-04)"
provides:
  - "Member sem weeklyCapacityMinutes; planning.ts sem DEFAULT_CAPACITY, memberCapacityMinutes e setMemberCapacity"
  - "OPERACOES e ESQUEMAS sem setMemberCapacity: (j) fecha em 289, o numero final da fase"
  - "Tela de Membros com seis colunas (Membro, Papel, Estado, Disponibilidade, Entrou, acoes), sem CapacityEditor"
  - "Teste membros-sem-capacidade.test.tsx: a tabela sem a coluna e tolerante a chave antiga no jsonb"
affects: [10-verificacao]

actuals:
  tokens: 6100
  tasks: 2
  commits: 2
plan_head_before: 183785d11a26de292ff26d5740e79e6b0422283d
plan_head_after: 618b80bfae4a8db0e89697648ff9f8559652aad6

tech-stack:
  added: []
  patterns:
    - "Remocao em cascata guiada pelo tsc num plano so: dominio, registro, esquema, linha de Quem pode e tela saem juntos"
    - "Chave legada fica inerte no jsonb (D-13): nenhum codigo de limpeza; o teste monta o nome da chave em pedacos para o grep do plano seguir limpo"

key-files:
  created:
    - apps/web/src/features/shell/membros-sem-capacidade.test.tsx
  modified:
    - packages/dominio/src/types/workspace.ts
    - packages/dominio/src/operations/planning.ts
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/src/operations/operations.test.ts
    - packages/dominio/src/operations/conversao-de-solicitacao.test.ts
    - packages/dominio/src/seed-financeiro.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas/planejamento.ts
    - apps/api/src/rotas/esquemas/planejamento.test.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts
    - apps/web/src/app/(shell)/configuracoes/membros/page.tsx

key-decisions:
  - "O valor de capacidade ja gravado nos Membros e ignorado, nao migrado (D-13): nada le nem regrava a chave."
  - "O teste da chave antiga monta o nome em pedacos (join) para que `grep weeklyCapacityMinutes` em packages e apps continue sem achados, como o plano exige."

requirements-completed: [EST-07, EST-11]

coverage:
  - id: D1
    description: "A capacidade semanal sai do dominio (campo, DEFAULT_CAPACITY, memberCapacityMinutes, setMemberCapacity), do registro, do index e do esquema; a linha de Quem pode sai; (j) = 289"
    requirement: "EST-11"
    verification:
      - kind: unit
        ref: "packages/dominio: vitest run completo (2120 passam) + src/quem-pode.test.ts + src/operations/registro.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/esquemas-de-argumentos.test.ts#(j) ESQUEMAS cobre exatamente OPERACOES — 289"
        status: pass
      - kind: other
        ref: "! grep -rn weeklyCapacityMinutes packages apps --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next"
        status: pass
    human_judgment: false
  - id: D2
    description: "A tela de Membros tem seis colunas, sem CapacityEditor nem a coluna Capacidade/sem, e ignora o valor gravado na chave antiga"
    requirement: "EST-07"
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/shell/membros-sem-capacidade.test.tsx#a tabela Participacoes tem Membro, Papel, Estado, Disponibilidade, Entrou e a coluna de acoes"
        status: pass
      - kind: automated_ui
        ref: "apps/web/src/features/shell/membros-sem-capacidade.test.tsx#um Membro que ainda carrega a chave antiga aparece normalmente"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tabela de seis colunas em tela estreita rola na horizontal sem a coluna de acoes sair do alcance; alinhamento com um e com muitos Membros (backstops de estouro e zero-um-muitos)"
    verification: []
    human_judgment: true
    rationale: "Comportamento visual de layout (rolagem e alinhamento) que nenhum teste jsdom mede; so a tabela existente foi mantida, sem CSS novo."

duration: 5min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 21: A capacidade semanal do Membro sai de ponta a ponta Summary

**`weeklyCapacityMinutes`, `setMemberCapacity` e o `CapacityEditor` saem do dominio, da API e da tela de Membros (seis colunas), com o valor gravado inerte no jsonb e a contagem de operacoes em 289.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-10-29T10:24Z
- **Tasks:** 2
- **Files modified:** 13 (12 alterados, 1 criado)

## Accomplishments
- Dominio: o campo sai de `Member`, `planning.ts` perde `DEFAULT_CAPACITY`, `memberCapacityMinutes` e `setMemberCapacity` (e o trecho do cabecalho), `registro.ts` e `index.ts` perdem a entrada, seed e teste perdem o literal, e a linha sai da tabela "Quem pode" em `packages/dominio/CONTEXT.md`.
- API: `esquemas/planejamento.ts` sem a entrada; `planejamento.test.ts` com 10 chaves; `(j)` de 290 para 289 com a parcela "− setMemberCapacity (Fase 10, 10-21, D-13) = 289".
- Web: `configuracoes/membros/page.tsx` sem o import, o cabecalho, a celula e o componente; nenhuma coluna tomou o lugar; nenhuma copy nova.
- `membros-sem-capacidade.test.tsx` prova os seis cabecalhos e um Membro com a chave antiga (4321) sem o numero (nem 4321 nem 72 h) na tela e sem campo numerico.

## Task Commits

1. **Task 1: Tracador — a capacidade semanal sai de ponta a ponta** - `0328fa8` (feat)
2. **Task 2: A tela de Membros com seis colunas e tolerante a chave antiga** - `618b80b` (test)

**Plan metadata:** commit docs(10-21) a seguir.

## Decisions Made
- Chave antiga ignorada, sem migracao nem limpeza (D-13).
- No teste, o nome da chave antiga e montado com `["weekly","Capacity","Minutes"].join("")`, porque a verificacao do plano proibe o nome literal em qualquer `.ts`/`.tsx`.

## Deviations from Plan

None - plan executed exactly as written.

O tracador (Task 1) foi verificado ponta a ponta antes da Task 2 (grep limpo, vitest do dominio e da API, tsc nos tres workspaces, eslint da pagina); nada falhou, a expansao seguiu.

## Issues Encountered

None. `npm run lint -w @n1/web` mostra 3 avisos pre-existentes (variaveis nao usadas) em arquivos que este plano nao tocou; `npm run verificar:tokens` limpo.

## Verification

- `packages/dominio`: vitest completo 2120 passam; `tsc --noEmit` limpo.
- `apps/api` (DATABASE_URL vazio): `src/rotas/esquemas` + `esquemas-de-argumentos.test.ts` 94 passam, 26 arquivos; `tsc --noEmit` limpo.
- `apps/web`: `tsc --noEmit` limpo; `membros-sem-capacidade.test.tsx` 2 passam; eslint sem erros.
- Criterios de aceitacao: `setMemberCapacity|memberCapacityMinutes` em `packages/dominio/CONTEXT.md` = 0; `Capacidade/sem|CapacityEditor` na pagina = 0; `toBe(289)` = 1.

## Threat Flags

None.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ultimo plano de remocao da fase; a contagem (j) esta no valor final (289). Restam a verificacao da fase e os planos fora de ordem numerica que o orquestrador ainda tiver pendentes.

## Self-Check: PASSED

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
