---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 01
subsystem: testing
tags: [playwright, vitest, node:http, e2e, fault-injection, clock-injection]

# Dependency graph
requires: []
provides:
  - "apps/web/playwright.config.ts + apps/web/e2e/fumaca.spec.ts — E2E contra o build de produção (npm run build && npm run start), nunca next dev, porta configurável por E2E_PORT (default 3011)"
  - "apps/api/src/testes/servidor-falso.ts (criarServidorFalso) — servidor node:http real em porta efêmera com fila FIFO de RespostaProgramada (ok, atraso, respostaPerdida, timeout)"
  - "apps/api/src/testes/relogio.ts (relogioFixo, relogioDoSistema) — Relogio injetável com avancar(ms)/definir(instante)"
affects: [02-10 (outbox), 02-17 (fila), 02-24 (fallback de 90 dias), toda jornada de navegador da Fase 2]

# Tech tracking
tech-stack:
  added: ["@playwright/test@1.63.0 (devDependency de @n1/web, pinned exato — T-02-SC aprovado)"]
  patterns:
    - "E2E sempre contra next build + next start, nunca next dev/watch (V02-02D)"
    - "Fake server é um node:http real, nunca mock de fetch — prova erro de transporte de verdade"
    - "Relogio injetado por parâmetro/opção, nunca new Date() direto nem variável global"

key-files:
  created:
    - apps/web/playwright.config.ts
    - apps/web/e2e/fumaca.spec.ts
    - apps/web/e2e/CONTEXT.md
    - apps/api/src/testes/servidor-falso.ts
    - apps/api/src/testes/servidor-falso.test.ts
    - apps/api/src/testes/relogio.ts
    - apps/api/src/testes/relogio.test.ts
    - apps/api/src/testes/CONTEXT.md
  modified:
    - apps/web/package.json (script test:e2e; @playwright/test 1.63.0)
    - apps/web/src/app/entrar/page.tsx (Suspense em torno de useSearchParams — Rule 3)
    - .gitignore (playwright-report/, test-results/, /apps/web/.playwright/)
    - package-lock.json

key-decisions:
  - "T-02-SC: checkpoint humano bloqueante aprovou @playwright/test 1.63.0 (microsoft/playwright oficial no npm) antes de qualquer npm install desta fase — resumo abaixo"
  - "Porta do webServer/baseURL parametrizada por E2E_PORT (default 3011, o valor do plano) para não colidir com outro processo já ocupando a porta fixa na máquina de quem roda"

patterns-established:
  - "Toda rota nova de apps/web que usa useSearchParams() precisa de <Suspense> acima dela, inclusive fora do grupo (shell) — só o build de produção pega isso"

requirements-completed: [SOL-02, SOL-05, SOL-08]

# Metrics
duration: ~25min
completed: 2026-09-21
---

# Phase 02 Plan 01: Wave 0 do harness de testes (Playwright + servidor HTTP falso + relógio injetável) Summary

**Harness de testes que a Fase 2 (outbox, fila, fallback de 90 dias) precisa: Playwright contra o build de produção do `apps/web`, um servidor `node:http` real e controlável em `apps/api`, e um relógio injetável — nenhum dos três existia antes deste plano.**

## Performance

- **Duration:** ~25 min (continuação após checkpoint humano já resolvido pelo orquestrador)
- **Started:** 2026-09-21T14:00:00Z (aprox., início da execução desta continuação)
- **Completed:** 2026-09-21T14:11:52-03:00
- **Tasks:** 3/3 (Task 1 checkpoint sem arquivo, Tasks 2 e 3 com commit)
- **Files modified:** 12 (7 novos + 4 modificados + package-lock.json)

## Accomplishments

- Task 1 (T-02-SC): portão humano de legitimidade de `@playwright/test` resolvido pelo orquestrador antes desta execução — ver seção "Task 1" abaixo.
- `apps/web/playwright.config.ts` + `e2e/fumaca.spec.ts`: um comando único (`npm run test:e2e` / `npx playwright test`) builda o `apps/web`, sobe `next start` e prova por um Chromium real que `/entrar` responde com o `h1` esperado — o gate V02-02D de `02-VALIDATION.md` deixa de estar `❌ W0`.
- `apps/api/src/testes/servidor-falso.ts`: `criarServidorFalso()` sobre `node:http` numa porta efêmera, fila FIFO de `RespostaProgramada` com os quatro `kind` do Fault-Injection Matrix (`ok`, `atraso`, `respostaPerdida`, `timeout`); fila vazia falha alto (500 `SEM_RESPOSTA_PROGRAMADA`) em vez de passar por acidente.
- `apps/api/src/testes/relogio.ts`: `relogioFixo`/`relogioDoSistema` — a fonte de instante injetável que os planos 02-10/02-17/02-24 vão usar para cobrir a janela de 90 dias e o backoff do outbox sem esperar tempo real.

## Task Commits

1. **Task 1: Portão de legitimidade de `@playwright/test` (T-02-SC)** — sem commit (nenhuma edição de arquivo, por desenho da task). Ver "Task 1" abaixo.
2. **Task 2: Playwright em `apps/web` contra o build de produção** - `67b8ddd` (feat)
3. **Task 3: Servidor HTTP falso e relógio injetável em `apps/api`** - `503fa2f` (feat)

**Plan metadata:** commit final desta execução (docs), ver STATE.md/ROADMAP.md — orquestrador aplica.

## Task 1 — T-02-SC (checkpoint resolvido antes desta execução)

Um executor anterior parou aqui sem commitar nada (worktree descartado). O orquestrador obteve a decisão humana e a verificou de forma independente contra o registro npm antes de despachar esta continuação:

- **Pacote:** `@playwright/test`
- **Versão aprovada:** `1.63.0`
- **Publicador:** `microsoft` (`microsoft-oss-releases`, `microsoft1es`, `dgozman-ms`)
- **Repositório:** `git+https://github.com/microsoft/playwright.git`
- **Homepage:** `https://playwright.dev`
- **Sinal de retomada:** `aprovado 1.63.0`

`npm install -D @playwright/test@1.63.0 -w @n1/web` instalado com pin exato (sem `^`) em `apps/web/package.json` e `package-lock.json` — nenhum outro pacote novo entrou. `npx playwright install chromium` baixou só o Chromium, como pedido.

## Files Created/Modified

- `apps/web/playwright.config.ts` — `testDir: "./e2e"`, `fullyParallel: false`, `forbidOnly: true`, `retries: 0`, `reporter: "list"`, `webServer` roda `npm run build && npm run start -- -p <porta>` (nunca `next dev`/`--watch`), `reuseExistingServer: !process.env.CI`
- `apps/web/e2e/fumaca.spec.ts` — abre `/entrar`, afirma `h1` = "N1 Digital"
- `apps/web/e2e/CONTEXT.md` — por que produção e não `next dev`; regra de não depender de dado real
- `apps/web/package.json` — script `test:e2e`; `@playwright/test: "1.63.0"` (devDependency)
- `apps/web/src/app/entrar/page.tsx` — `FormularioDeEntrada` isolado dentro de `<Suspense>`; `EntrarPage` (default export) só monta a fronteira
- `.gitignore` — `playwright-report/`, `test-results/`, `/apps/web/.playwright/`
- `apps/api/src/testes/servidor-falso.ts` — `criarServidorFalso`, tipos `ServidorFalso`/`RespostaProgramada`/`RequisicaoRecebida`
- `apps/api/src/testes/servidor-falso.test.ts` — 5 casos (ok, respostaPerdida, atraso+abort, fila vazia, ordem de `recebidas`)
- `apps/api/src/testes/relogio.ts` — `Relogio`, `RelogioFixo`, `relogioFixo`, `relogioDoSistema`
- `apps/api/src/testes/relogio.test.ts` — 3 casos (instante dado, `avancar` exato, `definir` substitui)
- `apps/api/src/testes/CONTEXT.md` — harness não vaza para produção; servidor real, não mock de `fetch`; `Relogio` sempre injetado

## Decisions Made

- **Porta configurável por `E2E_PORT`** (default `3011`, igual ao plano): a máquina onde esta execução rodou já tinha um processo Node não relacionado (Mastra Studio, de outro repositório) escutando em `:3011`; hardcodar o literal do plano teria feito a verificação reaproveitar silenciosamente o servidor errado (`reuseExistingServer` só olha se a URL responde, não se é o `apps/web`). Parametrizar por env var com o mesmo default preserva o comportamento do plano em qualquer máquina limpa e evita esse falso-positivo aqui. Ver "Issues Encountered".
- **`Relogio.agora()`/`agoraIso()` devolvem uma cópia** (`new Date(atual.getTime())`), nunca a referência interna — evita que quem chama mute o relógio por fora de `avancar`/`definir`.
- **`fechar()` chama `servidor.closeAllConnections()` antes de `close()`** — sem isso, um teste que usa `kind: "timeout"` deixaria um socket aberto para sempre e `close()` nunca resolveria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `/entrar` sem `<Suspense>` em volta de `useSearchParams()` — `next build` recusava a página**
- **Found during:** Task 2 (Playwright contra o build de produção)
- **Issue:** `apps/web/src/app/entrar/page.tsx` chamava `useSearchParams()` direto no componente default, sem fronteira `<Suspense>` acima. Em `next dev` isso nunca aparece (a árvore cliente só deixa de hidratar em silêncio); em `next build`, o Next 16 recusa a página inteira (`useSearchParams() should be wrapped in a suspense boundary`) — e como nenhum comando de produção tinha rodado contra este monorepo antes deste plano (é literalmente o que V02-02D descreve como ausente), o bug nunca tinha sido descoberto.
- **Fix:** Extraído o corpo da tela para `FormularioDeEntrada` (função interna, mesmo JSX, sem nenhuma mudança visual ou de comportamento); `EntrarPage` (export default) agora só monta `<Suspense><FormularioDeEntrada /></Suspense>`. Mesmo padrão que o comentário de `(shell)/layout.tsx` já documentava para as telas internas — só não tinha chegado em `/entrar` porque essa rota fica fora do grupo `(shell)`.
- **Files modified:** `apps/web/src/app/entrar/page.tsx`
- **Verification:** `npm run build -w @n1/web` (antes: falha em "/entrar"; depois: as 37 rotas geram sem erro); `npx playwright test` passa; `npm run check` verde nos três workspaces.
- **Committed in:** `67b8ddd` (Task 2 commit)

**2. [Rule 3 - Blocking] Ambiente sem `apps/web/.env.local` real — `next build`/`next start` derrubariam `proxy.ts` em toda requisição**
- **Found during:** Task 2, verificação do harness
- **Issue:** `apps/web/src/proxy.ts` (middleware) constrói um `createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)` incondicionalmente em toda requisição, inclusive `/entrar`. Esta worktree é um checkout novo — `.env.local` é ignorado pelo git (`.env*` no `.gitignore`, só `.env.local.example` versionado) e não existe aqui, então a variável chega `undefined` e o cliente Supabase lança na hora.
- **Fix:** Criado `apps/web/.env.local` **local a esta worktree**, com valores placeholder (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`) — confirmado coberto por `.gitignore` (`git check-ignore -v` aponta o padrão `.env*`) antes de escrever, e nunca staged nem commitado. Nenhuma mudança de código: `playwright.config.ts` não injeta nada — em qualquer checkout com um `.env.local` real (o caso normal fora desta worktree efêmera), o `next build`/`next start` já carrega esses valores sozinho, como sempre carregou.
- **Files modified:** nenhum arquivo versionado; `apps/web/.env.local` (gitignored, não commitado, só existe nesta worktree)
- **Verification:** `git status --short` nunca mostrou o arquivo; `git check-ignore -v apps/web/.env.local` confirma o padrão antes da escrita.
- **Committed in:** N/A — arquivo intencionalmente fora do controle de versão

---

**Total deviations:** 2 auto-fixed (ambos Rule 3 — bloqueantes para completar a Task 2, nenhum arquitetural)
**Impact on plan:** O fix em `page.tsx` é necessário para qualquer comando de produção deste monorepo funcionar daqui para frente, não só para este plano — sem ele, `npm run build` da raiz também falharia. Sem escopo além do que a Task 2 já pedia (provar o harness de produção).

## Issues Encountered

- **Porta 3011 ocupada por um processo alheio (Mastra Studio) na máquina de execução:** rodar `npm run test:e2e -w @n1/web` (ou `npx playwright test` sem `E2E_PORT`) aqui reaproveita silenciosamente esse servidor errado via `reuseExistingServer` e falha por não achar o `h1` — não é um bug do harness. Confirmado rodando com `E2E_PORT=3897 npx playwright test --reporter=list` dentro de `apps/web`: 1 passed. Em qualquer máquina/CI sem algo já escutando em `:3011`, o comando padrão (sem `E2E_PORT`) funciona como o plano descreve.

## Next Phase Readiness

- V02-02D, V02-05B e V02-08B (as três lacunas de Wave 0 de `02-VALIDATION.md`) fechadas: os planos de outbox (02-10), fila (02-17) e fallback de 90 dias (02-24) têm onde injetar timeout, resposta perdida, 429/503 e passagem de tempo.
- Nenhum bloqueio conhecido para o próximo plano da Fase 2.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: apps/web/playwright.config.ts
- FOUND: apps/web/e2e/fumaca.spec.ts
- FOUND: apps/web/e2e/CONTEXT.md
- FOUND: apps/api/src/testes/servidor-falso.ts
- FOUND: apps/api/src/testes/servidor-falso.test.ts
- FOUND: apps/api/src/testes/relogio.ts
- FOUND: apps/api/src/testes/relogio.test.ts
- FOUND: apps/api/src/testes/CONTEXT.md
- FOUND commit: 67b8ddd (Task 2)
- FOUND commit: 503fa2f (Task 3)
