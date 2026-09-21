---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 21
subsystem: api
tags: [express, zod, supabase, webhooks, idempotency, outbox, payment-automation]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-12 (porta PaymentRequestAdapter + escape hatch legacyClickUpRaw), Plan 02-13 (contrato HTTP v1 + idempotência), Plan 02-17 (plataforma.ts + platform-adapter-queue.ts), Plan 02-18 (PaymentRequestMapper + mapearSolicitacaoDaPlataforma), Plan 02-10 (outbox + outbox-worker.ts que entrega nestes webhooks)"
provides:
  - "POST /webhooks/plataforma/{solicitacao-criada,comentario-criado,aprovacao-decidida} no automation/, autenticados e idempotentes"
  - "platform_event_receipts (migração escrita, NÃO aplicada) — receipt antes do 202"
  - "Mapper selecionado no composition root (routes.ts), injetado em PaymentAutomationService — D-17"
  - "PaymentAutomationService.handlePlatformApprovalDecision — decisão de aprovação da plataforma sem reclassificação por IA, via this.adapter.updateTaskStatus"
  - "waiting_retry da fila (Plan 02-17) tratado em reviseSummary — run marcado aguardando, nunca sucesso fingido"
affects: [08-migracao-financeiro, fase-3-contas-a-pagar]

tech-stack:
  added: []
  patterns:
    - "Auth-before-parse por handler (constant-time Bearer compare via digesto sha256 + timingSafeEqual), corpo lido só depois — não reaproveita express.json() global"
    - "Receipt idempotente: upsert(...).select() com ignoreDuplicates:true sobre event_id, equivalente a insert...on conflict do nothing returning"
    - "Erro classificado no boundary do webhook: ErroPermanenteDaPlataforma -> 422 (outbox não retenta), ErroTransitorioDaPlataforma -> 500 (outbox reagenda), não classificado -> tratado como permanente por segurança (mesmo princípio de platform-adapter-queue.ts#executar)"
    - "Mapper genérico (PaymentRequestMapper<any>) selecionado no composition root junto do adapter — a entrada muda com a fonte, a saída (SolicitacaoInterna) não"

key-files:
  created:
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts
    - ../financeiro-tria/supabase/migrations/20260922140000_platform_event_receipts.sql
  modified:
    - ../financeiro-tria/automation/src/http/routes.ts
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts

key-decisions:
  - "Migração ESCRITA e commitada, mas NÃO APLICADA — instrução explícita do orquestrador (terceira migração pendente no repositório irmão; owner aplica em ordem: 20260922120000 → 20260922130000 (rodar duplicate check primeiro) → 20260922140000)"
  - "Seleção do mapper (D-17) fecha o ACOPLAMENTO ao mapper legado do ClickUp (payment-automation-service.ts não importa mais mapClickUpTaskToSolicitacaoPagamento — só via this.mapper.mapear()), mas NÃO fecha nenhum dos 6 call sites de legacyClickUpRaw() que alimentavam o mapper: todos os 6 ainda dependem de legacyClickUpRaw().getTask() para ler a Tarefa bruta e checar isTriaPaymentRequestTask, que segue lançando quando a fonte é 'plataforma' (D-21, sem legacyClickUp injetado). Fechamento real: 0 de 6. Ver seção 'Fechamento do escape hatch' abaixo"
  - "aprovacao-decidida NÃO reaproveita syncAndAnalyzeComment/analyzeApprovalComment: essa função tem guardas (isResponsible + isReplyInThread) desenhadas para filtrar comentários da própria automação num webhook de comentário — uma decisão estruturada vinda da plataforma (decision já resolvida, sem parentCommentId quando source='click') falharia essas guardas silenciosamente. Novo método handlePlatformApprovalDecision, opcional em PaymentService, usa a porta updateTaskStatus (nunca o hatch) — e é exatamente a escrita que o Convidado Agente do pipeline tem permissão de fazer (guardStatusWriter, Status apenas)"
  - "server.ts (fora de files_modified) aplica express.json() global ANTES de automationRouter() — isso significa que, em produção, o corpo desta requisição já é consumido pelo Express antes de qualquer handler, mesmo que webhooks-plataforma.ts nunca leia req.body antes de autenticar. A ordem correta está pronta no módulo e provada pela suíte de teste (app isolado, sem express.json() global); falta mover o mount para antes do parser global em server.ts — documentado como gap conhecido, não corrigido (fora do escopo declarado)"

patterns-established:
  - "Webhooks de plataforma (evento -> automation/) seguem: auth constante -> Idempotency-Key -> schema zod .strict() -> receipt insert-antes-do-efeito -> ação -> resposta classificada"

requirements-completed: [SOL-07, SOL-05]

duration: ~70min
completed: 2026-09-21
---

# Phase 02 Plan 21: Webhooks da plataforma — nova entrada do pipeline Summary

**Três webhooks novos em `automation/` (`/webhooks/plataforma/*`) com autenticação em tempo constante antes do parse, receipt idempotente em `platform_event_receipts` antes do 202, e o mapper da fonte selecionado junto do adapter no composition root (D-17).**

## Performance

- **Duration:** ~70 min (estimativa — sem timestamp de início capturado no arranque da sessão)
- **Completed:** 2026-09-21T23:04:00Z
- **Tasks:** 3 (Task 1 é `checkpoint:human-action` — ver seção "Checkpoint" abaixo)
- **Files modified:** 5 (3 novos, 2 modificados) — todos no repositório irmão `financeiro-tria`

## Accomplishments

- `POST /webhooks/plataforma/solicitacao-criada`, `/comentario-criado`, `/aprovacao-decidida` existem, autenticados e idempotentes — a outra metade de SOL-07 (o lado servidor já existia desde o Plan 02-13; este plano é a entrada que o `automation/` recebe)
- Auth-antes-do-parse provado por teste com corpo JSON malformado (caso a): a resposta continua 401, não 400 — o corpo nunca é tocado antes da autenticação passar
- Receipt (`platform_event_receipts`, `event_id` como primary key) inserido ANTES de qualquer efeito — replay do mesmo `eventId` nunca cria um segundo run (casos e/f/g/j)
- Uma recusa permanente do domínio vira `422` (nunca `500`) — o outbox de `crm-n1` não retenta um `422` para sempre; um erro não classificado é tratado como permanente por segurança, mesmo princípio de `platform-adapter-queue.ts#executar`
- Mapper selecionado no composition root: `payment-automation-service.ts` não importa mais `mapClickUpTaskToSolicitacaoPagamento` diretamente — os 5 call sites que chamavam essa função agora chamam `this.mapper.mapear()`, injetado no construtor junto do adapter
- `handlePlatformApprovalDecision` novo (opcional em `PaymentService`): processa a decisão já resolvida da plataforma via `this.adapter.updateTaskStatus` — a porta, nunca o hatch — e é exatamente a escrita que o Convidado `Agente do pipeline` tem permissão de fazer
- `reviseSummary` trata `waiting_retry` da fila (Plan 02-17): quando o comando de comentário não resolve a tempo, o run é marcado aguardando (`outputPayload.waitingCommandId`) e a função retorna sem fingir que o comentário foi publicado
- Migração `platform_event_receipts` escrita e commitada — **NÃO aplicada**, por instrução explícita (ver "Checkpoint")

## Task Commits

Todos no repositório irmão `financeiro-tria` (branch `main`, mesmo padrão dos commits anteriores desta fase nesse repositório):

1. **Task 1: [BLOCKING] Migração `platform_event_receipts`** — `7efd347` (feat) — arquivo escrito e commitado; **migração NÃO aplicada** (checkpoint human-action)
2. **Task 2: Os três webhooks com auth antes do parse e envelope sanitizado** — `afd36c7` (feat)
3. **Task 3: Suíte de idempotência e retomada entre serviços** — `8d6bd70` (test)

**Plan metadata (este arquivo):** commit pendente em `crm-n1` (feito pelo orquestrador/próximo passo, conforme instrução de que este executor não atualiza STATE.md/ROADMAP.md)

## Files Created/Modified

Todos em `../financeiro-tria` (repositório sibling, NÃO em `crm-n1`):

- `automation/src/http/webhooks-plataforma.ts` (novo) — `montarWebhooksDaPlataforma`, `responderErro`, autenticação constante, receipt idempotente, classificação de erro
- `automation/src/http/webhooks-plataforma.test.ts` (novo) — 10 casos (a)–(j), app de teste isolado sem `express.json()` global
- `supabase/migrations/20260922140000_platform_event_receipts.sql` (novo) — tabela `platform_event_receipts` + coluna `waiting_command_id` em `automation_workflow_runs`
- `automation/src/http/routes.ts` — monta o router novo; seleciona o mapper junto do adapter no composition root; `PaymentService.handlePlatformApprovalDecision?` novo (opcional)
- `automation/src/tenants/tria/payment-automation-service.ts` — `mapper` injetado no construtor (e nas DUAS composition roots que instanciam o serviço — `routes.ts` e a instância default usada por `tria-payment-workflow.ts`, achada durante o build); `this.mapper.mapear()` substitui os 5 call sites que chamavam `mapClickUpTaskToSolicitacaoPagamento` direto; `handlePlatformApprovalDecision` novo; `waiting_retry` tratado em `reviseSummary`

## Decisions Made

- **Migração não aplicada, por instrução explícita do orquestrador.** Ver "Checkpoint" — esta é a terceira migração pendente no repositório irmão; a ordem de aplicação está documentada abaixo.
- **Fechamento do escape hatch (D-17) é parcial e reportado honestamente.** A "seleção do mapper" fecha o ACOPLAMENTO DE CÓDIGO ao mapper legado (nenhuma chamada direta a `mapClickUpTaskToSolicitacaoPagamento` sobra em `payment-automation-service.ts` — grep confirma 0), e é o que destrava `origem: "plataforma"` em `SolicitacaoInterna` (comentário já existente em `adapters/supabase.ts#upsertSolicitacaoPagamento`: "a coorte 'plataforma' passa a existir só quando o Plan 02-21 injetar o novo mapper no composition root"). **Mas não fecha nenhum dos 6 call sites de `legacyClickUpRaw()`** que alimentavam esse mapper (`startPaymentRequest`, `processManualPayment`, `syncPaymentRequestFromClickUp`, `syncAllPaymentRequestsFromClickUp`, `launchFromStatusChange`, `runInitialValidation`) — todos os 6 continuam chamando `legacyClickUpRaw().getTask()`/`.listPaymentRequestTasks()` para ler a Tarefa BRUTA (necessária também para `isTriaPaymentRequestTask`, que não é parte da porta do mapper), e `legacyClickUpRaw()` continua lançando quando a fonte é "plataforma" (sem `legacyClickUp` injetado, D-21). Fechamento real: **0 de 6 call sites desbloqueados para a fonte plataforma** — o ganho é estrutural (D-17 cumprido: o serviço usa o mapper INJETADO, nunca um import direto), não funcional (a fonte "plataforma" ainda não consegue passar por esses 6 pontos). Os outros 6 do hatch original (4 `addAssignees` + 2 Status de Contas a Pagar fora do Conjunto da Solicitação) permanecem no hatch, intocados, como o plano determinou.
- **`aprovacao-decidida` não reusa `syncAndAnalyzeComment`.** Essa função (via `analyzeApprovalComment`) tem guardas (`isResponsible && isReplyInThread`) desenhadas para filtrar os próprios comentários da automação num webhook de COMENTÁRIO — uma decisão estruturada da plataforma (`decision` já resolvida; sem `parentCommentId` quando `source: "click"`) falharia essas guardas silenciosamente na maioria dos casos, processando "com sucesso" um no-op. Implementei `handlePlatformApprovalDecision` como método novo, opcional em `PaymentService` (não quebra `marcos-paulo`/`family-office`, que não o implementam), usando `this.adapter.updateTaskStatus` — a PORTA, nunca `legacyClickUpRaw()` — porque "aprovado"/"não aprovado" estão dentro do Conjunto de Status da Solicitação (contrato v1 §4) e é exatamente a escrita que o Convidado `Agente do pipeline` tem permissão de fazer.
- **`comentario-criado` reusa `syncAndAnalyzeComment` sem alteração** — o `parentCommentId` do evento da plataforma corresponde ao `ComentarioID`/thread que a própria automação criou ao pedir aprovação, então as guardas de `analyzeApprovalComment` seguem válidas aqui (mesmo caminho que já funciona para o webhook ClickUp equivalente).
- **`waiting_retry` marca o run via `outputPayload`, não uma coluna dedicada.** `automationStore.updateRun` (o store do Tria, que deriva "run" de `solicitacoes_pagamentos`, não de `automation_workflow_runs`) não tem uma coluna própria para `waiting_command_id` no patch atual — só `outputPayload` (JSON genérico) sobrevive. A migração da Task 1 adiciona `waiting_command_id` a `automation_workflow_runs`, mas essa é uma tabela DIFERENTE da que o serviço do Tria usa hoje (telemetria do `workflow-store.ts`, não consumida por `payment-automation-service.ts`). Marquei o run aguardando via `outputPayload.waitingCommandId`, dentro do escopo de arquivos declarado — reconciliar as duas representações de "run" é maior que este plano.
- **Gap de mount conhecido, não corrigido:** `server.ts` (fora de `files_modified`) aplica `express.json()` GLOBAL antes de `automationRouter()`. Isso significa que, em produção hoje, o corpo de QUALQUER requisição para `/webhooks/plataforma/*` já foi consumido pelo Express antes de `webhooks-plataforma.ts` rodar — independente da ordem interna do módulo (que está correta: autenticação primeiro, leitura do corpo só depois). A suíte de teste prova a ordem correta num app isolado (sem esse parser global). Para a garantia valer ponta-a-ponta, `server.ts` precisa montar este router ANTES do `express.json()` global (mesmo padrão já usado para `bankStatementWebhooksRouter()`) — um ajuste de uma linha, fora do escopo declarado deste plano.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Segunda composition root de `PaymentAutomationService` sem `mapper`**
- **Found during:** Task 2 (`npm run build` após adicionar `mapper` obrigatório ao construtor)
- **Issue:** `payment-automation-service.ts` exporta `paymentAutomationService` (instância default, consumida por `tria-payment-workflow.ts`, fora de `files_modified`) — uma SEGUNDA composition root além de `routes.ts`, que eu não tinha visto no plano. Tornar `mapper` obrigatório no construtor quebrou essa instanciação.
- **Fix:** Injetei `paymentRequestMapperClickUp` nessa instância também (mesmo comportamento anterior — fixa em ClickUp, como já documentado no comentário acima dela).
- **Files modified:** `automation/src/tenants/tria/payment-automation-service.ts`
- **Commit:** `afd36c7`

**2. [Rule 1 - Bug] Comentários com a string literal `mapClickUp`/`handleError` quebrando os greps de aceite**
- **Found during:** Task 2 (verificação manual dos critérios de aceite antes de commitar)
- **Issue:** Comentários explicativos citavam `mapClickUpTaskToSolicitacaoPagamento` e `handleError` por nome — os greps de aceite (`grep -c 'clickUpPaymentMapper\|mapClickUp'` / `grep -n 'handleError'`) não distinguem comentário de código, então bateriam mesmo sem uso real.
- **Fix:** Reescrevi os comentários para descrever o comportamento sem citar os nomes literais.
- **Files modified:** `automation/src/tenants/tria/payment-automation-service.ts`, `automation/src/http/webhooks-plataforma.ts`
- **Commit:** `afd36c7`

---

**Total deviations:** 2 auto-fixed (2 bugs, Rule 1)
**Impact on plan:** Ambos necessários para o build passar e os critérios de aceite baterem literalmente. Sem escopo além do declarado.

## Issues Encountered

- **Tensão entre "auth antes do parse" e o mount real em `server.ts`** — documentada acima em "Decisions Made" e não resolvida (fora do escopo declarado). Reportado explicitamente para o owner decidir se quer um plano de uma linha para corrigir o mount, ou aceitar o gap até a Fase 3.
- **Ambiguidade genuína sobre o que "criar/atualizar o run" significa antes do 202** — o plano fala em processamento "assíncrono", mas `PaymentService` não expõe uma primitiva leve de "só criar o run". Segui o MESMO padrão que os webhooks ClickUp já usam (`await service.<método>()` completo antes de responder) por consistência — mais simples e testável, ao custo de não ser literalmente assíncrono em relação à resposta HTTP. Ver "Decisions Made".

## Verificação honesta (`npm run build && npm test`)

```
cd ../financeiro-tria/automation && npm run build   # tsc --noEmit — EXIT 0
cd ../financeiro-tria/automation && npm test         # tsx --test — 50 testes, 49 passam, 1 falha
```

A falha remanescente é `resolve responsavel por centro de custo com fallback` em `payment-rules.test.ts` — **pré-existente, não relacionada a este plano**, já registrada em `deferred-items.md` da Fase 2 (mencionada no `upstream_context` deste plano). Não foi tocada.

`git -C ../financeiro-tria diff --stat` (arquivos staged desta sessão) lista exatamente os 5 arquivos declarados — os ~89 arquivos de frontend pré-existentes permanecem intocados e não staged em nenhum momento (verificado antes e depois de cada commit).

## User Setup Required

**As três migrações pendentes no repositório `financeiro-tria` precisam ser aplicadas, NESTA ORDEM, pelo owner:**

1. `supabase/migrations/20260922120000_create_platform_adapter_commands.sql` (Plan 02-17)
2. `supabase/migrations/20260922130000_solicitacoes_origem_unique.sql` (Plan 02-18 — **rodar o duplicate check descrito no próprio plano ANTES desta**)
3. `supabase/migrations/20260922140000_platform_event_receipts.sql` (esta — Plan 02-21)

Depois de aplicadas, confirmar:
- `select * from platform_event_receipts limit 1` com a credencial de serviço funciona; com `anon`, é recusado (RLS).
- `automation_workflow_runs` ganhou a coluna `waiting_command_id` sem perder nenhuma coluna existente.

**Variável de ambiente nova:** `PLATAFORMA_WEBHOOK_TOKEN` (o Bearer que os três webhooks exigem — distinto de `PLATAFORMA_SERVICE_TOKEN`, que é para CHAMAR a plataforma, não para RECEBER dela). Sem ela configurada (`optionalEnv`, string vazia por padrão), a fonte ClickUp continua subindo normalmente, mas nenhum request consegue autenticar nos webhooks novos — comportamento seguro por padrão, nunca um "fail open".

**Gap de mount conhecido:** `server.ts` precisa montar `automationRouter()` (ou especificamente o sub-router `/webhooks/plataforma`) ANTES do `express.json()` global para a garantia "auth antes do parse" valer ponta-a-ponta em produção — ver "Decisions Made". Não corrigido neste plano (arquivo fora de `files_modified`).

## Next Phase Readiness

- O pipeline do `automation/` tem entrada própria via os três webhooks — pronta para o outbox de `crm-n1` (Plan 02-10) entregar eventos reais assim que as três migrações forem aplicadas na ordem documentada.
- `handlePlatformApprovalDecision` fecha a aprovação vinda da plataforma sem depender de reclassificação por IA — mas ainda não foi testado contra o Supabase real (só contra os fakes da suíte).
- Os 6 call sites de `legacyClickUpRaw()` que alimentam o mapper legado (guarda de lista + leitura de Tarefa bruta) continuam bloqueando a fonte "plataforma" nesses pontos — reescrevê-los para usar `this.adapter.getTask()` (a porta, que devolve o DTO tipado para QUALQUER fonte) é trabalho de um plano futuro, não coberto aqui.
- O mount de `server.ts` antes do `express.json()` global é um ajuste pequeno e específico, recomendado como próximo passo antes de considerar a proteção "auth antes do parse" completa em produção.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Todos os 5 arquivos declarados em `../financeiro-tria` existem no disco.
- Este SUMMARY.md existe em `crm-n1`.
- Commits verificados via `git log --oneline --all`: `7efd347`, `afd36c7`, `8d6bd70` (financeiro-tria); `e874fa0` (crm-n1, este arquivo).
