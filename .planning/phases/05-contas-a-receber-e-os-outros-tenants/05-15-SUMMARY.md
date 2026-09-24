---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 15
subsystem: automation
tags: [webhooks, idempotency, multi-tenant, fail-closed, receipts, retry]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 04)
    provides: "TENANT_POR_EMPRESA/tenantDaEmpresa/resolverTenantDaTarefa — a tabela e a resolução de tenant que este plano estende com o gate de fonte 'plataforma'"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 08)
    provides: "notificar-canal-routes.ts — a rota que reusará receipts-da-plataforma.ts em 05-18 (IN-05)"
provides:
  - "receipts-da-plataforma.ts — módulo neutro com reivindicarReceipt/fecharReceipt/STATUS_DE_RECEIPT; falhou_retentavel permite retentativa honesta de falha transitória (CR-03)"
  - "migração 20260925120000_platform_event_receipts_retentavel_e_canal.sql — NOT YET APPLIED; alarga status (falhou_retentavel) e event_type (automacao.notificar-canal.v1)"
  - "webhooks-plataforma.ts consumindo o módulo neutro nos três handlers — 500 → retentativa → reprocessa, sem perda silenciosa"
  - "TENANTS_COM_FONTE_PLATAFORMA — recusa 422 TENANT_SEM_FONTE_PLATAFORMA para qualquer tenant fora de {tria}, nos três handlers, antes de tocar o serviço (CR-01, D5-20)"
  - "/aprovacao-decidida sem { ignored: true } — ausência de handlePlatformApprovalDecision é erro permanente"
affects: ["05-16 (lacuna aceita: linha presa em 'recebido' por processo morto no meio)", "05-18 (rota de Canal consome receipts-da-plataforma.ts em vez de recriar a lógica)", "05-23 (aplicação humana da migração deste plano)", "qualquer fase futura que porte a fonte 'plataforma' para marcos-paulo/family-office precisa revisitar TENANTS_COM_FONTE_PLATAFORMA"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo neutro compartilhado (não é o contrato v1, não é uma rota) para lógica que duas rotas duplicavam de propósito — corrige a lógica UMA vez, sem acoplar a rota nova ao módulo do contrato v1"
    - "Status de receipt com terceiro estado (falhou_retentavel) distinto de terminal (falhou) — retentativa condicional por UPDATE ... WHERE status = X, corrida resolvida pela contagem de linhas afetadas"
    - "Migração de schema escrita e commitada, nunca aplicada — banner NOT YET APPLIED, proibição explícita de supabase db push citando a outra migração pendente"
    - "Guarda de tenant por allowlist positiva (TENANTS_COM_FONTE_PLATAFORMA), recusa permanente e visível em vez de sucesso silencioso — mesma doutrina fail-closed de TENANT_POR_EMPRESA (05-04)"
    - "Teste com o serviço REAL (não um fake sem dependências) + spy no adapter externo — prova que a recusa acontece antes de qualquer I/O, em vez de esconder a dependência atrás de um fake"

key-files:
  created:
    - ../financeiro-tria/automation/src/http/receipts-da-plataforma.ts
    - ../financeiro-tria/automation/src/http/receipts-da-plataforma.test.ts
    - ../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql
  modified:
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts
    - ../financeiro-tria/automation/src/http/routes.ts

key-decisions:
  - "CR-03 aterrissa UMA vez, num módulo neutro (receipts-da-plataforma.ts), em vez de duas vezes (webhooks-plataforma.ts e, em 05-18, notificar-canal-routes.ts) — a opção IN-05 do 05-REVIEW.md."
  - "CR-01 fecha por RECUSA explícita (D5-20), não por porte: TENANTS_COM_FONTE_PLATAFORMA = {\"tria\"}; nenhum payment-automation-service.ts foi tocado; o corte de 05-05 continua bloqueado e fora deste plano."
  - "A migração de schema que falhou_retentavel e o event_type de Canal exigem foi escrita e commitada, mas NUNCA aplicada — aplicação é 05-23, checkpoint humano."
  - "Ausência de handlePlatformApprovalDecision em /aprovacao-decidida virou erro permanente (TENANT_SEM_FONTE_PLATAFORMA), nunca mais { ignored: true } com receipt concluido."
  - "Os testes (o)/(p) foram reescritos para usar o PaymentAutomationService REAL de marcos-paulo/family-office (com clickUpAdapter.getTask espionado), não o fake sem dependências que escondia CR-01 antes deste plano."

requirements-completed: []  # TEN-01/AUTO-02 abrangem a fase inteira (corte 05-05 e Canal ponta-a-ponta 05-18 continuam pendentes) — não marcados completos aqui, mesma disciplina de 05-04-SUMMARY.md.

# Metrics
duration: ~55min
completed: 2026-09-24
---

# Phase 05 Plan 15: Receipt com retentativa (CR-03) e recusa explícita de MP/FO (CR-01, D5-20) Summary

**Módulo neutro `receipts-da-plataforma.ts` com retentativa honesta de falha transitória (`falhou_retentavel`), migração de schema escrita e NUNCA aplicada, e os três webhooks da plataforma recusando Marcos Paulo/Family Office com `422 TENANT_SEM_FONTE_PLATAFORMA` em vez de descartar a Solicitação ou a decisão de aprovação em silêncio.**

## Performance

- **Duration:** ~55min
- **Completed:** 2026-09-24
- **Tasks:** 3/3
- **Files modified:** 6 (3 novos, 3 modificados), todos em `../financeiro-tria`

## Accomplishments

- **Task 1 — módulo neutro de receipts.** `receipts-da-plataforma.ts` exporta `reivindicarReceipt`/`fecharReceipt`/`STATUS_DE_RECEIPT`/`TABELA_RECEIPTS`/`ClienteDeReceipts`. `STATUS_DE_RECEIPT` tem 5 valores (`recebido`, `processando`, `concluido`, `falhou`, `falhou_retentavel`) e o teste do módulo lê a migração `.sql` e afirma a igualdade entre as duas listas. A migração `20260925120000_platform_event_receipts_retentavel_e_canal.sql` alarga as duas CHECK (status e event_type) por uma busca em `pg_constraint`/`pg_attribute` pela COLUNA (`conkey`), não por nome adivinhado — robusto ao nome gerado pelo Postgres na CHECK original de `20260922140000`. 16 testes, todos verdes; 1 deles prova a corrida (duas reivindicações concorrentes da mesma linha `falhou_retentavel` → exatamente uma `reivindicado`).
- **Task 2 — os três webhooks usam o módulo.** `webhooks-plataforma.ts` apagou `inserirReceiptSeNovo`/`marcarReceipt`/as interfaces locais e passou a importar de `receipts-da-plataforma.ts` (reexportando `ClienteDeReceipts`/`ClienteDeTabelaDeReceipts` para não quebrar `routes.ts`). Uma falha TRANSITÓRIA agora fecha `falhou_retentavel`; a PRÓXIMA entrega do MESMO `eventId` reivindica a linha e reprocessa (novos testes (v)/(w): "500 → retentativa → reprocessa" em `/solicitacao-criada` e `/aprovacao-decidida`, afirmando na ordem 500+falhou_retentavel+0 chamadas → 202 sem `duplicated`+1 chamada+concluido → 202 `duplicated`+nenhuma chamada nova). `/comentario-criado` distingue explicitamente: falha ANTES do 202 também retenta (`falhou_retentavel`); falha do classificador DEPOIS do 202 é sempre `falhou` (nenhum outbox retenta um evento já aceito) — comentário no código registrando essa regra.
- **Task 3 — MP/FO recusam visivelmente (CR-01, D5-20).** `TENANTS_COM_FONTE_PLATAFORMA: ReadonlySet<TenantId> = new Set(["tria"])`; `resolverTenantDaTarefa` lança `ErroPermanenteDaPlataforma(..., "TENANT_SEM_FONTE_PLATAFORMA")` para qualquer tenant fora do conjunto, ANTES de devolver o serviço — vale para os três handlers, porque os três passam por essa função. `/aprovacao-decidida` troca `{ ignored: true, reason: ... }` por um `throw` — ausência de `handlePlatformApprovalDecision` é agora erro permanente. `routes.ts` teve só dois comentários corrigidos (o do tipo `PaymentService` e o do mount); nenhuma linha de código mudou nesse arquivo (confirmado por `git diff` — só linhas `//`/`*`). Os testes (o)/(p), que antes injetavam um serviço falso SEM dependência do ClickUp e afirmavam MP/FO sendo ACIONADOS (consagrando o defeito), foram reescritos para instanciar o `PaymentAutomationService` REAL dos dois tenants com `clickUpAdapter.getTask` espionado por `mock.method` — a prova de que a recusa acontece antes de qualquer I/O. Quatro testes novos: `/aprovacao-decidida` com serviço real (resposta nunca contém "ignored"), `/comentario-criado` com Family Office (recusa antes do 202, classificador nunca roda), ausência de `handlePlatformApprovalDecision` num tenant hipotético dentro de `TENANTS_COM_FONTE_PLATAFORMA`, e um controle direto provando que o serviço real do Marcos Paulo de fato depende do ClickUp.

## Task Commits

Cada task foi commitada atomicamente no repositório irmão `../financeiro-tria` (branch `main`):

1. **Task 1: O módulo neutro de receipts e a migração que ele exige (NOT YET APPLIED)** — `f245337` (feat) — `automation/src/http/receipts-da-plataforma.ts`, `receipts-da-plataforma.test.ts` (16 testes), `supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql`
2. **Task 2: Os três webhooks usam o receipt com retentativa — "500 → retentativa → reprocessa" (CR-03)** — `986f7e7` (feat) — `automation/src/http/webhooks-plataforma.ts`, `webhooks-plataforma.test.ts` (+12 testes, agora 40)
3. **Task 3: Marcos Paulo e Family Office recusam visivelmente (CR-01, D5-20)** — `8049586` (feat) — `automation/src/http/webhooks-plataforma.ts`, `webhooks-plataforma.test.ts` (+4 testes além da reescrita de (o)/(p), agora 28), `automation/src/http/routes.ts` (só comentários)

**Plan metadata:** este arquivo (`05-15-SUMMARY.md`), escrito em `crm-n1` mas **deixado sem commit de propósito** — o orquestrador é quem commita `STATE.md`/`ROADMAP.md`/este SUMMARY nesta onda, para não haver contenção de índice com o executor concorrente do plano 05-14 no mesmo working tree.

_Nota CON-05: as SHAs acima são do repositório irmão `../financeiro-tria`, um repositório git distinto de `crm-n1`. Nenhum arquivo de código deste plano vive em `crm-n1`._

## Files Created/Modified

- `../financeiro-tria/automation/src/http/receipts-da-plataforma.ts` — `reivindicarReceipt`, `fecharReceipt`, `STATUS_DE_RECEIPT`, `TABELA_RECEIPTS`, `ClienteDeReceipts` (novo)
- `../financeiro-tria/automation/src/http/receipts-da-plataforma.test.ts` — 16 testes, incluindo a corrida de `falhou_retentavel` e a igualdade com a migração (novo)
- `../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql` — CHECK alargadas por `conkey`, idempotente, banner NOT YET APPLIED (novo)
- `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` — consome o módulo neutro; `TENANTS_COM_FONTE_PLATAFORMA`; `/aprovacao-decidida` sem `{ ignored: true }` (modificado)
- `../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts` — fake client ampliado; (o)/(p) reescritos com serviço real; +16 testes novos no total das Tasks 2-3 (modificado)
- `../financeiro-tria/automation/src/http/routes.ts` — dois comentários corrigidos, nenhuma mudança de código (modificado)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: CR-03 corrigido uma vez num módulo neutro reusável por 05-18; CR-01 fechado por recusa (D5-20), não por porte — nada de `payment-automation-service.ts` foi tocado e o corte 05-05 permanece bloqueado; a migração de schema foi escrita e commitada mas nunca aplicada (aplicação é 05-23).

## Deviations from Plan

None — plano executado exatamente como escrito. As interfaces do módulo neutro (`FiltroDeSelecaoDeReceipts`/`FiltroDeAtualizacaoDeReceipts`) são uma escolha de design dentro do espaço que o plano deixou explicitamente a critério do executor ("Claude's Discretion" implícito na ação da Task 1 — "de forma que um SupabaseClient real continue atribuível com `as unknown as ClienteDeReceipts`"), não uma mudança de escopo.

## Issues Encountered

None.

## Verificação executada nesta sessão

- **Task 1:** `cd ../financeiro-tria/automation && npx tsx --test --test-concurrency=1 src/http/receipts-da-plataforma.test.ts && npm run build` → 16/16, `===EXIT=0===` nos dois comandos.
- **Task 2:** `npx tsx --test --test-concurrency=1 src/http/webhooks-plataforma.test.ts src/http/receipts-da-plataforma.test.ts && npm run build` → 40/40 + 16/16 (execução conjunta), `===EXIT=0===`.
- **Task 3:** `npx tsx --test --test-concurrency=1 src/http/webhooks-plataforma.test.ts && npm run build` → 28/28, `===EXIT=0===`.
- **Suíte completa do `automation/`:** `npm test` → **210/211**, a única falha é a pré-existente `src/tenants/tria/payment-rules.test.ts:37` (item 1 do `deferred-items.md` da Fase 4) — confirmado que nenhuma falha nova apareceu fora dos arquivos deste plano.
- **Escopo do `git add`:** `git -C ../financeiro-tria diff --cached --name-only` conferido antes de CADA um dos três commits — exatamente os arquivos que a task nomeava, nunca os ~89 arquivos sujos pré-existentes.
- **`routes.ts` só comentário:** `git -C ../financeiro-tria diff automation/src/http/routes.ts` mostra só linhas `//`/`*` alteradas — nenhuma linha de código.
- **Nenhum `payment-automation-service.ts` tocado:** confirmado por `git -C ../financeiro-tria diff --name-only` nos três commits — nenhum arquivo desse nome aparece.
- **`05-05-PLAN.md` intocado:** `git diff --stat .planning/phases/05-contas-a-receber-e-os-outros-tenants/05-05-PLAN.md` (em `crm-n1`) vazio.
- **Nenhuma migração aplicada, nenhum deploy:** `20260925120000_platform_event_receipts_retentavel_e_canal.sql` foi escrita e commitada, nunca rodada contra nenhum Postgres — aplicação é 05-23 (checkpoint humano). Nenhum `git push`, nenhum PM2 reload, nenhum deploy de `automation/` aconteceu nesta sessão.
- **`ignored: true` erradicado:** `grep -n "ignored: true" webhooks-plataforma.ts` não devolve nada.
- **`TENANT_SEM_FONTE_PLATAFORMA` presente 4×:** mensagem fixa, `resolverTenantDaTarefa`, `/aprovacao-decidida`, e a checagem de ausência do handler.

## User Setup Required

None diretamente deste plano. Nota operacional: a migração `20260925120000_platform_event_receipts_retentavel_e_canal.sql` precisa ser aplicada manualmente (colar no SQL Editor do Supabase Studio, **nunca** `supabase db push` enquanto `20261001120000_remove_anon_read_painel.sql` estiver pendente) antes que `falhou_retentavel` ou o `event_type` de Canal sejam graváveis num banco real — isso é escopo do plano 05-23, dono é o dono do produto.

## Next Phase Readiness

- **05-16** pode tratar a lacuna conhecida e aceita (linha presa em `recebido` quando o processo morre no meio do efeito) — documentada no cabeçalho de `receipts-da-plataforma.ts`, não corrigida aqui de propósito.
- **05-18** (rota de Canal) pode consumir `reivindicarReceipt`/`fecharReceipt` de `receipts-da-plataforma.ts` em vez de recriar a lógica de receipt em `notificar-canal-routes.ts` — o módulo já existe e já está testado para os dois usos (novo/reivindicado/duplicado/erro).
- **05-23** tem a migração pronta para aplicar, com banner e proteção contra `supabase db push` acidental.
- CR-02 (Canal não funciona ponta a ponta em nenhuma configuração) e o corte de 05-05 (webhooks do ClickUp + arquivamento das Listas) continuam em aberto — fora do escopo deste plano por decisão de D5-21.

## Self-Check: PASSED

Todos os três commits do repositório irmão encontrados: `git -C ../financeiro-tria log --oneline --all | grep f245337` → FOUND; `grep 986f7e7` → FOUND; `grep 8049586` → FOUND. Os três arquivos novos da Task 1 lidos e confirmados em disco. `npm test` re-executado nesta sessão: 210/211, único gap é o pré-existente.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
