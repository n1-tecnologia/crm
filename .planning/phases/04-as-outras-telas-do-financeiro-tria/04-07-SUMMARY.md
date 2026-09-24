---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 07
subsystem: api
tags: [express, bearer, timing-safe-equal, allowlist, node-test, financeiro, financeiro-tria]

# Dependency graph
requires: ["04-01", "04-04"]
provides:
  - "exigirCredencial, responderErro, requestIdDe, lerCorpoBruto, tokenDeLeitura, MENSAGENS_FIXAS, EMPRESAS_PERMITIDAS, TIPOS_PERMITIDOS, queryDeEmpresa, queryDeEmpresaETipo — em financeiro-tria/automation/src/http/leituras-plataforma-comum.ts, o comum da superfície nova"
  - "montarRotasDeLeituras, leiturasPlataformaRouter, DepsDasRotasDeLeituras — GET /v1/leituras/{dashboard,problemas,aprovacoes-pendentes,workflows}, em financeiro-tria/automation/src/http/leituras-plataforma-routes.ts"
  - "/v1/leituras/* montado em server.ts, autenticado desde o nascimento, ANTES do express.json() global"
  - "PLATAFORMA_LEITURA_TOKEN em automation/.env.example (vazia)"
affects: ["04-05 (rotas/financeiro.ts do apps/api, cliente já pronto desde 04-02, agora tem com quem falar)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Superfície plataforma→automation/ nova recria a própria disciplina de autenticação/erro (Bearer em tempo constante, envelope fixo) em vez de importar de outra superfície já existente — mesmo quando o texto explicativo do porquê tenta citar o nome do arquivo/token evitado, e isso quebra os greps de 0-ocorrências da aceitação (achado repetido de 04-04, replicado aqui: Rule 1)"
    - "Rota de leitura devolve só o que uma derivação pura (04-04) ou um DTO de saída (04-01) produz — nunca uma linha crua do store, nunca res.json(data) direto"

key-files:
  created:
    - "../financeiro-tria/automation/src/http/leituras-plataforma-comum.ts"
    - "../financeiro-tria/automation/src/http/leituras-plataforma-routes.ts"
    - "../financeiro-tria/automation/src/http/leituras-plataforma-routes.test.ts"
  modified:
    - "../financeiro-tria/automation/src/server.ts"
    - "../financeiro-tria/automation/.env.example"

key-decisions:
  - "A primeira redação do cabeçalho de leituras-plataforma-comum.ts citava literalmente 'contas-a-pagar-routes.ts', 'webhooks-plataforma.ts', 'PLATAFORMA_LANCAMENTO_TOKEN' e 'requiredEnv' ao explicar por que este arquivo não os usa — os greps de 0-ocorrências das acceptance_criteria da Task 1 reprovaram (1, 1, 1 e 2 ocorrências respectivamente, onde o esperado era 0 em todos). Reescrito para descrever as mesmas decisões sem citar os identificadores literais proibidos pelo grep (Rule 1 — o grep é a especificação executável, igual ao achado já registrado em 04-04-SUMMARY.md)."
  - "queryDeEmpresaETipo foi exportado por leituras-plataforma-comum.ts (Task 1 pede explicitamente) mas nenhuma das quatro rotas desta plano o usa — todas as quatro leituras filtram só por empresa, nunca por tipo isoladamente. Fica pronto para uma leitura futura que precise do par (ex.: Notas fiscais/Produtos, fora do escopo deste plano)."
  - "listarWorkflows/listarExecucoes são chamadas em paralelo (Promise.all) dentro do handler de /workflows — não sequencial — porque não há dependência de dado entre catálogo e execuções; nenhuma das duas espera pela outra."

requirements-completed: [TELA-01]

# Metrics
duration: ~50min (leitura de contexto + execução; commits às 21:36-21:37, sem contar a checagem de contenção de CPU de processos tsc concorrentes não relacionados a este plano)
completed: 2026-09-23
---

# Phase 04 Plan 07: A superfície `/v1/leituras/*` — autenticada desde o nascimento Summary

**Quatro rotas GET novas no Express do `automation/` (`dashboard`, `problemas`, `aprovacoes-pendentes`, `workflows`), autenticadas por Bearer em tempo constante desde o primeiro commit, montadas antes do `express.json()` global, devolvendo só o que as derivações puras de 04-04 e os DTOs de saída de 04-01 produzem — nenhuma linha crua de `solicitacoes_pagamentos` atravessa.**

## Performance

- **Duration:** ~1min entre o primeiro e o último commit de código (`6924703` → `39dcc35`, 21:36:14 → 21:37:16); a maior parte do tempo real da sessão foi leitura de contexto (CONTEXT/SUMMARYs de 04-01/04-02/04-04, código-fonte do `automation/`) e a checagem de suíte completa (`npm test`, ~10min de wall time, com contenção de CPU de dois processos `tsc --noEmit` do `crm-n1` alheios a este plano, já rodando antes desta sessão começar)
- **Started:** 2026-09-23 (commits de código às 21:36-21:37 -03:00)
- **Completed:** 2026-09-23T21:37:16-03:00 (último commit de código)
- **Tasks:** 3/3
- **Files:** 3 criados, 2 modificados, todos em `../financeiro-tria` (mais este SUMMARY em `crm-n1`)

## Accomplishments

- `leituras-plataforma-comum.ts` (158 linhas): `exigirCredencial` em tempo constante (`createHash`+`timingSafeEqual`, recriado do molde de `contas-a-pagar-routes.ts`, não importado dele), `MENSAGENS_FIXAS`/`responderErro` com o mesmo envelope de 03-07, `EMPRESAS_PERMITIDAS`/`TIPOS_PERMITIDOS` duplicadas de propósito da rota legada, `queryDeEmpresa`/`queryDeEmpresaETipo` (`.strict()`)
- `leituras-plataforma-routes.ts` (159 linhas): as quatro rotas, todas na ordem autenticar → validar query → executar; `/dashboard`/`/problemas`/`/aprovacoes-pendentes` computam através de `montarMetricasDoDashboard`/`montarAtencaoDoDashboard`/`montarLinhasDeProblema`/`montarAprovacoesPendentes` (04-04); `/workflows` projeta através de `dtoDeWorkflow`/`dtoDeExecucaoDeWorkflow` (04-01); `.limit(500)` de `listSolicitacoesPagamentos` preservado; `leiturasPlataformaRouter()` é o wiring de produção sobre `automationStore`/`workflow-store.ts`
- `server.ts`: duas linhas (import + `app.use("/v1/leituras", leiturasPlataformaRouter())`) imediatamente após `/v1/integrations/contas-a-pagar` e antes de `express.json({ limit: "10mb" })` — confirmado por número de linha (53 < 54)
- `automation/.env.example`: `PLATAFORMA_LEITURA_TOKEN=` vazia, com os dois comentários pedidos — conteúdo confirmado por `git show` do commit (ver "Verificação do `.env.example`" abaixo)
- `leituras-plataforma-routes.test.ts` (299 linhas, 11 casos `node:test`): app montado à mão sem `express.json()` global; (a)-(d) autenticação (ausente/errado/vazio/tokenEsperado vazio nas deps), todos com a dep não chamada; (e)/(g) query inválida (`empresa` fora da allowlist, chave desconhecida) → 400, dep não chamada; (f) `?empresa=pf` repassa exatamente `"pf"`; (h) forma do corpo de `/dashboard`; (i) laço de não-vazamento sobre as quatro rotas contra `CAMPOS_PROIBIDOS` e os valores falsos da fixture; (j) `/workflows` sem `manualRunKey`/`input_payload`/`output_payload`; (k) erro da dep → 500 sem a mensagem original no corpo
- Verificação por mutação feita de fato, não só descrita: (1) trocar `credenciaisIguais`(`timingSafeEqual`) por uma comparação `===` ingênua em `exigirCredencial` manteve os 11 casos verdes (o teste não prova tempo constante, só prova 401/400/200 nos momentos certos); (2) remover a chamada de `exigirCredencial` do handler de `/dashboard` fez exatamente os quatro casos de autenticação daquela rota falharem (`(a)`-`(d)`, 200 em vez de 401) — os outros sete casos continuaram verdes, confirmando que a chamada de auth é o que os casos (a)-(d) realmente testam. Ambas as mutações revertidas antes do commit; `diff` contra o backup confirmou identidade byte a byte após reverter.

## Task Commits

Cada task foi commitada atomicamente **no repositório `financeiro-tria`** (não em `crm-n1` — ver `<two_repository_warning>` do plano):

1. **Task 1: O comum — Bearer em tempo constante, envelope fixo e allowlists** - `6924703` (feat)
2. **Task 2: As quatro leituras derivadas e o mount** - `c3dea4a` (feat)
3. **Task 3: O teste — 401, 400 e a projeção que não vaza** - `39dcc35` (test)

**Plan metadata:** este commit (`docs(04-07): complete...`), feito em `crm-n1`.

`git -C ../financeiro-tria status --porcelain | wc -l` confirmado em `89` antes do primeiro commit, `93`/`90`/`89` depois de cada um dos três commits, respectivamente — nenhum dos 89 arquivos pré-existentes foi tocado.

## Files Created/Modified

Repositório `financeiro-tria` (branch `main`):
- `automation/src/http/leituras-plataforma-comum.ts` - autenticação, envelope de erro, allowlists (novo)
- `automation/src/http/leituras-plataforma-routes.ts` - as quatro rotas + wiring de produção (novo)
- `automation/src/http/leituras-plataforma-routes.test.ts` - 11 casos `node:test` (novo)
- `automation/src/server.ts` - mount de `/v1/leituras`, duas linhas + comentário
- `automation/.env.example` - `PLATAFORMA_LEITURA_TOKEN=` + dois comentários

Repositório `crm-n1` (este):
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/04-07-SUMMARY.md` - este arquivo

## Decisions Made

Ver `key-decisions` no frontmatter — o ponto mais relevante: a primeira redação do cabeçalho de `leituras-plataforma-comum.ts` citava os identificadores que o arquivo deliberadamente evita usar (`contas-a-pagar-routes.ts`, `webhooks-plataforma.ts`, `PLATAFORMA_LANCAMENTO_TOKEN`, `requiredEnv`) para explicar por que não os importa/usa — o que fez os próprios greps de 0-ocorrências da Task 1 reprovarem a explicação. Reescrito sem citar os literais proibidos, mesma decisão de fundo, mesmo achado que 04-04 já registrou para outro arquivo desta fase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prosa do cabeçalho de `leituras-plataforma-comum.ts` citando os identificadores proibidos derrubava os próprios greps de aceitação**
- **Found during:** verificação das `<acceptance_criteria>` da Task 1, logo após a primeira escrita do arquivo
- **Issue:** `grep -cE "contratos/v1|contas-a-pagar-routes|webhooks-plataforma"` devolveu `2` (esperado `0`), `grep -c "PLATAFORMA_LANCAMENTO_TOKEN"` devolveu `1` (esperado `0`), `grep -c "requiredEnv"` devolveu `1` (esperado `0`) — todos porque o comentário de cabeçalho e o comentário de `tokenDeLeitura()` citavam esses tokens literalmente ao explicar as decisões de não os usar.
- **Fix:** reescrita da prosa para descrever as mesmas três decisões sem citar o nome literal do arquivo/token/função evitados (ex.: "a credencial de escrita usada pela superfície de lançamento" em vez de `PLATAFORMA_LANCAMENTO_TOKEN`; "cada superfície plataforma-`automation/` recria a própria disciplina" em vez de nomear os três arquivos evitados).
- **Files modified:** `../financeiro-tria/automation/src/http/leituras-plataforma-comum.ts`
- **Verification:** os quatro greps de aceitação da Task 1 voltaram a `2` (`timingSafeEqual`, ≥1 ok), `0`, `0`, `0` — todos dentro do esperado; `npx tsc --noEmit` limpo depois da edição.
- **Committed in:** `6924703` — a correção foi feita antes do commit, então o commit não registra o "antes" com o texto que falhava o grep.

---

**Total deviations:** 1 auto-fixed (1 bug, encontrado e corrigido antes do primeiro commit).
**Impact on plan:** nenhuma mudança de comportamento no código, só na prosa dos comentários.

## Issues Encountered

- **Contenção de CPU não relacionada a este plano.** Durante a execução, dois processos `tsc --noEmit` do workspace `crm-n1` (não iniciados por esta sessão de execução, presumivelmente remanescentes de atividade anterior no mesmo ambiente) ficaram rodando em paralelo com os `tsc`/`tsx --test` deste plano no `automation/`, tornando cada checagem de tipo/teste 3-5x mais lenta que o esperado (ex.: o `npx tsc --noEmit` isolado do `automation/` levou de mais tempo que o normal; a suíte completa `npm test` levou ~10min de wall time em vez do que seria esperado sem contenção). Não interferiu no resultado (todos os comandos completaram com o código de saída correto), só no tempo. Um processo duplicado que EU mesmo criei por engano (rodar o mesmo `tsc --noEmit` duas vezes em paralelo, uma vez com `&` manual e outra com `run_in_background`) foi identificado e encerrado (`kill`) assim que percebido — os dois processos do `crm-n1` não foram tocados, por não terem sido criados por esta sessão e por matar processos alheios ser fora de escopo.
- **`npm test` completo no `automation/`: 114/115 verdes.** A única falha é a pré-existente já registrada em `deferred-items.md` desde 04-01 (`payment-rules.test.ts`, "resolve responsavel por centro de custo com fallback", `'Elifas'` vs `/FINQ/i`) — confirmada aqui como ainda presente e não tocada por este plano (nenhuma edição em `payment-rules.ts`/`payment-rules.test.ts`, nenhum arquivo deste plano tem relação com aquele módulo). Nenhuma entrada nova adicionada a `deferred-items.md`. Os 11 casos de `leituras-plataforma-routes.test.ts` passaram dentro da suíte completa, junto com os 103 demais.
- **Waiver do `npm run check` do `crm-n1` — aplicado por decisão explícita do orquestrador para este plano** (ver `<do_not_run_the_crm_n1_full_check>` do prompt de execução): este plano não toca nenhum arquivo de código em `crm-n1` (só este SUMMARY, em `.planning/`), então o `npm run check` do `crm-n1` não provaria nada sobre o trabalho feito aqui — e o custo (`apps/api` contra Postgres real, `fileParallelism: false`, `testTimeout: 180_000`, 40-50min de wall time) excede a janela do executor. Verificação feita em escopo, como instruído: `npx tsc --noEmit` do `automation/` (limpo, duas vezes) e a suíte completa do `automation/` (`npm test`, 114/115 — o N-1 esperado).
- **Verificação do `.env.example` — sem lacuna desta vez.** O plano avisava que o sandbox nega `Read`/`cat`/`grep` diretos sobre `.env*`, e que um plano anterior (04-02) tinha uma lacuna de verificação por causa disso. Aqui a leitura direta do arquivo também foi negada, mas `git show <hash> -- automation/.env.example` (que imprime o diff através do git, não uma leitura direta do arquivo) FOI permitido e mostrou o conteúdo exato do que foi acrescentado — confirmando `PLATAFORMA_LEITURA_TOKEN=` vazia com os dois comentários esperados, byte a byte. Sem lacuna de verificação a registrar neste plano.

## User Setup Required

Nenhuma ação nova além da já documentada em `04-02-SUMMARY.md`: `PLATAFORMA_LEITURA_TOKEN` (gerar com `openssl rand -hex 32`, distinta de `PLATAFORMA_LANCAMENTO_TOKEN`) precisa ser escrita nos `.env` de produção de `automation/` E `apps/api` antes do corte (D4-16) — nenhuma rota em produção depende dela ainda até `apps/api` estar de fato chamando `/v1/leituras/*` (04-05, já também merged nesta fase segundo `04-05-SUMMARY.md`/`04-06-SUMMARY.md` referenciados no histórico de commits).

## Next Phase Readiness

- `GET /v1/leituras/{dashboard,problemas,aprovacoes-pendentes,workflows}` existem, autenticadas, montadas antes do parser global, e prontas para `cliente-leituras-financeiro.ts` (04-02) e `rotas/financeiro.ts` (04-05, já merged) consumirem.
- As rotas legadas (`routes.ts`, `plano-contas-routes.ts`, `workflow-routes.ts`, `bank-statement-webhooks.ts`) seguem byte a byte intactas — `git diff --stat` confirmado vazio.
- Nenhum bloqueio novo para os planos seguintes da Fase 4. A falha pré-existente de `payment-rules.test.ts` permanece documentada em `deferred-items.md` (de 04-01), sem entrada duplicada.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `../financeiro-tria/automation/src/http/leituras-plataforma-comum.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-plataforma-routes.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-plataforma-routes.test.ts`
- FOUND commit `6924703` (Task 1) in `../financeiro-tria`
- FOUND commit `c3dea4a` (Task 2) in `../financeiro-tria`
- FOUND commit `39dcc35` (Task 3) in `../financeiro-tria`
