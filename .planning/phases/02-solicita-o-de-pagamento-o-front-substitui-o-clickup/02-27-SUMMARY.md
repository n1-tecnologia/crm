---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 27
subsystem: observability
tags: [omie, idempotencia, outbox, reconciliacao, vitest, node-test]

# Dependency graph
requires:
  - phase: 02-10
    provides: "Outbox transacional (plataforma.integration_outbox, EVENTOS) — a fonte real de falhas/pendências que reconciliarDia lê"
  - phase: 02-24
    provides: "janela-de-fallback.ts (metricaDeOrigem) — reaproveitado por coletarMetricas para a razão clique/comentário de D-10"
  - phase: 02-25
    provides: "plataforma.importacao_ledger e o padrão de resumo opcional (resumoDaExecucao) — molde para o amostra/--resumo desta plano"
  - phase: 02-07
    provides: "src/testing/omie-falso.ts (criarOmieFalso) — usado por codigo-de-integracao.test.ts para provar consulta-antes-de-incluir sem rede"
provides:
  - "codigoDeIntegracao({origem, taskId}) em ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts — determinístico para a coorte plataforma (tria:payment-request:plataforma:<taskId>, taskId ausente é erro), forma preservada para a coorte clickup (caminho de rollback)"
  - "incluirNoOmieComConsultaAntes + PortaDeInclusaoIdempotente em ../financeiro-tria/automation/src/adapters/omie.ts — ConsultarContaPagar sempre antes de IncluirContaPagar; createPayableForFlux7 (Fluxo 7, Solicitação de pagamento) usa esse caminho"
  - "apps/api/src/observabilidade/metricas.ts (coletarMetricas) e reconciliacao.ts (reconciliarDia) — as métricas mínimas de 02-RESEARCH.md e a reconciliação diária por origem, com o script npm reconciliar"
affects: ["02-28 (corte)", "docs/08-migracao-financeiro/06-ensaio-e-coortes.md (Task 3, não escrito por este plano)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "codigo_lancamento_integracao determinístico por (origem, taskId), nunca Date.now() para a coorte nova — mesmo padrão que contas-a-pagar-lancamento.ts (Plan 03-07) já citava como 'mesmo padrão do Plan 02-27' antes deste plano rodar"
    - "Porta mínima consultar()/incluir() (sem parâmetro, fecha por closure) para impor ordem consultar→incluir sobre qualquer implementação concreta, testável com criarOmieFalso sem tocar fetch/rede"
    - "Métricas/reconciliação cross-repo: o que É do apps/api é sempre lido de verdade (outbox, aprovações via hidratar(), ledger); o que vive só no financeiro-tria chega por amostra/--resumo=<json>, nunca uma leitura SQL não verificável contra um schema que este processo não pode confirmar em produção"

key-files:
  created:
    - ../financeiro-tria/automation/src/tenants/tria/codigo-de-integracao.test.ts
    - apps/api/src/observabilidade/metricas.ts
    - apps/api/src/observabilidade/reconciliacao.ts
    - apps/api/src/observabilidade/reconciliacao.cli.ts
    - apps/api/src/observabilidade/reconciliacao.test.ts
    - apps/api/src/observabilidade/CONTEXT.md
  modified:
    - ../financeiro-tria/automation/src/adapters/omie.ts
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts
    - apps/api/package.json

key-decisions:
  - "A coorte clickup preserva o formato de código EXATO de antes desta extração (clickup-<taskId ou Date.now()>), nunca o novo tria:payment-request:clickup:<taskId> — mudar a forma do código de integração do caminho de rollback no meio do ensaio arriscaria duplicar lançamentos já feitos sob o código antigo. Só a coorte plataforma (nova) usa o formato determinístico e recusa taskId ausente."
  - "A consulta-antes-de-incluir foi implementada como uma porta genérica (incluirNoOmieComConsultaAntes) dentro de omie.ts, não como mudança de regra em attemptIncluirContaPagar — o fallback de Client-1166 (banco sem CNAB) ficou inalterado, só reordenado para depois da consulta."
  - "coletarMetricas/reconciliarDia recebem as contagens do financeiro-tria (RESUMOs, tentativas/resultados Omie, comandos do adapter, códigos de integração por origem) por parâmetro (amostra/--resumo=<json>), não por leitura SQL direta: nenhuma tabela do financeiro-tria hoje persiste um histórico agregável por dia dessas contagens (confirmado lendo src/adapters/supabase.ts — createOrResumeRun/updateRun são objetos SINTÉTICOS sobre solicitacoes_pagamentos, não uma tabela de runs de verdade), e uma leitura SQL não verificável arriscaria devolver um número errado com aparência de medido. Documentado em observabilidade/CONTEXT.md."
  - "Sem --resumo, o CLI reconcilia só o outbox local (sempre real) e devolve zero para o resto — nunca um número inventado; um aviso explícito avisa que a metade do financeiro-tria não entrou na rodada."

patterns-established:
  - "CLI fino em vite-node com SairComCodigo + encerrar() sempre antes de sair (molde de importar.cli.ts), agora também em reconciliacao.cli.ts"

requirements-completed: []

# Metrics
duration: ~2h30 (Tasks 1-2 apenas — Task 3 é checkpoint humano, deliberadamente não tentada)
completed: 2026-09-25
---

# Phase 02 Plan 27: Ensaio de duas semanas — código determinístico, consulta antes de incluir, métricas e reconciliação (Tasks 1-2) Summary

**Código de integração Omie determinístico por origem com ConsultarContaPagar sempre antes de IncluirContaPagar (financeiro-tria), e o instrumento de reconciliação diária por origem com portão automático (apps/api) — os dois primeiros terços do critério 4 do ROADMAP; o ensaio real de 14 dias (Task 3) continua em aberto, como planejado.**

## Status

**Tasks 1-2 concluídas e commitadas. Task 3 (`checkpoint:human-action`, operar o ensaio real de duas semanas com dado de produção) NÃO foi tentada — está fora do escopo desta execução por instrução explícita.** Ver "Task 3 — em aberto" abaixo para o resume-signal exato.

## Performance

- **Duration:** ~2h30 (pesquisa do código real do `payment-automation-service.ts`/`omie.ts` + desenho das interfaces de observabilidade)
- **Tasks:** 2 de 3
- **Files modified:** 9 (7 criados, 2 modificados, mais `package.json` de `apps/api`)

## Accomplishments

- **Task 1 — `codigoDeIntegracao` e consulta antes de incluir (`../financeiro-tria`).** `payment-automation-service.ts` ganhou `codigoDeIntegracao({ origem, taskId })`: para `plataforma`, devolve `tria:payment-request:plataforma:<taskId>` e recusa (lança) quando `taskId` está ausente — nunca um fallback com `Date.now()`; para `clickup`, preserva bit a bit o comportamento anterior (`clickup-<taskId ou Date.now()>`), documentado como decisão deliberada (caminho de rollback). `omie.ts` ganhou `incluirNoOmieComConsultaAntes` (porta `consultar()`/`incluir()` mínima) e `createPayableForFlux7` (o método que a Solicitação de pagamento usa) passou a chamar `ConsultarContaPagar` **antes** de `IncluirContaPagar`, reaproveitando se encontrar, e consultando de novo antes de deixar subir um erro de inclusão — o fallback de Client-1166 (banco sem CNAB) ficou intacto, só reordenado. `codigo-de-integracao.test.ts` cobre os 6 casos (a)-(f) do plano: determinismo, recusa da coorte plataforma sem taskId, consulta-antes-de-incluir com `criarOmieFalso` (incluir nunca chamado quando já existe), conexão caída + retry (uma única chamada de inclusão), regressão explícita do caminho clickup, e grep estático confirmando ausência de `Date.now()` no ramo plataforma.
- **Task 2 — Métricas e reconciliação diária por origem (`apps/api`).** `observabilidade/metricas.ts` (`coletarMetricas`) devolve as métricas mínimas de `02-RESEARCH.md` — outbox (`pending`/idade da mais antiga/`failed`/tentativas), aprovações clique/comentário e razão (reaproveita `metricaDeOrigem`), importação (`lidos`/`importados`/`rejeitados`/`avisados` do ledger) e latência local p50/p95/p99 — sanitizadas (nenhuma chave de payload, provado no teste). `observabilidade/reconciliacao.ts` (`reconciliarDia`) agrupa por origem entradas/aprovações/RESUMOs/tentativas/resultados Omie, cruza `codigo_lancamento_integracao` entre as duas coortes e afirma zero interseção, somando falhas não tratadas (outbox `failed` local + comandos `failed` do adapter). `reconciliacao.cli.ts` (`npm run reconciliar -w @n1/api -- --dia=YYYY-MM-DD [--resumo=<json>]`) imprime o relatório curto e sai `1` quando há código duplicado ou falha não tratada — **verificado manualmente contra o Postgres real** (dia de hoje, ambiente saudável: exit 0) e com um `--resumo` com código duplicado injetado (exit 1, confirmado pelo `npm error code 1`). `reconciliacao.test.ts` cobre os 5 casos (a)-(e) sem tocar banco.

## Task Commits

Each task was committed atomically, in the correct repository:

1. **Task 1: Código de integração determinístico e consulta antes de incluir** — `7c74681` (feat, repositório `../financeiro-tria`)
2. **Task 2: Métricas e reconciliação diária por origem** — `973aa8f` (feat, repositório `crm-n1`)

**Plan metadata:** este SUMMARY.md, commitado em seguida em `crm-n1` (Task 3 continua aberta — sem atualização de STATE.md/ROADMAP.md por este agente; o orquestrador cuida disso).

## Files Created/Modified

- `../financeiro-tria/automation/src/adapters/omie.ts` — `PortaDeInclusaoIdempotente`, `incluirNoOmieComConsultaAntes`, `createPayableForFlux7` reordenado (consultar→incluir)
- `../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts` — `OrigemDaSolicitacao`, `codigoDeIntegracao`, `origemAtual()` (derivado de `legacyClickUp`), ponto de chamada de `codigoLancamentoIntegracao` trocado
- `../financeiro-tria/automation/src/tenants/tria/codigo-de-integracao.test.ts` — casos (a)-(f)
- `apps/api/src/observabilidade/metricas.ts` — `coletarMetricas`, `montarMetricas` (pura), `AmostraDeMetricas`
- `apps/api/src/observabilidade/reconciliacao.ts` — `reconciliarDia`, `AmostraDaReconciliacao`, `EntradaPorOrigem`
- `apps/api/src/observabilidade/reconciliacao.cli.ts` — CLI fino, `SairComCodigo`/`encerrar()`
- `apps/api/src/observabilidade/reconciliacao.test.ts` — casos (a)-(e) + variantes de CLI
- `apps/api/src/observabilidade/CONTEXT.md` — o que é medido, por que nada carrega payload, por que `automation`/`porOrigem` chegam por parâmetro
- `apps/api/package.json` — script `reconciliar`

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo dos dois pontos que exigiram julgamento:

1. **Assimetria deliberada entre coortes no formato do código de integração** — a coorte `clickup` preserva a forma de antes (inclusive o fallback com `Date.now()`), porque é o caminho de rollback: mudar sua forma no meio do ensaio arriscaria duplicar um lançamento já feito sob o código antigo, se o mesmo evento reprocessar sob um código novo.
2. **Origem das contagens `financeiro-tria`-side em `coletarMetricas`/`reconciliarDia`: parâmetro, não leitura SQL direta.** Investigado (`src/adapters/supabase.ts`): `createOrResumeRun`/`updateRun` são objetos SINTÉTICOS reconstruídos de `solicitacoes_pagamentos` a cada chamada — não existe uma tabela `runs`/`platform_adapter_commands` real com histórico agregável por dia para este processo ler. Escrever SQL contra um schema não verificável arriscaria devolver números errados com aparência de medição real — pior que declarar a lacuna. O plano explicitamente permitia essa escolha ("recebe um resumo por parâmetro"); documentado em `observabilidade/CONTEXT.md` com a instrução de que quem operar o ensaio real (Task 3) precisa decidir como produzir o `--resumo=<json>` diário.

## Deviations from Plan

None - as Tasks 1 e 2 foram executadas dentro do escopo `files_modified` declarado em cada uma. Nenhum arquivo fora da lista foi tocado; nenhuma regra de negócio (valor, categoria, conta, RESUMO) foi alterada.

## Known Stubs / Limitações documentadas (não são stubs de UI — nenhuma tela consome este código)

- `Metricas.recebimento` (duplicatas recebidas/conflitos de idempotência) e `Metricas.signedUrl` (refresh/falha) saem sempre `0` sem `deps.amostra` correspondente — `plataforma.http_idempotency` guarda o estado ATUAL por chave, não um histórico de tentativas repetidas; não existe hoje nenhuma tabela que registre emissão/falha de URL assinada. Documentado em `metricas.ts` e `CONTEXT.md`; não é uma correção possível dentro de `files_modified` desta Task (adicionar uma tabela nova seria mudança arquitetural, Rule 4).
- `Metricas.automation` fica `undefined` (nunca um objeto de zeros) quando ninguém informa `deps.automation`/`deps.amostra.automation` — decisão deliberada para nunca parecer medição real sem ser.
- `reconciliarDia` sem `opcoes.amostra` devolve `porOrigem` zerado para as duas coortes (o outbox local ainda é reconciliado de verdade) — o CLI imprime um aviso explícito nesse caso, nunca um silêncio.

## Issues Encountered

- Ao escrever o caso (f) (grep estático), a primeira versão da mensagem de erro de `codigoDeIntegracao` continha a substring literal `"Date.now()"` dentro do próprio texto — o grep do teste (corretamente) reprovou por achar essa menção no ramo `plataforma`. Corrigido reescrevendo a mensagem para não citar `Date.now()` textualmente (ver commit `7c74681`), sem mudar o comportamento.
- `payment-rules.test.ts` (arquivo NÃO tocado por este plano) tem um caso (`resolve responsavel por centro de custo com fallback`) que falha na suíte completa de `financeiro-tria/automation` — confirmado pré-existente e fora de escopo (`git status` mostra `payment-rules.ts`/`payment-rules.test.ts` limpos antes e depois desta execução). Não corrigido, por scope boundary.

## User Setup Required

None para o que foi executado (Tasks 1-2). Para a Task 3 (não executada), quem operar o ensaio real vai precisar decidir e produzir o `--resumo=<caminho.json>` diário para `npm run reconciliar` reconciliar de verdade o lado `financeiro-tria` — ver `apps/api/src/observabilidade/CONTEXT.md` e o cabeçalho de `reconciliacao.cli.ts` para o formato exato.

## Next Phase Readiness

- O código está pronto para o ensaio: `codigoDeIntegracao` e a consulta-antes-de-incluir cobrem o invariante V02-CUT/T-02-23 para a coorte plataforma; `npm run reconciliar` é o portão automático que a Task 3 vai rodar todo dia.
- **Task 3 continua inteiramente em aberto** — ver seção abaixo.

## Task 3 — em aberto (checkpoint:human-action, NÃO tentada por instrução)

**O que falta:** escrever `docs/08-migracao-financeiro/06-ensaio-e-coortes.md` (regra de coorte, checklist de pré-ensaio, roteiro diário, portões de D-28) e então **operar** o ensaio de duas semanas com dado real: abrir a coorte plataforma para um subconjunto de solicitantes, rodar `npm run reconciliar` todo dia por 14 dias corridos, registrar as contagens por origem no documento, tratar toda falha antes do fim do dia, e ao final executar um ensaio de replay/rollback em ambiente de teste.

**Por que não foi tentada:** é um `checkpoint:human-action` com `gate="blocking"` que exige operar dois caminhos de entrada reais (link `/f/<segredo>` da plataforma e o ClickUp) por 14 dias corridos contra produção — não é automatizável nem apropriado para este agente executar, por instrução explícita do objetivo desta execução.

**Resume-signal exato do plano (`02-27-PLAN.md`, Task 3):**
> Digite "ensaio concluído" com o resumo das contagens, ou descreva o que impediu

## Self-Check: PASSED

- `../financeiro-tria/automation/src/tenants/tria/codigo-de-integracao.test.ts` — FOUND
- `apps/api/src/observabilidade/metricas.ts` — FOUND
- `apps/api/src/observabilidade/reconciliacao.ts` — FOUND
- `apps/api/src/observabilidade/reconciliacao.cli.ts` — FOUND
- `apps/api/src/observabilidade/reconciliacao.test.ts` — FOUND
- `apps/api/src/observabilidade/CONTEXT.md` — FOUND
- Commit `7c74681` (financeiro-tria) — FOUND
- Commit `973aa8f` (crm-n1) — FOUND

