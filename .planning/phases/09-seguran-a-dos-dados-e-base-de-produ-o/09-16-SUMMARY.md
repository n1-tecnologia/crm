---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 16
subsystem: observabilidade
tags: [sentry, "@sentry/nextjs", nextjs-16, instrumentation, global-error, scrub, lgpd, seg-10]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-13 @sentry/node 10.76.2 aprovado pelo dono e o scrub da api; 09-05 mascararSegredoDeUrl (url-segura)"
provides:
  - "@sentry/nextjs 10.76.2 (versão exata, a mesma do @sentry/node) em apps/web"
  - "features/observabilidade/limpar-evento.ts: limparEvento, limparMigalha, opcoesDoSentryNaWeb"
  - "src/instrumentation.ts (register só em nodejs e só com SENTRY_DSN; onRequestError) e src/instrumentation-client.ts (só com NEXT_PUBLIC_SENTRY_DSN)"
  - "src/app/global-error.tsx: fronteira de erro do root layout com captura"
  - "next.config.ts com withSentryConfig sem rede e sem token; NEXT_PUBLIC_SENTRY_DSN e SENTRY_DSN vazios no .env.example"
affects: [09-19 (DSN real da web, regra de alerta e prova em homologação), 09-22]

actuals:
  tokens: 6610
  tasks: 2
  commits: 6

plan_head_before: b980e95de25b53fa8a20f0a800df055be859b07c
plan_head_after: 023a137c2a071a1fcb230dc9f569f7dada3f89e0
commits: 6

tech-stack:
  added: ["@sentry/nextjs 10.76.2 (+110 entradas novas no lockfile: @sentry/browser, react, replay, vercel-edge, bundler-plugins, webpack-plugin, cli, webpack, rollup, terser e transitivas)"]
  patterns:
    - "Scrub em duas camadas (dataCollection desligado + beforeSend/beforeBreadcrumb), o mesmo da api, com mascaramento também no meio do texto"
    - "SDK só inicia com DSN; sem DSN a web roda como antes"
    - "withSentryConfig por @sentry/nextjs/config (o export da raiz está deprecado na 10.76)"

key-files:
  created:
    - apps/web/src/features/observabilidade/limpar-evento.ts
    - apps/web/src/features/observabilidade/limpar-evento.test.ts
    - apps/web/src/instrumentation.ts
    - apps/web/src/instrumentation-client.ts
    - apps/web/src/app/global-error.tsx
    - apps/web/src/app/global-error.test.tsx
  modified:
    - apps/web/package.json
    - package-lock.json
    - apps/web/next.config.ts
    - apps/web/.env.example
    - apps/web/CONTEXT.md

key-decisions:
  - "Versão: @sentry/nextjs 10.76.2 exata, igual à @sentry/node da api (aprovada pelo dono em 2026-10-23, 09-13), instalada com --ignore-scripts"
  - "dataCollection também na 10.76.2 (a chave existe na 10.x), todos os campos explícitos, como na api"
  - "O SDK só inicia com DSN (servidor e navegador): iniciar sem DSN não enviaria nada, mas instalaria a instrumentação de Node/OpenTelemetry à toa"
  - "withSentryConfig importado de @sentry/nextjs/config, porque o export da raiz está marcado @deprecated na 10.76.2"
  - "Mascaramento de segredo de /f/ e /p/ também no meio do texto: a regra do domínio só enxerga o começo da string"
  - "global-error usa py-12 (48px, na escala de espaçamento) em vez do py-10 do UI-SPEC (resolução do FLAG da Dimensão 5)"

patterns-established:
  - "Tudo que o Sentry da web recebe passa por limparEvento; URL perde query e fragmento, texto livre só tem o segredo de link mascarado"

requirements-completed: [SEG-10]

coverage:
  - id: D1
    description: "@sentry/nextjs instalado em versão exata, igual à @sentry/node da api, sem script de instalação executado"
    requirement: SEG-10
    verification:
      - kind: other
        ref: "node -e (apps/api @sentry/node === apps/web @sentry/nextjs, /^\\d+\\.\\d+\\.\\d+$/) -> 10.76.2 / 10.76.2"
        status: pass
    human_judgment: false
  - id: D2
    description: "limparEvento/limparMigalha apagam corpo, cabeçalhos (Referer), cookies, query, ambiente e usuário e mascaram /f/ e /p/ (URL, transação, migalhas, exceção, tags, extra); opcoesDoSentryNaWeb sem tracing nem replay"
    requirement: SEG-10
    verification:
      - kind: unit
        ref: "apps/web/src/features/observabilidade/limpar-evento.test.ts (13 testes)"
        status: pass
      - kind: other
        ref: "SDK real 10.76.2 com transporte falso (sonda única no scratchpad): nenhum dos 6 valores secretos no envelope"
        status: pass
    human_judgment: false
  - id: D3
    description: "Instrumentação do Next 16: register só em nodejs e só com SENTRY_DSN, onRequestError, instrumentation-client só com NEXT_PUBLIC_SENTRY_DSN"
    requirement: SEG-10
    verification:
      - kind: other
        ref: "cd apps/web && npx tsc --noEmit && npx eslint src/instrumentation.ts src/instrumentation-client.ts && npm run build -w @n1/web"
        status: pass
    human_judgment: true
    rationale: "Nenhum teste automatizado exercita o Next real enviando erro ao Sentry; a prova com DSN real e regra de alerta é do dono em 09-19"
  - id: D4
    description: "global-error.tsx: html/body próprios, texto fixo sem message/digest, captura uma vez, botão chama retry"
    requirement: SEG-10
    verification:
      - kind: unit
        ref: "apps/web/src/app/global-error.test.tsx (3 testes, jsdom)"
        status: pass
    human_judgment: true
    rationale: "Aparência da tela de erro (grade de pontos, painel, ícone, espaçamento py-12) não foi vista num navegador nesta execução; conferência visual na verificação da fase"
  - id: D5
    description: "withSentryConfig sem rede nem token no build (telemetry false, sourcemaps desligado, bundle mínimo); npm run build passa"
    requirement: SEG-10
    verification:
      - kind: other
        ref: "npm run build -w @n1/web e npm run build (raiz), exit 0; build repetido sob sandbox-exec com a saída de rede negada (exceto localhost), exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "DSN por ambiente (Production e Preview na Vercel), regra de alerta e envio real ao Sentry"
    requirement: SEG-10
    verification: []
    human_judgment: true
    rationale: "Exige DSN real e painel do Sentry: prova do dono em 09-19; nenhum teste local envia à rede"

duration: 10min
completed: 2026-10-23
status: complete
---

# Phase 9 Plan 16: Sentry na web Summary

**`@sentry/nextjs` 10.76.2 (a mesma versão exata da api) na `apps/web`: erros de render e de servidor chegam ao Sentry só quando há DSN, sem corpo, cabeçalho (nem `Referer`), cookie, query nem o segredo de `/f/` e `/p/`, com `global-error.tsx` que captura o erro de render e `withSentryConfig` que não usa rede nem token no build.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-23T10:55:00Z (aproximado)
- **Completed:** 2026-10-23T11:05:00Z
- **Tasks:** 2 (a Task 1 em TDD)
- **Files modified:** 11 (6 criados, 5 alterados), mais o `package-lock.json`

## O que a instalação trouxe (relatório pedido)

`npm install --save-exact --ignore-scripts @sentry/nextjs@10.76.2 -w @n1/web`. Comparei o lockfile antes e depois pelo campo `packages`:

- **111 entradas novas**, nenhuma removida, **nenhuma fora de `registry.npmjs.org`**. As versões `@sentry/*` novas são todas 10.76.2 (`browser`, `browser-utils`, `bundler-plugins`, `feedback`, `nextjs`, `react`, `replay`, `replay-canvas`, `vercel-edge`) mais `@sentry/webpack-plugin` 5.4.1 e `@sentry/cli` 2.58.6 com os 8 binários de plataforma opcionais (`@sentry/cli-darwin`, `-linux-*`, `-win32-*`).
- **Único pacote com script de instalação: `@sentry/cli` 2.58.6** (`postinstall: node ./scripts/install.js`). Veio por `@sentry/nextjs` → `@sentry/bundler-plugins` → `@sentry/cli` (repositório `getsentry/sentry-cli`, declarado nas dependências do próprio `@sentry/nextjs`). **Não rodou aqui** por causa do `--ignore-scripts`. Lido o script: ele só baixa o binário de `downloads.sentry-cdn.com` se os pacotes opcionais de plataforma tiverem sido omitidos (`--omit=optional`); com o `npm ci` normal da Vercel ele só confere a versão e sai. `SENTRYCLI_SKIP_DOWNLOAD=1` desliga o download se o dono quiser. Não é usado em tempo de build porque os source maps estão desligados.
- Transitivas grandes e esperadas do plugin de build: `webpack` 5.112.1, `rollup` 4.65.0 e seus binários opcionais, `terser`, `@rollup/plugin-commonjs`, `node-fetch` 2.7.0, `https-proxy-agent`, `glob` 13, `dotenv` 17.4.2, `jest-worker`, `schema-utils`.
- **Mudou o que já existia (53 entradas "alteradas")**: 52 pacotes (`@babel/*`, `@jridgewell/*`, `acorn`, `browserslist`, `semver`, `which`, etc.) perderam a marca `dev: true`, porque agora são dependência de produção via `@sentry/bundler-plugins`; e `enhanced-resolve` subiu de 5.25.1 para 5.26.0 (mesmo registry, resolvido de novo pelo npm). Nenhum trocou de origem.
- `npm audit` (só produção) não aponta nenhum pacote `@sentry/*`, `webpack`, `rollup`, `terser`, `node-fetch`, `glob` nem `dotenv` novo. O que aparece (`source-map-js`) já existia.
- Julguei que isto é a árvore normal de dependências do pacote que o dono aprovou, e não "algo surpreendente", então commitei (`dc40446`). Fica registrado aqui para o dono decidir se quer `SENTRYCLI_SKIP_DOWNLOAD=1` na Vercel.

## Accomplishments

- `limpar-evento.ts`: `limparEvento` apaga `user`, `request.headers/cookies/data/query_string/env` e `vars` de frame; passa URL, transação, mensagem, migalhas (inclusive `data.arguments` do console), exceção, `tags` e `extra` pelo mascaramento; URL perde também query e fragmento. `opcoesDoSentryNaWeb` monta o `Sentry.init`: `tracesSampleRate: 0`, `dataCollection` todo desligado, sem `dsn` quando vazio, sem replay.
- `instrumentation.ts` / `instrumentation-client.ts` conforme os guias do Next 16.3.4 (lidos antes): `register()` só no ramo `nodejs`, `onRequestError = Sentry.captureRequestError`, cliente síncrono no topo, sem `onRouterTransitionStart`.
- `global-error.tsx` com as props da 16.3 (`retry`), `<html lang="pt-BR">`/`<body>` próprios, `import "./globals.css"` próprio, texto fixo.
- `next.config.ts`: `withSentryConfig(nextConfig, { telemetry: false, silent: true, sourcemaps: { disable: true }, bundleSizeOptimizations: {...} })`.
- Sonda com o **SDK real 10.76.2** e transporte falso (sem rede): com usuário, URL com segredo e query, `Referer`, cookie, corpo, migalhas e mensagem de exceção com a URL no meio da frase, nenhum dos 6 valores secretos apareceu no envelope; `request` saiu só com `method` e `url` mascarada. A sonda achou um furo (tag posta pelo código com `/p/<segredo>` saía intacta), fechado em `f7d0208`.

## Task Commits

1. **Task 1: pacote, scrub e instrumentação** — `dc40446` (chore, instalação exata), `7bba37d` (test, RED), `875dbbd` (feat, GREEN), `f7d0208` (feat, tags e extra)
2. **Task 2: global-error, withSentryConfig, .env.example** — `faa9284` (feat)
3. **Doc de apoio** — `023a137` (docs, `apps/web/CONTEXT.md`)

**Plan metadata:** commit `docs(09-16)` seguinte a este arquivo.

## Files Created/Modified

- `apps/web/src/features/observabilidade/limpar-evento.ts` e `.test.ts` — filtros e opções, 13 testes sem SDK
- `apps/web/src/instrumentation.ts`, `instrumentation-client.ts` — iniciam o SDK só com DSN
- `apps/web/src/app/global-error.tsx` e `.test.tsx` — fronteira de erro e 3 testes (jsdom)
- `apps/web/next.config.ts` — `withSentryConfig` por `@sentry/nextjs/config`
- `apps/web/.env.example` — `NEXT_PUBLIC_SENTRY_DSN=` e `SENTRY_DSN=` vazios, com a explicação
- `apps/web/package.json`, `package-lock.json` — dependência exata
- `apps/web/CONTEXT.md` — seção "Monitoramento de erros (Fase 9)"

## TDD Gate Compliance

`workflow.tdd_mode` é `false` e o plano é `type: execute`, então `check tdd-red-evidence` não foi exigido; a disciplina RED/GREEN foi seguida.

- **RED** (`7bba37d`): esqueleto de `limpar-evento.ts` só com os exports; 8 de 12 testes falharam nas asserções planejadas (segredo no JSON, `request` sem apagar, `transaction` sem mascarar, `dsn` ausente, `tracesSampleRate`). Avaliação semântica: o alvo executou e falhou pela razão certa, não por import nem fixture; os 4 que já passavam são negativos ou de identidade (evento sem nada a limpar), esperado.
- **GREEN** (`875dbbd`): 12 de 12; `tsc` e `eslint` limpos.
- **Extra** (`f7d0208`): teste de tags/extra escrito junto com a correção, depois da sonda com o SDK real (13 de 13).
- Sem REFACTOR.

## Decisions Made

Ver `key-decisions`. Além disso, as duas marcações do UI-SPEC pedidas pelo orquestrador:

- **`py-12` no lugar de `py-10`** (resolução do FLAG da Dimensão 5, Spacing): o UI-SPEC copia `py-10` do estado de falha de `/p/`, que está fora da escala declarada de espaçamento; usei `py-12` (48px, `--e-12`, na escala). O `EmptyState` real mantém `py-10`; a diferença é de 8px em cada lado e só nesta tela.
- **«O erro foi registrado.» só é verdade onde há DSN** (UI-SPEC item I3): em desenvolvimento e em qualquer build sem `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` o SDK não inicia e a frase não corresponde ao que aconteceu. Mantida como o plano fixa; a tela só importa onde há DSN (homologação e produção, 09-19). Alternativa registrada: omitir a dica quando o DSN estiver vazio.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `dataCollection` na 10.76.2**
- **Found during:** Task 1 (tipos da versão instalada, conforme `read_first`)
- **Issue:** o plano previa `dataCollection` só na v11 e, na v10, apenas `sendDefaultPii: false`. A 10.76.2 tem `dataCollection`; sem a chave a coleta seguiria o padrão do SDK e dependeria só do `beforeSend`.
- **Fix:** `opcoesDoSentryNaWeb` sempre passa `dataCollection` com todos os campos explícitos, como na api (09-13), sem ramo por versão.
- **Files modified:** `apps/web/src/features/observabilidade/limpar-evento.ts`
- **Verification:** teste "com DSN liga só o filtro"; `tsc` aceita as opções em `Sentry.init`.
- **Committed in:** `875dbbd`

**2. [Rule 2 - Missing critical] Segredo no meio do texto**
- **Found during:** Task 1 (comportamento "exception.values[0].value com /f/SEGREDO-W")
- **Issue:** `mascararSegredoDeUrl` do domínio só casa `/f/` e `/p/` no começo da string, de propósito (para não tocar em `/financeiro/f/abc`). Uma mensagem real como "Failed to fetch RSC payload for https://app/p/x" vazaria o segredo.
- **Fix:** `mascararTexto` repete a busca em qualquer posição (caractere anterior que não seja de palavra, barra, ponto ou hífen), preservando a pontuação final da frase. O domínio não foi alterado.
- **Files modified:** `apps/web/src/features/observabilidade/limpar-evento.ts`
- **Verification:** testes "no meio de um texto" e "não troca o que não é link público".
- **Committed in:** `875dbbd`

**3. [Rule 2 - Missing critical] Migalhas profundas, query nas URLs, `env` e `vars`**
- **Fix:** `data.arguments` de migalha de console é mascarado em profundidade limitada; `request.url` e URLs de migalha perdem query e fragmento; saem também `request.env` e `vars` de frame (igual à api).
- **Committed in:** `875dbbd`

**4. [Rule 2 - Missing critical] `tags` e `extra`**
- **Found during:** verificação com o SDK real (a sonda deixou passar `/p/<segredo>` posto numa tag)
- **Fix:** `limparEvento` passa `tags` e `extra` por `mascararProfundo`. A web não usa tags hoje; fecha o furo para quem usar.
- **Committed in:** `f7d0208`

**5. [Rule 1 - Deprecation] `withSentryConfig` por `@sentry/nextjs/config`**
- **Issue:** na 10.76.2 o export da raiz `@sentry/nextjs` é um shim deprecado; `AGENTS.md` manda seguir avisos de deprecação.
- **Fix:** `import { withSentryConfig } from "@sentry/nextjs/config"` (mesmo código, sem o aviso).
- **Committed in:** `faa9284`

**6. [Rule 2 - Decisão de segurança] SDK só inicia com DSN**
- **Issue:** o plano manda `register()` chamar `Sentry.init` e diz que "o SDK sem DSN não envia nada". Iniciar sem DSN ainda instalaria a instrumentação de Node/OpenTelemetry no servidor (e os handlers no navegador) em todo ambiente sem monitoramento, contra "a web roda como hoje".
- **Fix:** `register()` e `instrumentation-client.ts` só chamam `Sentry.init` com DSN não vazio; `onRequestError` sem SDK iniciado é um no-op.
- **Committed in:** `875dbbd`

**7. [Rule 3 - Blocking] Instalação commitada separada**
- O pacote precisa estar no `node_modules` antes de `tsc`/build; a instalação foi commitada sozinha (`dc40446`), antes do RED.

**8. [Escopo acrescentado] Teste de `global-error` e `apps/web/CONTEXT.md`**
- Não estavam em `files_modified`. O teste (`global-error.test.tsx`) cobre captura única, texto fixo sem `message`/`digest`/segredo e o botão; o `CONTEXT.md` da web documenta a camada, como o da api fez em 09-13.

---

**Total deviations:** 8 (5 Rule 2, 1 Rule 1, 1 Rule 3, 1 escopo acrescentado). **Impact:** todas reforçam o que o plano pede (nada de corpo, cabeçalho, cookie, query ou segredo no evento; build sem rede); nenhum aumento de superfície de ataque.

## Issues Encountered

- A primeira sonda com o SDK real usou um DSN com hífen na chave (`chave-falsa`), que o SDK recusa ("Invalid Sentry Dsn") e por isso não enviava nada. Troquei por `chavefalsa` (também no teste, por forma válida). Em seguida a sonda achou o furo das tags (desvio 4).
- Na sonda, os campos de código-fonte ao redor de cada frame (`context_line`, padrão 5 linhas) continuam no evento, como em 09-13: é código, não dado de requisição.
- O servidor do Next, ao iniciar o SDK, lista dezenas de integrações de auto-instrumentação (Express, Postgres, Prisma, etc.). Só atuam se o módulo correspondente for carregado; tracing está desligado (`tracesSampleRate: 0`).
- Fora do escopo, registrado: `npm run lint` da web tem 3 avisos antigos (`rotulos.ts`, `app-shell.tsx`), nenhum em arquivo deste plano. O npm avisou `EBADENGINE` de `jsdom` (antigo).

## Verificação

- `cd apps/web && npx vitest run src/features/observabilidade/limpar-evento.test.ts`: 13 de 13. `src/app/global-error.test.tsx`: 3 de 3.
- Suíte inteira da web: **69 arquivos, 592 testes verdes**.
- `npm run typecheck` (web): limpo. `npm run lint` (web): 0 erros, 3 avisos antigos fora do plano. `npm run verificar:tokens`: 445 definidos, 372 arquivos, 0 falhas.
- `npm run build -w @n1/web` e `npm run build` (raiz): exit 0, "Compiled successfully", sem DSN nem token. Repetido sob `sandbox-exec` com a saída de rede negada (exceto localhost; a regra foi provada bloqueando um `fetch` ao registry): exit 0.
- Critérios de aceitação: versão igual nas duas pontas (10.76.2); `grep -c "@n1/dominio/url-segura"` = 1; `grep -c captureException global-error.tsx` = 1; `grep -c withSentryConfig next.config.ts` = 3 (import, uso e o comentário); `grep -c "telemetry: false"` = 1; `^NEXT_PUBLIC_SENTRY_DSN=` = 1 e `^SENTRY_DSN=` = 1.
- Nenhum processo meu ficou rodando (sem servidor de desenvolvimento; só comandos de uma vez). Nenhum DSN real nem realista em arquivo commitado (DSN falso `.invalid` só em teste).

## Pendente para a verificação da fase (sem navegador aqui)

- Aparência de `global-error.tsx` (grade de pontos, painel sólido, ícone, `py-12`, botão neutro de 44px no mobile, pilha de fonte do sistema sem `next/font`). Para ver: forçar um erro no root layout em desenvolvimento (desde o Next 15.2 o `global-error` também aparece em `dev`).
- Um erro real chegando ao Sentry com DSN e a regra de alerta: 09-19.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além da prevista no `threat_model` (T-09-82 a T-09-85, T-09-SC). T-09-85: a versão é a mesma nas duas pontas, comparada por `node -e`.

## User Setup Required

Nenhum neste plano. Os DSNs de Production e Preview (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`) na Vercel e a regra de alerta são do dono em 09-19. Opcional: `SENTRYCLI_SKIP_DOWNLOAD=1` na Vercel (ver "O que a instalação trouxe").

## Next Phase Readiness

- Web e api têm Sentry na mesma versão exata (10.76.2). Faltam o DSN e o alerta por e-mail (09-19) e a remoção da rota de erro de prova da api (09-22).
- `NEXT_PUBLIC_SENTRY_DSN` é lido em tempo de build: trocá-lo na Vercel exige novo deploy.

## Self-Check: PASSED

- Arquivos: `limpar-evento.ts`, `limpar-evento.test.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `global-error.tsx`, `global-error.test.tsx` e este SUMMARY existem.
- Commits (`dc40446`, `7bba37d`, `875dbbd`, `f7d0208`, `faa9284`, `023a137`) são ancestrais do HEAD.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
