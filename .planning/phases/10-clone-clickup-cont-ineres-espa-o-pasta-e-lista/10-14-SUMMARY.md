---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 14
subsystem: ui
tags: [est-04, d-17, textos, recusas-do-dominio, teste-de-varredura, vitest]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-18: structure.ts com as operações novas e a expansão do mover; 10-05: ordem da fase"
provides:
  - "As 13 cadeias da tabela S10 do UI-SPEC sem código de regra entre parênteses (9 na web, 4 recusas do domínio)"
  - "sem-codigo-de-regra.test.ts: varredura dos .tsx de features/estrutura e app/(shell)/estrutura, sem comentários, que lista arquivo:linha"
  - "recusas-sem-codigo.test.ts: frase exata das 4 recusas do domínio e prova de que não casam com a expressão do S10"
affects: [fase-11-tarefa-completa, 10-19]

plan_head_before: 5d2524028ca4980cf5cf182430d526bf8861c73d
plan_head_after: d5703e931086527c2dfd2ff2f24394adb28e4a9e

actuals:
  tokens: 9000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Varredura de texto visível: lê os .tsx, troca comentários (linha, bloco, JSX) por espaços mantendo as quebras de linha, e casa a expressão do S10 por linha"
    - "Recusa do domínio que chega literal à tela ganha asserção própria no domínio, porque o teste da web não a enxerga"

key-files:
  created:
    - apps/web/src/features/estrutura/sem-codigo-de-regra.test.ts
    - packages/dominio/src/operations/recusas-sem-codigo.test.ts
  modified:
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/structure.ts
    - packages/dominio/src/operations/contas-a-receber.test.ts
    - apps/web/src/features/estrutura/financeiro/serie-dialog.tsx
    - apps/web/src/features/estrutura/create-container-dialog.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx

key-decisions:
  - "Só o código e o espaço antes dele saem; nenhuma frase foi reescrita. Onde o código fechava oração com dois-pontos (tarefa-completa, item 5), o dois-pontos ficou colado em \"Integração manual\"."
  - "O comentário de pastas/[pasta]/page.tsx com (A3.4) e os demais comentários com código ficam: o teste descarta comentários."
  - "Os textos citados no fim do S10 (bulk-status-bar.tsx, contas-view.tsx, collaboration-editors.tsx) pertencem à remoção dos botões do S7 e não estão nos arquivos deste plano; ficam com o plano do S7."

patterns-established:
  - "Texto visível da Estrutura não carrega código de regra; a regra continua citada em comentário."

requirements-completed: [EST-04]

coverage:
  - id: D1
    description: "Criar uma série de parcelas sem Centro de Custo devolve exatamente \"Centro de Custo é obrigatório.\", e as outras duas recusas de financeiro.ts saem sem o código"
    requirement: EST-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/recusas-sem-codigo.test.ts#série de parcelas sem Centro de Custo"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/contas-a-receber.test.ts#R1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A recusa de Template com Subpastas dentro de outra Pasta sai sem (B47)"
    requirement: EST-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/recusas-sem-codigo.test.ts#Template de Pasta com Subpastas"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/operations.test.ts#B47"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os .tsx de features/estrutura e app/(shell)/estrutura não mostram código de regra entre parênteses"
    requirement: EST-04
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/sem-codigo-de-regra.test.ts#nenhum .tsx mostra"
        status: pass
    human_judgment: false
  - id: D4
    description: "As frases de ajuda de create-container-dialog, serie-dialog e tarefa-completa seguem quebrando linha normalmente, sem espaço duplo nem pontuação órfã"
    requirement: EST-04
    verification: []
    human_judgment: true
    rationale: "Backstop visual do UI-SPEC S10 (estouro): nenhum teste automatizado enxerga a quebra de linha renderizada; conferir na UAT."

duration: 8min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 14: Textos da Estrutura sem código de regra Summary

**As 13 cadeias do S10 (9 na web, 4 recusas do domínio) perdem o código entre parênteses, com um teste de varredura dos .tsx da Estrutura e outro que fixa a frase exata das recusas do domínio.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-29T09:49:00Z
- **Completed:** 2026-10-29T09:57:00Z
- **Tasks:** 2
- **Files modified:** 8 (2 novos, 6 editados)

## Accomplishments

- A série de parcelas sem Centro de Custo é recusada com "Centro de Custo é obrigatório."; as recusas de Entrada e de Parcela repetida saem sem "(RN-CR-07)" e a de Template com Subpastas sem "(B47)".
- `serie-dialog.tsx` (2), `create-container-dialog.tsx` (4) e `tarefa-completa.tsx` (3) sem código visível.
- `sem-codigo-de-regra.test.ts` impede a volta na web; `recusas-sem-codigo.test.ts` impede a volta nas quatro frases do domínio, que o teste da web não vê.
- Vermelho antes, verde depois: o teste de varredura listou as 7 cadeias que restavam na web (create-container-dialog 383/428/441/442 e tarefa-completa 1496/1524/1537); as 2 de serie-dialog já tinham sido corrigidas na Task 1, o que fecha as 9. O teste do domínio também foi visto vermelho (3 de 3) antes de editar `financeiro.ts`.

## Task Commits

1. **Task 1: Traçador — série sem Centro de Custo (domínio → diálogo de série)** - `54a20d6` (feat)
2. **Task 2: As outras cadeias e o teste de varredura da Estrutura** - `d5703e9` (feat)

**Plan metadata:** commit docs a seguir.

## Files Created/Modified

- `packages/dominio/src/operations/financeiro.ts` - três recusas de `createReceivableSeries` sem código
- `packages/dominio/src/operations/structure.ts` - recusa de Template com Subpastas sem "(B47)"
- `packages/dominio/src/operations/contas-a-receber.test.ts` - a Parcela dobrada passa a esperar "já tem a 1ª Parcela nesta Lista. Descarte a série antiga" (Pitfall 10)
- `packages/dominio/src/operations/recusas-sem-codigo.test.ts` - novo, 4 casos
- `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx` - 2 cadeias
- `apps/web/src/features/estrutura/create-container-dialog.tsx` - 4 cadeias
- `apps/web/src/features/estrutura/tarefa-completa.tsx` - 3 cadeias (únicas mudanças no arquivo)
- `apps/web/src/features/estrutura/sem-codigo-de-regra.test.ts` - novo, varredura

## Decisions Made

Ver `key-decisions`. O teste de varredura percorre as pastas por `new URL(…, import.meta.url)` e respeita cadeias entre aspas, para que `//` dentro de URL não abra comentário; cadeia de aspas simples ou duplas termina na quebra de linha, para que um apóstrofo solto em texto de JSX não engula o resto do arquivo.

## Deviations from Plan

### Critério de aceitação com leitura literal não atendida

**1. [Acceptance] `git diff --numstat` de `tarefa-completa.tsx` mostra 4 linhas, não "no máximo 3"**
- **Found during:** Task 2
- **Issue:** a cadeia do item 5 ocupa duas linhas de código-fonte JSX ("…sem Integração manual" / "(INV-CP-01): peça ao Agente…"). Para o dois-pontos ficar colado em "manual" (regra do S10) as duas linhas mudam; as outras duas cadeias mudam uma linha cada. São 3 cadeias e 4 linhas de código-fonte.
- **Fix:** nenhuma; a alternativa de manter 3 linhas exigia `{":"}` solto no JSX só para contar linhas. A intenção do critério (só as três cadeias do S10 mudam; a Fase 11 parte do arquivo limpo) está cumprida: o diff é exatamente os itens 5, 6 e 7.
- **Files modified:** apps/web/src/features/estrutura/tarefa-completa.tsx
- **Committed in:** d5703e9

---

**Total deviations:** 1 (leitura do critério de aceitação, sem mudança de código)
**Impact on plan:** nenhum; o conteúdo editado é o que o plano pede.

## Issues Encountered

None. O lint do `@n1/web` mostra 3 avisos `no-unused-vars` em arquivos que este plano não tocou (já existiam).

## Known Stubs

None.

## Threat Flags

None.

## Verification run

- `packages/dominio`: `npx vitest run` completo (109 arquivos, 2120 testes) e `npx tsc --noEmit` verdes.
- `apps/web`: `npx vitest run src/features/estrutura` (85 testes), `npx tsc --noEmit`, `npm run lint -w @n1/web` (0 erros) e `npm run verificar:tokens` verdes.
- `grep` do S10 em `features/estrutura` e `app/(shell)/estrutura`: só sobram comentários (inclusive o `(A3.4)` de `pastas/[pasta]/page.tsx`, dentro de comentário JSX).
- Nenhuma asserção nos testes de `apps/api` ou `apps/web` esperava as quatro frases antigas (busca por texto); nada a ajustar fora de `contas-a-receber.test.ts`.

## Next Phase Readiness

`tarefa-completa.tsx` está limpo para a Fase 11. Os textos de botão do S7 (`bulk-status-bar.tsx`, `contas-view.tsx`, `collaboration-editors.tsx`) seguem com o plano do S7.

## Self-Check: PASSED

- Arquivos criados presentes: `sem-codigo-de-regra.test.ts`, `recusas-sem-codigo.test.ts`.
- Commits `54a20d6` e `d5703e9` presentes na branch.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
