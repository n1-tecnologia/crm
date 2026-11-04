---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
plan: 05
subsystem: web
tags: [mencao, descricao, hook, textarea, jsdom, vitest]

requires:
  - phase: 11-02
    provides: mencionaNoTexto e membrosMencionadosNaDescricao (descricao-da-tarefa.ts) e updateTask com descriptionMentions
provides:
  - useMencoes, arrobaEmCurso e normalizar em features/estrutura/mencoes.ts (cópia única da regra do "@" na Estrutura)
  - TextArea com campoRef, onKeyDown, onSelect, ariaAutocomplete, ariaControls e cursor no onChange
  - Editor da descrição com menu "Pessoas para mencionar" que manda descriptionMentions no updateTask
  - CommentComposer sobre o mesmo hook, sem mudar o que a pessoa vê
affects: [11-07 destaque da mencao e tarefa-completa, 11-08 UAT]

actuals:
  tokens: 8000
  tasks: 2
  commits: 3
plan_head_before: e21eb8a2e5356f1c17cd15d826efc2881afe75bd
plan_head_after: a73a1417963c358a7b89802ba3aeb35961b2a27b

tech-stack:
  added: []
  patterns:
    - "Hook de digitação devolve ref de callback (campoRef) para o react-hooks/refs não tratar o objeto inteiro como ref"
    - "TextArea expõe o <textarea> por useImperativeHandle, mantendo o ref interno do autoGrow"

key-files:
  created:
    - apps/web/src/features/estrutura/mencoes.ts
    - apps/web/src/features/estrutura/mencoes.test.tsx
  modified:
    - apps/web/src/features/estrutura/task-editors.tsx
    - apps/web/src/design/components.tsx

key-decisions:
  - "D-06: a lista mandada ao servidor sai do texto no momento de salvar (mencionaNoTexto do domínio), e o editor abre com os escolhidos que a Tarefa já tem"
  - "Q7/Pitfall 6: estender o TextArea com props opcionais em vez de trocar por <textarea> cru; usos antigos não mudam (o 2º argumento do onChange é ignorado por quem não o lê)"
  - "campoRef do hook é um ref de callback, e o TextArea o repassa por useImperativeHandle; assim a regra react-hooks/refs não bloqueia o uso de mencoes.* no JSX"
  - "O Compositor de features/tarefa/timeline.tsx fica como está (Anti-Patterns da RESEARCH)"

requirements-completed: [TAR-04]

coverage:
  - id: D1
    description: "Digitar @Jú na descrição abre o menu Pessoas para mencionar, escolher grava @Júlia Prado e Salvar manda descriptionMentions com mem_julia"
    requirement: TAR-04
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/mencoes.test.tsx#@Jú abre o menu, escolher grava o nome e Salvar manda descriptionMentions"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tirar o @Nome do texto antes de salvar manda a lista sem o Membro; salvar só o título mantém a menção; o menu só oferece Membro ativo"
    requirement: TAR-04
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/mencoes.test.tsx#descrição — o @ menciona como no Comentário (TAR-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O menu do @ do Comentário continua igual: setas, Enter, Esc só no menu, Ctrl+Enter envia com mentions"
    requirement: TAR-04
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/mencoes.test.tsx#Comentário — o mesmo menu, o mesmo teclado"
        status: pass
    human_judgment: false
  - id: D4
    description: "Aparência e uso do menu do @ na descrição (posição do menu dentro do painel, foco, cursor depois do nome)"
    requirement: TAR-04
    verification: []
    human_judgment: true
    rationale: "O jsdom não mede layout nem o foco real; o cursor volta por requestAnimationFrame. Fica para a UAT de 11-08."

duration: 13min
completed: 2026-10-29
status: complete
---

# Phase 11 Plan 05: "@" na descrição com o mesmo hook do Comentário Summary

**`useMencoes` vira a cópia única do "@" na Estrutura: a descrição da Tarefa abre o menu "Pessoas para mencionar" e manda `descriptionMentions` (derivada do texto por `mencionaNoTexto`) no `updateTask`, e o `CommentComposer` passa a usar o mesmo hook sem mudar o que a pessoa vê.**

## Performance

- **Duration:** 13 min
- **Tasks:** 2
- **Files modified:** 4 (2 criados, 2 alterados)

## Accomplishments
- `mencoes.ts`: `normalizar` e `arrobaEmCurso` movidas do `CommentComposer` sem mudar regra; `useMencoes` devolve `texto`, `campoRef`, `sugestoes`, `sugestaoAtiva`, `mencionar`, `aoMudar`, `aoSelecionar`, `aoTeclar`, `mencoesEfetivas` e `limpar`.
- `TextArea` aceita `campoRef`, `onKeyDown`, `onSelect`, `ariaAutocomplete`, `ariaControls` e passa o cursor em `onChange(valor, cursor)`; os outros usos não mudam.
- `TaskTitleDescriptionEditor` abre com os Membros que a Tarefa já menciona (`membrosMencionadosNaDescricao`), usa o menu compartilhado `ListaDeMencoes` e salva com `descriptionMentions: mencoesEfetivas`; a dica do campo ganhou "@ menciona alguém.".
- `CommentComposer` perdeu o estado próprio do "@" (`caret`, `sugestoesFechadas`, `mencoes`) e usa o hook; o Comentário enviado leva `mentions` do hook.
- 8 testes jsdom em `mencoes.test.tsx` (funções puras, descrição, Comentário).

## TDD

- **RED (`5188d96`):** teste do editor da descrição com `mencoes.ts` só como esqueleto (devolvia valor neutro). O alvo "@Jú abre o menu, escolher grava o nome e Salvar manda descriptionMentions" falhou na asserção `queryByRole("listbox")` nula; `gsd_run check tdd-red-evidence` devolveu `RED_EVIDENCE_OK` (`target_test_failed`). A primeira tentativa deu `invalid_record` porque o `tap-flat` do Vitest imprime o valor esperado de `toEqual` com linhas sem recuo ("Non-TAP data"); troquei os `findBy*` por consultas síncronas e rodei só o alvo com `-t`, o que gerou um relatório TAP válido. Avaliação semântica: o alvo executou e falhou pelo motivo planejado (o editor ainda não oferecia menu), sem erro de import ou de fixture.
- **GREEN (`043e104`):** hook, `TextArea` e editor da descrição; 8/8 verdes.
- **REFACTOR (`a73a141`):** `CommentComposer` sobre o hook; os testes do Comentário já estavam verdes antes (regressão) e seguem verdes.

## Task Commits

1. **RED:** `5188d96` test(11-05): add failing test for @ menção na descrição
2. **Task 1 (tracer):** `043e104` feat(11-05): descrição menciona com @ e manda descriptionMentions
3. **Task 2:** `a73a141` refactor(11-05): o Comentário passa a usar o mesmo useMencoes da descrição

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lint `react-hooks/refs` e `react-hooks/immutability`**
- **Found during:** Task 1 (GREEN)
- **Issue:** devolver um `useRef` no objeto do hook faz o lint tratar todo `mencoes.*` no JSX como acesso a ref na renderização; e o ref de callback do `TextArea` que gravava em `campoRef.current` (prop) quebrava `immutability`.
- **Fix:** `campoRef` do hook é um `useCallback` que grava num ref interno; no `TextArea`, o ref externo é ligado por `useImperativeHandle(campoRef, ...)`, sem mutar prop. No `CommentComposer` o ref entra por `const { campoRef: ligarCampo } = mencoes`.
- **Files modified:** `apps/web/src/features/estrutura/mencoes.ts`, `apps/web/src/design/components.tsx`, `apps/web/src/features/estrutura/task-editors.tsx`
- **Commit:** `043e104`, `a73a141`

**2. [Process] Esqueleto de `mencoes.ts` no commit RED**
- O plano não previa arquivo de produção no commit RED; o esqueleto (funções neutras) evita que o teste falhe por erro de import (INVALID_RED). Foi substituído inteiro no GREEN.

**Total deviations:** 1 auto-fix (Rule 3) e 1 ajuste de processo. **Impact:** nenhum no comportamento planejado.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-11-13 (lista montada no cliente): o hook só manda quem passa em `mencionaNoTexto`, e o domínio refiltra (11-02). T-11-14: nomes são renderizados como texto React, sem HTML montado à mão.

## Verification

- `npx tsc --noEmit` (apps/web): sem erros.
- `npx eslint src/features/estrutura src/design`: sem avisos.
- `npx vitest run src/features/estrutura src/features/tarefa src/design`: 37 arquivos, 350 testes verdes.
- `npx vitest run` em apps/web: 88 arquivos, 818 testes verdes.
- Critérios de aceite: `useMencoes` exportado (1), `descriptionMentions` em `task-editors.tsx` (1), `campoRef` em `components.tsx` (4), `function normalizar` fora de `task-editors.tsx` (0), `useMencoes(` em `task-editors.tsx` (2), `setSugestoesFechadas` (0).

## Self-Check: PASSED

- FOUND: apps/web/src/features/estrutura/mencoes.ts
- FOUND: apps/web/src/features/estrutura/mencoes.test.tsx
- FOUND commits: 5188d96, 043e104, a73a141
