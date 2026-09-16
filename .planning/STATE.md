---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Completed 01-11-PLAN.md (CR-02 — POST /operacoes/:nome valida a forma dos args antes do despacho e mapeia TypeError para 400; gap 2 de 01-VERIFICATION.md fechado) — falta 01-10 (CR-01) para a Fase 1 fechar de novo"
last_updated: "2026-09-16T19:40:12.986Z"
last_activity: "2026-09-16 -- Plan 01-11 executado (CR-02 — validação de argumentos em POST /operacoes/:nome)"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 11
  completed_plans: 10
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-15)

**Core value:** Um solicitante cria o pedido no CRM N1 e o Financeiro opera Contas a pagar de ponta a ponta sem abrir o ClickUp — dados no Postgres próprio, regras de `@n1/dominio` intactas.
**Current focus:** Phase 01 — O CRM N1 ganha persistência e login

## Current Position

Phase: 01 (O CRM N1 ganha persistência e login) — EXECUTING (fechamento de lacunas)
Plan: 11 of 11 executado (01-11, CR-02); falta 01-10 (CR-01) para a Fase 1 fechar de novo
Status: Plan 01-11 completo — pronto para executar 01-10, depois nova rodada de /gsd-verify-phase 1
Last activity: 2026-09-16 -- Plan 01-11 executado (CR-02 — validação de argumentos em POST /operacoes/:nome)

Progress: [█████████░] 91% (10/11 planos GSD; em requisitos: 4/34 feitos, 2 deles da Phase 1 — PERS-04 desta vez com o gap de validação fechado)

**Restante da Phase 1:** Plan 01-10 (CR-01 — reconvite por Usuário: casar `existing` por `userId` OU `invitedIdentity`, com `userId` prevalecendo). Os 9 planos originais (01-01..01-09) e o gap-closure de CR-02 (01-11) estão feitos. PERS-08 (deploy do `apps/api`) bloqueado por D11.

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
| Phase 01 P02 | 75min | 3 tasks | 17 files |
| Phase 01 P07 | 25min | 3 tasks | 10 files |
| Phase 01 P04 | 55min | 2 tasks | 10 files |
| Phase 01 P05 | 45min | 3 tasks | 11 files |
| Phase 01 P08 | 50min | 2 tasks | 10 files |
| Phase 01 P09 | 40min | 2 tasks | 3 files |
| Phase 01 P11 | 25min | 3 tasks | 5 files |

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
- [Phase 01]: D-02 materializado — apps/api verifica o JWT do Supabase por getClaims() e resolve o Membro por userId dentro do WORKSPACE_ID configurado, nunca por id que o cliente mande (T-1-02); state ativo/suspenso passam, removido/pendente 403 — a mesma regra do front, agora aplicada de verdade pelo backend — Plan 01-02
- [Phase 01]: .gitignore ganhou exceção !.env.example/!.env.local.example — o padrão .env* pré-existente ignorava também os exemplos, então apps/api/.env.example nunca tinha sido commitado; sem segredo real nos três .example agora rastreados — Plan 01-02
- [Phase 01]: Plan 01-07: store.ts hidrata de GET /estado e grava por POST /operacoes/:nome via um Transporte (transporteHttp/transporteEmMemoria); run() clona o DataState e decide a recusa do domínio sem rede (D-05); revisão defasada ou 409 sempre re-hidratam (D-06) — API pública do store (useData/useSession/useCurrentMember/useRun/useLastResult) inalterada; buildProductSeed() só sobrevive em PublicoProvider (OQ-PF-01)
- [Phase 01]: PERS-04 fechado: POST /operacoes/:nome (despacho por OPERACOES) e GET /estado servem os 132 casos de uso do domínio pela Unidade de Trabalho; gravar() devolve registros (não contagens), executar() sincroniza nextId e devolve revisao/revisaoAnterior (D-03/D-06) — Plan 01-04
- [Phase 01]: syncIdSequence (packages/dominio/src/operations/activity.ts) casava qualquer id hand-authored de 6+ caracteres como sequência base36, estourando Number.MAX_SAFE_INTEGER com ids reais do seed (agt_classificador) e gerando ids duplicados — corrigido para casar só exatamente 6 caracteres, a largura que nextId() produz — Plan 01-04, Rule 1
- [Phase 01]: PERS-06 fechado: applyContasAPagar/applyContasAReceber ganham opcoes.fixtures (padrao true) preservando buildSeed() byte a byte (233 testes provam); buildGestaoBootstrap() monta o DataState de producao so com a config do Financeiro + Maryane Proprietaria; bootstrapGestao() grava via semear() guardado por count(*)>0 - rodado contra o Supabase real, ws_n1 criado com 98 registros sem tasks/contacts/activity, segunda execucao confirmada no-op
- [Phase 01]: PERS-09 fechado: inviteMember casa existing por userId antes de invitedIdentity quando o input traz o dado; resolverUsuarioPorEmail (apps/api) pagina admin.listUsers (sem filtro nativo por e-mail, A1 confirmada) e convidarMembro compõe I/O + operação antes de executar() — reconvite reativa o mesmo Membro removido de ponta a ponta, provado contra Postgres e Auth reais; SERVICOS na rota descarta qualquer userId do corpo (T-1-08)
- [Phase 01]: Fase 1 fechada: e2e/criar-conta.test.ts prova o critério 1 do ROADMAP inteiro por app.inject() contra o Supabase real (bootstrap → Membro real cria Conta → recarga → recusa em 200 → segundo processo sem colisão de ids → aplicarDiferenca ≡ re-hidratação); apps/api/README.md fecha o roteiro operacional e documenta PERS-08 como bloqueado por D11, sem nenhuma ação de deploy; npm run check verde nos três workspaces com e sem DATABASE_URL (357 testes com o Supabase real; os três arquivos de teste originais do domínio sem diff desde d713253) — Plan 01-09
- [Phase 01]: Plan 01-11 fechado: CR-02 (gap 2 de 01-VERIFICATION.md) — esquemaDeArgumentos(nome) valida a FORMA dos args de POST /operacoes/:nome (23 schemas por operação via satisfies contra ArgumentosDe<N>, fallback estrutural de profundidade 6 para as demais) ANTES do despacho; TypeError dentro de uma operação sem schema próprio vira 400 com rollback (nunca 500); inviteMember fica fora de ESQUEMAS de propósito (T-1-08 preservado); app.ts e packages/dominio/apps/web intocados

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

Last session: 2026-09-16T19:39:27.068Z
Stopped at: Completed 01-11-PLAN.md (CR-02 — POST /operacoes/:nome valida a forma dos args antes do despacho e mapeia TypeError para 400; gap 2 de 01-VERIFICATION.md fechado) — falta 01-10 (CR-01) para a Fase 1 fechar de novo
Resume file: None
