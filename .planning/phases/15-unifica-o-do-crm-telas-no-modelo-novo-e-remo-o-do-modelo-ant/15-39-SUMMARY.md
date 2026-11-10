---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 39
subsystem: dominio-api
tags: [ia, automacoes, funil, escopo, gesto-misto, tdd, ucr-08]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-08: gesto-no-crm/ia.ts com LER_DO_CRM_IA, LeituraDoCrm.ler com o Membro como 5o parametro, LidoDoCrm.funis (15-01)"
provides:
  - "escopoExiste(state, tipo, id, funis?) e inoperante(state, automacao, funis?): o Funil e conferido na lista de Funis (id, estado) por argumento; ativo e arquivado valem, na lixeira e ausente nao"
  - "criarAutomacao(state, m, input, funis?): o escopo Funil e conferido na tabela; leituraDoFunilDaAutomacao (gesto-no-crm/ia.ts) le o Funil de input.scopeId em plataforma.funis do Espaco da sessao"
  - "FUNIS_DO_NAVEGADOR (esquemas/fragmentos.ts): forma de transporte do funis que o navegador pode mandar; a rota o descarta"
  - "FunisDoEscopo (tipo exportado de automacoes-catalogo.ts)"
affects: [15-21]

plan_head_before: 4c531d86fd6f3993dbd4f92f4a0172fb5a43c6f0
plan_head_after: 06ac8d02819e5ed14bbc66958f0a4dbaa3492739

actuals:
  tokens: 7100
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Leitura de gesto misto que busca so o registro citado pelo input (obter por id) em vez de listar o Espaco para conferir um id"
    - "Parametro posicional opcional no fim (funis), como nomes no 15-08: ausente = desconhecido, a web compila ate o 15-21"

key-files:
  created: []
  modified:
    - packages/dominio/src/operations/ia/automacoes-catalogo.ts
    - packages/dominio/src/operations/ia/automacoes-editor.ts
    - packages/dominio/src/derive-ia.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/gesto-no-crm/ia.ts
    - apps/api/src/rotas/esquemas/ia-automacoes-editor.ts
    - apps/api/src/rotas/esquemas/fragmentos.ts
    - apps/api/src/rotas/CONTEXT.md
    - packages/dominio/src/operations/ia/automacoes.test.ts
    - packages/dominio/src/operations/ia/fundacao.test.ts
    - packages/dominio/src/seed-ia.test.ts
    - apps/api/src/rotas/operacoes-ia.test.ts

key-decisions:
  - "A leitura de criarAutomacao busca so o Funil de input.scopeId (repositorio obter, filtrado por Espaco) e nao lista todos os Funis: o repositorio nao tem listagem sem filtro de estado/pagina, e conferir um id nao precisa dela. O teto de 200 vale para o funis do navegador (descartado)."
  - "editarAutomacao nao recebeu funis: EditarAutomacaoInput nao troca de escopo (so nome, descricao e reage a Eventos), entao nao ha escopo a conferir nessa operacao."
  - "escopoExiste trata Funil na lixeira como inexistente (plano); por isso inoperante diz 'escopo eliminado (Funil)' para Funil na lixeira, onde antes dizia 'escopo na lixeira (Funil)'. O estado arquivado segue dando 'escopo arquivado (Funil)'."

requirements-completed: [UCR-08]

duration: 12 min
completed: 2026-11-06
---

# Phase 15 Plan 39: Escopo Funil da Automacao conferido na tabela Summary

**`criarAutomacao` confere o Funil do escopo em `plataforma.funis` (lido pelo servidor na transacao) e `escopoExiste`/`inoperante` recebem os Funis por argumento, sem ler `state.funnels`.**

## Accomplishments

- Dominio: `escopoExiste(..., funis?)` confere o ramo `funnel` na lista (`id`, `estado`): ativo e arquivado existem, na lixeira e ausente nao. `criarAutomacao(..., funis?)` repassa; sem `funis` recusa com "O escopo indicado nao existe." sem lancar.
- `derive-ia.ts`: `inoperante(..., funis?)` e `estadoDoEscopo` derivam o estado do Funil da lista (`estadoDoFunil`). Zero `state.funnels` em `derive-ia.ts` e `automacoes-catalogo.ts`.
- API: `leituraDoFunilDaAutomacao` (posicao 1 de `criarAutomacao`) le o Funil do `scopeId` em `plataforma.funis` do Espaco da sessao; `FUNIS_DO_NAVEGADOR` valida a forma do `funis` que o navegador manda e a rota o descarta (T-15-92). Funil de outro Espaco nao aparece na leitura (T-15-93).
- Borda UCR-08: `criarAutomacao` com Funil forjado pelo navegador (inexistente na tabela) e recusado duas vezes seguidas, e nada e gravado em `plataforma.registros`.

## Coverage

```yaml
coverage:
  - deliverable: "criarAutomacao confere o escopo Funil na tabela, do dominio a rota"
    verification:
      - kind: test
        ref: "apps/api/src/rotas/operacoes-ia.test.ts#criarAutomacao com escopo Funil confere o Funil na tabela (15-39, 3.4.9)"
        status: pass
      - kind: test
        ref: "packages/dominio/src/operations/ia/automacoes.test.ts#o escopo Funil confere o Funil que o servidor leu"
        status: pass
    human_judgment: false
  - deliverable: "escopoExiste e inoperante com Funis por argumento"
    verification:
      - kind: test
        ref: "packages/dominio/src/operations/ia/fundacao.test.ts#Escopo Funil da Automacao le os Funis por argumento (15-39, 3.4.9)"
        status: pass
    human_judgment: false
```

## TDD

- **RED 1 (3775404):** `automacoes.test.ts` (ativo/arquivado criam; lixeira, outro Espaco, ausente e `[]` recusam) e `operacoes-ia.test.ts` (3 casos de rota em Docker). Falhou nas asserts planejadas: dominio `expected false to be true` em `ativa.ok` (Funil so existe na lista, nunca em `state.funnels`); rota `O escopo indicado nao existe.: expected false to be true` (cria) e `expected 400 to be 200` (esquema ainda recusava o `funis` forjado). Avaliacao semantica: o teste alvo executou e falhou pela razao pretendida, sem erro de import/fixture. Nao rodei `check tdd-red-evidence` (`workflow.tdd_mode` e false).
- **RED 2 (30c4133):** `fundacao.test.ts` (`escopoExiste` e `inoperante` com `funis`), mais `automacoes.test.ts` 29b e `seed-ia.test.ts` passando os Funis do seed como lista. Falhou em `inoperante` ("escopo eliminado" onde esperava `undefined`/"escopo arquivado") e em `escopoExiste(.., [])`.
- **GREEN:** 6e74c41 (catalogo + derive-ia), 06ac8d0 (editor + leitura da api + esquema).
- **REFACTOR:** nenhum.

## Task Commits

1. Task 1 (tracer) RED: 3775404 — Task 2 RED: 30c4133
2. Task 2 GREEN: 6e74c41 `feat(15-39): escopoExiste e inoperante leem os Funis por argumento`
3. Task 1 GREEN: 06ac8d0 `feat(15-39): criarAutomacao confere o escopo Funil em plataforma.funis`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Testes do seed passam os Funis como lista**
- **Found during:** Task 1 GREEN (mudar `escopoExiste` quebrou `29b` em `automacoes.test.ts` e `seed-ia.test.ts`: `aut_sdr_enriquecimento` virava "escopo eliminado")
- **Fix:** helper `funisDoSeed(state)` nos dois testes (nao listado em `files_modified`: `seed-ia.test.ts`), commitado como RED 2.
- **Commit:** 30c4133

**2. [Ordem de commits] A GREEN da Task 2 (derive-ia) antecede a da Task 1**
- `inoperante` chama `escopoExiste`; mudar o catalogo sem `derive-ia` deixaria o dominio vermelho no commit. Por isso o RED 2 foi commitado antes dos GREEN e a GREEN do catalogo + `derive-ia` (6e74c41) antes da do editor + api (06ac8d0).

### Decisoes que mudam comportamento visivel (registradas em WINDOWS.md, linha 16, aberta)

- Ate o 15-21 passar os Funis de `useFunis`, a tela da IA (`editor-de-automacao.tsx`, `secoes-catalogo.tsx`) mostra Automacao de escopo Funil como "escopo eliminado (Funil)" e a aplicacao otimista de criar Automacao com escopo Funil recusa localmente; o servidor confere certo (previsto na truth do plano; nada e publicado antes do corte, D-15-03).
- Funil na lixeira em `inoperante` passa de "escopo na lixeira (Funil)" para "escopo eliminado (Funil)" (consequencia de `escopoExiste` recusar Funil na lixeira, como o plano manda).

**Total deviations:** 1 auto-fixed (Rule 3), 1 reordenacao de commits, 2 comportamentos registrados. **Impact:** nenhum no contrato; o que muda de tela some no 15-21.

## Verification

- `operacoes-ia.test.ts` + `ia-automacoes-editor.test.ts` em Docker novo (`crm-n1-pg-1539`, porta 55739, migracoes 001-012): 2 arquivos, 25 testes, 0 skipped.
- `packages/dominio`: suite inteira 124 arquivos / 2372 testes; `automacoes.test.ts` + `fundacao.test.ts`: 32 testes.
- `apps/api` `src/rotas/operacoes-ia.test.ts` + `src/rotas/esquemas`: 27 arquivos / 120 testes. `apps/web` `sem-crm-antigo.test.ts`: 2 testes.
- `tsc --noEmit` em dominio, api e web: 0 erros.
- Criterios: `grep -c criarAutomacao apps/api/src/rotas/gesto-no-crm/ia.ts` = 2 (>= 1); `grep -c "state.funnels"` em `automacoes-catalogo.ts` e `derive-ia.ts` = 0.
- Contêiner `crm-n1-pg-1539` parado no fim.

## Known Stubs

None.

## Threat Flags

None. Os dois riscos do plano estao mitigados e testados: T-15-92 (funis forjado, repetido) e T-15-93 (Funil de outro Espaco recusado).

## Self-Check: PASSED

- Commits 3775404, 30c4133, 6e74c41, 06ac8d0 presentes no branch.
- Arquivos modificados existem; testes acima verdes.
