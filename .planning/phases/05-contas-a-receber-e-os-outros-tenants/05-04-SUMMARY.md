---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 04
subsystem: automation
tags: [tenant-routing, webhooks, fail-closed, multi-tenant]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 01)
    provides: "Marcos Paulo como 12ª opção do Campo Empresa em seed-financeiro.ts"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 03)
    provides: "contrato v1 com CamposSchema.company e getTask, usados por resolverTenantDaTarefa"
provides:
  - "TENANT_POR_EMPRESA — a tabela total de doze linhas, sem fallback, que decide qual dos três serviços atende cada Empresa"
  - "tenantDaEmpresa — resolução por igualdade literal ou normalizada (NFD/uppercase/trim), undefined para qualquer Empresa fora da tabela"
  - "resolverTenantDaTarefa nos três webhooks da plataforma — a Empresa vem de getTask (busca autenticada de volta), nunca do corpo do webhook (T-5-02)"
  - "código de erro EMPRESA_DESCONHECIDA (422 permanente), com MENSAGENS_FIXAS que nunca cita o valor da Empresa (T-5-13)"
  - "confirmação humana registrada da tabela inteira, condição para ela valer em produção (T-5-14)"
affects: ["05-05 (o corte dos webhooks do ClickUp depende desta tabela já valer)", "qualquer plano futuro que reabra o caminho FINQ/Konq por payment-rules.ts precisa revisitar a divergência (a) registrada aqui"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabela total sem fallback: undefined é o único caminho para 'fora da tabela', nunca um `?? \"tria\"` — contraste deliberado com routes.ts#pickService"
    - "Resolução de tenant por busca autenticada de volta (getTask), nunca por campo declarado no corpo de um webhook — mitigação de tenant spoofing"
    - "Recusa permanente (422) DENTRO do try, depois do receipt idempotente — mesma doutrina de qualquer outra recusa de webhooks-plataforma.ts"
    - "servicos: Record<TenantId, PaymentService> substitui um service único nos deps injetáveis, reusando o mesmo mapa que routes.ts já monta"

key-files:
  created:
    - ../financeiro-tria/automation/src/tenants/empresa-para-tenant.ts
    - ../financeiro-tria/automation/src/tenants/empresa-para-tenant.test.ts
  modified:
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts
    - ../financeiro-tria/automation/src/http/routes.ts

key-decisions:
  - "\"Konq Intermediações\" → tria (não family-office, apesar de aparecer no mapa `empresas` do Family Office): D5-08 mantém o caminho FINQ fora de payment-rules.ts, e é o serviço da Tria (finqCategoryBank) que atende FINQ/Konq hoje. Confirmado pelo humano em 2026-09-24."
  - "\"Marcos Paulo\" → marcos-paulo (não family-office, apesar de family-office/config.ts também listar essa Empresa com um banco de categorias diferente): a tabela decide QUAL serviço, não qual banco — quem decide o banco continua sendo resolveAccountConfig do serviço escolhido. Confirmado pelo humano em 2026-09-24."
  - "A tabela está confirmada mas NÃO está em produção: o deploy de automation/ é parte do corte do plano 05-05, de responsabilidade do dono do produto — este plano só implementa e confirma o conteúdo."

requirements-completed: []

# Metrics
duration: ~25min (Tasks 1-2, sessão anterior) + verificação e checkpoint (esta sessão)
completed: 2026-09-24
---

# Phase 05 Plan 04: A tabela Empresa → tenant e os três webhooks que a consultam Summary

**Tabela total de doze linhas (Empresa → tenant), sem fallback, consultada pelos três webhooks da plataforma via `resolverTenantDaTarefa` (Empresa buscada de volta por `getTask`, nunca do corpo do evento); Empresa fora da tabela é 422 `EMPRESA_DESCONHECIDA` sem efeito colateral. A tabela foi confirmada linha a linha por um humano nesta sessão.**

## Performance

- **Duration:** Tasks 1-2 em sessão anterior (~25min, commits 09:49–09:54 -03:00); Task 3 (checkpoint) respondida e fechada nesta sessão
- **Completed:** 2026-09-24
- **Tasks:** 3/3 (2 auto + 1 checkpoint bloqueante)
- **Files modified:** 5, todos em `../financeiro-tria/automation/`

## Accomplishments

- `empresa-para-tenant.ts` — `TENANT_POR_EMPRESA` com as doze Empresas exatas do Campo `Empresa` (`packages/dominio/src/seed-financeiro.ts:190`), `tenantDaEmpresa` resolvendo por igualdade literal ou normalizada (NFD, uppercase, trim), nunca por omissão. Cabeçalho documenta as duas divergências conhecidas entre as fontes (Konq/FINQ e o banco de categorias de Marcos Paulo) — as mesmas que o checkpoint desta sessão confirmou.
- `webhooks-plataforma.ts` — `DepsWebhooksDaPlataforma.service` (um serviço) virou `.servicos` (um por tenant) + `.obterTarefa` opcional; `resolverTenantDaTarefa` busca a Tarefa de volta por `getTask`, lê `fields.company`, resolve pelo `tenantDaEmpresa` e lança `ErroPermanenteDaPlataforma` com `EMPRESA_DESCONHECIDA` quando a Empresa não resolve — o literal `tenantId: "tria"` da linha 347 saiu do código.
- Os três handlers (`solicitacao-criada`, `comentario-criado`, `aprovacao-decidida`) passam a escolher o serviço pela Empresa resolvida, dentro do `try`, depois do receipt idempotente — uma recusa vira 422 com o receipt marcado `falhou`, como qualquer outra recusa permanente.
- `routes.ts` passa o mesmo mapa `services` que `automationRouter` já monta, em vez de só `triaPaymentService` — nenhum literal duplicado.
- Testes: `empresa-para-tenant.test.ts` (12 casos de resolução + normalização + valores fora da tabela + integridade contra `services`) e `webhooks-plataforma.test.ts` (+7 casos: os três tenants roteados corretamente, Empresa `null`/desconhecida em 422 com zero chamadas de serviço, corpo da resposta sem o valor da Empresa).
- **Task 3 (checkpoint bloqueante) respondida nesta sessão** — ver seção seguinte. Nenhuma linha da tabela foi corrigida; o código commitado na Task 1 já é o que vale.

## Confirmação humana da Task 3 (registrada verbatim, 2026-09-24)

Perguntas do plano (`how-to-verify`) e respostas do humano, através do diálogo do orquestrador:

1. **"Konq Intermediações vai para o serviço da Tria?"** → **"Confirmo: tria"**
2. **"Solicitações com Empresa 'Marcos Paulo' são do tenant marcos-paulo (banco conciliador_contas_pagar_pf), e não do Family Office?"** → **"Confirmo: marcos-paulo"**
3. **"As outras dez linhas estão certas?"** → **"Todas certas"**

Nenhuma correção. `TENANT_POR_EMPRESA` permanece exatamente como commitado em `9a7e723` — nenhum código foi editado nesta sessão.

## Task Commits

Cada task foi commitada atomicamente no repositório irmão `../financeiro-tria` (branch `main`):

1. **Task 1: A tabela total Empresa → tenant, sem fallback** — `9a7e723` (feat) — `automation/src/tenants/empresa-para-tenant.ts`, `empresa-para-tenant.test.ts` (16 testes)
2. **Task 2: Os três handlers resolvem o tenant pela Tarefa, Empresa desconhecida é 422** — `25716c1` (feat) — `automation/src/http/webhooks-plataforma.ts`, `webhooks-plataforma.test.ts` (+7), `automation/src/http/routes.ts`
3. **Task 3: checkpoint bloqueante** — sem commit de código (nenhuma correção); a resposta humana está registrada nesta SUMMARY

**Plan metadata:** este arquivo, commitado em `crm-n1` (não em `financeiro-tria`)

_Nota CON-05: as SHAs acima são do repositório irmão `../financeiro-tria`, um repositório git distinto de `crm-n1`. Nenhum arquivo deste plano vive em `crm-n1`._

## Files Created/Modified

- `../financeiro-tria/automation/src/tenants/empresa-para-tenant.ts` — `TenantId`, `TENANT_POR_EMPRESA`, `tenantDaEmpresa` (novo)
- `../financeiro-tria/automation/src/tenants/empresa-para-tenant.test.ts` — 16 testes (novo)
- `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` — `resolverTenantDaTarefa`, `EMPRESA_DESCONHECIDA`, `.servicos`/`.obterTarefa` nos deps (modificado)
- `../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts` — +7 testes de roteamento e recusa (modificado)
- `../financeiro-tria/automation/src/http/routes.ts` — passa o mapa `services` para `montarWebhooksDaPlataforma` (modificado)

## Decisions Made

- Ver `key-decisions` no frontmatter: as duas divergências (Konq/FINQ → tria; Marcos Paulo → marcos-paulo) foram confirmadas pelo humano sem correção.
- A tabela está confirmada mas **não está em produção**. O deploy de `automation/` com este código é parte do corte descrito no plano 05-05, de responsabilidade do dono do produto — este plano entrega e confirma o conteúdo, não o publica.

## Deviations from Plan

None — plano executado exatamente como escrito. O checkpoint da Task 3 não gerou nenhuma correção de código; a resposta humana confirmou a tabela tal como commitada na Task 1.

## Issues Encountered

None.

## Verificação executada nesta sessão

- Ambos os commits do repositório irmão confirmados em `git -C ../financeiro-tria log --oneline -5` (`9a7e723`, `25716c1` presentes, com `6db51b8` acima na história — trabalho de outro plano, não deste).
- Conteúdo de `empresa-para-tenant.ts` lido linha a linha: as doze entradas batem exatamente com o plano, e o comentário de cabeçalho documenta as duas divergências que o checkpoint confirma.
- `cd ../financeiro-tria/automation && npx tsx --test --test-concurrency=1 src/tenants/empresa-para-tenant.test.ts src/http/webhooks-plataforma.test.ts` (redirecionado a arquivo, sem pipe) → **37/37 passaram, exit 0**.
- Verificação da sessão anterior (Tasks 1-2), preservada aqui: `npx tsc --noEmit` verde em `automation`; `npm test` 171/172 (a única falha é o defeito pré-existente conhecido em `src/tenants/tria/payment-rules.test.ts:37`, item 1 do `deferred-items.md` da Fase 4 — não relacionado a este plano).

## User Setup Required

None diretamente deste plano. Nota operacional: o deploy de `automation/` com esta tabela (necessário para ela valer em produção) é escopo do plano 05-05, dono é o dono do produto — não uma configuração de serviço externo deste plano.

## Next Phase Readiness

- TEN-01 avança (não fecha: a mitigação T-5-14 — tabela confirmada por humano — está satisfeita; o requisito como um todo cobre o corte dos webhooks do ClickUp, que é 05-05). `requirements-completed` fica vazio de propósito nesta SUMMARY: TEN-01 abrange a fase inteira e não deve ser marcado como completo aqui.
- 05-05 pode contar com `TENANT_POR_EMPRESA`/`tenantDaEmpresa`/`resolverTenantDaTarefa` prontos e confirmados quando planejar o corte dos webhooks do ClickUp — falta só o deploy.
- Nenhum bloqueio para planos seguintes da Onda 3/4.

## Self-Check: PASSED

Ambos os commits do repositório irmão encontrados: `git -C ../financeiro-tria log --oneline --all | grep 9a7e723` → FOUND; `grep 25716c1` → FOUND. Arquivo `../financeiro-tria/automation/src/tenants/empresa-para-tenant.ts` lido e confirmado em disco com as doze entradas. Suíte escopada re-executada nesta sessão: 37/37, exit 0.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
