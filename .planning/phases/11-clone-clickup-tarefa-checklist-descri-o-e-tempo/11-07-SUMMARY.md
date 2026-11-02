---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
plan: 07
subsystem: web
tags: [conversao, checklist, descricao, mencao, tempo, confirmdialog, jsdom, vitest]

requires:
  - phase: 11-01
    provides: conversaoDeItemRecusada e convertChecklistItem de cinco parametros
  - phase: 11-02
    provides: membrosMencionadosNaDescricao e segmentosComMencoes
  - phase: 11-03
    provides: tempoRegistrado e valorDaLinhaDeTempo
provides:
  - BotaoDeConversao e DialogoDeConversao em features/estrutura/conversao-de-item.tsx
  - DescricaoDaTarefa em features/estrutura/descricao-da-tarefa.tsx (@Nome destacado)
  - tarefa-completa.tsx ligado aos dois e a valorDaLinhaDeTempo, com o estado linkDoAviso
affects: [11-08 UAT (textos da confirmacao e do aviso, cor do botao, sensacao de um clique, destaque da mencao)]

actuals:
  tokens: 6000
  tasks: 3
  commits: 5
plan_head_before: 9c19a017473027b7e394c0c6e94b60bc7e8800a4
plan_head_after: 85b84093292b2f7d1890f4347121dc730346b0bb

tech-stack:
  added: []
  patterns:
    - "Componente testavel extraido de um arquivo gigante que nenhum teste renderiza: o dialogo e a descricao viram arquivos proprios"
    - "Aviso com link usa o id de runConfirmado.confirmado (servidor), nunca o da copia local"

key-files:
  created:
    - apps/web/src/features/estrutura/conversao-de-item.tsx
    - apps/web/src/features/estrutura/conversao-de-item.test.tsx
    - apps/web/src/features/estrutura/descricao-da-tarefa.tsx
    - apps/web/src/features/estrutura/descricao-da-tarefa.test.tsx
  modified:
    - apps/web/src/features/estrutura/tarefa-completa.tsx

key-decisions:
  - "D-05: o botao de converter sai da mesma derivada da operacao (conversaoDeItemRecusada) e o aviso 'Abrir' usa o id do servidor via useRunConfirmado"
  - "D-01: a confirmacao e um ConfirmDialog de um clique, sem destructive, sem campo de digitar o nome; o texto avisa que a conversao nao tem volta"
  - "Numa recusa local o dialogo fecha para o erro aparecer (escolha do planejador)"
  - "DescricaoDaTarefa devolve so conteudo inline (texto e span data-mencao com as variaveis de .rico .mencao), nunca HTML"

requirements-completed: [TAR-02, TAR-04, TAR-07]

coverage:
  - id: D1
    description: "Botao Converter em Subtarefa aparece em tsk_seed_1 e tsk_seed_7, na cor normal, e some em tsk_seed_8, em Lista sem Subtarefas e para o Convidado"
    requirement: TAR-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/conversao-de-item.test.tsx#BotaoDeConversao — só onde o domínio deixa (D-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Confirmacao de um clique, sem campo de texto, que avisa que nao tem volta; Item inexistente nao abre dialogo"
    requirement: TAR-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/conversao-de-item.test.tsx#DialogoDeConversao — um clique, sem digitar o nome (D-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Converter grava uma chamada convertChecklistItem; onConvertida recebe o id do servidor e a recusa do servidor chega em onErro"
    requirement: TAR-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/conversao-de-item.test.tsx#DialogoDeConversao — o id é o do servidor (T-11-19)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O cartao do Quadro nao ganha gesto de converter"
    requirement: TAR-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/conversao-de-item.test.tsx#Quadro — o cartão não converte (D-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A descricao destaca o @Nome da lista efetiva, nao destaca sem a lista e nao vira HTML"
    requirement: TAR-04
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/descricao-da-tarefa.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "A linha Rastrear tempo usa valorDaLinhaDeTempo(tempoRegistrado(...)) e tarefa-completa.tsx nao cresceu (2.304 linhas)"
    requirement: TAR-07
    verification:
      - kind: other
        ref: "grep durationMinutes em tarefa-completa.tsx (0); wc -l <= 2371; vitest run src/features/estrutura (222 passando)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Textos da confirmacao e do aviso, cor do botao, sensacao de um clique e aparencia do destaque da mencao"
    requirement: TAR-02
    verification: []
    human_judgment: true
    rationale: "Escolhas de texto e visual do planejador (Claude's Discretion); o jsdom nao julga cor nem sensacao. Fica para a UAT de 11-08."

duration: 10min
completed: 2026-10-29
status: complete
---

# Phase 11 Plan 07: Conversao em um clique, descricao com @Nome destacado e tempo igual ao editor Summary

**Na Tarefa aberta, converter um Item em Subtarefa e um botao na cor normal (so onde `conversaoDeItemRecusada` deixa) com confirmacao de um clique e aviso "Abrir" para o id que o servidor devolveu; a descricao destaca o `@Nome` mencionado sem virar HTML; e a linha "Rastrear tempo" usa o mesmo formatador do editor.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-29T22:33:00Z
- **Completed:** 2026-10-29T22:40:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 criados, 1 alterado)

## Accomplishments
- `BotaoDeConversao` consulta `conversaoDeItemRecusada(state, memberId, task.id)` e some em Lista sem Subtarefas, em `tsk_seed_8` (nivel 3) e para o Convidado; aparece em `tsk_seed_1` e `tsk_seed_7`, sem atributo `style`.
- `DialogoDeConversao` e um `ConfirmDialog` sem `destructive` e sem filhos; usa `useRunConfirmado`; recusa local fecha o dialogo e mostra o erro; resposta do servidor leva o id `tsk_do_servidor` ate o aviso "Item convertido em Subtarefa: {titulo}." com o link "Abrir" (`linkDoAviso`).
- `tarefa-completa.tsx` perdeu o estado de digitacao do nome, a funcao `convert`, os lookups `convertingChecklist`/`convertingItem` e o bloco do dialogo antigo, o comentario D13 foi reescrito, e o arquivo foi de 2.351 para 2.304 linhas (limite 2.371).
- `DescricaoDaTarefa` monta so nos de texto e `<span data-mencao>` a partir de `segmentosComMencoes`, nos dois lugares que imprimiam `{task.description}`.
- A linha "Rastrear tempo" mostra `valorDaLinhaDeTempo(tempoRegistrado(state, task.id))` (soma local de `durationMinutes` removida).

## TDD Gate Compliance

- **Task 1 (tracer) RED** `b680dce`: componentes como esqueleto (`null`); 5 de 10 testes falharam nas asserções planejadas (botão ausente em `tsk_seed_1`/`tsk_seed_7`, `alertdialog` ausente em todos os casos do diálogo); os outros 5 (botão ausente onde não deve aparecer, Item inexistente, cartão sem gesto) já passam e são guardas. Avaliação semântica: o alvo executou e falhou pelo comportamento planejado, sem erro de import ou fixture. `workflow.tdd_mode` desligado, então `check tdd-red-evidence` não foi rodado.
- **Task 1 GREEN** `be69db3`: 10/10 e `sem-codigo-de-regra` verdes, tsc e eslint limpos. Tracer verificado de ponta a ponta antes de seguir para a expansão.
- **Task 2 RED** `12266be`: esqueleto imprime o texto cru; 2 de 4 falharam em `expected undefined to be '@Júlia Prado'` (destaque ausente); os casos "sem lista" e "quebra de linha" são guardas.
- **Task 2 GREEN** `0e029b2`: 4/4 verdes.
- **Task 3** `85b8409` (type `auto`, sem `tdd`): sem commit de RED; coberta por `tempo.test.ts` e `tempo-da-tarefa.test.tsx` de 11-03 e pela pasta inteira.
- Sem commit de REFACTOR (nada a limpar).

## Task Commits

1. **Task 1 RED:** `b680dce` test(11-07): add failing test for converter Item em um clique
2. **Task 1 GREEN (tracer):** `be69db3` feat(11-07): converter Item em Subtarefa em um clique, so onde o dominio deixa
3. **Task 2 RED:** `12266be` test(11-07): add failing test for @Nome destacado na descricao
4. **Task 2 GREEN:** `0e029b2` feat(11-07): descricao da Tarefa mostra o @Nome mencionado destacado
5. **Task 3:** `85b8409` feat(11-07): linha Rastrear tempo mostra o mesmo numero do editor

**Plan metadata:** commit seguinte (docs: complete plan)

## Files Created/Modified
- `apps/web/src/features/estrutura/conversao-de-item.tsx` - `BotaoDeConversao` e `DialogoDeConversao`
- `apps/web/src/features/estrutura/conversao-de-item.test.tsx` - 10 testes (botão, um clique, id do servidor, erro, cartão sem gesto)
- `apps/web/src/features/estrutura/descricao-da-tarefa.tsx` - `DescricaoDaTarefa`
- `apps/web/src/features/estrutura/descricao-da-tarefa.test.tsx` - 4 testes (destaque, sem lista, texto puro, quebra de linha)
- `apps/web/src/features/estrutura/tarefa-completa.tsx` - ligado aos componentes e a `valorDaLinhaDeTempo`; estado `linkDoAviso`

## Decisions Made
- Seguiu o plano. A recusa local fecha o diálogo antes do erro (premissa sinalizada do plano), e `onFechar` é chamado antes de a confirmação do servidor resolver, para o endereço `?converter-item=` sair na hora.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Nenhum. `Field`, `TextInput` e `ConfirmDialog` continuam importados em `tarefa-completa.tsx` (usados no Negócio e nos outros diálogos); tsc e eslint não apontaram import morto.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: sem endpoint, caminho de autenticação ou schema novo. T-11-17 (nada vira HTML), T-11-18 (botão da mesma derivada) e T-11-19 (id do servidor) cobertos por teste.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pronto para 11-08 (UAT). Pendências humanas: textos da confirmação e do aviso, cor do botão, sensação de um clique, aparência do destaque da menção na descrição.

## Self-Check: PASSED

- Arquivos criados existem: conversao-de-item.tsx, conversao-de-item.test.tsx, descricao-da-tarefa.tsx, descricao-da-tarefa.test.tsx.
- Commits existem: b680dce, be69db3, 12266be, 0e029b2, 85b8409.
- `cd apps/web && npx tsc --noEmit`, `npx eslint src/features/estrutura` e `npx vitest run src/features/estrutura` (222 testes) verdes; `src/features/tarefa` e `src/app` (115 testes) verdes; `wc -l tarefa-completa.tsx` = 2.304.

---
*Phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo*
*Completed: 2026-10-29*
