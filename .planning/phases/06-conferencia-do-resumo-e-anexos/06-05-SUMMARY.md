---
phase: 06-conferencia-do-resumo-e-anexos
plan: 05
subsystem: pipeline da Solicitação, coorte plataforma (financeiro-tria/automation)
tags: [s5, s6, resumo-de-pagamento, handlePlatformApprovalDecision, porta, payment-request-adapter, omie-falso, node-test]

# Dependency graph
requires:
  - phase: 06-02
    provides: "financeiro-tria no estado pós-v1.1 (d462f6e, 24ef256, 5a65e5b); nada de 06-02 é usado diretamente, só a base"
  - phase: 02-21
    provides: "handlePlatformApprovalDecision (Aprovado + Status pela porta) e o webhook /webhooks/plataforma/aprovacao-decidida"
provides:
  - "handlePlatformApprovalDecision com S5 (aprovada: conta, fornecedor e categoria no Omie, RESUMO na Solicitação pela porta) e S6 (rejeitada: aviso ao Solicitante, sem Menção)"
  - "PaymentAutomationService#publicarResumoDepoisDaAprovacao: a sequência selectAccount -> ensureSupplierAndCategory -> postPaymentSummary, usada pelos três caminhos de aprovação"
  - "Falha no S5 vira comentário 'Não consegui montar o Resumo: <motivo>' e resumoPublicado: false; o handler não lança (D-20)"
  - "postPaymentSummary na coorte plataforma menciona o Membro traduzido de Contas a Pagar (PLATAFORMA_MEMBRO_POR_CLICKUP_ID), nunca o id do ClickUp"
affects: [06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prova de 'pela porta e só pela porta': mock.method no legacyClickUpRaw do serviço com um falso que LANÇA e conta; asserção callCount 0 em todos os casos (um try/catch em volta do raw não esconde a chamada)"
    - "Passo que só existe no ClickUp é pulado com log '[plataforma] passo <x> ignorado: exige ClickUp' (aqui: atribuir_contas_a_pagar)"

key-files:
  created: []
  modified:
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.plataforma.test.ts
    - ../financeiro-tria/automation/README.md

key-decisions:
  - "S5 roda dentro do step approval_comment, depois do Status; falha no S5 deixa o run em status 'approved', currentStep 'summary', recommendedAction 'tentar_novamente' (não 'failed': a aprovação vale)"
  - "O motivo do comentário de falha é a primeira linha da mensagem do erro, até 200 caracteres; o aviso de falha tem Idempotency-Key summary:<runId>:falha e, se ele próprio falhar, só é logado"
  - "processManualPayment passa o parsed do comentário recém-mapeado para publicarResumoDepoisDaAprovacao (não relê da linha, que pode guardar o RESUMO anterior); a releitura da linha usa a origem só quando pedida (plataforma), mantendo byte a byte a chamada dos caminhos ClickUp"
  - "Rejeitada na plataforma: run 'failed' + evento 'Pagamento reprovado.' como em analyzeApprovalComment; o comentário de S6 sai mesmo sem linha (a Solicitação existe na plataforma)"

requirements-completed: [RES-05]

# Metrics
duration: ~75min
completed: 2026-09-29
---

# Phase 06 Plan 05: S5/S6 em handlePlatformApprovalDecision Summary

**Aprovar por clique na plataforma agora roda conta → fornecedor/categoria no Omie → `📋 RESUMO DE PAGAMENTO` na própria Solicitação, e reprovar avisa quem pediu, tudo por `PaymentRequestAdapter` e nunca por `legacyClickUpRaw()`; se o Omie ou o RAG estiverem fora, a aprovação fica e a Solicitação recebe "Não consegui montar o Resumo: <motivo>".**

## Performance

- **Duration:** ~75 min (inclui uma parada do watchdog logo depois da leitura inicial)
- **Completed:** 2026-09-29
- **Tasks:** 1/1
- **Files modified:** 3 (financeiro-tria)

## Accomplishments

- `publicarResumoDepoisDaAprovacao(runId, taskId, solicitacao, { parsed?, origem? })` extraído de `analyzeApprovalComment` e `processManualPayment`; os três caminhos o usam (`grep -c` = 5: definição, 3 usos, 1 menção no doc do handler).
- `handlePlatformApprovalDecision`: depois de `Aprovado` + `updateTaskStatus`,
  - `aprovada` com linha `origem: "plataforma"` ⇒ S5 em `try/catch`; sucesso ⇒ run `waiting_human_release`, tarefa de aprovação `financeiro_final`, `resumoPublicado: true`;
  - `aprovada` sem linha ⇒ só o Status, `console.warn("[plataforma] sem linha em solicitacoes_pagamentos; Resumo não publicado")` + evento, `resumoPublicado: false`;
  - `rejeitada` ⇒ `TEXTO_DA_REPROVACAO` sem Menção, `approval-comment:<runId>:rejected-comment`, run `failed`;
  - falha no S5 ⇒ `registrarFalhaDoResumo` (run + evento + comentário `Não consegui montar o Resumo: <motivo>`), nunca lança.
- `sed -n '/async handlePlatformApprovalDecision/,/^  }/p' … | grep -c legacyClickUpRaw` = **0**.
- README do `automation/`: linha dos webhooks da plataforma dizendo que S5/S6 são feitos pelo pipeline.

## Task Commits

1. **Task 1: S5/S6 em handlePlatformApprovalDecision, pela porta e só pela porta** - `2cd13cd` (feat) em financeiro-tria
   `feat(plataforma): aprovação por clique publica o RESUMO e a reprovação avisa, pela porta (S5/S6)`

TDD: um commit só (o plano pede commit atômico da task). O RED foi provado sem commit: os testes novos contra o `payment-automation-service.ts` de HEAD (5a65e5b) davam 11 pass / 4 fail (S5 (a), S5 (b), S6 (c), S5 (d)); (e) passava em HEAD, como esperado de uma guarda.

## Testes adicionados (payment-automation-service.plataforma.test.ts)

Cenário: serviço REAL, fonte plataforma, `AutomationStore` sobre o PostgREST falso (com `matchCategory` → `[]`), `OmieAdapter` REAL contra `criarServidorOmieFalso` em loopback, IA falsa do Resumo, `legacyClickUpRaw` trocado por falso que lança e conta, `clickUpAdapter` espionado.

| Caso | Prova |
|---|---|
| S5 (a) | 1 `createComment` depois do Status, começa com `📋 RESUMO DE PAGAMENTO`, key `summary:task:<id>:comment`, Menção `mem_contas_a_pagar`; Omie recebeu `ListarClientesResumido` e `ListarCategorias` com a credencial da configuração; linha única com `ThreadID`/`ComentarioID`/`comentario` |
| S5 (b) | sem linha: 1 Status, 0 comentários, 0 chamadas ao Omie, 0 linhas, aviso `[plataforma] sem linha…` |
| S6 (c) | 1 comentário com o texto de S6, `mentionMemberIds: []`, key `approval-comment:task:<id>:rejected-comment`, 0 chamadas ao Omie, `Aprovado: false` |
| S5 (d) | Omie lança em `ensureSupplier`: resolve com `resumoPublicado: false`, `motivo` = 1ª linha; Status já mudou; comentário `Não consegui montar o Resumo: Omie fora do ar: HTTP 503`; `Aprovado: true` mantido |
| (e) | aprovada e rejeitada: raw 0 chamadas, `clickUpAdapter` 0; e o falso está mesmo no lugar (pedi-lo lança) |

Todos os casos (a)–(d) também afirmam raw 0 e ClickUp 0.

## Verificação

- `npx tsc --noEmit -p .` — verde.
- `npm test` — antes: **566/566**; depois: **571/571** (0 fail). `payment-automation-service.legado.test.ts` verde **sem edição**; os testes (a)–(j) existentes do arquivo da plataforma verdes sem edição (o (f) agora passa pelo ramo de falha do S5, porque o Omie dele é porta proibida — continua verde).
- Mutações (arquivo restaurado e conferido com `cmp` depois de cada uma):
  1. `handlePlatformApprovalDecision` chama `legacyClickUpRaw()` (dentro de `try/catch`) ⇒ **(e) falha**, e também S5 (a), (b), (d) (asserção raw = 0).
  2. exceção do S5 propaga (`throw error` depois de `registrarFalhaDoResumo`) ⇒ **S5 (d) falha** (e o (f) existente).
  3. comentário de rejeição com Menção (`[decidedByMemberId]`) ⇒ **S6 (c) falha**.
  4. (caminhos existentes) `postPaymentSummary` só roda quando há `origem` ⇒ o legado `fluxo manual (ClickUp): fornecedor novo é criado no Omie…` **falha** — os caminhos do ClickUp passam mesmo pelo método extraído e o teste legado sem edição os guarda.
- Commit: `git diff --cached --stat` com só os 3 caminhos; CR de HEAD = CR da árvore = 0 nos três; os 89 arquivos sujos por EOL continuam fora (`git status --short | wc -l` = 89 depois do commit).

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RESUMO na plataforma mencionava o id do ClickUp de Contas a Pagar**
- **Found during:** Task 1
- **Issue:** `postPaymentSummary` manda `mentionMemberIds: [CLICKUP_CONTAS_A_PAGAR_ID]` (id do ClickUp, `81581816`). Na coorte plataforma isso é um id que a plataforma não conhece (o mesmo motivo que levou `assignResponsible` a traduzir a Menção) — o RESUMO do S5 seria recusado.
- **Fix:** na coorte plataforma, a Menção é `membroDaPlataformaDoResponsavel(contasAPagarId)`; sem tradução, sai sem Menção. Fonte ClickUp inalterada.
- **Files modified:** payment-automation-service.ts
- **Commit:** 2cd13cd

**2. [Rule 2 - Missing critical] Passo só-ClickUp registrado**
- O ramo `approved` do ClickUp também atribui a Tarefa a Contas a Pagar (`addAssignees`, raw). Na plataforma ele é pulado com `console.info("[plataforma] passo atribuir_contas_a_pagar ignorado: exige ClickUp")`, como a verdade do plano pede.

**3. Observação de teste** — o import `OmieAdapter` do arquivo de teste já existia como `import type`; o valor foi importado com alias (`OmieAdapterReal`) para não editar linhas existentes.

## Issues Encountered

- Watchdog parou o agente logo depois da checagem inicial dos três arquivos (nada tinha sido modificado); retomado do mesmo ponto.
- A primeira execução do `npm test` completo (baseline) levou ~15 min (máquina concorrida) e foi para background; a execução final levou 18 s.
- Uma chamada Bash teve "classifier gave no verdict" (transiente); repetida uma vez, como instruído, e passou. Nenhuma verificação ficou bloqueada.

## Known Stubs

None.

## Threat Flags

None — nenhuma superfície nova: o handler já era alcançado pelo webhook autenticado; o texto novo que vai para a Solicitação é a 1ª linha da mensagem de erro (até 200 caracteres). As mensagens de `ErroDoOmie` trazem call/faultcode/faultstring, não credenciais.

## Next Phase Readiness

- A coorte plataforma tem o encadeamento 3 → 4 → 5; o Financeiro vê o mesmo RESUMO na Solicitação.
- Pendente fora deste plano: `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` precisa do par `81581816=<Membro de Contas a Pagar>` em produção para o RESUMO sair com Menção.

## Self-Check: PASSED

- FOUND: automation/src/tenants/tria/payment-automation-service.ts, payment-automation-service.plataforma.test.ts, README.md (no commit 2cd13cd)
- FOUND: commit 2cd13cd em financeiro-tria (`git log --oneline -1`)
