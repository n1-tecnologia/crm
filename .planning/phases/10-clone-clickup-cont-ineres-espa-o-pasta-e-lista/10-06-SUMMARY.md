---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 06
subsystem: ui
tags: [react, nextjs, refatoracao, selecao-em-lote, pagina-da-lista]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-05 — relógio da recorrência (ordem da fase, sem dependência de arquivo)"
provides:
  - "SelecaoEmLote e BotaoDeSelecao: a única seleção em lote, montada uma vez nas três lentes"
  - "ContagemFiltrada / textoDaContagem: «Mostrando X de Y Tarefas.» (contas na lente financeira)"
  - "QuadroDeTarefas, TabelaPlana, BarraDeCriacao (4 lentes), DialogosDaLista, DetalhesDaLista fora da página"
  - "page.tsx da Lista com 923 linhas (era 1.407)"
affects: [10-07 em diante (2.5.4 Carga, 2.6.2 Visualizações padrão, 2.1.1), 10-16 retirada do botão de rodar a agenda]

actuals:
  tokens: 20150
  tasks: 3
  commits: 3
plan_head_before: b34c5810c1205c6877456a409c00afaae535f530
plan_head_after: 95be4936c3dcd179391eb6e30aff8a6512f4e991

tech-stack:
  added: []
  patterns:
    - "Encaixe `fim` nas barras: quem monta a página decide o fim da barra (botão de seleção, botão de agenda), as barras não conhecem a seleção"
    - "Extração sem mudar comportamento: o estado e os avisos ficam na página, os componentes novos recebem callbacks"

key-files:
  created:
    - apps/web/src/features/estrutura/selecao-em-lote.tsx
    - apps/web/src/features/estrutura/selecao-em-lote.test.tsx
    - apps/web/src/features/estrutura/contagem-filtrada.tsx
    - apps/web/src/features/estrutura/contagem-filtrada.test.tsx
    - apps/web/src/features/estrutura/quadro-de-tarefas.tsx
    - apps/web/src/features/estrutura/tabela-plana.tsx
    - apps/web/src/features/estrutura/barra-de-criacao.tsx
    - apps/web/src/features/estrutura/dialogos-da-lista.tsx
    - apps/web/src/features/estrutura/detalhes-da-lista.tsx
  modified:
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
    - apps/web/src/features/estrutura/financeiro/contas-view.tsx

key-decisions:
  - "O botão de seleção é desligado por `criacaoRecusada` nas três lentes (antes só nas barras comum e conversacional); só enquanto não se está selecionando, para nunca prender a pessoa dentro da seleção."
  - "A lente da barra segue a precedência financeira > espelhoComercial > conversacional > comum (a mesma que a página já declarava em comentário)."
  - "`aria-pressed` não foi levado ao `BotaoDeSelecao`: o `Button` do sistema não repassa o atributo, então ele nunca chegou ao DOM."

patterns-established:
  - "FinanceToolbar ganha `fim?: ReactNode` no lugar do botão de seleção próprio"
  - "BarraDeCriacao recebe `campo` (título, Tipo, callbacks) e `financeiro` (perfil e filtros) como objetos"

requirements-completed: [EST-02]

coverage:
  - id: D1
    description: "Uma só seleção em lote: o botão alterna Selecionar várias / Sair da seleção, e o painel do lote só existe com a seleção ligada; sair limpa as marcadas"
    requirement: EST-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/selecao-em-lote.test.tsx (5 casos)"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/bulk-status-bar.test.tsx (12 casos, sem edição)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Contagem curta «Mostrando X de Y Tarefas.» (Tarefa com Y = 1; contas/conta na lente financeira), só com filtro ativo"
    requirement: EST-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/contagem-filtrada.test.tsx (8 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sem a nota sob o Quadro, sem as duas frases de ajuda e sem o De modelo da barra conversacional"
    requirement: EST-02
    verification:
      - kind: other
        ref: "grep -c 'Arrastar altera o Status\\|o filtro vale em todas' page.tsx == 0"
        status: pass
    human_judgment: true
    rationale: "A ausência de texto é provada por grep; que a tela ficou limpa e a barra conversacional ficou só com Nova Tarefa e Selecionar várias é juízo visual do dono (UAT)."
  - id: D4
    description: "Quadro, Tabela e as barras de criação das quatro lentes em arquivos próprios, página com até 950 linhas, sem mudança de comportamento"
    requirement: EST-02
    verification:
      - kind: other
        ref: "wc -l page.tsx == 923; tsc --noEmit; eslint; vitest run src/features/estrutura (11 arquivos, 64 testes)"
        status: pass
    human_judgment: true
    rationale: "Criar Tarefa pela barra e arrastar um cartão no Quadro não têm teste de página; a equivalência de comportamento depende de conferência na tela (UAT)."

duration: 14min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 06: Página da Lista limpa Summary

**Seleção em lote numa peça só (`SelecaoEmLote` + `BotaoDeSelecao`) nas três lentes, contagem «Mostrando X de Y Tarefas.», sem as frases que explicam a regra, e a página da Lista de 1.407 para 923 linhas com Quadro, Tabela, barras de criação, diálogos e detalhes do cabeçalho em arquivos próprios.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-29T09:31:00Z
- **Completed:** 2026-10-29T09:45:00Z
- **Tasks:** 3
- **Files modified:** 11 (9 criados, 2 alterados)

## Accomplishments

- `selecao-em-lote.tsx`: `BotaoDeSelecao` e `SelecaoEmLote`. A página monta o painel uma vez, fora dos ramos de lente, em linha própria logo abaixo da barra principal; a `BulkStatusBar` segue inalterada e `bulk-status-bar.test.tsx` passa sem edição.
- A barra do Financeiro mostra sempre a `FinanceToolbar`; o botão de seleção entra pelo encaixe novo `fim`. O relatório do lote continua guardado na página, fora da seleção.
- `contagem-filtrada.tsx`: `textoDaContagem` (plural pelo Y, contas/conta na financeira) e `ContagemFiltrada`, 8 testes.
- Saíram a nota sob o Quadro, a frase ao lado de «Iniciar conversa», a de «Nova Tarefa» conversacional e o «De modelo» da barra conversacional (o da Lista comum fica).
- `QuadroDeTarefas`, `TabelaPlana` e `BarraDeCriacao` movidos sem mudar comportamento. O botão de rodar a agenda viaja pelo `fim` das barras comum e conversacional e só sai em 10-16.
- `wc -l` da página: 923 (meta 950; a UI-SPEC pedia abaixo de 1.000).

## Task Commits

1. **Task 1: Traçador — uma só seleção em lote** - `11d398e` (feat)
2. **Task 2: contagem curta, sem as frases de explicação** - `33c8c84` (feat)
3. **Task 3: Quadro, Tabela e barras fora da página** - `95be493` (refactor)

**Plan metadata:** commit de docs que inclui este SUMMARY (a seguir).

## Files Created/Modified

- `apps/web/src/features/estrutura/selecao-em-lote.tsx` — botão único e painel do lote.
- `apps/web/src/features/estrutura/contagem-filtrada.tsx` — a frase de contagem.
- `apps/web/src/features/estrutura/quadro-de-tarefas.tsx`, `tabela-plana.tsx` — Quadro e Tabela da página, movidos.
- `apps/web/src/features/estrutura/barra-de-criacao.tsx` — barras das quatro lentes.
- `apps/web/src/features/estrutura/dialogos-da-lista.tsx` — série de parcelas, Iniciar conversa, Nova Tarefa conversacional, painel da Tarefa e mover Tarefa.
- `apps/web/src/features/estrutura/detalhes-da-lista.tsx` — linha de detalhes do cabeçalho.
- `apps/web/src/features/estrutura/financeiro/contas-view.tsx` — `FinanceToolbar` troca o botão de seleção próprio por `fim`.
- `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx` — 1.407 → 923 linhas.

## Decisions Made

- O botão de seleção é desligado por `criacaoRecusada` nas três lentes, só enquanto não se está selecionando (antes, só nas barras comum e conversacional). Para Convidado na lente financeira o domínio já recusava o lote; agora o botão diz por quê antes do clique.
- `aria-pressed` não foi levado ao botão novo: o `Button` do sistema não o repassa, então ele nunca chegou ao DOM.
- Precedência das lentes da barra: financeira > espelhoComercial > conversacional > comum.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A página não chegava a 950 linhas só com as extrações nomeadas**
- **Found during:** Task 3
- **Issue:** Com `Quadro`, `Tabela` e as barras fora, a página ficou em 1.040 linhas.
- **Fix:** Aplicada a instrução do plano (extrair o bloco de diálogos para `features/estrutura/dialogos-da-lista.tsx`), e mais duas reduções sem mudar comportamento: a linha de detalhes do cabeçalho virou `detalhes-da-lista.tsx`; os dois pares de callbacks de marcar linha viraram `marcarUma`/`marcarVarias`; o `report` inline do Calendário/Linha do tempo, idêntico a `reportar`, passou a usar `reportar`.
- **Files modified:** `page.tsx`, `dialogos-da-lista.tsx`, `detalhes-da-lista.tsx`
- **Verification:** `wc -l` 923; `tsc --noEmit`, eslint e `vitest run src/features/estrutura` verdes.
- **Committed in:** `95be493`

**2. [Rule 1 - Bug] `aria-pressed` morto**
- **Found during:** Task 1 (teste do botão)
- **Issue:** os três botões antigos passavam `aria-pressed`, que o `Button` não repassa.
- **Fix:** não levado ao `BotaoDeSelecao`; o teste prova o rótulo, que é o que a pessoa vê.
- **Committed in:** `11d398e`

---

**Total deviations:** 2 (1 blocking, 1 bug menor)
**Impact on plan:** nenhuma mudança de escopo; os arquivos extras de Task 3 foram previstos pelo plano como saída se a página passasse de 950.

## Issues Encountered

- A suíte inteira (`npm test`) e o e2e não foram rodados, conforme orientação. Rodados: `tsc --noEmit` (web), eslint nos arquivos tocados, `npm run lint -w @n1/web` (0 erros; 3 avisos preexistentes em arquivos que este plano não toca), `npm run verificar:tokens` (0 falhas) e `vitest run src/features/estrutura` (11 arquivos, 64 testes).
- Não há teste de página para criar Tarefa pela barra nem para arrastar cartão no Quadro; a equivalência fica para a UAT (D3 e D4 do `coverage`).

## Known Stubs

None.

## Threat Flags

None. T-10-17: `SelecaoEmLote` passa à `BulkStatusBar` só `selecionadas` (recortadas ao que está na tela), e sair da seleção as limpa. T-10-18: `BarraDeCriacao` aplica o `criacaoRecusada` recebido da página a todo botão de criação.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronta a sequência da página: 2.1.4 → 2.1.5 → 2.1.6 feitas; seguem 2.5.4 (tirar a Carga) → 2.6.2 (Visualizações padrão) → 2.1.1, com folga de 27 linhas sob a meta de 950.
- A aba «Carga» e `CargaDeTrabalho` seguem na página (2.5.4, plano próprio). O botão «Rodar agenda da Lista (hoje)» segue no `fim` das barras comum e conversacional até 10-16.

## Self-Check: PASSED

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
