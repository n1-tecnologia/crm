---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 03
subsystem: database
tags: [domain, dispatch-registry, diff, id-sequence, dataState, zod-free]

# Dependency graph
requires: []
provides:
  - "OPERACOES — allowlist literal de 132 operações alcançáveis por HTTP (packages/dominio/src/operations/registro.ts)"
  - "ehNomeDeOperacao(nome) — checagem de nome com Object.hasOwn, fecha __proto__/constructor (T-1-04)"
  - "gravarChamadas / instrumentar — gravador de chamadas que permite ao run() do apps/web descobrir nome+args de um closure sem mudar assinatura"
  - "serializarArgumentos / reviverArgumentos — marcador { $tipo: \"Date\", iso } para Date sobreviver a JSON"
  - "syncIdSequence(state) — sincroniza o contador de nextId com o maior id já presente no estado, recursivo"
  - "aplicarDiferenca(state, ordens, diferenca) + Diferenca/Ordens/DIFERENCA_VAZIA — aplica o diff do servidor no DataState do cliente respeitando ordem fracionária"
affects: [01-04, 01-05, 01-07, 01-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registro explícito como allowlist (mesma disciplina de colecoes.ts): satisfies Record<...> barra assinatura errada em tempo de compilação sem alargar o tipo de cada função"
    - "Gravador de módulo (let gravador: T[] | null) com try/finally para restaurar estado anterior — mesma natureza de resetIdSequence, sem I/O"
    - "Shadowing de export *: uma declaração local (export const x = instrumentar(\"x\")) sombreia a reexportação crua do módulo de origem sem erro de duplicidade"

key-files:
  created:
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/registro.test.ts
    - packages/dominio/src/operations/id-sequence.test.ts
    - packages/dominio/src/diferenca.ts
    - packages/dominio/src/diferenca.test.ts
  modified:
    - packages/dominio/src/operations/index.ts
    - packages/dominio/src/operations/activity.ts
    - packages/dominio/src/index.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "OPERACOES tem 132 entradas (dentro da faixa 125–140 esperada pelo plano): contagem exata confirmada por script e pelo teste (b) de registro.test.ts, que verifica que operations/index.ts instrumenta TODAS as chaves sem exceção"
  - "receiveMessage (conversations.ts) ficou FORA do registro: o segundo parâmetro é channelId, não actingMemberId — é uma operação disparada pelo canal (mensagem recebida de um Contato), não um caso de uso de Membro; não estava na lista explícita do plano mas segue a regra de inclusão à risca"
  - "Em aplicarDiferenca, um vizinho de ordem desconhecida nunca interrompe a busca de posição — só um vizinho de ordem MAIOR e conhecida interrompe; isso garante que um registro sem ordem (não deveria acontecer) não seja 'furado' por uma inserção nova"

requirements-completed: [PERS-04, PERS-05]

# Metrics
duration: 35min
completed: 2026-09-16
---

# Phase 1 Plan 03: Registro de operações, gravador de chamadas e sincronização de estado no domínio Summary

**Allowlist explícita `OPERACOES` (132 operações) com gravador de chamadas por closure, mais `syncIdSequence` e `aplicarDiferenca` — as três peças puras que a rota HTTP (Plan 01-04) e o `store.ts` (Plan 01-07) vão compor sem inventar nada por conta própria.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-16T13:55:00Z (aprox.)
- **Completed:** 2026-09-16T14:13:00Z
- **Tasks:** 2/2
- **Files modified:** 9 (5 criados, 4 modificados)

## Accomplishments

- `OPERACOES` fecha a porta a resolução dinâmica por string: `POST /operacoes/:nome` (Plan 01-04) só pode despachar uma das 132 funções literalmente mapeadas, checadas por `Object.hasOwn` — `__proto__`/`constructor` nunca passam (T-1-04).
- `gravarChamadas`/`instrumentar` resolvem a Open Question #2 do RESEARCH.md: `run()` do `apps/web` continua chamando `operacao(data, memberId, ...args)` nos ~140 pontos de chamada existentes, e ainda assim o Plan 01-07 vai saber QUAL operação e QUAIS argumentos mandar ao servidor, sem tocar em nenhum componente.
- `syncIdSequence` elimina a colisão de ids entre processos: depois de sincronizado, o mesmo `DataState` produz o mesmo próximo id em dois processos independentes — o que faz o `result.value.id` que a tela do web calcula localmente (D-05, híbrido) coincidir com o que o `apps/api` vai gravar.
- `aplicarDiferenca` é o espelho, do lado do cliente, do diff que `gravar()` já calcula no servidor (D-03): aplica gravados/removidos em lugar no `DataState`, respeitando a posição fracionária, e ignora coleção desconhecida sem lançar.
- Os 214 testes de domínio pré-existentes continuam passando sem alteração; 18 testes novos (7 + 4 + 7) somam 232.

## Task Commits

Each task was committed atomically:

1. **Task 1: Registro explícito `OPERACOES`, gravador de chamadas e exportações instrumentadas** - `60d2678` (feat)
2. **Task 2: `syncIdSequence(state)` e `aplicarDiferenca(state, ordens, diferenca)`** - `04d9732` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `packages/dominio/src/operations/registro.ts` - `OPERACOES` (132 entradas, agrupadas por módulo de origem), `ehNomeDeOperacao`, `gravarChamadas`, `instrumentar`, `serializarArgumentos`/`reviverArgumentos`
- `packages/dominio/src/operations/registro.test.ts` - 7 casos: forma de cada entrada, index.ts instrumenta tudo, helpers fora do registro, gravador simples/aninhado, round-trip de `Date`
- `packages/dominio/src/operations/index.ts` - reescrito: mantém todos os `export *`, acrescenta reexportação de `registro.ts` e uma `export const <nome> = instrumentar("<nome>")` por operação (sombreando o `export *` do módulo de origem)
- `packages/dominio/src/operations/activity.ts` - acrescenta `syncIdSequence(state)`, percurso recursivo do `DataState`
- `packages/dominio/src/operations/id-sequence.test.ts` - 4 casos: sem colisão, determinismo entre seeds, id inédito depois de uma operação, estado mínimo sem lançar
- `packages/dominio/src/diferenca.ts` - `RegistroGravado`, `RegistroRemovido`, `Diferenca`, `Ordens`, `DIFERENCA_VAZIA`, `aplicarDiferenca`
- `packages/dominio/src/diferenca.test.ts` - 7 casos: upsert em lugar, `unshift` por ordem negativa, inserção no meio, remoção, singular, coleção desconhecida, diff vazio
- `packages/dominio/src/index.ts` - `export * from "./diferenca"`
- `packages/dominio/CONTEXT.md` - subcaminhos `@n1/dominio/operations/registro` e `@n1/dominio/diferenca` documentados na tabela; nota sobre `operations/index.ts` instrumentado

## Decisions Made

- Contagem final de `OPERACOES`: **132** operações (dentro da faixa 125–140 do plano). Verificado por `grep -c` e pelo teste que confere que `operations/index.ts` instrumenta cada uma das 132 chaves.
- `receiveMessage` (mensagem recebida de um Contato/canal) ficou de fora do registro — não é um caso de uso de Membro (o segundo parâmetro é `channelId`, não `actingMemberId`), então não bate com a regra de inclusão, mesmo não estando na lista explícita de exclusões do plano.
- Comentário de `operations/index.ts` reescrito para não conter literalmente a substring `instrumentar("` fora do código real — evita um falso positivo no `grep -c` do critério de aceitação (o comentário original citava a sintaxe entre crases e coincidia com o padrão).

## Deviations from Plan

None - plan executed exactly as written. A única decisão de julgamento (inclusão/exclusão de `receiveMessage`) segue estritamente a regra de inclusão descrita no plano (dois primeiros parâmetros `state, actingMemberId`), não é uma mudança de escopo.

## Issues Encountered

- `tsc` acusou `Cannot find name 'instrumentar'` em `operations/index.ts`: um `export { instrumentar } from "./registro"` reexporta mas não cria um binding local utilizável no mesmo arquivo. Corrigido com um `import { instrumentar } from "./registro"` explícito antes do uso.
- Um teste de `serializarArgumentos`/`reviverArgumentos` com um array literal de tipos mistos (`[Date, string, {...}]`) foi inferido pelo TypeScript como união, quebrando `.getTime()` em `strict`/`noUncheckedIndexedAccess`. Resolvido tipando a tupla explicitamente e comparando contra variáveis nomeadas em vez de indexar o array original.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-04 (rotas HTTP) pode importar `OPERACOES`/`ehNomeDeOperacao` de `@n1/dominio/operations/registro` como a allowlist de despacho de `POST /operacoes/:nome`, sem reimplementar validação de nome.
- Plan 01-04 também pode chamar `syncIdSequence(state)` logo após `hidratar()` e antes de rodar a operação na Unidade de Trabalho, fechando o risco de colisão de ids entre processos.
- Plan 01-07 (`store.ts`) tem `gravarChamadas`/`instrumentar` para descobrir nome+args de qualquer chamada existente, `serializarArgumentos`/`reviverArgumentos` para o `POST` levar `Date` em segurança, e `aplicarDiferenca`/`Ordens` prontos para aplicar a resposta do servidor sem reimplementar merge de diff.
- Nenhum bloqueio conhecido para os planos seguintes desta fase.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 5 created files found on disk; both task commit hashes (`60d2678`, `04d9732`) found in `git log --oneline --all`.
