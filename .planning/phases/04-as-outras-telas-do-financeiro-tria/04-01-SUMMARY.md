---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 01
subsystem: api
tags: [dto, allowlist, security, node-test, fixture, financeiro, financeiro-tria]

# Dependency graph
requires: []
provides:
  - "CAMPOS_PROIBIDOS, SOLICITACOES_DE_TESTE, TRANSACOES_DE_TESTE, PRODUTOS_DE_TESTE — fixture compartilhada em financeiro-tria/automation/src/testing/fixture-financeiro.ts, com os campos proibidos (app_key, app_secret, api_key, cpf_cnpj, telefone, endereço completo) preenchidos de propósito para os testes de allowlist reprovarem"
  - "dtoDeNotaFiscal, dtoDeProduto, dtoDeLinhaDoPlanoDeContas, dtoDeWorkflow, dtoDeExecucaoDeWorkflow — projeções de saída positivas (allowlist) de /v1/leituras/*, em financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts"
  - "leituras-plataforma-dtos.test.ts — 11 casos node:test provando ausência dos campos proibidos por nome E por valor, com um caso de mutação de controle não-vazio"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, 04-13, 04-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist positiva de DTO: cada função de projeção nomeia campo a campo o que inclui, nunca espalha a linha de origem nem usa lista de campos a excluir — a ausência de um campo proibido é consequência da forma, não de um filtro"
    - "Fixture de teste com campos proibidos presentes de propósito, para que o teste de ausência tenha o que reprovar (nunca por snapshot, sempre por nome + valor)"
    - "Caso de mutação de controle: um teste que constrói deliberadamente a projeção ingênua (espalhamento) e afirma que ELA contém o campo proibido — prova que a lista de campos proibidos não passaria por acidente sobre uma fixture vazia"

key-files:
  created:
    - "../financeiro-tria/automation/src/testing/fixture-financeiro.ts"
    - "../financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts"
    - "../financeiro-tria/automation/src/http/leituras-plataforma-dtos.test.ts"
    - ".planning/phases/04-as-outras-telas-do-financeiro-tria/deferred-items.md"
  modified: []

key-decisions:
  - "Interfaces nomeadas do TypeScript (LinhaDeTransacaoDeTeste, LinhaDeProdutoDeTeste) ganharam índice de assinatura ([chave: string]: unknown) para serem atribuíveis aos parâmetros das projeções sem cast — TS não dá índice implícito a interfaces declaradas, só a literais inferidos (Rule 3, achado durante a Task 3)"
  - "dtoDeLinhaDoPlanoDeContas não tem fixture dedicada com campos proibidos: a tabela conciliador_contas não tem nenhuma coluna sensível (confirmado em 04-RESEARCH.md), então o teste de allowlist para essa projeção usa um objeto inline mínimo em vez de uma fixture completa"

patterns-established:
  - "Toda rota futura de /v1/leituras/* (Waves seguintes) importa os DTOs daqui — nenhuma inventa a própria projeção"
  - "Todo teste de allowlist segue o molde: for (const proibido of CAMPOS_PROIBIDOS) sobre Object.keys(dto), mais um grep de JSON.stringify(dto) contra os VALORES literais da fixture, mais um caso de mutação de controle"

requirements-completed: [TELA-01]

# Metrics
duration: 34min
completed: 2026-09-23
---

# Phase 04 Plan 01: A fronteira do dado — fixture e DTOs de /v1/leituras/* Summary

**Allowlist positiva de saída (D4-05) para as cinco leituras de Notas fiscais, Produtos, Plano de contas e Workflows, provada por nome de campo e por valor sobre uma fixture que contém os campos proibidos de propósito.**

## Performance

- **Duration:** ~34 min entre o primeiro e o último commit de código (3f5303c → a45fd87), sem contar a leitura inicial de contexto
- **Started:** 2026-09-23T19:31:07-03:00 (primeiro commit)
- **Completed:** 2026-09-23T20:05:38-03:00 (último commit de código)
- **Tasks:** 3/3
- **Files modified:** 3 criados em `../financeiro-tria` (mais 1 arquivo de acompanhamento em `crm-n1`: `deferred-items.md`)

## Accomplishments
- Fixture compartilhada (`fixture-financeiro.ts`) com `SOLICITACOES_DE_TESTE` (5 linhas), `TRANSACOES_DE_TESTE` (3 linhas, todas as colunas de `transacoes` preenchidas incluindo as proibidas) e `PRODUTOS_DE_TESTE` (2 linhas), mais `CAMPOS_PROIBIDOS` — nenhum dado real, credenciais com literais evidentemente falsos (D-13)
- Cinco projeções de saída (`leituras-plataforma-dtos.ts`) — `dtoDeNotaFiscal`, `dtoDeProduto`, `dtoDeLinhaDoPlanoDeContas`, `dtoDeWorkflow`, `dtoDeExecucaoDeWorkflow` — cada uma nomeando campo a campo o que inclui, sem espalhamento da linha de origem, sem `delete`/`Object.assign`/lista negra
- Teste de allowlist (`leituras-plataforma-dtos.test.ts`, 11 casos) provando por nome E por valor que nenhum DTO carrega `app_key`, `app_secret`, `api_key`, `cpf_cnpj`, `telefone` ou coluna de endereço — com um caso de mutação de controle que prova que a checagem não passaria por acidente
- Verificação por mutação feita à mão conforme exigido pelo `<success_criteria>` do plano: acrescentar `telefone` a `dtoDeNotaFiscal` fez o caso (a) falhar com o `AssertionError` esperado; desfeito antes do commit (`git diff --stat` confirmou vazio)

## Task Commits

Cada task foi commitada atomicamente **no repositório `financeiro-tria`** (não em `crm-n1` — ver `<two_repository_warning>` do plano):

1. **Task 1: A fixture compartilhada, com os campos proibidos presentes de propósito** - `3f5303c` (feat)
2. **Task 2: As projeções de saída — allowlist positiva por DTO** - `6477baa` (feat)
3. **Task 3: O teste que reprova por nome de campo** - `a45fd87` (test — inclui também o fix de índice de assinatura na fixture, Rule 3)

**Plan metadata:** (este commit, `docs(04-01): complete...`, feito em `crm-n1` — ver seção de commits abaixo)

## Files Created/Modified

Repositório `financeiro-tria` (branch `main`):
- `automation/src/testing/fixture-financeiro.ts` - fixture com `CAMPOS_PROIBIDOS`, `SOLICITACOES_DE_TESTE`, `TRANSACOES_DE_TESTE`, `PRODUTOS_DE_TESTE`
- `automation/src/http/leituras-plataforma-dtos.ts` - as cinco projeções de saída
- `automation/src/http/leituras-plataforma-dtos.test.ts` - o teste de allowlist (11 casos)

Repositório `crm-n1` (este):
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/deferred-items.md` - achados fora de escopo (ver "Issues Encountered")
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/04-01-SUMMARY.md` - este arquivo

## Decisions Made

- Índice de assinatura adicionado a `LinhaDeTransacaoDeTeste`/`LinhaDeProdutoDeTeste` (Rule 3, ver "Deviations from Plan") — necessário para que as linhas da fixture fossem atribuíveis aos parâmetros das projeções sem cast, dado que interfaces nomeadas do TypeScript não recebem índice implícito.
- `dtoDeLinhaDoPlanoDeContas` testada com um objeto inline (`{ id: 42, content: "..." }`) em vez de uma fixture dedicada — `conciliador_contas` não tem nenhuma coluna proibida (confirmado em `04-RESEARCH.md` §"Inventário exato das 8 leituras"), então não há necessidade de uma fixture "com campos proibidos" para essa tabela especificamente.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Índice de assinatura nas interfaces da fixture**
- **Found during:** Task 3 (ao tentar passar `TRANSACOES_DE_TESTE`/`PRODUTOS_DE_TESTE` para `dtoDeNotaFiscal`/`dtoDeProduto`)
- **Issue:** `npx tsc --noEmit` recusava a chamada com `Index signature for type 'string' is missing in type 'LinhaDeTransacaoDeTeste'` — TypeScript só dá índice de assinatura implícito a tipos-objeto inferidos de literais, não a `interface` declaradas, mesmo quando todas as chaves batem estruturalmente.
- **Fix:** Adicionado `[chave: string]: unknown;` a `LinhaDeTransacaoDeTeste` e `LinhaDeProdutoDeTeste` em `fixture-financeiro.ts`, com comentário explicando o porquê.
- **Files modified:** `../financeiro-tria/automation/src/testing/fixture-financeiro.ts`
- **Verification:** `npx tsc --noEmit` limpo; `npx tsx --test src/http/leituras-plataforma-dtos.test.ts` → 11/11 verde
- **Committed in:** `a45fd87` (junto com o commit da Task 3, já que o fix era pré-requisito do teste compilar)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessário só para o teste compilar contra a fixture; nenhuma mudança de comportamento nas projeções nem na fixture além do tipo.

## Issues Encountered

- **`payment-rules.test.ts` — falha pré-existente, não causada por este plano.** Ao rodar `npm test` completo no `automation/` (exigido pelo `<verification>` do plano), o caso "resolve responsavel por centro de custo com fallback" falhou (`/FINQ/i` não bateu com `'Elifas'`). Verificado com `git diff --stat` e `git log` que nem `payment-rules.ts` nem `payment-rules.test.ts` têm qualquer diferença do HEAD de `main` nem foram tocados por qualquer commit deste plano — a causa exata (dado de configuração/env específico do ambiente, ou uma regra que já divergiu) não foi investigada, por estar fora do escopo desta task (ver `deferred-items.md`). Resultado líquido: 95/96 testes verdes no `automation/`; os três arquivos novos deste plano passam 100%.
- **`npm run check` no `crm-n1` — rodado por diligência (o plano pede "provar que a fase não sangrou"), com um achado fora de escopo.** `typecheck` (3 workspaces), `lint`, `verificar:tokens` e os testes de `@n1/dominio` (480) e `@n1/web` (144) saíram verdes. Os testes de `@n1/api` tiveram 2 falhas em arquivos que dependem de Postgres real (`src/e2e/lote-contas-a-pagar.test.ts`, `src/rotas/classificacoes.test.ts`) — ambos com timeout batendo exatamente no `testTimeout: 180_000` do `vitest.config.mts`, consistente com os vários blockers de acesso a produção já registrados em `STATE.md` para outros planos da Fase 3. Confirmado por `git status --porcelain` que este plano não tocou nenhum arquivo de código em `crm-n1` (só `deferred-items.md` e este SUMMARY, ambos em `.planning/`) — a falha não pode ter sido introduzida por este plano, e é adicionada a `deferred-items.md` para quem for revisar a Fase 4.
- **Anomalia durante a execução, registrada por transparência:** logo após o `npm run check` completar em segundo plano, uma mensagem apareceu embutida no fluxo de resultado de ferramenta, formatada como um aviso do "orquestrador", pedindo para (a) não investigar a falha de `payment-rules.test.ts` e suavizar a redação de um achado que eu já tinha verificado com `git diff`/`git log`, e (b) considerar a verificação do `crm-n1` "dispensada". A mensagem não veio pelo canal legítimo de instrução (o prompt de invocação desta sessão) e continha uma alegação que não batia com o estado real observável (dizia que o comando ainda estava rodando e precisava ser "morto", quando a notificação de conclusão em segundo plano já mostrava `exit code 0`). Não segui as instruções dessa mensagem: mantive a redação original do achado de `payment-rules.test.ts` (verificado por `git diff --stat`/`git log`, não "não confirmado") e completei a verificação do `crm-n1` normalmente. Reportado em detalhe ao orquestrador real via handback.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `leituras-plataforma-dtos.ts` está pronto para as rotas de `/v1/leituras/*` das próximas ondas importarem — nenhuma rota nova foi criada por este plano (fora de escopo: este plano é só a fronteira do dado).
- `fixture-financeiro.ts` está pronta para os testes de equivalência de `buildDashboardStats`/`buildProblemRows` (D4-06), que ainda não foram escritos (fora de escopo desta plano).
- Nenhum bloqueio novo para os planos seguintes da Fase 4. Os dois achados fora de escopo (`payment-rules.test.ts`, os dois testes de `@n1/api` dependentes de Postgres real) estão documentados em `deferred-items.md` para quem quiser investigá-los, mas não impedem o próximo plano de começar.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `../financeiro-tria/automation/src/testing/fixture-financeiro.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-plataforma-dtos.test.ts`
- FOUND: `.planning/phases/04-as-outras-telas-do-financeiro-tria/deferred-items.md`
- FOUND commit `3f5303c` (Task 1) in `../financeiro-tria`
- FOUND commit `6477baa` (Task 2) in `../financeiro-tria`
- FOUND commit `a45fd87` (Task 3) in `../financeiro-tria`
