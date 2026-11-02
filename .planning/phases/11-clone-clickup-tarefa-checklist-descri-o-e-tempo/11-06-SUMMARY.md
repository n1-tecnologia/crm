---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
plan: 06
subsystem: ui
tags: [historico, atividade, descricao, react, vitest]

requires:
  - phase: 11-02
    provides: before/after da "Descrição alterada" e ehAlteracaoDeDescricao
provides:
  - AlteracaoDeDescricao (botão "Ver alteração" + expansão Antes/Depois) em features/tarefa
  - Feed de Atividade e Timeline sem o (antes -> depois) da descrição na frase
  - Auditoria e Reunião sem o texto da descrição na linha
affects: [11-07, 11-08]

actuals:
  tokens: 9000
  tasks: 3
  commits: 5
plan_head_before: 18f2fb44a807ab5c8273b839836730c1d4300d4b
plan_head_after: 221b909471891a501ca5d88351446d6aafccc31b

tech-stack:
  added: []
  patterns:
    - "Linha do Feed no escopo do módulo (LinhaDoFeed) para o estado do botão sobreviver a re-render"
    - "Texto não confiável como nó de texto React em whitespace-pre-wrap, sem Rico"

key-files:
  created:
    - apps/web/src/features/tarefa/alteracao-de-descricao.tsx
    - apps/web/src/features/tarefa/alteracao-de-descricao.test.tsx
    - apps/web/src/features/tarefa/feed-de-atividade.test.tsx
  modified:
    - apps/web/src/features/tarefa/feed-de-atividade.tsx
    - apps/web/src/features/tarefa/timeline.tsx
    - apps/web/src/features/tarefa/timeline.test.tsx
    - apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx
    - apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx

key-decisions:
  - "D-10/D-11: o componente único AlteracaoDeDescricao serve Feed e Timeline; devolve null para outras ações, edição antiga e Ator de integração"
  - "D-12: presença testada por !== undefined; before vazio mostra 'Sem descrição'"
  - "Pitfall 1: a regra ehAlteracaoDeDescricao(record) do domínio vale nos quatro lugares (Feed, Timeline, Auditoria, Reunião)"

requirements-completed: [TAR-06]

coverage:
  - id: D1
    description: "updateTask de A para B aparece no Feed como 'Descrição alterada' com 'Ver alteração', que expande Antes A e Depois B e recolhe; a expansão sobrevive a re-render"
    requirement: TAR-06
    verification:
      - kind: unit
        ref: "apps/web/src/features/tarefa/feed-de-atividade.test.tsx#FeedDeAtividade — Descrição alterada (11-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Componente: sem botão para registro antigo, before vazio vira 'Sem descrição', Ator de integração nunca mostra, HTML aparece literal sem criar elemento"
    requirement: TAR-06
    verification:
      - kind: unit
        ref: "apps/web/src/features/tarefa/alteracao-de-descricao.test.tsx#AlteracaoDeDescricao"
        status: pass
    human_judgment: false
  - id: D3
    description: "Timeline da Solicitação usa o mesmo componente (caso k), integração segue sanitizada (caso f)"
    requirement: TAR-06
    verification:
      - kind: unit
        ref: "apps/web/src/features/tarefa/timeline.test.tsx#Timeline — Descrição alterada com Ver alteração (k)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Auditoria mostra '—' e Reunião não passa before/after da descrição da Tarefa"
    requirement: TAR-06
    verification:
      - kind: other
        ref: "tsc --noEmit + eslint + grep 'ehAlteracaoDeDescricao(' nos dois arquivos"
        status: pass
    human_judgment: true
    rationale: "Sem teste de página para Auditoria e Reunião (o plano pede só tsc/eslint/grep); conferir na UAT de 11-08."
  - id: D5
    description: "Rótulos 'Antes'/'Depois', 'Ver alteração'/'Ocultar alteração', 'Sem descrição' e o desenho da expansão"
    verification: []
    human_judgment: true
    rationale: "Escolha do planejador (Claude's Discretion); vai para a UAT de 11-08."

duration: 6min
completed: 2026-10-29
status: complete
---

# Phase 11 Plan 06: Ver alteração da descrição no histórico Summary

**`AlteracaoDeDescricao` dá o botão "Ver alteração" (Antes/Depois em texto puro, `aria-expanded`) ao Feed de Atividade e à Timeline, e Auditoria e Reunião deixam de imprimir a descrição inteira entre parênteses.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-29T22:26Z
- **Completed:** 2026-10-29T22:32Z
- **Tasks:** 3
- **Files modified:** 8 (3 criados, 5 alterados)

## Accomplishments
- `alteracao-de-descricao.tsx`: `temAlteracaoParaVer` (descrição + não integração + `before`/`after` definidos) e o componente, só com `<span>`/`<button>`.
- Feed: `LinhaDoFeed` saiu de dentro de `FeedDeAtividade` para o escopo do módulo, então a expansão sobrevive a re-render; `textoDaLinha` não imprime o `(antes → depois)` da descrição.
- Timeline: mesma troca em `LinhaDeAtividade`; a guarda T-02-10 e o `detail` ficaram como estavam.
- Auditoria mostra "—" e a Reunião não passa `before`/`after` do registro de descrição.

## Task Commits

1. **Task 1: Traçador no Feed** - `60cb331` (test, RED), `31df3df` (feat, GREEN)
2. **Task 2: Timeline** - `d6249cc` (test, RED), `158f0d4` (feat, GREEN)
3. **Task 3: Auditoria e Reunião** - `221b909` (feat)

## TDD / RED

- RED Task 1: `alteracao-de-descricao.tsx` entrou como esqueleto que devolve `null` para os testes falharem na asserção (não por import); 5 de 10 falharam nas asserções planejadas (botão ausente, `(A → B)` ainda na frase).
- RED Task 2: caso (k) "Membro" falhou por `(A → B)` presente e botão ausente; os outros dois (integração, sem before/after) já passavam por construção.
- Não rodei o `gsd_run check tdd-red-evidence` (`workflow.tdd_mode` não é exigido aqui); a avaliação semântica foi feita lendo a saída do vitest.

## Files Created/Modified
- `apps/web/src/features/tarefa/alteracao-de-descricao.tsx` - botão e expansão, compartilhados por Feed e Timeline
- `apps/web/src/features/tarefa/feed-de-atividade.tsx` - `LinhaDoFeed` no módulo, sem antes/depois da descrição na frase
- `apps/web/src/features/tarefa/timeline.tsx` - `LinhaDeAtividade` com o componente
- `apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx` - "—" para a descrição
- `apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx` - sem before/after da descrição
- Testes: `alteracao-de-descricao.test.tsx`, `feed-de-atividade.test.tsx`, `timeline.test.tsx` (caso k)

## Decisions Made
Seguiu o plano. Nota: o teste do Feed filtra o registro `after === "B"` porque o seed grava os registros do mesmo instante do mais novo para o mais antigo, e o primeiro `updateTask` ("" → "A") também gera botão.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Primeira versão do teste do Feed clicou no botão da linha errada (duas edições no mesmo instante); corrigido filtrando os registros do teste. Sem efeito no código de produção.

## Known Stubs

None.

## Out-of-scope observation
- `apps/web/src/features/shell/ficha.tsx:159` (`RegistroRecolhido`, usado pelas fichas de outros objetos e de Documento de conhecimento) e `design/components.tsx:1362` (`ActivityTimeline`) ainda imprimem `before`/`after` inline para qualquer ação. Nenhum deles recebe Atividade de Tarefa hoje (o plano pediu para não mexer em `design/components.tsx`); não alterados.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 11-07 segue dono de `tarefa-completa.tsx`; este plano não tocou nele.
- UAT (11-08): rótulos, aparência da expansão, Auditoria "—" e Reunião.

## Self-Check: PASSED

- Arquivos criados existem; commits `60cb331 31df3df d6249cc 158f0d4 221b909` são ancestrais de HEAD.
- `npx vitest run src/features/tarefa` 109 passando; `tsc --noEmit` e `eslint` limpos.

---
*Phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo*
*Completed: 2026-10-29*
