---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
plan: 04
subsystem: dominio
tags: [mencao, notificacoes, descricao, derive, vitest]

requires:
  - phase: 11-02
    provides: membrosMencionadosNaDescricao, trechoDaMencao e ACAO_DESCRICAO_ALTERADA (descricao-da-tarefa.ts)
  - phase: 11-03
    provides: base do dominio da Fase 11 (tempo registrado), sem dependencia direta
provides:
  - MencaoPendente (uniao comentario | descricao) e pendingMentions com lista unica ordenada
  - Notificacoes mostrando "Menção a você na descrição de" com trecho e link
affects: [11-07 destaque da mencao, 11-08 UAT]

actuals:
  tokens: 21000
  tasks: 2
  commits: 3
plan_head_before: b53170144b9903cd3256fc79c7e37a9fecf919b0
plan_head_after: dfcf1862decceaa5297d037c1f8ffee9e5fd89d4

tech-stack:
  added: []
  patterns:
    - "Aviso derivado do dado: nada e guardado por pessoa; a regra de sumir e o proprio filtro (ativo, fora de categoria terminal, nome no texto)"
    - "Uniao discriminada por tipo obriga cada leitor de comment a estreitar em tempo de compilacao"

key-files:
  created:
    - packages/dominio/src/operations/mencao-na-descricao.test.ts
    - apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx
  modified:
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/pessoa-da-conta.test.ts
    - packages/dominio/src/operations/automations-motor.test.ts
    - apps/web/src/app/(shell)/notificacoes/page.tsx

key-decisions:
  - "D-07/D-08: a variante descricao so entra para quem ve a Tarefa, com a Tarefa ativo e fora de categoria terminal; o filtro terminal vale so para ela, o Comentario segue como era"
  - "Q4: a lista unica vem em instante decrescente; o instante da descricao e o 'at' do Registro 'Descrição alterada' mais recente, ou task.createdAt sem Registro"
  - "Padrao de trabalho nº 1: quem escreve o proprio nome na descricao tambem ve o aviso (a descricao nao tem autor)"
  - "O Set de excluidos de comentariosObservados so recebe ids da variante comentario"

requirements-completed: [TAR-05]

coverage:
  - id: D1
    description: "pendingMentions devolve a variante descricao para o Membro mencionado e o total das Notificacoes a conta uma vez"
    requirement: TAR-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mencao-na-descricao.test.ts#a Tarefa que a Júlia vê, com @Júlia Prado na descrição, entra em pendingMentions e no total"
        status: pass
    human_judgment: false
  - id: D2
    description: "A mencao some por conta propria (Tarefa fechada, lixeira, arquivo, nome tirado, atribuicao direta) e nunca vaza (forjada, quem nao ve)"
    requirement: TAR-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mencao-na-descricao.test.ts#a menção da descrição some por conta própria (D-08)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/mencao-na-descricao.test.ts#a menção da descrição nunca vaza nem se forja (D-09, RN-TAR-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tela de Notificacoes mostra as duas variantes em 'Menções a você' e o aviso de Comentario segue igual"
    requirement: TAR-05
    verification:
      - kind: unit
        ref: "apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx#Notificações › Menções a você (11-04)"
        status: pass
    human_judgment: true
    rationale: "Texto, trecho e ordem na tela precisam de olho humano na UAT de 11-08 (premissas sinalizadas: ordem pela ultima edicao, quem se menciona ve o aviso)"

duration: 5min
completed: 2026-10-29
status: complete
---

# Phase 11 Plan 04: Menção da descrição avisa em Notificações Summary

**`pendingMentions` vira uma lista única `MencaoPendente` (Comentário | descrição) derivada do dado, sem estado novo, e a tela de Notificações mostra "Menção a você na descrição de “{título}”" com o trecho.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-10-29T22:19Z
- **Tasks:** 2
- **Files modified:** 6 (2 criados)

## Accomplishments

- `MencaoPendente` e `pendingMentions` novo: a variante `descricao` só entra se `membrosMencionadosNaDescricao` inclui o Membro, a Tarefa está `ativo`, fora de categoria terminal e `memberSeesTask` é verdadeiro; ordenação decrescente pelo instante (Comentário: `createdAt`; descrição: último Registro "Descrição alterada" ou `createdAt`).
- `notificacoesDoMembro`: `mencoes` com a união; o Set de Comentários já contados só recebe a variante `comentario`; sino e Início seguem lendo `.total`/`.length` sem mudança.
- Página de Notificações: variante da descrição (`key` `descricao-{id}`, link `/estrutura/tarefas/{id}`), Comentário com o mesmo JSX de antes, dica do rodapé atualizada.
- 15 testes de domínio e 3 de tela; os 4 predicados `p.comment.id` antigos estreitam por `tipo`.

## TDD (RED/GREEN)

- **RED** (`4e852ab`): o caso positivo de domínio falhou em `expect(entradas).toHaveLength(1)` (recebeu 0) e o de tela falhou na ausência do texto "Menção a você na descrição de"; o teste de Comentário da tela passou, como esperado (regressão). Avaliação semântica: o alvo executou e falhou na asserção planejada, não por importação/sintaxe.
- **GREEN** (`fff3e57`): `derive.ts` + página + estreitamento dos testes antigos.
- **Task 2** (`dfcf1862`): os testes de borda foram escritos depois do GREEN da Task 1 (a implementação já cobria as regras), então passaram de primeira. Para provar que não são vácuos, mutei o filtro terminal em `derive.ts` (trocado por `true`) e o teste "Tarefa concluída ou fechada" falhou; o arquivo foi restaurado.
- Sem commit de refactor (nada a limpar).

## Task Commits

1. **Task 1 RED** - `4e852ab` (test)
2. **Task 1 GREEN: traçador** - `fff3e57` (feat)
3. **Task 2: bordas (some sozinho, nunca vaza)** - `dfcf1862` (test)

**Plan metadata:** commit `docs(11-04)` seguinte.

## Files Created/Modified

- `packages/dominio/src/derive.ts` - `MencaoPendente`, `pendingMentions` com as duas origens, `NotificacoesDoMembro.mencoes`
- `packages/dominio/src/operations/mencao-na-descricao.test.ts` - prova de TAR-05 no domínio
- `packages/dominio/src/operations/pessoa-da-conta.test.ts`, `automations-motor.test.ts` - predicados estreitados por `tipo`
- `apps/web/src/app/(shell)/notificacoes/page.tsx` - as duas variantes em "Menções a você"
- `apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx` - prova da tela

## Decisions Made

Ver `key-decisions`. Nenhum campo novo em `Task` nem no estado (`git log --grep 11-04 -- packages/dominio/src/types/structure.ts` sai vazio).

## Deviations from Plan

None - plan executed exactly as written.

(Detalhe operacional, não desvio de regra: a Lista de `tsk_seed_1` exige o checklist fechado para ir a Status terminal, então os testes marcam os itens como feitos antes de `changeTaskStatus`.)

## Issues Encountered

Nenhum de código. Verificações: `packages/dominio` `npx vitest run` (113 arquivos, 2197 testes) e `tsc` verdes; `apps/web` `tsc`, eslint de `notificacoes` e vitest de `notificacoes`, `features/inicio`, `features/shell` (14 arquivos, 128 testes) verdes.

## Known Stubs

None.

## Threat Flags

None - sem superfície nova além da já coberta por T-11-10, T-11-11 e T-11-12 (trecho renderizado como nó de texto React).

## User Setup Required

None - no external service configuration required.

## Premissas sinalizadas para a UAT de 11-08

- Ordem da variante `descricao` pela última edição da descrição (decisão do planejador).
- Quem se menciona na própria descrição também vê o aviso (padrão de trabalho nº 1; confirmação do dono pendente).
- A mesma menção aparece uma vez por Tarefa, mesmo com o nome escrito várias vezes.

## Next Phase Readiness

Pronto para 11-05, 11-06 e 11-07 (mesma onda) e para a UAT de 11-08.

## TDD Gate Compliance

RED (`test(11-04)`, `4e852ab`) precede GREEN (`feat(11-04)`, `fff3e57`). Sem REFACTOR.

## Self-Check: PASSED

---
*Phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo*
*Completed: 2026-10-29*
