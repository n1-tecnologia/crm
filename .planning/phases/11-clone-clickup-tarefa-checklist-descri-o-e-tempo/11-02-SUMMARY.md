---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
plan: 02
subsystem: dominio
tags: [descricao, mencao, historico, atividade, zod, vitest]

requires:
  - phase: 11-01
    provides: checklist de um nivel e esquema de updateTask/convertChecklistItem enxutos
provides:
  - Task.descriptionMentions (so Membro, derivada do texto)
  - updateTask com descriptionMentions, validacao de Membro e before/after da descricao cortados
  - modulo packages/dominio/src/descricao-da-tarefa.ts (leituras unicas da descricao)
  - UPDATE_TASK_INPUT aceitando descriptionMentions
affects: [11-04 Notificacoes de mencao, 11-05 hook de digitacao, 11-06 historico na tela, 11-07 destaque da mencao, 11-08 UAT]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 797291be876d81d2f18a59f456e633045d807289
plan_head_after: e416339857baf732379064d1065ebb227a388a2b

tech-stack:
  added: []
  patterns:
    - "Lista derivada do texto: a escrita refiltra por higiene, a leitura (membrosMencionadosNaDescricao) e a invariante"
    - "Modulo-folha de leituras da descricao, sem import de derive.ts"

key-files:
  created:
    - packages/dominio/src/descricao-da-tarefa.ts
    - packages/dominio/src/operations/descricao-da-tarefa.test.ts
  modified:
    - packages/dominio/src/types/structure.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/collaboration.ts
    - packages/dominio/src/derive-visibilidade.test.ts
    - apps/api/src/rotas/esquemas/tarefas.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts

key-decisions:
  - "D-09: a invariante 'mencao sem @Nome nunca avisa' vale na leitura (membrosMencionadosNaDescricao); updateTask so refiltra por higiene, porque rollback do financeiro e recorrencia escrevem a descricao fora dele"
  - "Pitfall 7: mencionaNoTexto exige fronteira depois do nome (fim, espaco ou pontuacao) numa funcao so, usada por dominio, hook e destaque"
  - "A4: 2.000 pontos de codigo de conteudo + reticencias (2.001 no total); descricao antes vazia grava before vazio"
  - "Mudar so a lista de mencoes (texto igual) atualiza updatedAt e nao grava Atividade"

requirements-completed: [TAR-04, TAR-06]

coverage:
  - id: D1
    description: "updateTask grava descriptionMentions derivada do texto e recusa Membro inexistente antes de mudar qualquer campo"
    requirement: TAR-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/descricao-da-tarefa.test.ts#updateTask — menção da descrição e texto anterior (11-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Descricao alterada grava before/after cortados em 2.000 pontos de codigo + reticencias, sem partir emoji"
    requirement: TAR-06
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/descricao-da-tarefa.test.ts#cortarParaHistorico"
        status: pass
    human_judgment: false
  - id: D3
    description: "Leituras da descricao (lista efetiva, segmentos, trecho) e recorrencia que leva a mencao"
    requirement: TAR-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/descricao-da-tarefa.test.ts#membrosMencionadosNaDescricao"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/descricao-da-tarefa.test.ts#recorrência (padrão de trabalho nº 2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O texto do historico da descricao de Gestao nao chega a quem nao enxerga Gestao (recorte de GET /estado)"
    requirement: TAR-06
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#D-14"
        status: pass
    human_judgment: false
  - id: D5
    description: "UPDATE_TASK_INPUT aceita descriptionMentions so de Membro; contagem (j) segue 289"
    requirement: TAR-04
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/esquemas-de-argumentos.test.ts#(a2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Renomear um Membro faz o @Nome antigo deixar de contar (premissa sinalizada do plano)"
    requirement: TAR-04
    verification: []
    human_judgment: true
    rationale: "Comportamento aceito por construcao (D-06); fica para a UAT de 11-08."

duration: 6min
completed: 2026-10-29
status: complete
---

# Phase 11 Plan 02: Menção da descrição e texto anterior no histórico Summary

**`updateTask` passa a gravar `Task.descriptionMentions` (derivada do `@Nome` no texto, Membro inexistente recusado antes de mudar algo) e o `before`/`after` da "Descrição alterada" cortados em 2.000 pontos de código + "…", com as leituras da descrição concentradas em `descricao-da-tarefa.ts`.**

## Performance

- **Duration:** 6 min
- **Tasks:** 2 (cada uma com RED e GREEN)
- **Files modified:** 8 (2 criados, 6 alterados)

## Accomplishments
- `Task.descriptionMentions?` (só Membro) no tipo, em `UpdateTaskInput` e em `UPDATE_TASK_INPUT` (`z.literal("member")` + `.strict()`).
- `updateTask`: valida os Membros antes do primeiro campo (mesma frase de `addTaskComment`), grava a lista refiltrada pelo texto (sem repetição, vazia apaga a chave), e só a lista mudando atualiza `updatedAt` sem Atividade.
- "Descrição alterada" passa a levar `before`/`after` via `cortarParaHistorico` (corte por ponto de código, `before: ""` presente quando a descrição era vazia).
- Módulo-folha `descricao-da-tarefa.ts`: `LIMITE_DO_HISTORICO`, `cortarParaHistorico`, `ACAO_DESCRICAO_ALTERADA`, `ehAlteracaoDeDescricao`, `mencionaNoTexto`, `segmentosComMencoes`, `membrosMencionadosNaDescricao`, `trechoDaMencao`.
- A próxima ocorrência de uma Tarefa recorrente copia `descriptionMentions` (objetos novos).
- Prova de D-14: o texto do histórico de uma Tarefa de Gestão não aparece em `GET /estado` de quem não enxerga Gestão (teste de `visibilidadePara`; o filtro já existia, o caso é a garantia).

## TDD Gate Compliance

- **Task 1 RED** `490fcc9`: 11 de 13 testes falham (asserções do comportamento planejado: lista não gravada, `before`/`after` ausentes, `cortarParaHistorico` ainda lançando "não implementada"); no esquema, o caso (a2) falha porque `.strict()` recusava a chave. Os dois que passam (menção sem `@Nome` não grava; menção não cria concessão) são guardas de regressão. Avaliação semântica: o alvo executou e falhou pelo comportamento planejado. O esqueleto de `descricao-da-tarefa.ts` entrou no commit RED só para o teste carregar. `workflow.tdd_mode` desligado, então `check tdd-red-evidence` não foi rodado.
- **Task 1 GREEN** `f903d1e`.
- **Task 2 RED** `4a5b068`: 9 falhas (`TypeError: ... is not a function` das três leituras novas e asserção da recorrência). O caso de D-14 já passava (o recorte existia): é prova de garantia, não de feature.
- **Task 2 GREEN** `e416339`.
- Sem commit de REFACTOR (nada a limpar).

## Task Commits

1. **Task 1 RED** - `490fcc9` (test)
2. **Task 1 GREEN** - `f903d1e` (feat)
3. **Task 2 RED** - `4a5b068` (test)
4. **Task 2 GREEN** - `e416339` (feat)

**Plan metadata:** commit `docs(11-02)` desta SUMMARY.

## Files Created/Modified
- `packages/dominio/src/descricao-da-tarefa.ts` - leituras da descrição (novo)
- `packages/dominio/src/operations/descricao-da-tarefa.test.ts` - prova de TAR-04 e TAR-06 no domínio (novo)
- `packages/dominio/src/types/structure.ts` - `Task.descriptionMentions`
- `packages/dominio/src/operations/tasks.ts` - `updateTask` com validação, refiltro e before/after
- `packages/dominio/src/operations/collaboration.ts` - recorrência copia a lista
- `packages/dominio/src/derive-visibilidade.test.ts` - caso D-14
- `apps/api/src/rotas/esquemas/tarefas.ts` - `UPDATE_TASK_INPUT` com `descriptionMentions`
- `apps/api/src/rotas/esquemas-de-argumentos.test.ts` - caso (a2)

## Decisions Made
Ver `key-decisions`. Nada fora do que o plano já decidia.

## Deviations from Plan

None - plan executed exactly as written. (Adaptação de teste: a descrição do seed de `tsk_seed_1` é vazia, então o caso "antes = descrição antiga" grava uma descrição antes de editar.)

## Issues Encountered
None.

## Known Stubs
None.

## Threat Flags
None - T-11-04 (menção forjada), T-11-05 (texto do histórico), T-11-07 (esquema) e T-11-08 (corte) mitigados e provados em teste; T-11-06 aceito (D-13). Nenhuma superfície nova além das do `<threat_model>`.

## User Setup Required
None - no external service configuration required.

## Verification
- `packages/dominio`: `npx vitest run` 111 arquivos / 2169 testes verdes; `tsc --noEmit` verde.
- `apps/api`: `DATABASE_URL= npx vitest run src/rotas/esquemas src/rotas/esquemas-de-argumentos.test.ts` 96 testes verdes ((j) segue 289); `tsc --noEmit` verde.
- `apps/web`: `tsc --noEmit` verde.
- Nenhum teste ou migração rodou contra o banco de produção.

## Next Phase Readiness
- 11-04 pode usar `membrosMencionadosNaDescricao` em `pendingMentions`; 11-05/11-07 usam `mencionaNoTexto` e `segmentosComMencoes`; 11-06 usa `ehAlteracaoDeDescricao`; as Notificações usam `trechoDaMencao`.
- Premissa aberta para a UAT de 11-08: renomear um Membro faz o `@Nome` antigo deixar de contar.

## Self-Check: PASSED

---
*Phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo*
*Completed: 2026-10-29*
