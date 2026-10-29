---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 02
subsystem: dominio
tags: [est-10, est-11, d-16, rn-esp-09, setContainerBlock, bloqueio, quem-pode, privacidade-b38a]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-20: blocks só em Space e Folder; 10-01: setContainerDefaultViews e a cadeia de registro como molde"
provides:
  - "setContainerBlock(space|folder): bloqueia e libera um aspecto, com a regra RN-ESP-09"
  - "definesAspect, sobrescritasAbaixo (com memberId opcional), bloqueioAcima (L5), origemDoAspecto, contagemAcumulada e NOME_DO_ASPECTO em derive.ts"
  - "blockedAbove monta a frase a partir de bloqueioAcima (uma fonte só)"
  - "criarAutomacao recusa em Pasta ou Lista abaixo de bloqueio de Automações"
  - "cadeia de registro fechada: registro, index, esquema ASPECTO_CONFIGURAVEL, Quem pode, contagem 288"
affects: [10-08, 10-10, 10-11, 10-18]

actuals:
  tokens: 8500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Uma leitura derivada serve a recusa da operação e à tela: sobrescritasAbaixo(…, memberId) é a mesma função nos dois lados"
    - "Recusa que nomeia contêineres filtra por memberReachesContainer e conta o resto (B38a)"
    - "Teste de operação de Estrutura parte de um Espaço novo (createSpace) quando o Espaço do seed já tem sobrescritas"

key-files:
  created:
    - packages/dominio/src/operations/bloqueio-de-aspecto.test.ts
  modified:
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/configuration.ts
    - packages/dominio/src/operations/ia/automacoes-editor.ts
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas/fragmentos.ts
    - apps/api/src/rotas/esquemas/configuracao.ts
    - apps/api/src/rotas/esquemas/configuracao.test.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts

key-decisions:
  - "definesAspect de fieldDefinitions só conta Campo de Tarefa (target task) ativo e de taskTypes só Tipo que não é da plataforma: é o que o nó DEFINE, coerente com effectiveContainerConfig."
  - "contagemAcumulada exclui os Tipos da plataforma das duas contas (aqui e herdados) e não conta como herdado o Campo que um nível abaixo deixou de usar (camposHerdadosFora)."
  - "sobrescritasAbaixo ordena por profundidade do caminho (Pastas antes de Listas no mesmo nível); setContainerBlock o chama duas vezes: sem memberId para o total e com o ator para o que pode ser nomeado."
  - "A frase de recusa fixa o texto 'e mais N que você não alcança' (sem a palavra contêiner) quando há nomes; só a contagem usa 'N contêiner(es) que você não alcança define(m)'."

patterns-established:
  - "Aspectos que acumulam (Campos, Tipos, Automações) nunca consultam sobrescritasAbaixo: bloquear vale só para o criado depois"

requirements-completed: [EST-10, EST-11]

coverage:
  - id: D1
    description: "Bloquear o Conjunto de Status num Espaço sem sobrescrita abaixo funciona, grava a Atividade 'Aspecto bloqueado' e a Lista deixa de poder sobrescrever; repetir o estado não grava Atividade; desbloquear grava 'Aspecto desbloqueado'"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/bloqueio-de-aspecto.test.ts#setContainerBlock — Conjunto de Status (EST-10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bloquear aspecto que substitui é recusado enquanto uma Pasta abaixo sobrescreve, e a frase nomeia a Pasta; aspectos que acumulam bloqueiam só o que vem depois"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/bloqueio-de-aspecto.test.ts#recusa bloquear enquanto uma Pasta abaixo sobrescreve; aspectos que acumulam"
        status: pass
    human_judgment: false
  - id: D3
    description: "A recusa e sobrescritasAbaixo não nomeiam contêiner privado que o ator não alcança (B38a, T-10-05)"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/bloqueio-de-aspecto.test.ts#setContainerBlock — privacidade da recusa"
        status: pass
    human_judgment: false
  - id: D4
    description: "criarAutomacao recusa com a frase de blockedAbove em Pasta ou Lista sob bloqueio de Automações e segue permitida no Espaço acima (T-10-06)"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/bloqueio-de-aspecto.test.ts#setContainerBlock — Automações (T-10-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "bloqueioAcima, origemDoAspecto e contagemAcumulada respondem o que as telas 10-08 e 10-11 precisam"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/bloqueio-de-aspecto.test.ts#leituras para a tela (L5, origem, contagem)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cadeia de registro fechada: POST /operacoes/setContainerBlock aceita só Espaço e Pasta, linha em Quem pode, contagem 288"
    requirement: EST-11
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/esquemas/configuracao.test.ts; apps/api/src/rotas/esquemas-de-argumentos.test.ts#(j); packages/dominio/src/quem-pode.test.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-29
status: complete
plan_head_before: ee60228bd13eb3bf12d096575d27ba93d5545f5b
plan_head_after: 10989ad7a251774fe34dd51051c6cae726cd928d
commits: 4
---

# Phase 10 Plan 02: Bloqueio de aspecto Summary

**`setContainerBlock` aplica RN-ESP-09 no domínio (recusa nomeando só quem o ator alcança, acumulativos bloqueiam o futuro), `criarAutomacao` respeita o bloqueio e `sobrescritasAbaixo`, `bloqueioAcima`, `origemDoAspecto` e `contagemAcumulada` ficam prontas para as telas.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-29T08:43:35Z
- **Completed:** 2026-10-29T08:49:09Z
- **Tasks:** 2
- **Files modified:** 11 (1 criado)

## Accomplishments

- `setContainerBlock(space|folder, aspecto, bloqueado)` na ordem de guardas de `setContainerFeature`; Atividade "Aspecto bloqueado"/"Aspecto desbloqueado" com o nome do aspecto em `detail`, só quando o estado muda; desbloquear nunca é recusado a quem administra.
- Para Conjunto de Status, Funcionalidades e Visualizações padrão, bloquear é recusado enquanto um descendente sobrescreve, e a frase nomeia `Pasta X`, `Subpasta Y`, `Lista Z`; Campos, Tipos de Tarefa e Automações não consultam quem está abaixo.
- Pitfall 7 / B38a: a frase só nomeia o que `memberReachesContainer` deixa o ator ver; o resto vira "e mais N que você não alcança", ou só a contagem quando nada é alcançável.
- `derive.ts` ganhou `definesAspect` (predicado único), `sobrescritasAbaixo` (com `memberId` opcional para a tela), `bloqueioAcima` (L5), `origemDoAspecto`, `contagemAcumulada` e `NOME_DO_ASPECTO`; `blockedAbove` passou a montar a frase a partir de `bloqueioAcima` sem mudar o texto.
- `criarAutomacao` chama `blockedAbove(…, "automations")` para escopo Pasta ou Lista (D-16, 2.6.5 item 4).
- Cadeia de registro: `registro.ts`, `index.ts`, `ASPECTO_CONFIGURAVEL` (conferido contra `ConfigurableAspect` por `Igual`), esquema `setContainerBlock` que recusa `list` no transporte, `configuracao.test.ts`, contagem (j) 287 -> 288 e linhas em "Quem pode".

## Task Commits

1. **Task 1 (tracer): bloquear Status no Espaço impede a Lista de sobrescrever** - `d16e7f7` (test, RED: 5 casos falhando) -> `310d9f1` (feat, GREEN)
2. **Task 2: aspectos que acumulam, privacidade, `criarAutomacao` e leituras** - `69aa02c` (test, RED: 6 casos falhando) -> `10989ad` (feat, GREEN)

**Plan metadata:** commit docs(10-02) logo após este arquivo.

RED (semantic assessment): em Task 1 os 5 casos falharam porque `setContainerBlock` não existia; em Task 2 seis casos falharam (`bloqueioAcima`/`origemDoAspecto`/`contagemAcumulada` não eram função, `criarAutomacao` ainda criava sob bloqueio e a frase ainda nomeava a Pasta privada). Plano `type: execute`; o classificador `tdd-red-evidence` não foi exigido.

Tracer gate: modo `end-of-phase`, verify só automatizado, reexecutado verde (domínio e api) antes da Task 2.

## Files Created/Modified

- `packages/dominio/src/derive.ts` - leituras de bloqueio, origem e contagem
- `packages/dominio/src/operations/configuration.ts` - `setContainerBlock`; `blockedAbove` delegando a `bloqueioAcima`
- `packages/dominio/src/operations/ia/automacoes-editor.ts` - recusa em `criarAutomacao`
- `packages/dominio/src/operations/registro.ts`, `index.ts` - registro e instrumentação
- `packages/dominio/CONTEXT.md` - linhas `setContainerBlock` e `criarAutomacao`
- `packages/dominio/src/operations/bloqueio-de-aspecto.test.ts` - 15 testes (EST-10)
- `apps/api/src/rotas/esquemas/fragmentos.ts`, `configuracao.ts` - `ASPECTO_CONFIGURAVEL` e o esquema
- `apps/api/src/rotas/esquemas/configuracao.test.ts`, `apps/api/src/rotas/esquemas-de-argumentos.test.ts` - formas, recusas de transporte, contagem 288

## Decisions Made

Ver `key-decisions` no frontmatter. O texto exato da recusa é discricionário no plano; fixei a forma pedida e a tela 10-11 a mostra literal.

## Deviations from Plan

None - plan executed exactly as written. Um ajuste de teste, não de plano: o `spc_com` do seed já tem seis sobrescritas de Conjunto de Status abaixo (Listas e a Subpasta Ativação), então os casos "Espaço sem sobrescrita" partem de um Espaço novo criado por `createSpace` no `beforeEach`.

## Issues Encountered

None.

## Verification

- `packages/dominio`: `vitest run` completo, 105 arquivos / 2022 testes verdes; `tsc --noEmit` limpo.
- `apps/api`: `DATABASE_URL= vitest run src/rotas/esquemas src/rotas/esquemas-de-argumentos.test.ts`, 26 arquivos / 93 testes verdes; `tsc --noEmit` limpo.
- `apps/web`: `tsc --noEmit` limpo.
- Suíte completa do monorepo e e2e não rodados, conforme orientação do orquestrador. Nenhum dos três workspaces tem script de lint próprio (o `eslint` direto não achou configuração); o lint roda no `npm run check` da raiz, não executado.

## Known Stubs

None.

## Threat Flags

None - T-10-04 (`mayConfigure`, tipo e esquema só `space`/`folder`, teste de recusa), T-10-05 (filtro por `memberReachesContainer`, testes da Pasta privada) e T-10-06 (`blockedAbove` dentro de `criarAutomacao`, teste) mitigados.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-08, 10-10 e 10-11: as telas leem `sobrescritasAbaixo(…, memberId)`, `bloqueioAcima`, `origemDoAspecto` e `contagemAcumulada` e chamam `setContainerBlock`. `definesAspect` também está disponível para `moveContainer` (10-18). Nenhum bloqueio.

## Self-Check: PASSED

- `bloqueio-de-aspecto.test.ts` presente; commits `d16e7f7`, `310d9f1`, `69aa02c` e `10989ad` presentes na branch.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
