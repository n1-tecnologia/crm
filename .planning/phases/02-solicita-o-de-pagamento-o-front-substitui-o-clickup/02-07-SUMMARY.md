---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 07
subsystem: testing
tags: [express, node-test, node-http, fault-injection, financeiro-tria, automation, wave-0]

# Dependency graph
requires: []
provides:
  - "criarRouter(deps) em ../financeiro-tria/automation/src/http/routes.ts — factory do Express Router injetável por tenant/service, extraída de automationRouter() sem mudar comportamento"
  - "criarAppDeTeste(deps) em src/testing/criar-app.ts — Express de teste em porta efêmera, sem listen() fixo, sem supertest"
  - "criarServidorFalso() em src/testing/servidor-falso.ts — node:http real com os 4 kinds (ok, atraso, respostaPerdida, timeout)"
  - "criarOmieFalso() em src/testing/omie-falso.ts — consultar/incluir/incluirComConexaoCaida sobre Map em memória, prova o invariante V02-CUT"
  - "Relogio/relogioDoSistema/relogioFixo(inicial).avancar(ms) em src/testing/relogio.ts"
  - "runner do pacote confirmado por escrito: tsx --test sobre \"src/**/*.test.ts\" (glob entre aspas — ver achado de bug abaixo)"
affects: ["02-17 (fila persistente)", "02-21 (webhooks)", "02-27 (paridade Omie)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Router Express extraído para função pura que recebe deps por parâmetro (criarRouter), em vez de importar serviços reais no topo do módulo — o composition root real (automationRouter) e o de teste (criarAppDeTeste) convergem no mesmo ponto de montagem"
    - "Servidor de fault-injection é node:http real em porta efêmera, nunca mock de fetch — mesma pilha de rede do código de produção"
    - "package.json test script com glob de teste sempre entre aspas quando o `**` precisa alcançar mais de um nível de profundidade sob um /bin/sh não-bash"

key-files:
  created:
    - "../financeiro-tria/automation/src/testing/criar-app.ts"
    - "../financeiro-tria/automation/src/testing/servidor-falso.ts"
    - "../financeiro-tria/automation/src/testing/servidor-falso.test.ts"
    - "../financeiro-tria/automation/src/testing/omie-falso.ts"
    - "../financeiro-tria/automation/src/testing/relogio.ts"
    - "../financeiro-tria/automation/src/testing/CONTEXT.md"
    - ".planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/deferred-items.md"
  modified:
    - "../financeiro-tria/automation/package.json"
    - "../financeiro-tria/automation/src/http/routes.ts"

key-decisions:
  - "criarRouter(deps) monta só as rotas de webhook de UM tenant (mountTenantWebhooks), sem os endpoints de gestão de runs — automationRouter() passa a chamar criarRouter() em loop para cada tenant real, preservando byte a byte as mesmas rotas e prefixos; endpoints de /automation/runs continuam montados só uma vez em automationRouter() para não quebrar o roteamento por ?tenant= do pickService"
  - "PaymentService (antes um type interno não-exportado) virou export — os fakes de teste e criar-app.ts tipam contra a mesma forma estrutural que os três serviços reais já satisfazem, sem duplicar a interface"
  - "chamadas[] do Omie falso conta só inclusões (incluir/incluirComConexaoCaida), nunca consultar — é o contador que prova quantas inclusões aconteceram de fato, não quantas leituras"

patterns-established:
  - "Pattern: extrair router/factory testável de um módulo Express existente sem tocar em handler, rota ou texto de resposta — só mover a montagem para uma função que recebe deps"
  - "Pattern: glob de teste em package.json SEMPRE entre aspas quando o runner é invocado via npm script (sh não-bash) e mais de um *.test.ts pode existir em profundidades diferentes sob src/"

requirements-completed: [SOL-05]

duration: 40min
completed: 2026-09-21
---

# Phase 02 Plan 07: Wave 0 de testes do financeiro-tria Summary

**Fábrica de Router injetável, Express de teste sem porta fixa, servidor HTTP falso com 4 modos de falha e Omie falso — mais um bug real de glob no `package.json` do pacote irmão, achado e corrigido no processo.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-21T13:48:20Z
- **Tasks:** 3
- **Files modified/created:** 9 (8 no `financeiro-tria`, 1 em `crm-n1`)

## Accomplishments

- `automation/src/http/routes.ts` exporta `criarRouter(deps: { service; tenantId })`, extraído de `automationRouter()` sem alterar nenhuma rota, handler ou texto de resposta (`automationRouter()` agora chama `criarRouter()` em loop, comportamento idêntico).
- `automation/src/testing/criar-app.ts` monta o Express de teste com o router real injetado, `http.createServer(app).listen(0)`, expõe `{ app, url, fechar() }` — sem `supertest`.
- `automation/src/testing/servidor-falso.ts`: `node:http` real em porta efêmera com os 4 `kind` (`ok`, `atraso`, `respostaPerdida`, `timeout`) que a fila persistente do Plan 02-17 precisa provar; fila vazia responde 500 `SEM_RESPOSTA_PROGRAMADA`.
- `automation/src/testing/omie-falso.ts`: `consultar`/`incluir`/`incluirComConexaoCaida` sobre um `Map` em memória por `codigo_lancamento_integracao` — prova o invariante de V02-CUT (Omie inclui e a conexão cai; uma consulta posterior encontra o código; não reinclui).
- `automation/src/testing/relogio.ts`: `Relogio`, `relogioDoSistema`, `relogioFixo(inicial)` com `avancar(ms)`.
- `automation/src/testing/servidor-falso.test.ts`: 6 casos novos, todos verdes.
- `automation/src/testing/CONTEXT.md`: registra o que mora na pasta, o runner confirmado, por que HTTP real (não mock de `fetch`), a regra de convivência com o worktree sujo (89 arquivos de frontend pré-existentes) e o par simétrico em `crm-n1/apps/api/`.
- **Achado real:** `npm test` do pacote (`tsx --test src/**/*.test.ts`, sem aspas) perde silenciosamente arquivos de teste 2+ níveis abaixo de `src/` assim que existe mais de um `*.test.ts` em profundidades diferentes — o `sh` que o `npm run` invoca expande `**` como um único nível de diretório (não recursivo), então uma vez que o glob "casa" com o arquivo mais raso (`src/testing/servidor-falso.test.ts`), o Node nunca vê o argumento não-expandido e nunca aplica sua própria resolução recursiva. Corrigido citando o glob no `package.json` — exatamente a correção que o próprio Plan 02-07 já previa como condicional ("se o glob não alcançar subpastas..."). Confirmado: com o glob entre aspas, `npm test` roda os 6 casos novos + o `payment-rules.test.ts` pré-existente (13 testes totais).

## Task Commits

Todos os commits abaixo são no repositório `financeiro-tria` (sibling repo) — `crm-n1` não teve mudança de código neste plano.

1. **Task 1: Confirmar o runner e extrair a fábrica do app Express** - `adac887` (feat) — `package.json` (glob entre aspas), `routes.ts` (`criarRouter` + `PaymentService` exportado), `src/testing/criar-app.ts`
2. **Task 2: Servidor HTTP falso, Omie falso e relógio injetável** - `dc53ae5` (test) — `servidor-falso.ts`, `servidor-falso.test.ts`, `omie-falso.ts`, `relogio.ts`
3. **Task 3: `CONTEXT.md` da pasta de testes e disciplina do worktree** - `3461f13` (docs) — `src/testing/CONTEXT.md`

**Plan metadata:** commit deste SUMMARY (`crm-n1`) — ver final_commit abaixo.

## Files Created/Modified

- `../financeiro-tria/automation/src/http/routes.ts` - extrai `criarRouter(deps)`; exporta `PaymentService`; `automationRouter()` reescrito para chamar `criarRouter()` (mesmo comportamento)
- `../financeiro-tria/automation/package.json` - script `test` com o glob entre aspas + `--test-concurrency=1`
- `../financeiro-tria/automation/src/testing/criar-app.ts` - `criarAppDeTeste(deps)`, Express + `http.createServer().listen(0)`
- `../financeiro-tria/automation/src/testing/servidor-falso.ts` - `criarServidorFalso()`, 4 `kind` de resposta programável
- `../financeiro-tria/automation/src/testing/servidor-falso.test.ts` - 6 casos node:test
- `../financeiro-tria/automation/src/testing/omie-falso.ts` - `criarOmieFalso()`, idempotência do Omie
- `../financeiro-tria/automation/src/testing/relogio.ts` - `Relogio`, `relogioDoSistema`, `relogioFixo`
- `../financeiro-tria/automation/src/testing/CONTEXT.md` - documentação da pasta
- `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/deferred-items.md` - item pré-existente fora de escopo (ver abaixo)

## Decisions Made

- `criarRouter` monta só webhooks de um tenant (não os endpoints de gestão de runs) — ver `key-decisions` no frontmatter para o porquê (preservar o roteamento por `?tenant=` do `pickService`).
- `PaymentService` exportado de `routes.ts` em vez de duplicar a interface estrutural em `src/testing/`.
- `chamadas[]` do Omie falso conta só inclusões, não consultas — para o teste de idempotência (`chamadas.length === 1` após 1 inclusão-com-queda + N consultas) fazer sentido.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` do `automation/` ausente — `npm install` a partir do lockfile existente**
- **Found during:** Task 1 (baseline `npm run build && npm test` antes de qualquer edição)
- **Issue:** `tsx: command not found` — o pacote nunca tinha sido instalado neste checkout.
- **Fix:** `npm install` dentro de `automation/`, sem adicionar nenhuma dependência nova (respeitou `package-lock.json` existente; `git status` confirma `automation/package-lock.json` sem diff).
- **Files modified:** nenhum arquivo rastreado (só `node_modules/`, ignorado)
- **Verification:** `npm run build` e `npm test` passaram a rodar.
- **Committed in:** n/a (nada para commitar — instalação local)

**2. [Rule 3 - Blocking, pré-autorizado pelo próprio texto do plano] Glob do script `test` sem aspas perdia arquivos de teste em profundidades diferentes**
- **Found during:** Task 2 (depois de criar `servidor-falso.test.ts` ao lado de `criar-app.ts`, `npm test` parou de rodar `payment-rules.test.ts`)
- **Issue:** `tsx --test src/**/*.test.ts` sem aspas é expandido pelo `sh` do `npm run` (globbing não-recursivo, `**` = um nível) antes do Node ver o argumento. Com só um `*.test.ts` no pacote (o caso antes deste plano) o `sh` não expandia (sem match) e o Node recebia a string crua, fazendo sua própria resolução recursiva por baixo dos panos — mascarando o bug. Assim que um segundo `*.test.ts` existiu em profundidade diferente (`src/testing/` vs `src/tenants/tria/`), o `sh` conseguiu expandir para UM arquivo e o Node nunca viu o glob — o outro arquivo de teste silenciosamente parou de rodar, sem erro.
- **Fix:** `package.json`: `"test": "tsx --test --test-concurrency=1 \"src/**/*.test.ts\""` — exatamente a mudança que o Plan 02-07 já autorizava condicionalmente ("Se o glob... não alcançar subpastas... ajustar o script").
- **Files modified:** `../financeiro-tria/automation/package.json`
- **Verification:** `npm test` volta a rodar os 13 testes (6 novos + 7 de `payment-rules.test.ts`), confirmado com `sh -c 'echo src/**/*.test.ts'` em sandbox controlado reproduzindo o mesmo comportamento.
- **Committed in:** `adac887` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking, Rule 3; nenhuma instalação de pacote novo — exclusão de Rule 3 não se aplica)
**Impact on plan:** Ambas essenciais para o pacote sequer rodar teste algum. A segunda é um achado genuíno — sem ela, qualquer segundo arquivo de teste no pacote (incluindo os deste próprio plano) faria arquivos existentes pararem de rodar em silêncio, sem quebrar o exit code.

## Issues Encountered

- Teste pré-existente `resolve responsavel por centro de custo com fallback` (`payment-rules.test.ts`) falha na baseline (confirmado com `node_modules` limpo, antes de qualquer edição deste plano) — `resolveResponsible("centro desconhecido").nome` devolve `"Elifas"` em vez de casar `/FINQ/i`, aparentemente por `CLICKUP_RESPONSAVEL_TRIA_NOME` no `.env` local desta máquina. Fora do escopo deste plano (não é Wave 0 de teste, não está em `files_modified`) — documentado em `deferred-items.md`, não corrigido, conforme SCOPE BOUNDARY.

## Known Stubs

Nenhum — este plano só cria infraestrutura de teste, sem UI nem dado exibido.

## Threat Flags

Nenhum novo — as rotas e handlers de produção não mudaram (mesmo texto de resposta, mesma lógica); `criarRouter` é extração pura. O grep do critério de aceite (`from "../testing/"` / `from "./testing/"` fora de `*.test.ts`) confirma que nenhum arquivo de produção importa o harness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Planos 02-17 (fila persistente), 02-21 (webhooks) e 02-27 (paridade Omie) têm a partir de agora `criarAppDeTeste`, `criarServidorFalso`, `criarOmieFalso` e `relogioFixo` disponíveis em `../financeiro-tria/automation/src/testing/` para injetar falha sem mock de `fetch`.
- O worktree do `financeiro-tria` permanece com exatamente os mesmos 89 arquivos de frontend modificados de antes deste plano — nada foi formatado, limpo ou revertido (verificado por `git status --short | wc -l` antes/depois).
- Pendência não-bloqueante: o teste pré-existente `resolve responsavel por centro de custo com fallback` continua vermelho (ver `deferred-items.md`) — não impede nenhum plano futuro, mas quem tocar `payment-rules.ts`/`payment-rules.test.ts` deve resolver antes de assumir `npm test` verde por completo no pacote.

## Self-Check: PASSED

- FOUND: `../financeiro-tria/automation/src/testing/criar-app.ts`
- FOUND: `../financeiro-tria/automation/src/testing/servidor-falso.ts`
- FOUND: `../financeiro-tria/automation/src/testing/servidor-falso.test.ts`
- FOUND: `../financeiro-tria/automation/src/testing/omie-falso.ts`
- FOUND: `../financeiro-tria/automation/src/testing/relogio.ts`
- FOUND: `../financeiro-tria/automation/src/testing/CONTEXT.md`
- FOUND: `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/deferred-items.md`
- FOUND commit `adac887` (financeiro-tria)
- FOUND commit `dc53ae5` (financeiro-tria)
- FOUND commit `3461f13` (financeiro-tria)

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*
