---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 13
subsystem: observabilidade
tags: [sentry, "@sentry/node", fastify, scrub, lgpd, seg-10]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-05 mascararSegredoDeUrl (url-segura) e log sem segredo; 09-10 cofre; 09-12 inventario de rotas"
provides:
  - "@sentry/node 10.76.2 (versao exata) em apps/api"
  - "observabilidade/sentry.ts: limparEvento, limparMigalha, opcoesDoSentry, iniciarSentry, capturarErroNoSentry, fecharSentry"
  - "OpcoesDoApp.capturarErro e OpcoesDoApp.erroDeProvaAtivo; ramo 500 envia ao Sentry; GET /diagnostico/erro-de-prova condicionada"
  - "SENTRY_DSN, SENTRY_AMBIENTE, ERRO_DE_PROVA_ATIVO no .env.example (vazios)"
affects: [09-16 (Sentry da web: instalar a MESMA versao 10.76.2), 09-19 (prova do alerta em homologacao), 09-22 (remover a rota de erro de prova)]

actuals:
  tokens: 5346
  tasks: 3
  commits: 5

plan_head_before: 7b3d4fbfecec1c248651d67b49696913cfa8d21e
plan_head_after: 95db80c2609d79603b6c6192f8f748e426264aef
commits: 5

tech-stack:
  added: ["@sentry/node 10.76.2 (+18 transitivas: @sentry/core, node-core, opentelemetry, server-utils, conventions e @opentelemetry/*)"]
  patterns:
    - "Scrub em duas camadas: dataCollection desligado na origem + beforeSend/beforeBreadcrumb que apagam e mascaram"
    - "Captura explicita no ramo 500 (sem auto-instrumentacao); SDK so inicia com SENTRY_DSN"

key-files:
  created:
    - apps/api/src/observabilidade/sentry.ts
    - apps/api/src/observabilidade/sentry.test.ts
  modified:
    - apps/api/package.json
    - package-lock.json
    - apps/api/src/app.ts
    - apps/api/src/index.ts
    - apps/api/.env.example
    - apps/api/src/observabilidade/CONTEXT.md

key-decisions:
  - "Task 1 (portao de legitimidade): o dono respondeu \"10.76.2\" em 2026-10-23, via orquestrador; so @sentry/node entra aqui, a web (@sentry/nextjs) e o 09-16, na MESMA versao"
  - "dataCollection e usado tambem na 10.76.2 (a chave existe na 10.x), com todos os campos explicitos, porque ao informa-lo todo campo omitido volta ao padrao LIGADO"
  - "request.url e as URLs de migalha perdem tambem a query e o fragmento, alem do segredo de link (o teste exige que x=1 nao saia)"
  - "fecharSentry registrado por aoEncerrar logo apos a criacao do app: corre em paralelo com os workers, nao depois deles"

patterns-established:
  - "Tudo que o Sentry recebe passa por limparEvento; texto livre so tem o segredo de link mascarado, URL tambem perde a query"

requirements-completed: [SEG-10]

coverage:
  - id: D1
    description: "Portao de legitimidade respondido pelo dono (10.76.2, 2026-10-23) e @sentry/node instalado em versao exata, sem script de instalacao"
    requirement: SEG-10
    verification:
      - kind: other
        ref: "node -e (apps/api/package.json dependencies['@sentry/node'] casa /^\\d+\\.\\d+\\.\\d+$/) -> 10.76.2"
        status: pass
    human_judgment: true
    rationale: "A legitimidade do publicador npm e conferencia do dono; o orquestrador so pode confirmar metadados publicos"
  - id: D2
    description: "limparEvento/limparMigalha apagam corpo, cabecalhos, cookies, query, env e usuario e mascaram o segredo de URL; opcoesDoSentry desliga a coleta"
    requirement: SEG-10
    verification:
      - kind: unit
        ref: "apps/api/src/observabilidade/sentry.test.ts (9 testes de scrub/opcoes/fechar)"
        status: pass
      - kind: other
        ref: "SDK real 10.76.2 com transporte falso (sonda unica, scratchpad): nenhum dos 5 valores secretos no envelope"
        status: pass
    human_judgment: false
  - id: D3
    description: "O ramo 500 chama capturarErro; 400 do zod e 413 nao chamam; a rota de erro de prova so existe ligada e exige sessao"
    requirement: SEG-10
    verification:
      - kind: integration
        ref: "apps/api/src/observabilidade/sentry.test.ts (6 testes de app, sem banco)"
        status: pass
      - kind: integration
        ref: "apps/api/src/seguranca/inventario-de-rotas.test.ts (rota de prova desligada por padrao)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O alerta por e-mail e o envio real ao Sentry em homologacao"
    requirement: SEG-10
    verification: []
    human_judgment: true
    rationale: "Exige DSN real e regra de alerta no painel do Sentry: prova do dono em 09-19; nenhum teste local envia a rede"

duration: 11min
completed: 2026-10-23
status: complete
---

# Phase 9 Plan 13: Sentry na api Summary

**`@sentry/node` 10.76.2 (versao exata) na `apps/api`: erro 500 vai ao Sentry sem corpo, cabecalho, cookie, query nem segredo de link (`dataCollection` desligado + `beforeSend`), fecha no desligamento, e a rota de erro de prova so existe com `ERRO_DE_PROVA_ATIVO=true`.**

## Performance

- **Duration:** 11 min (continuacao, desde o Task 2)
- **Started:** 2026-10-23T10:26:00Z
- **Completed:** 2026-10-23T10:38:00Z
- **Tasks:** 3 (Task 1 checkpoint ja respondido; Tasks 2 e 3 TDD)
- **Files modified:** 8 (2 criados, 6 alterados)

## Task 1 — Portao de legitimidade (resposta do dono)

- **Resposta:** `10.76.2`, em **2026-10-23**, dada pelo dono (usuario) a pergunta do checkpoint `blocking-human` e repassada ao executor pelo orquestrador. Nao foi uma decisao do executor.
- Fatos publicos que o dono viu (npm, somente leitura): `@sentry/node` 10.76.2 publicado em 2026-10-08, 11.8.0 em 2026-10-15; repositorio `getsentry/sentry-javascript`; sem `preinstall`/`install`/`postinstall`; nao deprecado. O orquestrador nao verificou a organizacao publicadora no npm; essa conferencia ficou com o dono.
- Esta fase instala so `@sentry/node`. `@sentry/nextjs` (web) e do 09-16 e deve usar a **mesma** `10.76.2`.

## Accomplishments

- `@sentry/node` instalado com `--save-exact` e `--ignore-scripts`: `apps/api/package.json` tem `"@sentry/node": "10.76.2"` sem caret, e o `package-lock.json` so ganhou 19 pacotes (nenhum removido ou alterado; todos de `registry.npmjs.org`; nenhum com `hasInstallScript`).
- `sentry.ts`: `limparEvento` (apaga `user`, `request.headers/cookies/data/query_string/env` e `vars` de frame; mascara URL, transacao, mensagem, migalhas e valor de excecao com `mascararSegredoDeUrl`; tira a query das URLs), `limparMigalha`, `opcoesDoSentry` (`tracesSampleRate: 0`, `dataCollection` todo desligado), `iniciarSentry` (so com `SENTRY_DSN`), `capturarErroNoSentry`, `fecharSentry` (`close(2000)`).
- `app.ts`: `capturarErro(erro)` so no ramo 500; `GET /diagnostico/erro-de-prova` so com `erroDeProvaAtivo`, depois do hook de autenticacao e sem `config.publica`.
- `index.ts`: `iniciarSentry()` entre `carregarEnv()` e `buildApp`; `aoEncerrar(fecharSentry)`.
- Alem dos testes com SDK espionado, o SDK real 10.76.2 foi exercitado uma vez com um transporte falso (sem rede): com usuario, URL com segredo e query, `Authorization` e corpo na requisicao normalizada, nenhum dos cinco valores apareceu no envelope; `request` saiu so com `method` e `url` mascarada.

## Task Commits

1. **Task 1: portao de legitimidade** - sem commit (decisao do dono, 2026-10-23)
2. **Task 2: Sentry node e scrub** - `774459c` (chore: instalacao exata), `39a1447` (test, RED), `872f081` (feat, GREEN)
3. **Task 3: boot, ramo 500, fechamento e rota de prova** - `a374402` (test, RED), `95db80c` (feat, GREEN)

**Plan metadata:** commit `docs(09-13)` seguinte a este arquivo.

## Files Created/Modified

- `apps/api/src/observabilidade/sentry.ts` - filtros, opcoes e ciclo de vida do SDK
- `apps/api/src/observabilidade/sentry.test.ts` - 15 testes, sem rede e sem DSN real (dominio `.invalid`)
- `apps/api/src/app.ts` - `capturarErro`, `erroDeProvaAtivo`, rota de prova condicionada
- `apps/api/src/index.ts` - inicia antes de `buildApp`, fecha ao encerrar
- `apps/api/.env.example` - `SENTRY_DSN=`, `SENTRY_AMBIENTE=`, `ERRO_DE_PROVA_ATIVO=` vazios, com explicacao
- `apps/api/src/observabilidade/CONTEXT.md` - secao "Sentry (Fase 9)"
- `apps/api/package.json`, `package-lock.json` - dependencia exata

## TDD Gate Compliance

`workflow.tdd_mode` esta `false` e o plano e `type: execute`, entao o classificador `check tdd-red-evidence` nao foi exigido; a disciplina RED/GREEN foi seguida mesmo assim.

- **RED 1** (`39a1447`): `sentry.ts` so com o esqueleto de exports; 8 de 9 testes falharam nas asserções planejadas (por ex. `tracesSampleRate` undefined, `close` com 0 chamadas). Avaliacao semantica: o alvo executou e falhou pela razao certa, nao por import nem fixture.
- **GREEN 1** (`872f081`): 9 de 9 passam; `tsc` limpo.
- **RED 2** (`a374402`): 2 de 15 falharam exatamente nas asserções planejadas (espiao com 0 chamadas; 404 em vez de 500). Os demais (400, 413, 404 sem a variavel, 401 sem sessao) ja passavam por serem negativos, o que e esperado.
- **GREEN 2** (`95db80c`): 15 de 15 passam.
- Sem REFACTOR.

## Decisions Made

- Ver `key-decisions`. Em particular: a versao e do dono; `dataCollection` tambem na 10.x; query tirada das URLs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `dataCollection` tambem na 10.76.2**
- **Found during:** Task 2 (leitura dos tipos apos instalar, conforme `read_first`)
- **Issue:** O plano previa, para a 10.x, so `sendDefaultPii: false` "sem a chave que o tipo nao tem". A 10.76.2 tem `dataCollection` (e deprecia `sendDefaultPii`). Sem a chave, a coleta seguiria o padrao do SDK e dependeria apenas do `beforeSend`, uma camada so.
- **Fix:** `opcoesDoSentry` sempre passa `dataCollection` com todos os campos explicitos (`userInfo`, `cookies`, `httpHeaders`, `httpBodies: []`, `urlQueryParams`, `graphQL`, `genAI`, `databaseQueryData`, `stackFrameVariables`), mantendo `sendDefaultPii: false` como documentacao. Sem ramo por versao.
- **Files modified:** `apps/api/src/observabilidade/sentry.ts`
- **Verification:** teste "as opcoes desligam traços e coleta de dado"; sonda com o SDK real.
- **Committed in:** `872f081`

**2. [Rule 2 - Missing critical] Query e fragmento tirados de `request.url` e das URLs de migalha**
- **Found during:** Task 2 (comportamento do plano: o resultado nao pode conter `x=1`)
- **Issue:** `mascararSegredoDeUrl` so troca o segredo; `request.url` com `?x=1` manteria a query, que pode carregar token.
- **Fix:** URLs passam por `semQuery` (mascara e corta em `?`/`#`); texto livre (mensagem, transacao, valor de excecao) so tem o segredo mascarado, pois nao ha como separar query de texto com seguranca.
- **Files modified:** `apps/api/src/observabilidade/sentry.ts`
- **Verification:** testes de `limparEvento` e `limparMigalha`.
- **Committed in:** `872f081`

**3. [Rule 2 - Missing critical] Campos extras limpos**
- **Fix:** tambem saem `request.env` (IP do cliente) e `vars` dos frames de stack, alem dos campos listados no plano.
- **Committed in:** `872f081`

**4. [Rule 3 - Blocking] Commit separado da instalacao**
- Os testes mockam `@sentry/node`, entao o pacote precisava estar instalado antes do RED. A instalacao foi commitada sozinha (`774459c`), em vez de junto com o RED.

---

**Total deviations:** 4 (3 Rule 2, 1 Rule 3). **Impact:** todas reforcam o que o plano pede (nada de corpo, cabecalho, cookie, query ou segredo no evento); nenhum aumento de escopo.

## Issues Encountered

- Uma primeira sonda com o SDK real acusou "vazamento" falso: o proprio arquivo da sonda aparecia nas linhas de contexto do stack (`pre_context`/`context_line`). Refeita com os valores secretos montados em tempo de execucao: limpa. Observacao de produto: eventos levam linhas de codigo-fonte ao redor de cada frame (`frameContextLines`, padrao 5); e codigo, nao dado de requisicao, e foi mantido porque ajuda a achar o erro.
- Fora do escopo, registrado: o `npm audit` da raiz lista vulnerabilidades pre-existentes (next, vitest, vite, fastify, entre outras) e nenhuma em pacote `@sentry/*` ou `@opentelemetry/*` novo. O npm avisou que `@opentelemetry/sdk-trace-base@2.12.0` esta deprecado (dependencia transitiva do `@sentry/node`). Os avisos `EBADENGINE` de `jsdom` sao da web e anteriores.
- Observacao (nao alterada, fora do plano): o ouvinte de SIGTERM de `index.ts` so para os workers e nao chama `app.close()` nem sai do processo; a saida depende do systemd. O `fecharSentry` segue esse mesmo desenho.

## Verificacao

- `DATABASE_URL= npx vitest run src/observabilidade`: 4 arquivos, 29 testes verdes. `npx tsc --noEmit` na api: limpo.
- Contra o container local `crm-n1-pg-0913` (porta 55613, `postgres:16`): `estado.test.ts`, `operacoes.test.ts`, `operacoes-suspenso.test.ts`, `operacoes-eventos.test.ts`, `seguranca/inventario-de-rotas.test.ts` e `observabilidade/`: 9 arquivos, 88 testes verdes.
- Suite inteira da api, com o mesmo container e **sem** `src/e2e/lote-contas-a-pagar.test.ts` (conhecido, nao e deste plano): 140 arquivos passaram, 2 pulados; 1513 testes passaram, 2 `expected fail` (as lacunas de dominio conhecidas), 21 pulados, 1 todo.
- Criterios de aceitacao: `grep -c "iniciarSentry()" index.ts` = 1; `grep -c "aoEncerrar(fecharSentry)" index.ts` = 1; `grep -c "capturarErro(erro)" app.ts` = 1; `^SENTRY_DSN=` = 1; `^ERRO_DE_PROVA_ATIVO=` = 1; versao exata verificada por `node -e`.
- O container `crm-n1-pg-0913` foi parado e removido; nenhum processo meu ficou rodando.

## Known Stubs

Nenhum. A rota `/diagnostico/erro-de-prova` e intencional e condicionada; sai em 09-22.

## Threat Flags

Nenhuma superficie nova alem da prevista no `threat_model` (T-09-66, a rota de prova, mitigada: so com a variavel, exige sessao).

## User Setup Required

Nenhum neste plano. O DSN de cada ambiente, o alerta por e-mail e a prova em homologacao sao do dono em 09-19; o DSN vai so no `api.env` da VPS.

## Next Phase Readiness

- 09-16 instala `@sentry/nextjs` na MESMA versao `10.76.2`, exata. Vale reler os tipos da versao (a 10.76.2 ja tem `dataCollection`).
- 09-19 liga `SENTRY_DSN`, `SENTRY_AMBIENTE=homologacao` e `ERRO_DE_PROVA_ATIVO=true` so em homologacao; 09-22 remove a rota.

## Self-Check: PASSED

- `apps/api/src/observabilidade/sentry.ts`, `sentry.test.ts` e este SUMMARY existem; os cinco commits (`774459c`, `39a1447`, `872f081`, `a374402`, `95db80c`) sao ancestrais do HEAD.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
