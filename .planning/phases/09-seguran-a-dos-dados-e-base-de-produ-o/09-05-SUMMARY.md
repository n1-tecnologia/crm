---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 05
subsystem: infra
tags: [fastify, pino, redact, logging, secrets, dominio]

requires:
  - phase: 09-01
    provides: "apps/api autenticado, job de seguranca e a base do boot que 09-05 ajusta"
provides:
  - "mascararSegredoDeUrl em @n1/dominio/url-segura: funcao pura que tira o segredo de /v1/public/forms|tasks/<s>, /f/<s> e /p/<s>"
  - "opcoesDoLogger em apps/api/src/observabilidade/log.ts: level por LOG_LEVEL, redact com [oculto], serializer de req com URL mascarada, stream opcional"
  - "index.ts sobe com buildApp({ logger: opcoesDoLogger() }); OpcoesDoApp.logger aceita o objeto de opcoes"
affects: [09-06, 09-13, 09-16, observabilidade, deploy]

actuals:
  tokens: 5500
  tasks: 2
  commits: 4
plan_head_before: 4aec7b728c990705769fdb199310fee4d6bfce2a
plan_head_after: 2215fae08a40c3fdc6eae5a9d674868e9aa616d6

tech-stack:
  added: []
  patterns:
    - "Regra de mascara de URL unica no dominio, importada por log (api) e Sentry (api e web)"
    - "Prova de log por fluxo em memoria: logger com destino injetado, rotas com lerEstado falso, sem banco e sem .env"

key-files:
  created:
    - packages/dominio/src/url-segura.ts
    - packages/dominio/src/url-segura.test.ts
    - apps/api/src/observabilidade/log.ts
    - apps/api/src/observabilidade/log.test.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/index.ts
    - apps/api/src/observabilidade/CONTEXT.md

key-decisions:
  - "Cada campo secreto do redact entra duas vezes (topo e *.campo): o curinga *.token do pino nao casa o topo do objeto logado, e o teste de objeto logado direto provou a lacuna do desenho original"
  - "O serializador de req recebe a FastifyRequest no Fastify 5 e usa req.host (nao hostname)"
  - "O RED de cada tarefa usa um esqueleto identidade/sem mascara para falhar por assercao e nao por modulo ausente"

patterns-established:
  - "mascararSegredoDeUrl: /f/ e /p/ so mascaram no comeco do caminho (inicio ou apos esquema://host), nunca em /financeiro/f/abc"

requirements-completed: [SEG-06]

coverage:
  - id: D1
    description: "mascararSegredoDeUrl no dominio mascara formularios, tarefas, /f/ e /p/, preserva query e deixa o resto intacto"
    requirement: SEG-06
    verification:
      - kind: unit
        ref: "packages/dominio/src/url-segura.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "O log do apps/api nao grava segredo de link publico, Authorization nem campos segredo/secret/token/senha, provado por fluxo em memoria"
    requirement: SEG-06
    verification:
      - kind: integration
        ref: "apps/api/src/observabilidade/log.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "O boot do apps/api usa opcoesDoLogger() com LOG_LEVEL lido do ambiente"
    requirement: SEG-06
    verification:
      - kind: other
        ref: "grep -c 'opcoesDoLogger()' apps/api/src/index.ts = 1; npx tsc --noEmit em apps/api"
        status: pass
    human_judgment: true
    rationale: "O boot real (processo no VPS escrevendo no journald) nao e exercitado por teste automatizado; a linha de entrada real so se confere subindo o servico"

duration: 12min
completed: 2026-10-22
status: complete
---

# Phase 9 Plan 05: Log sem segredo Summary

**Segredo de link e tokens fora do log do apps/api: mascararSegredoDeUrl no dominio (regra unica para api e web) e opcoesDoLogger com redact "[oculto]" e URL mascarada, provados por fluxo em memoria sem banco**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-10-22
- **Tasks:** 2 (ambas TDD)
- **Files modified:** 7 (4 novos, 3 alterados)

## Accomplishments
- `mascararSegredoDeUrl` (domínio, sem import): troca por `***` o segmento depois de `/v1/public/forms/` e `/v1/public/tasks/` em todas as ocorrências e o primeiro segmento de `/f/` e `/p/` quando são o começo do caminho; query e resto do caminho intactos.
- `opcoesDoLogger(env, destino?)`: `level` de `LOG_LEVEL` (padrão `info`), `redact` de `req.headers.authorization`, `req.headers.cookie` e `segredo`/`secret`/`token`/`senha` com censura `[oculto]`, serializador de `req` com a URL mascarada.
- `index.ts` troca `logger: true` por `opcoesDoLogger()`; `OpcoesDoApp.logger` aceita `boolean | FastifyServerOptions["logger"]`; testes seguem com `logger: false`.
- `GET`/`POST` em `/v1/public/forms/<s>` e `GET /v1/public/tasks/<s>` não deixam o segredo em linha alguma; a linha de entrada mostra `/v1/public/forms/***`.

## TDD Gate Compliance

Os dois ciclos tem RED -> GREEN; nenhum REFACTOR foi necessario.

- **Task 1** RED `f3afc83` (`test(09-05)`) -> GREEN `fc855e3` (`feat(09-05)`). RED: 6 dos 7 testes falharam por assercao (`expected '/v1/public/forms/abc123' to be '/v1/public/forms/***'` e equivalentes); o setimo (URLs sem segredo voltam como vieram) passou por ser o caso identidade. Primeira execucao falhou por modulo ausente (load failure, nao RED valido), entao o RED foi refeito com um esqueleto identidade em `url-segura.ts`. Avaliacao semantica: o teste alvo executou e falhou na assercao planejada pelo motivo certo.
- **Task 2** RED `ca576f5` (`test(09-05)`) -> GREEN `2215fae` (`feat(09-05)`). RED: 3 dos 4 testes falharam por assercao (segredo presente na linha, `[oculto]` ausente, `expected 'info' to be 'warn'`) com um esqueleto de `opcoesDoLogger` sem mascara. O teste do `Authorization: Bearer` passou ja no RED porque o serializador padrao do Fastify nao inclui cabecalhos: fica como guarda de regressao, e o `redact` de cabecalhos e coberto pelo terceiro teste (`req.headers.authorization`/`cookie` num objeto logado).
- `workflow.tdd_mode` esta `false` neste projeto; o `gsd check tdd-red-evidence` nao foi executado, a conferencia foi leitura direta da saida do vitest.

## Task Commits

1. **Task 1: mascararSegredoDeUrl no dominio** - `f3afc83` (test, RED), `fc855e3` (feat, GREEN)
2. **Task 2: opcoesDoLogger e boot** - `ca576f5` (test, RED), `2215fae` (feat, GREEN)

**Plan metadata:** commit docs(09-05) a seguir (SUMMARY, STATE, ROADMAP, REQUIREMENTS)

## Files Created/Modified
- `packages/dominio/src/url-segura.ts` - regra pura de mascara de segredo de URL
- `packages/dominio/src/url-segura.test.ts` - 7 casos (formulario, tarefa, query, /f/ /p/, nao-segredo, varias ocorrencias, esquema://host)
- `apps/api/src/observabilidade/log.ts` - `opcoesDoLogger` e `CAMINHOS_CENSURADOS`
- `apps/api/src/observabilidade/log.test.ts` - 4 testes de fluxo em memoria, sem banco
- `apps/api/src/app.ts` - tipo de `OpcoesDoApp.logger` ampliado
- `apps/api/src/index.ts` - boot com `opcoesDoLogger()`
- `apps/api/src/observabilidade/CONTEXT.md` - secao "Log sem segredo (Fase 9)"

## Decisions Made
- `redact` lista cada campo secreto no topo e como `*.campo`: o curinga `*.token` do pino casa só um nível abaixo do topo, então `app.log.info({ token })` ficaria sem censura.
- Serializador de `req` tipado com `FastifyRequest` (confirmado no Fastify 5: `req.host`, `req.ip`, `req.socket`); resolve a suposição A10 da pesquisa.
- A regra de `/f/` e `/p/` só vale no começo do caminho, para não mascarar `/financeiro/f/abc`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Redact do desenho original não cobria campo secreto no topo do objeto**
- **Found during:** Task 2 (desenho dos testes)
- **Issue:** o plano e a pesquisa listam só `*.segredo`, `*.secret`, `*.token`, `*.senha`; no pino o curinga não casa o topo, e o próprio comportamento exigido (`app.log.info({ token, segredo, secret, senha })`) ficaria sem censura.
- **Fix:** cada campo entra também sem o curinga em `CAMINHOS_CENSURADOS`.
- **Files modified:** `apps/api/src/observabilidade/log.ts`
- **Verification:** terceiro teste de `log.test.ts` (topo e aninhado) passa
- **Committed in:** `2215fae`

**2. [Rule 3 - Blocking] Segredos de teste com 16+ caracteres**
- **Found during:** Task 2 (testes)
- **Issue:** `PARAMS_SEGREDO` das rotas de formulário exige 16+ caracteres; `SEGREDO-LOG-1` (13) pararia na validação antes do handler.
- **Fix:** o teste usa `SEGREDO-LOG-1-ABCDEFGH`/`SEGREDO-LOG-2-ABCDEFGH`; a asserção continua procurando o prefixo `SEGREDO-LOG-1`/`-2`.
- **Files modified:** `apps/api/src/observabilidade/log.test.ts`
- **Committed in:** `ca576f5`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** nenhuma mudança de escopo; a primeira fecha uma lacuna real de censura.

## Issues Encountered
- A primeira execução do RED da Task 1 falhou por módulo ausente (não é RED válido pelo contrato); resolvido com esqueleto identidade antes de commitar o RED.
- Verificação: `cd packages/dominio && npx vitest run src/url-segura.test.ts` (7 passed) e `npx tsc --noEmit`; `cd apps/api && npx vitest run src/observabilidade/log.test.ts` (4 passed) e `npx tsc --noEmit`; `webhook-meta.test.ts` e `tarefas-publicas.test.ts` continuam verdes (26 testes no total junto com o log).

## Known Stubs

None - nenhum stub; os esqueletos do RED foram substituídos pelo GREEN.

## Threat Flags

None - nenhuma superfície nova; o plano só reduz o que chega ao log.

## User Setup Required

None - nenhuma configuração externa. `LOG_LEVEL` é opcional (padrão `info`).

## Next Phase Readiness
- `mascararSegredoDeUrl` pronta para o `map` do nginx (09-06, espelha o trecho `/v1/public/`) e para o Sentry da api (09-13) e da web (09-16).
- Sem bloqueios.

## Self-Check: PASSED

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-22*
