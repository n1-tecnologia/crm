---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 01
subsystem: dominio
tags: [visualizacoes-padrao, heranca, setContainerDefaultViews, esquemas-zod, quem-pode]

requires:
  - phase: 09-seguranca-dos-dados
    provides: tabela "Quem pode" regredida por quem-pode.test.ts e contagem de operações em esquemas-de-argumentos.test.ts
provides:
  - "VisualizacoesPadrao / TipoDeVisualizacao e defaultViews? nos contêineres"
  - "EffectiveListConfig.views e viewsDefinedAt resolvidos pelo nó mais próximo (substitui por inteiro)"
  - "VISUALIZACOES_DA_PLATAFORMA (cinco tipos, inicial lista) para quem não definiu"
  - "setContainerDefaultViews registrada, com esquema .strict(), linha em Quem pode e contagem 287"
  - "saveView recusa salvar Visualização de tipo que a Lista não oferece"
affects: [10-02, 10-07, 10-08, 10-10, 10-11, 10-20]

actuals:
  tokens: 8200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Aspecto que substitui por inteiro (como o Conjunto de Status): laço do nó até o Espaço, para no primeiro que define"
    - "Cadeia de registro fechada no mesmo plano: operação, registro, index, esquema, teste de esquema, contagem, linha em Quem pode"
    - "VIEW_KIND vive em fragmentos.ts com a conferência Igual contra View[kind] num lugar só"

key-files:
  created:
    - packages/dominio/src/operations/visualizacoes-padrao.test.ts
  modified:
    - packages/dominio/src/types/structure.ts
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/configuration.ts
    - packages/dominio/src/operations/scale.ts
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas/fragmentos.ts
    - apps/api/src/rotas/esquemas/escala.ts
    - apps/api/src/rotas/esquemas/configuracao.ts
    - apps/api/src/rotas/esquemas/configuracao.test.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts

key-decisions:
  - "A Atividade 'Visualizações padrão alteradas' compara a definição PRÓPRIA do nó (antes/depois), não a efetiva: definir exatamente o padrão da plataforma num nó que herdava ainda é uma mudança registrada ('herdadas' -> lista)."
  - "Tipo repetido em disponiveis usa a mesma frase de tipo desconhecido ('Tipo de Visualização desconhecido.'); o plano não deu frase própria."
  - "VISUALIZACOES_DA_PLATAFORMA nasce com cinco tipos (sem carga): a remoção de carga de View.kind fica para 10-07, junto da página da Lista."
  - "viewsDefinedAt é acréscimo ao D-07 (premissa sinalizada no plano): a tela 10-08 precisa dizer 'Herdado de X'. Campo de leitura, reversível."

patterns-established:
  - "Teste de domínio por seed: buildSeed + operação + checagem do estado deixado (spc_com / fld_renovacao / lst_renovacao / lst_prospeccao)"

requirements-completed: [EST-08, EST-11]

coverage:
  - id: D1
    description: "O Espaço define as Visualizações padrão e a configuração efetiva de toda Lista abaixo muda junto; a Pasta sobrescreve por inteiro e null volta a herdar"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/visualizacoes-padrao.test.ts#setContainerDefaultViews — herança pelo caminho (EST-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "setContainerDefaultViews recusa inicial fora de disponiveis, disponiveis vazio, tipo desconhecido/repetido, Membro sem administrar, Convidado, contêiner arquivado e ancestral que bloqueia; grava Atividade só quando muda"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/visualizacoes-padrao.test.ts#setContainerDefaultViews — recusas / Atividade"
        status: pass
    human_judgment: false
  - id: D3
    description: "saveView recusa tipo que a Lista não oferece e não toca nas Visualizações já salvas (D-06)"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/visualizacoes-padrao.test.ts#saveView — só salva tipo que a Lista oferece"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cadeia de registro fechada: POST /operacoes/setContainerDefaultViews aceita a forma (esquema .strict()), linha em Quem pode, contagem 287"
    requirement: EST-11
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/esquemas/configuracao.test.ts; apps/api/src/rotas/esquemas-de-argumentos.test.ts#(j); packages/dominio/src/quem-pode.test.ts"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-29
status: complete
plan_head_before: f1025a1bff34a11f970e1eeaf97f0a3f59f417ca
plan_head_after: 1713ba4bfa35af9fb4cfef879ce1da85f16a1c8d
commits: 4
---

# Phase 10 Plan 01: Visualizações padrão Summary

**Visualizações padrão do Espaço/Pasta herdadas pela Lista (o nó mais próximo vence por inteiro), com `setContainerDefaultViews` registrada de ponta a ponta e `saveView` recusando tipo que a Lista não oferece.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-29T08:32:31Z
- **Completed:** 2026-10-29T08:37:29Z
- **Tasks:** 2
- **Files modified:** 13 (1 criado)

## Accomplishments

- `VisualizacoesPadrao`, `defaultViews?` em `StructuralContainerBase` e `views`/`viewsDefinedAt?` em `EffectiveListConfig`; `VISUALIZACOES_DA_PLATAFORMA` (lista, quadro, calendario, tabela, linhaDoTempo; inicial lista) vale sem migração de dados.
- `setContainerDefaultViews` na ordem de guardas de `setContainerFeature` (`findContainer`, `mayConfigure`, ciclo de vida, `blockedAbove(…, "defaultViews")`) mais a validação do valor; Atividade "Visualizações padrão alteradas" com `Lista, Quadro · inicial Lista` ou `herdadas`.
- Cadeia de registro fechada no mesmo plano: `registro.ts`, `index.ts`, esquema `.strict()` em `configuracao.ts`, `VIEW_KIND` movido para `fragmentos.ts`, linha em "Quem pode", contagem 286 -> 287.
- `saveView` consulta `effectiveListConfig(...).views.disponiveis`; as salvas existentes ficam intactas.

## Task Commits

1. **Task 1 (tracer): Visualizações padrão de ponta a ponta** - `3808059` (test, RED: 12 casos falhando porque a operação não existia) -> `7a6041a` (feat, GREEN)
2. **Task 2: saveView recusa tipo indisponível** - `592797b` (test, RED: 2 casos falhando na asserção planejada) -> `1713ba4` (feat, GREEN)

**Plan metadata:** commit docs(10-01) logo após este arquivo.

RED (semantic assessment): em Task 1 o alvo falhou com `TypeError: setContainerDefaultViews is not a function` nos 12 casos (a função é o objeto da fase; não há assertiva possível antes de existir); em Task 2 os dois casos falharam em `expected true to be false` na recusa planejada. Plano `type: execute`, então o classificador `tdd-red-evidence` não foi exigido.

Tracer gate: modo `end-of-phase`, verify só automatizado — os dois comandos do `<verify>` foram reexecutados e passaram antes da expansão para a Task 2.

## Files Created/Modified

- `packages/dominio/src/types/structure.ts` - tipos novos e campos
- `packages/dominio/src/derive.ts` - `VISUALIZACOES_DA_PLATAFORMA` e resolução de `views` em `effectiveContainerConfig`
- `packages/dominio/src/operations/configuration.ts` - `setContainerDefaultViews`
- `packages/dominio/src/operations/scale.ts` - recusa em `saveView`
- `packages/dominio/src/operations/registro.ts`, `index.ts` - registro e instrumentação
- `packages/dominio/CONTEXT.md` - linha em "Quem pode"
- `packages/dominio/src/operations/visualizacoes-padrao.test.ts` - 14 testes (EST-08)
- `apps/api/src/rotas/esquemas/fragmentos.ts`, `escala.ts`, `configuracao.ts` - esquema e `VIEW_KIND` compartilhado
- `apps/api/src/rotas/esquemas/configuracao.test.ts`, `apps/api/src/rotas/esquemas-de-argumentos.test.ts` - formas da web, recusas de transporte, contagem 287

## Decisions Made

Ver `key-decisions` no frontmatter. Nenhuma divergência do plano.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Um ajuste de teste do próprio plano: a Atividade mais nova vem primeiro em `state.activity` (`unshift`), então o teste lê o índice 0.

## Verification

- `packages/dominio`: `vitest run` completo, 103 arquivos / 2005 testes verdes; `tsc --noEmit` limpo.
- `apps/api`: `DATABASE_URL= vitest run` em `configuracao.test.ts`, `escala.test.ts`, `esquemas-de-argumentos.test.ts` (17 testes) verdes; `tsc --noEmit` limpo.
- `apps/web`: `tsc --noEmit` limpo (a web ainda não lê `views`).
- Suíte completa do monorepo e e2e não rodados, conforme orientação do orquestrador.

## Known Stubs

None.

## Threat Flags

None - superfície nova coberta por T-10-01 (mayConfigure + teste de recusa), T-10-02 (esquema `.strict()` + validação no domínio) e T-10-03 (recusa em `saveView`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-02 em diante: o tipo e a operação existem, e 10-08/10-10/10-11 podem ler `views` e `viewsDefinedAt`. A remoção de `carga` (10-07) muda `VIEW_KIND` só em `fragmentos.ts`. Nenhum bloqueio.

## Self-Check: PASSED

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
