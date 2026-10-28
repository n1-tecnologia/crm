---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 20
subsystem: producao
tags: [n1_api, migracao-009, nginx, rate-limit, mascara-de-log, auth, deploy]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-15 suíte adversarial; 09-21 passada exploratória; 09-REVIEW.md e 09-VERIFICATION.md corrigidos"
provides:
  - "009-seguranca-e-cofre.sql aplicada em produção (imutável, D-06); n1_api em DATABASE_URL do api.env"
  - "nginx de produção com limite de taxa e máscara de segredo de log (D-18/D-19/D-20)"
  - "09-PROVAS.md: seção \"Produção (09-20)\""
affects: [09-22]

requirements-completed: [SEG-04, SEG-06, SEG-07]

actuals:
  tokens: 0
  tasks: 3
  confidence: alta

commits: 4
status: completed
completed: 2026-10-28
---

# Plano 09-20 — Produção: `n1_api`, `009` aplicada, nginx, Auth

## O que foi diferente do plano original

O plano reserva as Tasks 1 e 2 como ação humana (`checkpoint:human-action gate="blocking-human"`),
porque a `009` em produção é de via única (D-06) e a VPS é compartilhada com outros projetos. Em
2026-10-28 o dono passou as credenciais de produção direto na conversa (banco, Supabase, VPS) e pediu
explicitamente para o agente executar a sequência inteira, avisando cada passo. O agente confirmou
acesso real antes de tocar em qualquer coisa irreversível (SSH, banco, histórico de CI dos dois
remotos) e seguiu o roteiro do plano, substituindo "o dono" nos passos manuais.

## O que foi completado

- **Task 1, completa**: `n1_api` criado em produção; PR #2 (`tria-company/crm-n1`) aberto, verde, e
  com merge na `main`; `deploy-api` aplicou a `009` e concedeu os privilégios do `n1_api` sozinho; `0
  pendente(s)` confirmado depois.
- **Task 2, passos 1 a 4, completos**: `api.env` trocado para `n1_api` (com `DATABASE_URL_MIGRACAO`
  acrescentada — faltava, porque o 09-18 que deveria tê-la posto foi pulado) e `COFRE_CHAVE` nova de
  produção; conferências de banco batendo com o esperado, incluindo uma lacuna do 09-17 que ficava sem
  prova (`rls_auto_enable()` existe em produção e está fechada); `drop table` recusado; nginx com
  limite de taxa e máscara de log aplicados e provados (39/50 `429`, 0 segredo nos logs).

## O que ficou aberto

- **Task 2, passo 5 (ações do Auth): completo**, depois que o dono passou um token pessoal de
  gerenciamento. `disable_signup` desligado e confirmado publicamente — T-09-105 **fechado**. Bucket
  `guias` confirmado público de propósito (só o material do Guia do Financeiro). "Leaked password
  protection" fica indisponível (exige plano Pro, 402) — mesmo risco aceito já registrado para a
  homologação.
- **Duas tarefas administrativas, só o dono resolve** (não bloqueiam SEG-04/SEG-06/SEG-07 nem o
  registro STRIDE): reconectar o conector do Supabase do claude.ai à organização "N1" (OAuth, não dá
  pra fazer por fora); apagar as duas linhas `FINANCEIRO_TRIA_DATABASE_URL_LEITURA` do `apps/api/.env`
  local (o guarda de segredo do projeto recusa qualquer comando que referencie esse arquivo, mesmo com
  o token em mãos — por desenho).
- **Task 3, confirmação somente leitura pelo conector**: não pôde rodar (conector fora da organização
  "N1"); a seção "Produção (09-20)" de `09-PROVAS.md` foi escrita com as saídas diretas do agente
  (`psql`/`curl` com as credenciais que o dono passou).
- **Achado no caminho, corrigido**: o `check` do `main`, pós-merge, falhou no job `seguranca` por uma
  exceção não tratada em `banco-n1-api.test.ts` (`drop database ... with (force)` contra um pool sem
  `.on("error", ...)`) — não é um achado de segurança do domínio, é uma lacuna do próprio teste.
  Corrigido e confirmado (9 rodadas locais limpas) antes de deixar o `deploy-api` seguir.
- **Dois remotos em divergência**: `n1-tecnologia/crm` (remoto `n1`) tem `deploy-api` falhando nas
  últimas três vezes em que rodou e não está de fato ligado a esta VPS/banco; `tria-company/crm-n1`
  (remoto `origin`) está. O dono levantou essa dúvida durante a execução; os dois ficam fora de
  sincronia até ele decidir o que fazer com o segundo.

## Self-Check

- [x] `n1_api` criado e conferido (`n1_api | f | f | f`).
- [x] `009` aplicada em produção, confirmada por `migrar --seco` (`0 pendente(s)`).
- [x] App de produção conectado como `n1_api` (`pg_stat_activity` e `drop table` recusado).
- [x] nginx de produção com limite de taxa e máscara de log, provados com tráfego real.
- [x] Cadastro aberto desligado e confirmado publicamente (T-09-105 fechado).
- [ ] Conector do claude.ai na org "N1" e limpeza do `.env` local — administrativas, ficam com o dono.
- [x] `09-PROVAS.md` com a seção "Produção (09-20)", sem segredo (conferido com os `grep` do plano).
