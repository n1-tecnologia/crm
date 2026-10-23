---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 08
subsystem: ui
tags: [web, privacidade, convidado, link-publico, trilho, nextjs, vitest, seg-01, seg-02]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-02: secret '' para quem não administra a Lista; agents/automations/documents/collections/skills vazios para o Convidado; actorLabel sem sufixo duplicado"
provides:
  - "linkVisivel / SEM_LINK_PARA_QUEM_NAO_ADMINISTRA: as telas de link público tratam o segredo vazio e nunca montam /f/ ou /p/ sem segredo"
  - "ehConvidado / veAssuntoIa: o assunto IA some do trilho do Convidado (o item não é renderizado)"
  - "ia/layout.tsx (LayoutDaIA): Convidado vê 'a área de IA · sem acesso' em toda rota /ia/*, sem montar as páginas filhas"
  - "nomeDoAgente: 'Agente' no lugar de '—' ou de sumir quando a coleção agents não chega"
affects: [09-09, 09-16, verificacao-da-fase-9]

actuals:
  tokens: 16000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Regra pura de visibilidade do trilho em arquivo próprio (assuntos-do-trilho.ts), no molde de vePastaFinanceiro; app-shell só filtra"
    - "Segredo vazio tratado por um predicado (linkVisivel) usado pelas três telas, com a frase numa constante só"
    - "Layout de segmento Client Component como barreira cosmética (a real é o servidor não mandar as coleções)"

key-files:
  created:
    - apps/web/src/features/estrutura/link-publico.ts
    - apps/web/src/features/estrutura/link-publico.test.tsx
    - apps/web/src/features/estrutura/nome-do-ator.ts
    - apps/web/src/features/estrutura/nome-do-ator.test.ts
    - apps/web/src/features/shell/assuntos-do-trilho.ts
    - apps/web/src/features/shell/assuntos-do-trilho.test.ts
    - apps/web/src/features/shell/layout-da-ia.test.tsx
    - apps/web/src/app/(shell)/ia/layout.tsx
  modified:
    - apps/web/src/features/estrutura/share-task-dialog.tsx
    - apps/web/src/features/estrutura/forms-editor.tsx
    - apps/web/src/features/estrutura/forms-editor.test.tsx
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/features/estrutura/task-editors.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/web/src/features/tarefa/timeline.tsx

key-decisions:
  - "ia/layout.tsx envolve o NoAccessState em PageHeader title='IA' + CorpoDeTela (premissa A1 do UI-SPEC), o mesmo esqueleto de ia/chat/[sessao]"
  - "forms-editor: sem segredo, 'Copiar link' não é renderizado (premissa A2); o parágrafo já é o motivo"
  - "Página da Lista: o botão que abre o Formulário some sem segredo (plano) e o item de menu 'Copiar link do formulário' fica desabilitado com disabledReason (padrão da página)"
  - "As cópias locais do rótulo do ator (tarefa-completa.tsx authorLabel e tarefa/timeline.tsx resolverNomeDoAtor) foram alinhadas a actorLabel do domínio: UI-SPEC S4 manda 'Agente' / 'Automação' sem o registro"

patterns-established:
  - "Frase de ausência de segredo: texto estático em <p class='app-base'> com --texto-3, sem role=alert (ausência de segredo é permissão, não erro)"

requirements-completed: [SEG-01, SEG-02]

coverage:
  - id: D1
    description: "Link público sem segredo: ShareTaskDialog e FormsEditor mostram 'Só quem administra a Lista vê o link.', sem /p/ nem /f/ no DOM e sem 'Copiar link'; com segredo o link aparece como antes"
    requirement: SEG-01
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/link-publico.test.tsx#ShareTaskDialog — o link da Tarefa"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/forms-editor.test.tsx#FormsEditor — o link do Formulário (Fase 9, 1.1.3)"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/link-publico.test.tsx#linkVisivel"
        status: pass
    human_judgment: false
  - id: D2
    description: "Página da Lista: botão que abre o Formulário só com segredo; item de menu 'Copiar link do formulário' desabilitado com o motivo quando o segredo é vazio"
    requirement: SEG-01
    verification: []
    human_judgment: true
    rationale: "A página da Lista não tem teste de componente; a mudança foi conferida só por tipos, lint e grep (linkVisivel( = 2). Precisa de olho humano com um Membro que não administra a Lista"
  - id: D3
    description: "O assunto IA não é renderizado no trilho do Convidado; Membro e Proprietário veem; sem sessão nada some"
    requirement: SEG-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/assuntos-do-trilho.test.ts#veAssuntoIa"
        status: pass
    human_judgment: true
    rationale: "A regra pura está provada, mas o app-shell em si (item ausente do trilho renderizado) não tem teste; conferir no navegador com a Beatriz (Convidado do seed)"
  - id: D4
    description: "Convidado em qualquer /ia/* vê 'a área de IA · sem acesso' e a página filha não é montada; Membro vê a página filha"
    requirement: SEG-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/layout-da-ia.test.tsx#LayoutDaIA"
        status: pass
    human_judgment: true
    rationale: "Backstop do UI-SPEC (I5): antes de a sessão resolver o layout renderiza children; verificar no navegador que a troca para 'sem acesso' não pisca conteúdo"
  - id: D5
    description: "nomeDoAgente: o nome do Agente, ou 'Agente' sem o registro; usado no fio resolvido da Tarefa e na coluna de responsáveis da Lista; rótulos locais do ator sem 'Agente eliminado'"
    requirement: SEG-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/nome-do-ator.test.ts#nomeDoAgente"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-23
status: complete
plan_head_before: 664c401b596184dc94c46c0a0f942aaa3d314c03
plan_head_after: ef73b4da1e823feb7247cdbeb68a453c88564776
---

# Phase 9 Plan 08: Interface ajustada ao que o servidor deixou de mandar Summary

**`linkVisivel` nas três telas de link público (segredo vazio mostra "Só quem administra a Lista vê o link."), assunto IA fora do trilho do Convidado por `veAssuntoIa`, `ia/layout.tsx` com `NoAccessState` e `nomeDoAgente` ("Agente") onde a coleção de Agentes não chega.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-23
- **Tasks:** 3
- **Files:** 8 criados, 8 modificados (todos em `apps/web`)

## Accomplishments

- `ShareTaskDialog`, `FormsEditor` e a página da Lista não montam `/p/` nem `/f/` sem segredo: o parágrafo substitui o link, o campo e o botão de copiar; o item de menu da página fica desabilitado com a mesma frase como motivo.
- `veAssuntoIa` (falso só para o Convidado) filtra a chave `ia` em `assuntosVisiveis`, junto da regra do Financeiro; `isGuest` do `app-shell` passou a usar `ehConvidado`, a mesma leitura.
- `app/(shell)/ia/layout.tsx` mostra `<NoAccessState what="a área de IA" />` (com `PageHeader` e `CorpoDeTela`, premissa A1) ao Convidado em qualquer `/ia/*`; os demais Papéis recebem `children` sem envoltório.
- `nomeDoAgente` entra no "Fio resolvido por …" da Tarefa e na coluna de responsáveis da Lista; nenhuma tela pede a coleção de volta.

## Task Commits

Cada tarefa tem um commit RED (`test`) e um GREEN (`feat`):

1. **Task 1: link público com segredo vazio** — RED `2dd3585`, GREEN `bb14fbc`
2. **Task 2: assunto IA e /ia/* para o Convidado** — RED `0523f1d`, GREEN `4827310`
3. **Task 3: nome do Agente sem a coleção** — RED `230a5c0`, GREEN `ef73b4d`

**Plan metadata:** commit `docs(09-08)` seguinte a este arquivo.

## TDD / Evidência

O plano é `type: execute` (com `tdd="true"` por tarefa) e `workflow.tdd_mode` é `false`: sem `## TDD Gate Compliance` formal e sem o classificador `tdd-red-evidence`. A evidência RED é a saída real do Vitest antes do código, com esqueletos neutros nos commits RED (para falhar na asserção, não no import):

- **Task 1 RED:** 4 falhas nas asserções planejadas (`linkVisivel("")` e `linkVisivel(undefined)` devolviam true; `ShareTaskDialog` e `FormsEditor` com `secret: ""` não mostravam a frase). Os casos "com segredo" passavam, como esperado.
- **Task 2 RED:** 3 falhas (`ehConvidado("mem_beatriz")` false, `veAssuntoIa` true para o Convidado, layout sem "sem acesso").
- **Task 3 RED:** 3 falhas (o esqueleto devolvia texto vazio).

## Decisions Made

- Ver `key-decisions`. A página da Lista segue o plano (botão some, item desabilitado); o item de menu real se chama "Copiar link do formulário" (o plano o chama "Copiar link").
- A nota de 09-03 sobre `markConversationRead` / `toggleConversationStar`: a interface não chama a primeira em lugar nenhum; `toggleConversationStar` só é chamada em `inbox-columns.tsx:420` e o `run(...)` tem o resultado descartado, então a recusa ao Convidado já é silenciosa. Nenhuma mudança.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Cópias locais do rótulo do ator**
- **Found during:** Task 3 (aviso de 09-02 sobre `tarefa-completa.tsx`)
- **Issue:** `authorLabel` de `tarefa-completa.tsx` devolvia "Agente eliminado (Agente)" e "Automação (Automação)", e `resolverNomeDoAtor` de `tarefa/timeline.tsx` devolvia "Agente eliminado", para o Convidado, que recebe `agents` e `automations` vazios. O UI-SPEC S4 manda "Agente" / "Automação" sem o registro.
- **Fix:** `tarefa-completa.tsx` devolve "Agente" / "Automação" sem o registro e `<nome> (Agente)` / `<nome> (Automação)` com ele; `timeline.tsx` devolve "Agente" sem o registro.
- **Files modified:** `apps/web/src/features/estrutura/tarefa-completa.tsx`, `apps/web/src/features/tarefa/timeline.tsx` (os dois fora de `files_modified` do plano)
- **Verification:** suíte web inteira verde, `tsc` e `eslint` sem erro
- **Committed in:** `ef73b4d`

**2. [Plano impreciso] "Os dois pontos Fio resolvido por"**
- **Issue:** `task-editors.tsx` tem um só ponto com "Fio resolvido por …" (linha 879); as linhas 690-705 citadas pelo plano são a declaração `agentes = useData(...)`, que ficou sem uso e foi removida. O critério `grep -c "nomeDoAgente(" task-editors.tsx` ≥ 2 imprime 1 (um ponto real). O objetivo do critério (nenhum recuo `?? "—"` para Agente) está cumprido.

---

**Total deviations:** 1 auto-fixed (Rule 2), 1 imprecisão do plano documentada.
**Impact on plan:** nenhum desvio de escopo além dos dois rótulos locais, previstos pelo aviso de 09-02 e pelo UI-SPEC S4.

## Issues Encountered

- Nenhum. `app-shell.tsx` mantém dois avisos de ESLint que já existiam (`Target`, `memberReachesContainer` sem uso); não vêm desta mudança.

## Known Stubs

Nenhum.

## Deferred / fora de escopo

- `tarefa-completa.tsx` linha ~2318: o Campo `person` cai no próprio id (`?? valor`) quando o id é de um Agente que o Convidado não recebe. Não está no plano nem em S4; não tocado.
- Pendente para a verificação da fase (não há navegador aqui): (a) com a Beatriz (Convidado do seed), o item "IA" não aparece no trilho e `/ia/chat` mostra "a área de IA · sem acesso" sem piscar conteúdo (I5); (b) com um Membro que não administra a Lista, a página da Lista não mostra o botão "Abrir formulário" e o item "Copiar link do formulário" aparece desabilitado com a frase; (c) o aspecto visual do parágrafo em `ShareTaskDialog` e `FormsEditor`.

## Threat Flags

Nenhum: o plano só reduz superfície. T-09-41 a T-09-44 mitigadas na interface; a barreira real continua sendo o servidor (09-02). T-09-SC: nenhum pacote instalado.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Verificação do plano: `cd apps/web && npx vitest run` = 67 arquivos, 577 testes verdes; `npm run typecheck`, `npm run lint` (0 erros, 3 avisos pré-existentes) e `npm run verificar:tokens` (0 falhas) verdes. Nenhum arquivo web importa `apps/api`.
- 09-16 segue com a Superfície S5 e o `global-error`; nada neste plano a bloqueia.

## Self-Check: PASSED

Os arquivos criados existem (`link-publico.ts`, `link-publico.test.tsx`, `nome-do-ator.ts`, `nome-do-ator.test.ts`, `assuntos-do-trilho.ts`, `assuntos-do-trilho.test.ts`, `layout-da-ia.test.tsx`, `ia/layout.tsx`); os seis commits (`2dd3585`, `bb14fbc`, `0523f1d`, `4827310`, `230a5c0`, `ef73b4d`) estão no histórico; `grep -c "linkVisivel("` = 1 (`forms-editor.tsx`), 1 (`share-task-dialog.tsx`), 2 (página da Lista); `veAssuntoIa(data, memberId)` em `app-shell.tsx` = 1; `"use client"` em `ia/layout.tsx` = 1; `git grep "apps/api"` nos três arquivos puros sem resultado.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
