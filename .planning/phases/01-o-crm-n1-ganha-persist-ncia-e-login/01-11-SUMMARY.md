---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 11
subsystem: api
tags: [zod, fastify, validation, transporte, cr-02]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-04)
    provides: "POST /operacoes/:nome despachando por OPERACOES sobre a Unidade de Trabalho"
provides:
  - "esquemaDeArgumentos(nome): schema por operação (23) + fallback estrutural para a FORMA dos args, validado ANTES de executar()"
  - "TypeError dentro de operacao(...) mapeado para 400 com rollback, nunca 500"
  - "gap 2 de 01-VERIFICATION.md (CR-02) fechado: título/descrição corrompidos não chegam mais ao jsonb compartilhado"
affects: [rotas-api, financeiro-fase2-adapter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validação de TRANSPORTE (forma dos args) separada de regra de negócio: schema por operação com satisfies contra o tipo inferido da assinatura real do domínio (ArgumentosDe<N>) barra drift em tempo de compilação"
    - "Fallback estrutural conservador (profundidade máxima de contêiner) para operações sem schema próprio, como rede de segurança contra objeto-onde-domínio-espera-escalar"
    - "TypeError dentro do callback de executar() mapeado para o mesmo ErroDeEntrada que os schemas de serviço já usavam — uma única origem de 400 por entrada inválida"

key-files:
  created:
    - apps/api/src/rotas/esquemas-de-argumentos.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts
  modified:
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "inviteMember fica de propósito fora de ESQUEMAS — o estrutural deixa {email, roleId, userId} passar e o .strip() do serviço continua sendo o único ponto que descarta userId (T-1-08, convidar-membro.test.ts (c) preservado)"
  - "RangeError não é mapeado para 400 — só TypeError; z.date() já recusa Invalid Date antes de a operação rodar"
  - "app.ts e SERVICOS.inviteMember não tocados — WR-04 fica fora do escopo deste plano"

patterns-established:
  - "ArgumentosDe<N> + satisfies Esquemas: qualquer schema cuja aridade/tipo não bata com a assinatura real de uma operação do domínio quebra o build (TS2322), não só o teste"

requirements-completed: [PERS-04]

# Metrics
duration: 25min
completed: 2026-09-16
---

# Phase 01 Plan 11: Validação de argumentos em POST /operacoes/:nome (CR-02) Summary

**Schema por operação (23, tuplas espelhando a assinatura TypeScript real via `satisfies`) + fallback estrutural de profundidade 6 validam a FORMA dos `args` antes de `executar()`; `TypeError` dentro de uma operação sem schema próprio vira 400 com rollback em vez de 500 — `updateTask` com `title: 123`/`description: {}` nunca mais chega ao `jsonb` compartilhado.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-16T19:16Z (aprox.)
- **Completed:** 2026-09-16T19:35Z
- **Tasks:** 3/3
- **Files modified:** 5 (2 novos, 3 alterados)

## Accomplishments

- `esquemas-de-argumentos.ts`: `ArgumentosDe<N>` infere a forma dos args de cada operação a partir de `OPERACOES`; `ESQUEMAS satisfies Esquemas` cobre as 23 operações que o Espaço "Gestão" usa na Fase 1 (tasks 20, automations 1, financeiro 2); drift schema × assinatura comprovadamente não compila (prova feita e desfeita: `moveTask: z.tuple([ID])` → TS2322).
- `ARGUMENTOS_GENERICOS`: fallback estrutural (folhas `string|number|boolean|null|Date válido`, até 6 níveis de contêiner) para as ~109 operações restantes — barra objeto-onde-domínio-espera-escalar mesmo sem schema dedicado.
- `operacoes.ts`: `esquemaDeArgumentos(nome).safeParse(args revividos)` roda ANTES do despacho; `TypeError` dentro do callback de `executar()` vira `ErroDeEntrada` → 400, com a Unidade de Trabalho já fazendo rollback antes de relançar. Uma única `mensagemDeEntradaInvalida()` formata as três origens de 400 (schema de serviço, schema de operação, `TypeError`) sem nunca expor a mensagem crua do zod ou do `TypeError` (T-1-06).
- Casos (k)–(r) em `operacoes.test.ts`: 5 casos sem banco provam 400 antes de qualquer conexão; 3 casos com banco provam nada persistido (`hidratar` antes/depois), o mapeamento de `TypeError` numa operação sem schema próprio (`createChatFolder`) e que o caminho feliz (`description` válida) continua gravando e devolvendo o diff normalmente.
- `npm run check` verde nos três workspaces: `@n1/api` 72 testes (54 anteriores + 10 do schema puro + 8 dos casos (k)–(r)), `@n1/web` 53, `@n1/dominio` 250 — os três arquivos de teste do domínio (`operations.test.ts`, `seed-produto.test.ts`, `contas-a-receber.test.ts`) seguem sem diff desde `d713253`.

## Task Commits

Each task was committed atomically:

1. **Task 1: `esquemas-de-argumentos.ts` — 23 schemas por operação + fallback estrutural** - `c932a4d` (feat) — inclui o teste puro `esquemas-de-argumentos.test.ts` no mesmo commit (RED confirmado antes: o teste falhava por módulo inexistente; GREEN confirmado com os 10 casos verdes e `tsc --noEmit` limpo antes de commitar juntos, seguindo o precedente já em uso no repositório — ver `74cd275`, Plan 01-08).
2. **Task 2: `operacoes.ts` valida args antes do despacho e mapeia `TypeError` para 400** - `053ee5a` (feat)
3. **Task 3: Casos (k)–(r) em `operacoes.test.ts`** - `2ba811d` (test)

**Plan metadata:** commit pendente (este SUMMARY + STATE.md + ROADMAP.md)

_Nota TDD: as Tasks 1 e 3 têm `tdd="true"`. Para a Task 1, RED (teste falhando por módulo ausente) foi confirmado antes de escrever a implementação; o commit final agrupa teste+implementação em um único `feat`, replicando o padrão já estabelecido em `74cd275` (Plan 01-08) em vez de dois commits separados `test`/`feat`. A Task 3 é só teste (`test`), sem GREEN separado por não alterar comportamento de produção._

## Files Created/Modified

- `apps/api/src/rotas/esquemas-de-argumentos.ts` - `ArgumentosDe<N>`, `ESQUEMAS` (23 entradas), `ARGUMENTOS_GENERICOS`, `esquemaDeArgumentos(nome)`, helper `opcional()`
- `apps/api/src/rotas/esquemas-de-argumentos.test.ts` - 10 casos puros (formas hostis de CR-02 + formas literais que `apps/web` envia hoje)
- `apps/api/src/rotas/operacoes.ts` - validação de forma antes do despacho, `TypeError` → 400, `mensagemDeEntradaInvalida()`, docblock/comentários atualizados
- `apps/api/src/rotas/operacoes.test.ts` - casos (k)–(r); import de `hidratar` acrescentado ao de `semear`
- `apps/api/src/rotas/CONTEXT.md` - entrada de `esquemas-de-argumentos.ts`; "Nasce vazia" trocado por lista no presente

## Decisions Made

- `inviteMember` permanece fora de `ESQUEMAS` de propósito — ver `key-decisions` acima.
- `RangeError` não mapeado para 400 (só `TypeError`) — `z.date()` já recusa `Invalid Date` antes da operação rodar, então um `RangeError` real já não seria sinal de entrada malformada.
- Mensagem do 400 unificada por `mensagemDeEntradaInvalida()`: `inviteMember` passou a responder `Entrada inválida para "inviteMember".` (com aspas), formato levemente diferente do anterior (`Entrada inválida para inviteMember.`, sem aspas) — sem impacto em teste, já que `convidar-membro.test.ts` (d) verifica só `statusCode`/`ok`, não o texto exato.

## Deviations from Plan

None — plano executado como escrito. Uma observação de processo (não uma mudança de plano):

**Nota:** o commit da Task 1 correspondeu a "RED confirmado, depois GREEN" internamente (rodei o teste antes de escrever a implementação e vi a falha por módulo ausente; escrevi a implementação e vi os 10 casos passarem), mas o **commit em si** agrupa teste + implementação em um só `feat`, em vez de dois commits `test`/`feat` separados. Segui o precedente já estabelecido no repositório para tasks `tdd="true"` (Plan 01-08, commit `74cd275`, que também agrupa teste de serviço + implementação num único `feat`). Não é uma mudança de comportamento nem de escopo — só do número de commits.

## Issues Encountered

- Um único ajuste de formatação de teste: o título do caso (q) em `operacoes.test.ts` usava aspas simples por hábito; a acceptance criteria do plano exige que os 8 títulos `"(k)…"`–`"(r)…"` sejam encontráveis por um grep que casa aspas duplas literais antes do parêntese — troquei para aspas duplas, sem mudar o conteúdo do teste. Verificado: `grep -cE '"\((k|l|m|n|o|p|q|r)\) '` → 8.
- Duas ocorrências de `satisfies Esquemas` apareciam no arquivo (uma no comentário, uma no código) contra a acceptance criteria (`→ 1`); reescrevi o comentário para dizer apenas "`satisfies` (sobre o tipo local `Esquemas`)" preservando o sentido sem repetir a string exata. Verificado: `grep -c "satisfies Esquemas"` → 1.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma dependência nova (`zod` 4.6.5 já estava em `apps/api/package.json`; `package.json`/`package-lock.json` sem diff, confirmado).

## Next Phase Readiness

- Gap 2 de `01-VERIFICATION.md` (CR-02, Critério 2 do ROADMAP) fechado: `POST /operacoes/:nome` agora valida a FORMA dos argumentos antes de rodar qualquer operação, e mapeia `TypeError` para 400 com rollback quando uma operação sem schema próprio recebe uma forma inesperada.
- Combinado com o Plan 01-10 (CR-01, reconvite), os dois gaps identificados em `01-VERIFICATION.md` estão endereçados — a Fase 1 fica pronta para uma nova rodada de `/gsd-verify-phase`.
- Nenhum bloqueio novo. `apps/web` e `packages/dominio` não foram tocados (regra de camada de `CONTEXT.md` preservada); `app.ts` não foi tocado (WR-04 permanece fora do escopo, como já registrado em `01-REVIEW.md`).

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Todos os 5 arquivos de `files_modified` e este SUMMARY existem em disco; os três hashes de commit (`c932a4d`, `053ee5a`, `2ba811d`) existem em `git log`.
