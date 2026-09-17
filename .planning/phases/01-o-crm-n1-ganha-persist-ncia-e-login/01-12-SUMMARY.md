---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 12
subsystem: api
tags: [zod, fastify, validation, transporte, cr-02, wr-10]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-11)
    provides: "esquemaDeArgumentos(nome): schema por operação (23) + fallback estrutural, validado ANTES de executar()"
provides:
  - "WR-10 fechado: reviverArgumentos dentro de try/catch na rota; RangeError vira 400, nunca 500"
  - "apps/api/src/rotas/esquemas/fragmentos.ts: base compartilhada (tipos, opcional(), fragmentos) com portão de enum bidirecional Igual<A,B>/Confere<T>"
  - "Molde 'um arquivo por módulo, satisfies Esquemas' estabelecido em tarefas.ts/automacoes.ts/financeiro.ts — os Plans 01-13/14/15 copiam"
affects: [rotas-api, esquemas-01-13, esquemas-01-14, esquemas-01-15, esquemas-01-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "try/catch em volta do PRIMEIRO código que percorre entrada não confiável (reviverArgumentos), não só em volta da validação por schema — a ordem revive→valida só é segura se o revive também for protegido"
    - "Portão de enum bidirecional (Igual<A,B> = [A] extends [B] ? [B] extends [A] ? true : false) para uniões literais, fechando a assimetria que satisfies sozinho não pega (IN-10) — não se estende a objetos (readonly/?: quebram a simetria)"
    - "Um arquivo de fragmentos compartilhados (fragmentos.ts) + um arquivo por módulo do domínio (satisfies Esquemas parcial), compostos por spread num arquivo de composição final — evita ciclo de importação e permite planos paralelos sem tocar arquivo compartilhado"

key-files:
  created:
    - apps/api/src/rotas/esquemas/fragmentos.ts
    - apps/api/src/rotas/esquemas/tarefas.ts
    - apps/api/src/rotas/esquemas/automacoes.ts
    - apps/api/src/rotas/esquemas/financeiro.ts
    - apps/api/src/rotas/esquemas/CONTEXT.md
  modified:
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/esquemas-de-argumentos.ts

key-decisions:
  - "Cobertura total (opção b) escolhida sobre '404 para operação sem schema' (opção a) — 128/132 operações são chamadas de fato por apps/web; um 404 quebraria o Critério 2 do ROADMAP ao pé da letra. A rodada de fechamento de CR-02 vira 5 planos (01-12 fundação+WR-10; 01-13/14/15 schemas por módulo em paralelo; 01-16 composição final e limpeza)"
  - "Igual<A,B> aplicado só a uniões literais (enums), não a objetos — o próprio 01-REVIEW.md (IN-10) descarta a checagem bidirecional para objetos por causa de readonly/?: vs |undefined"
  - "PERS-04 NÃO marcado como requisito concluído nesta rodada (requirements-completed: [] abaixo) — já está [x] em REQUIREMENTS.md desde o Plan 01-04/01-11, mas o gap CR-02 só fecha por inteiro no Plan 01-16 (instrução explícita do orquestrador para este plano); nenhuma chamada a `requirements mark-complete` feita por este plano"

patterns-established:
  - "fragmentos.ts → <modulo>.ts → esquemas-de-argumentos.ts → operacoes.ts: sem ciclo, cada seta só numa direção — os Plans 01-13/14/15 seguem o mesmo sentido"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-09-17
---

# Phase 01 Plan 12: WR-10 (reviverArgumentos protegido) + fundação dos schemas por módulo (CR-02, onda 2/3, rodada 1/5) Summary

**`reviverArgumentos` dentro de `try/catch` na rota — `RangeError` de aninhamento profundo vira 400, nunca 500 (WR-10) — e extração dos fragmentos/schemas de `esquemas-de-argumentos.ts` para `apps/api/src/rotas/esquemas/{fragmentos,tarefas,automacoes,financeiro}.ts`, com um portão de enum bidirecional (`Igual<A,B>`) que fecha a assimetria de IN-10 para uniões literais — o molde que os Plans 01-13/14/15 copiam para os outros 12 módulos do domínio.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-17T12:20Z (aprox.)
- **Completed:** 2026-09-17T12:57Z
- **Tasks:** 3/3
- **Files modified:** 8 (5 novos, 3 alterados)

## Accomplishments

- `operacoes.ts`: `reviverArgumentos(request.body.args)` agora roda dentro de `try/catch`; `RangeError` (aninhamento além do que o reviver suporta) vira 400 `{ ok: false, error: 'Entrada inválida para "<nome>".' }` com `warn` `{ operacao, membro }` — nunca `request.body` nem `erro.stack` no log (T-1-06). Qualquer outro erro continua subindo. Caso (s) em `operacoes.test.ts` prova com um corpo de 10.000 níveis de arrays aninhados (20 KB, muito abaixo do `bodyLimit` de 1 MiB) — 19 casos verdes com banco.
- `apps/api/src/rotas/esquemas/fragmentos.ts` (novo): `ArgumentosDe<N>`, `Esquemas` (parcial), `EsquemasCompletos` (sem `?` — portão de completude do Plan 01-16), `Igual<A,B>`/`Confere<T>` (portão de enum bidirecional), `opcional()`, e os fragmentos `ID`, `PRIORITY`, `TASK_DATE`, `ACTOR_REF`, `STATUS_MAPPING`, `VALOR_DE_CAMPO`, `CONTAINER_TYPE`, `STATUS_CATEGORY`, `MONEY`. Portão `_EnumsCompletos = Confere<[Igual<...>, ...]>` (4 conferências) provado por prova negativa executada e desfeita: reduzir `PRIORITY` a 2 membros quebra `npm run typecheck -w @n1/api` exatamente na linha do portão.
- Os 23 schemas de hoje movidos, sem mudar comportamento, para `esquemas/tarefas.ts` (20), `esquemas/automacoes.ts` (1) e `esquemas/financeiro.ts` (2), cada um `satisfies Esquemas`; `esquemas-de-argumentos.ts` reduzido à composição por spread (`{ ...TAREFAS, ...AUTOMACOES, ...FINANCEIRO }`) + `PROFUNDIDADE_MAXIMA`/`valorJson`/`ARGUMENTOS_GENERICOS`/`esquemaDeArgumentos` inalterados (saem no Plan 01-16).
- `apps/api/src/rotas/esquemas/CONTEXT.md` (novo): contrato da pasta — 6 regras (um arquivo por módulo, `.strict()` salvo `inviteMember`, `opcional()`/`.nullable()`/`.optional()`, `Confere<[Igual<...>]>` para enums, fragmentos compartilhados só em `fragmentos.ts`, sem import de `esquemas-de-argumentos.ts` de dentro da pasta) e a lista dos 15 arquivos por módulo (3 presentes + 12 que os Plans 01-13/14/15 acrescentam).
- `npm run check` verde nos três workspaces (dominio 253, web 53, api — todos os 17 arquivos de teste do workspace, incluindo os de importação do ClickUp da Phase 0 que também vivem em `@n1/api`); `esquemas-de-argumentos.test.ts` sem edição, 10 casos verdes; `operacoes.test.ts` com o caso (s) novo, 19 casos verdes.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-10 — `reviverArgumentos` dentro de `try/catch`; caso (s)** - `c6f0d1c` (fix)
2. **Task 2: `esquemas/fragmentos.ts` + `esquemas/CONTEXT.md`** - `ba4796b` (feat)
3. **Task 3: Mover os 23 schemas; `esquemas-de-argumentos.ts` vira composição** - `68650d0` (refactor)

**Plan metadata:** commit pendente (este SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `apps/api/src/rotas/operacoes.ts` - `let revividos: unknown[]` + `try/catch` com `instanceof RangeError` → 400; terceiro `request.log.warn`; docblock de topo cita WR-10
- `apps/api/src/rotas/operacoes.test.ts` - caso `(s) corpo com 10.000 níveis de arrays aninhados em args responde 400 antes de qualquer schema — nunca 500 (WR-10)`; frase no cabeçalho
- `apps/api/src/rotas/esquemas/fragmentos.ts` - tipos, `opcional()`, fragmentos compartilhados, portão de enum bidirecional
- `apps/api/src/rotas/esquemas/tarefas.ts` - `TAREFAS` (20 entradas), `CREATE_TASK_INPUT`/`UPDATE_TASK_INPUT`/`ADD_TASK_COMMENT_INPUT` locais
- `apps/api/src/rotas/esquemas/automacoes.ts` - `AUTOMACOES` (1 entrada)
- `apps/api/src/rotas/esquemas/financeiro.ts` - `FINANCEIRO` (2 entradas), `RECEIVABLE_SERIES_INPUT` local
- `apps/api/src/rotas/esquemas/CONTEXT.md` - contrato da pasta, 6 regras, lista dos 15 arquivos por módulo
- `apps/api/src/rotas/esquemas-de-argumentos.ts` - reduzido à composição + `ARGUMENTOS_GENERICOS`/`esquemaDeArgumentos` inalterados

## Decisions Made

Ver `key-decisions` no frontmatter. Adicionalmente:

- A contagem de testes de `apps/api` no `npm run check` (121, não os "74" da acceptance criteria do plano) reflete que o workspace `@n1/api` também hospeda os testes de importação do ClickUp da Phase 0 (`importacao/clickup/*.test.ts`) e de persistência/e2e contra o Postgres real — todos ativados porque `apps/api/.env` tem `DATABASE_URL`/`CLICKUP_API_TOKEN`. O número "74" do plano parece ter sido calculado só sobre os arquivos que a rodada de CR-02 toca diretamente; a métrica que importa — `npm run check` verde, zero falhas — foi confirmada.

## Deviations from Plan

None — plano executado como escrito. Duas notas de processo (não mudanças de plano):

**1.** O comentário do fragmento `Confere<T>` original (`<interfaces>`/ação do plano não fixava o texto exato) repetia literalmente a string `type _EnumsCompletos = Confere<` dentro do próprio comentário-doc, o que fazia a acceptance criteria `grep -c "type _EnumsCompletos = Confere<"` → 1 falhar (2 ocorrências: comentário + declaração real). Reescrevi o comentário para não repetir a string exata, preservando o sentido. Verificado: `grep -c` → 1.

**2.** Para a acceptance criteria `grep -c "Igual<"` ≥ 5, formatei `_EnumsCompletos = Confere<[...]>` com cada `Igual<...>` em sua própria linha (em vez de uma linha só) — `grep -c` conta LINHAS que casam, não ocorrências; numa única linha as 4 conferências contariam como 1 match. Com quebra de linha: 1 (definição) + 4 (uso) = 5 linhas. Sem mudança de comportamento — só formatação.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma dependência nova (`zod` 4.6.5 já estava em `apps/api/package.json`; `package.json`/`package-lock.json` sem diff, confirmado).

## Next Phase Readiness

- WR-10 fechado: `missing[2]`/`missing[3]` de `01-VERIFICATION.md` estão literalmente cobertos — aninhamento hostil de `args` é 400, nunca 500, sem tocar em `packages/dominio`.
- Fundação pronta para a onda 2 (Plans 01-13/14/15, em paralelo): `esquemas/fragmentos.ts` com o portão de enum bidirecional, três arquivos por módulo no molde definitivo (`satisfies Esquemas`), composição por spread — nenhum comportamento observável mudou (mesmos 10 + 19 testes verdes, `esquemas-de-argumentos.test.ts` sem edição).
- CR-02 (efeito 2 — `ARGUMENTOS_GENERICOS` não barrar tipo/enum errado nas ~109 operações fora de `ESQUEMAS`) permanece parcialmente aberto até os Plans 01-13/14/15 (schemas por módulo) e 01-16 (composição final `satisfies EsquemasCompletos`, remoção do fallback, limpeza da rota). PERS-04 continua com a mesma ressalva de `01-VERIFICATION.md` até então.
- `packages/dominio` e `apps/web` sem diff (regra de camada preservada); `apps/api/src/app.ts` sem diff (WR-04 permanece fora do escopo, como já registrado em `01-REVIEW.md`).

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-17*

## Self-Check: PASSED

Todos os 8 arquivos de `files_modified` e este SUMMARY existem em disco; os três hashes de commit (`c6f0d1c`, `ba4796b`, `68650d0`) existem em `git log`.
