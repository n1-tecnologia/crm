---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 16
subsystem: api
tags: [zod, fastify, validation, cr-02, wr-11, gap-closure]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-12)
    provides: "esquemas/fragmentos.ts (Igual<A,B>/Confere<T>, EsquemasCompletos) + molde tarefas.ts/automacoes.ts/financeiro.ts"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-13)
    provides: "esquemas/negocios.ts + esquemas/conversas.ts + esquemas/contatos.ts (40 schemas)"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-14)
    provides: "esquemas/ia.ts + pastas-de-chat.ts + construtor-de-agentes.ts + configuracao.ts + colaboracao.ts (36 schemas)"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-15)
    provides: "esquemas/planejamento.ts + escala.ts + membros.ts + estrutura.ts (33 schemas)"
provides:
  - "ESQUEMAS = composição dos 15 módulos satisfies EsquemasCompletos — as 132 operações de OPERACOES têm schema próprio; portão de completude em compilação"
  - "esquemaDeArgumentos(nome) sem fallback: sempre ESQUEMAS[nome]"
  - "operacoes.ts sem o mapeamento TypeError→400 (WR-11 resolvido por remoção)"
  - "CR-02 (gap 2 de 01-VERIFICATION.md) fechado por inteiro"
affects: [rotas-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composição final por spread de 15 objetos disjuntos sob satisfies EsquemasCompletos (tipo sem `?`) — faltar uma chave de OPERACOES não compila, apontando o nome; TypeScript resolve a união de keyof sem necessidade de cast na composição em si, só na função de leitura genérica (esquemaDeArgumentos)"
    - "Remoção de um mapeamento de erro em vez de estreitá-lo, quando a pré-condição que o justificava (cobertura parcial) deixa de existir — WR-11: '404 to sem schema' viraria bug escondido atrás de 400 se qualquer TypeError dentro de operacao(...) continuasse mapeado"

key-files:
  created: []
  modified:
    - apps/api/src/rotas/esquemas-de-argumentos.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts
    - apps/api/src/rotas/esquemas/escala.test.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/api/src/rotas/esquemas/CONTEXT.md

key-decisions:
  - "PERS-04 marcado como requisito concluído nesta rodada (era [x] desde o Plan 01-04/01-11 com a ressalva de 01-VERIFICATION.md; a ressalva se dissolve com CR-02 fechado por inteiro) — instrução explícita do orquestrador para este plano de fechamento"
  - "Comentários pré-existentes em esquemas/escala.test.ts (Plan 01-15) que citavam literalmente 'ARGUMENTOS_GENERICOS' foram reapontados para 'o antigo fallback estrutural' — arquivo fora de files_modified do plano, mas a acceptance criteria de Task 1 exige grep -rc ARGUMENTOS_GENERICOS em apps/api/src vazio; mudança só de texto de comentário, sem tocar asserções nem comportamento"

patterns-established: []

requirements-completed: [PERS-04]

# Metrics
duration: 40min
completed: 2026-09-17
---

# Phase 01 Plan 16: composição final ESQUEMAS satisfies EsquemasCompletos + rota sem TypeError→400 (CR-02 fechado) Summary

**`ESQUEMAS` passa a ser a composição sob spread dos 15 arquivos de `esquemas/` (`satisfies EsquemasCompletos` — portão de completude, uma operação de `OPERACOES` sem schema é erro de compilação), `ARGUMENTOS_GENERICOS`/fallback estrutural removidos, e o mapeamento `TypeError → 400` sai por inteiro da rota (WR-11): as 132 operações alcançáveis por `POST /operacoes/:nome` têm schema próprio, validado antes de `executar()`, e um `TypeError` remanescente dentro de uma operação é 500 com log `error` — bug, não entrada. `createGoal` e `saveView`, as duas formas que o verificador reproduziu contra o fallback antigo, provadas 400 por HTTP com nada persistido.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-17T13:30Z (aprox.)
- **Completed:** 2026-09-17T14:10Z (aprox.)
- **Tasks:** 2/2
- **Files modified:** 7 (5 do escopo do plano + 1 fora do escopo, reapontado por acceptance criteria, + o próprio SUMMARY)

## Accomplishments

- `esquemas-de-argumentos.ts`: `ESQUEMAS` agora é `{ ...TAREFAS, ...AUTOMACOES, ...FINANCEIRO, ...NEGOCIOS, ...CONVERSAS, ...CONTATOS, ...IA, ...PASTAS_DE_CHAT, ...CONSTRUTOR_DE_AGENTES, ...CONFIGURACAO, ...COLABORACAO, ...PLANEJAMENTO, ...ESCALA, ...MEMBROS, ...ESTRUTURA } satisfies EsquemasCompletos`. Prova negativa executada e desfeita: retirar `...ESTRUTURA` do spread quebra `npm run typecheck -w @n1/api` citando `createSpace`/`createFolder`/`createList` como propriedades ausentes de `EsquemasCompletos`. `PROFUNDIDADE_MAXIMA`, `valorJson` e `ARGUMENTOS_GENERICOS` removidos; `esquemaDeArgumentos(nome)` devolve `(ESQUEMAS as Record<NomeDeOperacao, z.ZodType<unknown[]>>)[nome]` — nunca fallback. Comentário de topo reescrito: cobertura total das 132, `inviteMember` em `esquemas/membros.ts` com duas barreiras (T-1-08), assimetria de IN-10 e a rede contra ela (`Igual<>` + caso "(b)" por módulo), citação de CR-02 e das cinco rodadas do fechamento.
- `esquemas-de-argumentos.test.ts`: (h) reapontado para provar identidade sem fallback — `esquemaDeArgumentos(nome) === ESQUEMAS[nome]` para as 132 chaves de `OPERACOES`; (i) simplificado para `createChatFolder`/`updateTask` batendo com `ESQUEMAS[...]` (sem mais `ARGUMENTOS_GENERICOS` para comparar); (j) reapontado — `Object.keys(ESQUEMAS).sort() === Object.keys(OPERACOES).sort()`, 132 chaves, todas nomes de operação válidos; (k) novo prova a forma de `createGoal` (`kind: 42`, `anchor.lixo`) que o verificador reproduziu caindo pela composição inteira. (a)–(g) byte-idênticos.
- `operacoes.ts`: o `try/catch` interno do callback de `executar()` que mapeava `TypeError → 400` foi removido por inteiro — `REGISTRO[nome]!(state, request.membro.id, ...args)` chamado direto, com um comentário de uma frase citando WR-11. `ErroDeEntrada` agora tem uma única origem: o schema de `SERVICOS.inviteMember`. Comentários de `REGISTRO`, `ErroDeEntrada`, `mensagemDeEntradaInvalida` e do docblock de topo atualizados para refletir cobertura total e a distinção 400 (entrada) vs. 500 (bug). `try/catch` do reviver (WR-10, Plan 01-12) e `SERVICOS.inviteMember`/`ENTRADA_INVITE_MEMBER.strip()` (T-1-08) preservados sem alteração de comportamento.
- `operacoes.test.ts`: (q) reapontado — título e mensagem agora `'Entrada inválida para "createChatFolder" em 0.name.'` (cai pelo schema `{ name: z.string() }.strict()` de `esquemas/pastas-de-chat.ts`, ANTES de `executar()`, não mais por `TypeError` mapeado dentro dela); a asserção "nada persistido" (`state.chatFolders.length` antes/depois) preservada. (t) novo, sem banco: `createGoal` com `kind: 42` + `anchor.lixo` → 400 antes de `executar()`. (u) novo, com banco: mesma forma → 400, `state.goals.length` inalterado. (v) novo, com banco: `saveView` com `filters: { qualquer: { coisa: true } }` → 400 com `em 0.filters`, `state.views.length` inalterado; a mesma chamada com `filters: {}` → 200 (caminho feliz, prova que o schema deixa a forma real passar). Cabeçalho do arquivo atualizado.
- `apps/api/src/rotas/CONTEXT.md`: entrada de `esquemas-de-argumentos.ts` reescrita (compõe `esquemas/` sob `satisfies EsquemasCompletos`) e nova entrada apontando para `esquemas/CONTEXT.md`.
- `apps/api/src/rotas/esquemas/CONTEXT.md`: os 15 arquivos listados como presentes (nenhum "a chegar"); regra 7 acrescentada (`esquemas-de-argumentos.ts` compõe os 15 sob `satisfies EsquemasCompletos`, um módulo novo sem arquivo correspondente não compila).
- `npm run check` verde nos três workspaces: dominio 253, web 53, api 163 (159 base + 1 caso (k) + 3 casos (t)/(u)/(v)). `git diff --quiet` confirma `apps/api/src/app.ts`, `packages/dominio`, `apps/web`, `package.json` e `package-lock.json` sem diff. Os três arquivos de teste originais do domínio byte-idênticos a `d713253`.

## Task Commits

Each task was committed atomically:

1. **Task 1: `ESQUEMAS` = composição dos 15 módulos `satisfies EsquemasCompletos`; fallback removido; (h)/(i)/(j) reapontados** - `76fc03b` (feat)
2. **Task 2: rota sem `TypeError → 400` (WR-11 por remoção); (q) reapontado; (t)/(u)/(v) provam `createGoal`/`saveView` por HTTP; `CONTEXT.md`s** - `497b053` (refactor)

**Plan metadata:** commit pendente (este SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

- `apps/api/src/rotas/esquemas-de-argumentos.ts` - composição dos 15 módulos `satisfies EsquemasCompletos`; `ARGUMENTOS_GENERICOS`/`valorJson`/`PROFUNDIDADE_MAXIMA` removidos
- `apps/api/src/rotas/esquemas-de-argumentos.test.ts` - (h)/(i)/(j) reapontados; (k) novo; (a)–(g) inalterados
- `apps/api/src/rotas/esquemas/escala.test.ts` - dois comentários reapontados (não citam mais `ARGUMENTOS_GENERICOS`), sem mudança de asserção
- `apps/api/src/rotas/operacoes.ts` - `try/catch` de `TypeError` removido do callback de `executar()`; comentários atualizados (WR-11)
- `apps/api/src/rotas/operacoes.test.ts` - (q) reapontado; (t)/(u)/(v) novos
- `apps/api/src/rotas/CONTEXT.md` - entrada de `esquemas-de-argumentos.ts` reescrita + entrada de `esquemas/`
- `apps/api/src/rotas/esquemas/CONTEXT.md` - 15 arquivos presentes; regra 7

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/acceptance criteria] Comentários em `esquemas/escala.test.ts` citavam literalmente `ARGUMENTOS_GENERICOS`, símbolo removido nesta rodada**
- **Found during:** Task 1, ao rodar `grep -rc "ARGUMENTOS_GENERICOS" apps/api/src | grep -v ":0"` (acceptance criteria explícita do plano: "vazio — nenhum arquivo do `apps/api` cita o símbolo")
- **Issue:** `esquemas/escala.test.ts` (escrito no Plan 01-15, fora do `files_modified` deste plano) tinha dois comentários de prosa citando `ARGUMENTOS_GENERICOS` como referência histórica ao fallback que este plano remove
- **Fix:** Reapontados para "o antigo fallback estrutural (01-VERIFICATION.md, removido no Plan 01-16)" — só texto de comentário, nenhuma asserção ou linha de código de teste tocada
- **Files modified:** `apps/api/src/rotas/esquemas/escala.test.ts`
- **Commit:** `76fc03b`

Nenhum outro desvio — o restante do plano foi executado como escrito.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma dependência nova (`package.json`/`package-lock.json` sem diff, confirmado).

## Next Phase Readiness

- CR-02 (gap 2 de `01-VERIFICATION.md`) fechado por inteiro: `missing[0]` (composição + completude, `ESQUEMAS ≡ OPERACOES`), `missing[1]` (`createGoal`/`saveView` 400 por HTTP, nada persistido), `missing[2]`/`missing[3]` (WR-10, já fechado no Plan 01-12, reconfirmado verde) — todos os quatro itens do gap re-verificados nesta rodada.
- WR-10 e WR-11 resolvidos; `inviteMember` com duas barreiras independentes (T-1-08) preservadas.
- Critério 2 do ROADMAP sem ressalva: toda operação dos 16 módulos chega por `POST /operacoes/:nome`, roda na Unidade de Trabalho, com a forma dos 132 argumentos validada antes de `executar()` — forma errada é 400, aninhamento hostil é 400 (WR-10), nunca 500 por entrada, nunca `jsonb` malformado.
- Regra de camada preservada em toda a rodada (Plans 01-12..01-16): `packages/dominio`, `apps/web` e `apps/api/src/app.ts` sem diff.
- PERS-04 marcado como requisito concluído (ver `requirements-completed` no frontmatter) — a ressalva de `01-VERIFICATION.md` se dissolve.
- Fase 1: 16/16 planos GSD executados. Pronta para nova rodada de `/gsd-verify-phase 1`.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-17*

## Self-Check: PASSED

Todos os 6 arquivos de `files_modified` (mais o `esquemas/escala.test.ts` do desvio documentado) e este SUMMARY existem em disco; os dois hashes de commit (`76fc03b`, `497b053`) existem em `git log`.
