---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 12
subsystem: api
tags: [express, supabase, rag, conciliador-contas, workflows, retry-cancel, node-test, financeiro, financeiro-tria]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "exigirCredencial, responderErro, requestIdDe, lerCorpoBruto, tokenDeLeitura, MENSAGENS_FIXAS, EMPRESAS_PERMITIDAS, TIPOS_PERMITIDOS, queryDeEmpresaETipo — em financeiro-tria/automation/src/http/leituras-plataforma-comum.ts (Plan 04-07)"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "dtoDeLinhaDoPlanoDeContas — projeção de saída positiva de conciliador_contas, em financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts (Plan 04-01)"
provides:
  - "montarConteudoDeRag, listarPlanoDeContas, importarPlanoDeContas, removerLinhaDoPlanoDeContas — em financeiro-tria/automation/src/tenants/tria/leituras-plano-contas.ts: leitura e escrita de conciliador_contas, a MESMA tabela que matchCategory consulta"
  - "montarRotasDePlanoDeContas, planoContasLeiturasRouter, DepsDasRotasDePlanoDeContas — GET /v1/leituras/plano-contas, POST /v1/leituras/plano-contas/importar, POST /v1/leituras/plano-contas/:id/remover, POST /v1/leituras/workflows/:key/executar, POST /v1/leituras/execucoes/:id/repetir-passo, POST /v1/leituras/execucoes/:id/cancelar, em financeiro-tria/automation/src/http/leituras-plano-contas-routes.ts"
  - "/v1/leituras/* fecha a superfície: terceiro router montado em server.ts, autenticado desde o nascimento, ANTES do express.json() global"
affects: ["04-13 (já mesclado — a tela de Plano de contas de apps/web consome exatamente este contrato)", "04-10 (já mesclado — apps/api chama estas seis rotas)", "04-16 (o plano de corte — routes.ts/workflow-routes.ts/plano-contas-routes.ts continuam intocados até lá; este plano prova que a superfície nova já cobre tudo que eles fazem hoje)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo de tenant duplica de propósito buildContent/db()/embeddingFor da rota legada de Plano de contas (não importa dela) — mesma disciplina de leituras-notas-fiscais.ts (04-09) e leituras-plataforma-comum.ts (04-07): a rota legada é removida no corte (D4-16 etapa 4), e importar dela faria a superfície nova morrer junto"
    - "Composition root do PaymentAutomationService (adapter ClickUp/plataforma por PAYMENT_REQUEST_SOURCE) recriado (memoizado, lazy) na camada de rotas em vez de importado de routes.ts — routes.ts não exporta o serviço e não pode ser alterado (acceptance criteria exige diff vazio nos três arquivos legados); os adapters subjacentes (clickUpAdapter etc.) são singletons compartilhados, então a segunda instância não duplica estado externo, só o objeto PaymentAutomationService em si (inclui seu próprio `inFlight` de dedupe — ver Deviations/Decisions)"
    - "Resultado bruto de retryRun/cancelRun NUNCA atravessa a resposta HTTP: esses métodos podem devolver a Tarefa do ClickUp e a Solicitação inteira (app_key/app_secret inclusive, via solicitacaoInput internamente) — as duas rotas respondem só { ok: true } no caminho feliz, descartando o retorno do serviço (extensão de D4-05 para um caso que o plano não especificou explicitamente)"
    - "Erro de 'workflow sem execução manual' reusa SCHEMA_INVALIDO em vez de crescer MENSAGENS_FIXAS — leituras-plataforma-comum.ts não está no files_modified deste plano"

key-files:
  created:
    - "../financeiro-tria/automation/src/tenants/tria/leituras-plano-contas.ts"
    - "../financeiro-tria/automation/src/http/leituras-plano-contas-routes.ts"
    - "../financeiro-tria/automation/src/http/leituras-plano-contas-routes.test.ts"
  modified:
    - "../financeiro-tria/automation/src/server.ts"

key-decisions:
  - "O erro de workflow sem manualRunKey usa o código SCHEMA_INVALIDO (já existente em MENSAGENS_FIXAS) em vez de um código novo (ex.: EXECUCAO_MANUAL_INDISPONIVEL) — o plano oferecia as duas opções e pedia para decidir e registrar; leituras-plataforma-comum.ts não está em files_modified deste plano, então a opção que não exige tocá-lo foi a escolhida."
  - "repetirPasso/cancelarExecucao respondem { ok: true }, nunca o retorno de PaymentAutomationService#retryRun/cancelRun — o plano não especificou a forma da resposta dessas duas rotas, e o retorno real de retryRun pode carregar { task, solicitacao, parsed, deadline }, onde solicitacao é a linha inteira de solicitacoes_pagamentos (app_key/app_secret inclusive, via solicitacaoInput). Repassar seria reabrir exatamente o vazamento que D4-05 existe para fechar, só que por uma porta diferente (ação de escrita, não leitura)."
  - "O composition root de PaymentAutomationService para o Tria (fonte ClickUp ou plataforma, por PAYMENT_REQUEST_SOURCE) foi recriado — não importado — em leituras-plano-contas-routes.ts, memoizado (lazy singleton) igual ao padrão `cached`/`db()` já usado em todo o repositório. routes.ts NÃO exporta `triaPaymentService`, e o acceptance criteria da Task 2 exige `git diff --stat` vazio nos três arquivos legados — não havia como importar sem alterar routes.ts para exportar o singleton. Os adapters de origem (clickUpAdapter, etc.) já são singletons compartilhados entre os dois composition roots, então não há duplicação de estado externo (só duas instâncias do objeto PaymentAutomationService, cada uma com seu próprio Map `inFlight` de dedupe de chamadas concorrentes — irrelevante para retry-step/cancel, que são ações administrativas raras, não fluxo de alto tráfego)."

requirements-completed: [TELA-01]

# Metrics
duration: ~30min entre o primeiro e o último commit de código (f06da55 → 49d71af, 22:43-22:51 -03:00)
completed: 2026-09-23
---

# Phase 04 Plan 12: Plano de contas — a tela mais importante, e o que faltava Summary

**A leitura/escrita de `conciliador_contas` (a mesma tabela que `matchCategory` consulta para classificar a próxima Conta a pagar) mais os dois gatilhos de emissão de NF em lote e as duas ações de recuperação de execução que D4-07 autoriza — as seis rotas que fecham `/v1/leituras/*`.**

## Performance

- **Duration:** ~30min entre o primeiro e o último commit de código (`f06da55` → `49d71af`, 22:43:49 → 22:50:54 -03:00)
- **Completed:** 2026-09-23
- **Tasks:** 3/3
- **Files modified:** 3 criados, 1 modificado, todos em `../financeiro-tria` (mais este SUMMARY em `crm-n1`)

## Accomplishments

- `leituras-plano-contas.ts` (128 linhas): `montarConteudoDeRag` reproduz byte a byte a string do import legado (`buildContent`); `listarPlanoDeContas(empresa, tipo)` — `select("id, content")` com `.contains("metadata", { empresa, tipo })`, mesma consulta da rota legada; `importarPlanoDeContas` grava `metadata.source: "import-csv-crm-n1"` (confirmado por grep que nenhuma consulta deste repositório filtra `conciliador_contas` por `source`); `removerLinhaDoPlanoDeContas` — `delete().eq("id", id)`, lançando para id não finito. Cliente `service_role` e `embeddingFor` duplicados de propósito da rota legada (que é removida no corte, D4-16).
- `leituras-plano-contas-routes.ts` (293 linhas): as seis rotas, todas na ordem autenticar → validar → executar. `GET /plano-contas` exige `empresa`/`tipo` (ao contrário do `queryDeEmpresaETipo` genérico de 04-07, que os torna opcionais) e projeta via `dtoDeLinhaDoPlanoDeContas`. `POST /plano-contas/importar` traduz `categoria_clickup` (corpo) → `categoriaClickup` (módulo de acesso) na borda — a mesma tradução que `apps/api` (04-10) já faz do lado camelCase→snake_case. `POST /workflows/:key/executar` dispara `markSeteDias`/`emitirNotas` em segundo plano e responde 202 sem aguardar. `POST /execucoes/:id/{repetir-passo,cancelar}` chamam `PaymentAutomationService#retryRun`/`#cancelRun` mas nunca repassam o retorno bruto (ver Decisions). Nenhuma rota de `approve`/`review`/`aprovado` nasceu — `grep -cEi "approve|review|aprovado"` devolve `0`.
- `server.ts`: duas linhas (import + `app.use("/v1/leituras", planoContasLeiturasRouter())`) — terceiro router sob o mesmo prefixo, na linha 66, imediatamente antes de `express.json()` na linha 67 (confirmado por número de linha).
- `leituras-plano-contas-routes.test.ts` (21 casos `node:test`): paridade literal do RAG (forma completa + campos ausentes), autenticação, allowlist de empresa/tipo, import (vazio/2001 linhas/chave desconhecida/válido com tradução de campo confirmada), o 202 do disparo de workflow provado por cronômetro (a dep falsa resolve em 100ms; o teste afirma que a resposta 202 chegou antes), 400 para `tria-payment` (existe no catálogo, sem `manualRunKey`), 404 para `inventado`, 400 para `motivo` de 501 caracteres, ausência de rota `aprovar` (404), erro com segredo sanitizado, remoção por id (válido e não numérico).
- Verificação por mutação feita de fato: (1) uma vírgula removida de `montarConteudoDeRag` fez os dois casos de paridade do RAG falharem com `AssertionError`; (2) o allowlist de `empresa`/`tipo` trocado por `z.string().optional()` em `queryDeEmpresaETipo` fez o caso "empresa fora da allowlist → 400" falhar (`200 !== 400`). As duas mutações revertidas a partir de backup em disco antes do commit; `git diff --stat` confirmou identidade byte a byte após reverter.

## Task Commits

Cada task foi commitada atomicamente **no repositório `financeiro-tria`** (não em `crm-n1` — ver `<two_repository_warning>` do plano):

1. **Task 1: O módulo de acesso ao `conciliador_contas`** - `f06da55` (feat)
2. **Task 2: As seis rotas e o mount** - `d4cca79` (feat)
3. **Task 3: O teste — paridade do RAG, allowlist e o 202** - `49d71af` (test)

**Plan metadata:** este commit (`docs(04-12): complete...`), feito em `crm-n1`.

`git -C ../financeiro-tria status --porcelain | wc -l` confirmado em `89` antes do primeiro commit, e `90`/`91`/`90` depois de cada um dos três commits, voltando a `89` sempre — nenhum dos 89 arquivos pré-existentes foi tocado.

## Files Created/Modified

Repositório `financeiro-tria` (branch `main`):
- `automation/src/tenants/tria/leituras-plano-contas.ts` - `montarConteudoDeRag`, `listarPlanoDeContas`, `importarPlanoDeContas`, `removerLinhaDoPlanoDeContas` (novo)
- `automation/src/http/leituras-plano-contas-routes.ts` - as seis rotas + wiring de produção (novo)
- `automation/src/http/leituras-plano-contas-routes.test.ts` - 21 casos `node:test` (novo)
- `automation/src/server.ts` - mount de `planoContasLeiturasRouter()`, terceiro router sob `/v1/leituras`, antes do `express.json()`

Repositório `crm-n1` (este):
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/04-12-SUMMARY.md` - este arquivo

## Decisions Made

Ver `key-decisions` no frontmatter — os dois pontos mais relevantes:

- **Código de erro de workflow sem `manualRunKey`:** `SCHEMA_INVALIDO`, não um código novo — `leituras-plataforma-comum.ts` não está em `files_modified` deste plano.
- **Resposta de `repetir-passo`/`cancelar`:** `{ ok: true }` fixo, nunca o retorno de `retryRun`/`cancelRun` — esse retorno pode carregar a Solicitação inteira (`app_key`/`app_secret` inclusive), e o plano não especificou a forma da resposta dessas duas rotas. Repassar seria reabrir o vazamento que D4-05 fecha para as leituras, por uma porta de escrita.
- **Composition root do serviço de pagamento do Tria recriado (não importado) em `leituras-plano-contas-routes.ts`**, memoizado como lazy singleton — `routes.ts` não exporta `triaPaymentService` e o acceptance criteria exige `git diff --stat` vazio nos três arquivos legados.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentário de cabeçalho citando o literal "planos_de_contas" (singular) derrubava o próprio grep de aceitação da Task 1**
- **Found during:** verificação das `<acceptance_criteria>` da Task 1, logo após a primeira escrita do arquivo
- **Issue:** `grep -c "planos_de_contas"` devolveu `1` (esperado `0`) — o comentário de cabeçalho citava o nome da tabela morta ao explicar por que o módulo não a toca, e o grep de aceitação não distingue prosa de código (mesmo achado já registrado em 04-06/04-07/04-09/04-11/04-13-SUMMARY.md para outros arquivos desta fase — nenhum agente desta fase escapou dessa armadilha na primeira tentativa).
- **Fix:** reescrita da frase para "A tabela homônima no singular, vazia e morta, é uma OUTRA tabela" — mesma explicação, sem o literal proibido pelo grep.
- **Files modified:** `../financeiro-tria/automation/src/tenants/tria/leituras-plano-contas.ts`
- **Verification:** o grep de aceitação voltou a `0`; `npx tsc --noEmit` limpo.
- **Committed in:** `f06da55` — a correção foi feita antes do commit, então o commit não registra o "antes" com o texto que falhava o grep.

---

**Total deviations:** 1 auto-fixed (1 bug de prosa de comentário, sem mudança de comportamento).
**Impact on plan:** Nenhum — só o texto de um comentário mudou antes do primeiro commit.

## Issues Encountered

- **`npm test` completo no `automation/`: 146/147 verdes.** A única falha é a pré-existente já registrada em `deferred-items.md` desde 04-01 (`payment-rules.test.ts`, "resolve responsavel por centro de custo com fallback", `'Elifas'` vs `/FINQ/i`) — confirmada aqui como ainda presente e não tocada por este plano (`git diff --stat` vazio para `payment-rules.ts`/`payment-rules.test.ts`). Os 21 casos novos de `leituras-plano-contas-routes.test.ts` passaram dentro da suíte completa (147 = 126 anteriores + 21 novos), junto com os demais.
- **Waiver do `npm run check` do `crm-n1` — aplicado por decisão explícita do orquestrador para este plano** (ver `<do_not_run_the_crm_n1_full_check>` do prompt de execução): este plano não toca nenhum arquivo de código em `crm-n1` (só este SUMMARY, em `.planning/`), então o `npm run check` do `crm-n1` não provaria nada sobre o trabalho feito aqui — e o custo (`apps/api` contra Postgres real, `fileParallelism: false`, `testTimeout: 180_000`, 40-50min de wall time) excede a janela do executor. Verificação feita em escopo, como instruído: `npx tsc --noEmit` do `automation/` (limpo, múltiplas vezes, inclusive durante as duas mutações) e a suíte completa do `automation/` (`npm test`, 146/147 — o N-1 esperado).
- **`financeiro-tria.vercel.app` continua respondendo (D4-16) — não verificado nesta execução**, mesma limitação já registrada por 04-09/04-13: exigiria acesso de rede à VPS de produção, fora do escopo desta task. Nenhuma rota legada foi tocada (`git diff --stat` vazio para `routes.ts`/`plano-contas-routes.ts`/`workflow-routes.ts`), então não há indício de que este plano afete o painel legado.
- **`repetirPasso`/`cancelarExecucao` de produção não foram exercitados contra Postgres/ClickUp reais nesta execução** — o teste da Task 3 usa deps falsas para as seis rotas (por desenho: a suíte inteira é injeção de dependência, sem rede). A composição real (`servicoDeExecucaoTria()`) só é chamada por `planoContasLeiturasRouter()`, o wiring de produção, que `npx tsc --noEmit` confirma tipar corretamente mas que nenhum teste desta fase invoca de ponta a ponta (mesma limitação que `routes.ts`/`automationRouter()` já tinha antes deste plano — não é regressão, é o padrão herdado).

## User Setup Required

Nenhuma ação nova além da já documentada em `04-02-SUMMARY.md`/`04-07-SUMMARY.md`: `PLATAFORMA_LEITURA_TOKEN` (gerar com `openssl rand -hex 32`) precisa estar nos `.env` de produção de `automation/` E `apps/api` antes do corte (D4-16) — as seis rotas deste plano usam a mesma credencial de leitura que 04-07/04-09 já introduziram, nenhuma nova.

## Next Phase Readiness

- `GET /v1/leituras/plano-contas`, `POST /v1/leituras/plano-contas/importar`, `POST /v1/leituras/plano-contas/:id/remover`, `POST /v1/leituras/workflows/:key/executar`, `POST /v1/leituras/execucoes/:id/repetir-passo` e `POST /v1/leituras/execucoes/:id/cancelar` existem, autenticadas, montadas antes do parser global — 04-10 (já mesclado, `apps/api`) e 04-13 (já mesclado, a tela de Plano de contas de `apps/web`) já chamam exatamente este contrato.
- `/v1/leituras/*` está fechada: as oito leituras do Financeiro (Dashboard, Notas fiscais, Produtos, Plano de contas, Extratos, Workflows, Problemas, Aprovações pendentes) e todas as escritas que D4-07 autoriza agora têm rota autenticada no `automation/`.
- As rotas legadas (`routes.ts`, `plano-contas-routes.ts`, `workflow-routes.ts`, `bank-statement-webhooks.ts`) seguem byte a byte intactas — `git diff --stat` confirmado vazio. `financeiro-tria.vercel.app` pode continuar no ar sem que este plano tenha mudado nada do que ele consome.
- Nenhum bloqueio novo para os planos seguintes da Fase 4 (04-14, o corte). A falha pré-existente de `payment-rules.test.ts` permanece documentada em `deferred-items.md` (de 04-01), sem entrada duplicada.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `../financeiro-tria/automation/src/tenants/tria/leituras-plano-contas.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-plano-contas-routes.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-plano-contas-routes.test.ts`
- FOUND commit `f06da55` (Task 1) in `../financeiro-tria`
- FOUND commit `d4cca79` (Task 2) in `../financeiro-tria`
- FOUND commit `49d71af` (Task 3) in `../financeiro-tria`
