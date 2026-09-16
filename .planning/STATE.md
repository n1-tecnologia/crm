---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01-06-PLAN.md (migração 002 — colunas geradas e índices, aplicada no Supabase do projeto) — 12/12 testes de persistência verdes
last_updated: "2026-09-16T15:00:00.000Z"
last_activity: 2026-09-16 -- Phase 1 execution started
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 9
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-15)

**Core value:** Um solicitante cria o pedido no CRM N1 e o Financeiro opera Contas a pagar de ponta a ponta sem abrir o ClickUp — dados no Postgres próprio, regras de `@n1/dominio` intactas.
**Current focus:** Phase 1 — o-crm-n1-ganha-persist-ncia-e-login

## Current Position

Phase: 1 (o-crm-n1-ganha-persist-ncia-e-login) — EXECUTING
Plan: 4 of 9
Status: Ready to execute
Last activity: 2026-09-16 -- Phase 1 execution started

Progress: [░░░░░░░░░░] 0% (de planos GSD; em requisitos: 4/34 feitos, 2 deles da Phase 1)

**Restante da Phase 1:** rotas HTTP por operação (PERS-04 — inclui escolher a camada HTTP), `store.ts` → `POST /operacoes/:nome` (PERS-05), bootstrap do Espaço "Gestão" sem Tarefas fictícias (PERS-06), colunas geradas/índices — migração `002` (PERS-07), reconvite por Usuário (PERS-09). PERS-08 (deploy do `apps/api`) bloqueado por D11.

**Aberto na Phase 0 (paralela):** spec da Solicitação de pagamento (PREP-03 — maior risco do plano), exportação do ClickUp (PREP-02), de-para de usuários (PREP-04), rotação das credenciais Omie (PREP-05, fora deste repo). Nada disso bloqueia terminar a Phase 1; PREP-03 e PREP-04 **bloqueiam a Phase 2**.

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P03 | 35min | 2 tasks | 9 files |
| Phase 01 P06 | 22min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisões travadas (DEC-01..DEC-17) no bloco `<decisions>` de PROJECT.md; candidatas (CAND-01..07) e questões abertas (D6–D12, OQ-*) nas tabelas logo abaixo dele. As que pesam agora:

- [Phase 1]: DEC-01/02/06 — hidratar o `DataState` inteiro por Espaço, tabela genérica `plataforma.registros`, revisão otimista por Espaço (3 tentativas); as rotas só compõem hidratar → operação → diff.
- [Phase 1]: DEC-08 — projeto Supabase próprio `epomplsskqpluxuujpxl`; nada de JOIN com o `public` do financeiro; cabeçalho de `001-plataforma.sql` está desatualizado quanto a isso.
- [Phase 1]: DEC-09/10 — testes de persistência pulam sem `DATABASE_URL`; migrações numeradas e imutáveis (`002-*.sql` para colunas geradas).
- [Phase 2]: DEC-11/14 — backend do financeiro-tria intacto; `automation/` fala com o `apps/api` só por HTTP pelos 7 métodos.
- [Phase 3]: motor de Automações (AUTO-01) colocado explicitamente na Phase 3 como infraestrutura genérica; o Financeiro é o primeiro cliente.
- [Phase 01]: OPERACOES (registro.ts) tem 132 operações — allowlist de despacho de POST /operacoes/:nome; receiveMessage ficou de fora por não ter actingMemberId como segundo parâmetro — Plan 01-03
- [Phase 01]: PERS-07 fechado: migração 002 (colunas geradas status_id/list_id/due_date + 6 índices parciais, 5 GIN jsonb_path_ops para arrays) aplicada e imutável no Supabase do projeto — Testada contra o banco real (8 casos); persistencia.test.ts continua verde — colunas geradas não entram em hidratar()/gravar()
- [Phase 01]: T-1-SC tratado — checkpoint humano bloqueante aprovou `fastify` 5.12.5, `@fastify/type-provider-zod` 1.0.0 (peer `zod >=4.2.0`, aceita o `zod ^4.6.1` do monorepo, sem fallback), `@fastify/cors` 11.3.0 e `concurrently` 10.0.5 nos repositórios oficiais no npm, antes de qualquer `npm install` da fase — Plan 01-02 liberado

### Pending Todos

Nenhum em `.planning/todos/` ainda. Decisões com prazo (ver ROADMAP.md "Decisões a tomar antes de cada fase"):

- OQ-ADR-01 região do Supabase — decidir até o fim da Phase 1 (barata agora, cara depois)
- D11 onde o `apps/api` roda — antes do adapter da Phase 2
- D6, D8, D9, OQ-PLAN-01, OQ-PF-01, OQ-SYN-02 — antes de planejar a Phase 2

### Blockers/Concerns

- PERS-08 bloqueado por D11 (deploy do `apps/api`); não trava o código da Phase 1.
- PREP-03 (spec da Solicitação) não existe e é pré-requisito de toda a Phase 2 — "o maior risco do plano".
- SOL-01 (D6), SOL-08 (D8) e REC-01 (D7) bloqueados por decisão aberta.
- `rejectUnauthorized: false` em `apps/api/src/persistencia/conexao.ts` — fixar a CA do Supabase antes de o `apps/api` ir para a VPS.
- Sem teste ponta a ponta tela → Postgres nem de sessão → Membro (CONCERNS.md) — fechar na Phase 1.
- Credenciais Omie no histórico do git do financeiro-tria e por linha em `solicitacoes_pagamentos`/`transacoes` — rotacionar (PREP-05), nunca copiar na importação.

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Decisão | D12 — mover o `automation/` para o monorepo | Reavaliar ao fim da Phase 2 (DEC-15) | Plano §7 |
| Requisito | PERS-03 — uma tabela por entidade | Sobreposto por DEC-02; parte viva é PERS-07 | Ingest 2026-09-15 |
| Escopo | Cache local/offline; troca de Espaço na sessão; recorte de hidratação por Lista | Depois da Phase 5, se doer | CONCERNS.md |
| Escopo | Go High Level | Inventário próprio, fora deste plano | 00-LEIA-PRIMEIRO |

## Session Continuity

Last session: 2026-09-16T15:00:00.000Z
Stopped at: Completed 01-01-PLAN.md (checkpoint humano de legitimidade de pacote aprovado — fastify e dependências conferidos no npm; Plan 01-02 liberado)
Resume file: None
