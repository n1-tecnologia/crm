---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 06
subsystem: database
tags: [dominio, catalogo, zod-free-data, tdd, financeiro, solicitacao-de-pagamento]

# Dependency graph
requires:
  - phase: 00-prepara-o
    provides: "docs/07-processos/solicitacao-de-pagamento.md — a spec real (19 Tarefas exportadas + código do automation/)"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login
    provides: "packages/dominio/src/bootstrap-gestao.ts e seed-financeiro.ts como padrão de catálogo de Lista (Status, Campos, Tags, Grants)"
provides:
  - "CATALOGO_SOLICITACAO_DE_PAGAMENTO — Status, 25 Campos, Tag, Papéis e roteamento do aprovador, como dado tipado"
  - "resolverAprovador — leitura derivada pura que resolve o Papel aprovador por Centro de Custo e Valor (RN-SP-03)"
affects: [02-08 evolver, 02-13, 02-21 aprovação por clique]

# Tech tracking
tech-stack:
  added: []
  patterns: ["catálogo de Lista como dado puro pré-workspace (sem workspaceId/lifecycle), consumido por um evolver futuro"]

key-files:
  created:
    - packages/dominio/src/solicitacao-de-pagamento.ts
    - packages/dominio/src/solicitacao-de-pagamento.test.ts
  modified:
    - packages/dominio/src/index.ts

key-decisions:
  - "Papéis e Campos do catálogo usam tipos locais (CampoDaSolicitacao, PapelDaSolicitacao, TagDaSolicitacao) em vez de FieldDefinition/Tag reais — o catálogo nasce antes de qualquer workspaceId existir; mesmo precedente de Template.creates.listConfig em types/workspace.ts"
  - "Todas as regras de roteamento apontam para o único Papel rol_sp_aprovador (Task 1 definiu exatamente cinco Papéis) — a distinção entre Elifas/Fabíola/Thiago/Iallas fica em quem ocupa o Papel por atribuição, fora deste catálogo (D-13)"

patterns-established:
  - "resolverAprovador(entrada, regras) lança erro explícito em vez de devolver undefined quando a configuração não tem fallback — evita roteamento silenciosamente vazio"

requirements-completed: [SOL-01]

# Metrics
duration: 20min
completed: 2026-09-21
---

# Phase 02 Plan 06: Catálogo da Lista "Solicitações de pagamento" Summary

**Catálogo tipado com os 4 Status, 25 Campos (A..Z), a Tag `conta tria`, os 5 Papéis e o roteamento do aprovador por Centro de Custo e Valor (corte R$ 5.000), fiel a `docs/07-processos/solicitacao-de-pagamento.md`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 completed
- **Files modified:** 3 (2 criados, 1 modificado)

## Accomplishments
- `CATALOGO_SOLICITACAO_DE_PAGAMENTO` traduz a spec real (19 Tarefas exportadas + código do `automation/`) para dado tipado: nenhum Status/Campo inventado, `Cartão` como quarta opção de Forma de pagamento (D-08), `Y-Produto` marcado como lacuna explícita (`LACUNA-SP-Y`) em vez de opções inventadas.
- `resolverAprovador` materializa RN-SP-03 (D-07) como configuração alterável sem deploy — alvo sempre um Papel, nunca um id de Membro (D-13) — com prova de paridade executável (10 casos, TDD RED→GREEN).
- `Revisor do RESUMO` nasce sem ocupantes hardcoded; nenhuma menção de dado a Maryane/Liliane no arquivo (D-13).

## Task Commits

Each task was committed atomically:

1. **Task 1: Status, Tags e Papéis da Lista** - `183f58e` (feat)
2. **Task 2: Os 25 Campos na ordem A..Z** - `c0e45ef` (feat)
3. **Task 3: Roteamento do aprovador como configuração e prova de paridade** - `be7a086` (test, RED) → `a9f0b45` (feat, GREEN)

_Task 3 é TDD: o commit RED (`be7a086`) prova que `resolverAprovador` e o bloco `roteamento` ainda não existiam (3 dos 10 casos falhavam); o commit GREEN (`a9f0b45`) implementa e os 10 casos passam, junto com a exportação em `index.ts`._

**Plan metadata:** (este commit, ao final)

## Files Created/Modified
- `packages/dominio/src/solicitacao-de-pagamento.ts` - `CATALOGO_SOLICITACAO_DE_PAGAMENTO` (statusSet, tags, papeis, campos, roteamento) + `resolverAprovador`; ids literais `sts_sp_*`, `fld_sp_*`, `rol_sp_*`, `tag_sp_conta_tria`
- `packages/dominio/src/solicitacao-de-pagamento.test.ts` - 11 casos: os 10 (a)-(j) do plano + 1 caso extra provando o erro explícito de `resolverAprovador` sem fallback
- `packages/dominio/src/index.ts` - exporta `CATALOGO_SOLICITACAO_DE_PAGAMENTO`, `resolverAprovador`, `SOL` e os quatro tipos do catálogo

## Decisions Made
- **Tipos locais em vez de `FieldDefinition`/`Tag` reais:** o plano pede "25 `FieldDefinition`", mas `FieldDefinition` exige `workspaceId` e `lifecycle` — campos que só existem depois que a Lista nasce num Espaço real. Segui o precedente já presente em `types/workspace.ts` (`Template.creates.listConfig.fieldDefinitions`, uma forma sem `workspaceId` para configuração pré-instanciação) e defini `CampoDaSolicitacao`/`TagDaSolicitacao` locais, mais leves, deixando o evolver (Plan 02-08) completar `workspaceId`/`lifecycle`/`definedAtType` ao materializar.
- **Um único Papel `rol_sp_aprovador` para todas as regras de roteamento:** a Task 1 fixa exatamente cinco Papéis (critério de aceite explícito); a Task 3 menciona "`rol_sp_aprovador` e variantes", mas criar Papéis por aprovador nomeado (Elifas/Fabíola/Thiago/Iallas) contradiria a contagem fechada da Task 1 e o D-13 (Papel é o nível de abstração, não a pessoa). Todas as 7 regras de `ROTEAMENTO_SOLICITACAO_DE_PAGAMENTO` apontam para o mesmo Papel; quem o ocupa por Centro de Custo/Valor é atribuição, documentada só em comentário (`descricao`).
- **`ordem` dos 25 Campos é a posição sequencial 1..25** (não o índice bruto do alfabeto, que teria um buraco em 22 onde `V` não existe) — satisfaz literalmente "derivada da letra" (mesma ordem alfabética A..Z-menos-V) e "estritamente crescente e sem buraco" (teste b) ao mesmo tempo.

## Deviations from Plan

None - plan executed exactly as written. As únicas escolhas de implementação (tipos locais para Campo/Tag, Papel único no roteamento, `ordem` sequencial) estão dentro do "Claude's Discretion" do CONTEXT da fase e não alteram nenhuma verdade do `must_haves` nem nenhum critério de aceite.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`CATALOGO_SOLICITACAO_DE_PAGAMENTO` e `resolverAprovador` estão prontos para o evolver do Plan 02-08 materializar a Lista de verdade no `DataState` (Espaço "Gestão" › Pasta "Financeiro"), ao lado de "Contas a pagar" — que este plano não tocou (`git diff --stat` vazio em `seed-financeiro.ts`). O Papel `rol_sp_aprovador` e o roteamento por Centro de Custo/Valor ficam disponíveis para os Plans 02-13/02-21 (aprovação por clique) consultarem antes de `solicitarAprovacao`. Nenhum bloqueio conhecido.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*
