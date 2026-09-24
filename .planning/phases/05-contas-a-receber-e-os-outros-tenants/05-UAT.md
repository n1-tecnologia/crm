---
status: testing
phase: 05-contas-a-receber-e-os-outros-tenants
source: [05-VERIFICATION.md]
started: 2026-09-24T23:59:00Z
updated: 2026-09-24T23:59:00Z
---

## Current Test

number: 1
name: Aplicar a migração de receipts no Supabase do automation/ (05-23 Task 1) — só este arquivo, nunca `supabase db push`
expected: |
  CHECK de `status` com 5 valores (inclui `falhou_retentavel`) e de `event_type` com 4 (inclui
  `automacao.notificar-canal.v1`); `20261001120000_remove_anon_read_painel.sql` continua NÃO aplicada.
awaiting: user response

## Tests

### 1. Migração de receipts no Supabase do automation/ (05-23 Task 1)
expected: CHECK de status com 5 valores e de event_type com 4; a migração do corte do painel (04-14) segue não aplicada. Consultas antes/depois e método de aplicação (colar o arquivo inteiro no SQL Editor) no checkpoint de 05-23.
result: [pending]

### 2. Deploy do automation/ (05-23 Task 2) — pode recusar
expected: GET /health 200 com três tenants; POST /webhooks/plataforma/notificar-canal e /solicitacao-criada sem Authorization → 401; nenhum webhook do ClickUp muda; nenhuma Lista arquivada. Precisa do commit hoje em produção e da presença (só nomes) das variáveis PLATAFORMA_*, EVOLUTION_*, MP_* na VPS.
result: [pending]

### 3. Corte de Marcos Paulo e Family Office (Critério 2, parte B — D5-20)
expected: ou o corte é executado (10 webhooks ClickUp desligados, Listas 901109642259/901111928443 arquivadas, 48h de silêncio) numa fase própria que o dono abre no ROADMAP, ou o Critério 2 é reescrito aceitando a recusa visível como alvo de curto prazo.
result: [pending]

### 4. R7 e o relógio de Contas a receber (adiados em 05-25)
expected: exatamente 1 Tarefa de Saque com recurrence em lst_contas_a_receber; depois do Ensaio lido contra a simulação (executadas 0 / puladas 717), a primeira volta real não age sobre nenhuma das 240 Tarefas históricas. Pré-condições: processo de scheduler em produção (PERS-08) e Membro Agente do pipeline em ws_n1 (D-15).
result: [pending]

### 5. Espaços de teste com Automações temporais no Postgres de produção (WR-A)
expected: antes de ligar AUTOMACOES_WORKER_ATIVO em produção, os ~14 Espaços de teste (ws_outbox_*, ws_spike*, ws_debug_automations, ws_teste_*) são removidos por operação escopada com dry-run, ou o catálogo do worker é restrito a ws_n1.
result: [pending]

### 6. Primeiro WhatsApp real por Canal
expected: com OUTBOX_WORKER_ATIVO=true em produção e uma Automação de Canal publicada na Lista de Solicitações de ws_n1, uma Solicitação nova do Marcos Paulo gera o evento automacao.notificar-canal.v1 e a rota entrega pela Evolution API. Depende dos testes 1 e 2.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
