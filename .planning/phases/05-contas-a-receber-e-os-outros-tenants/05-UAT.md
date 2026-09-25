---
status: partial
phase: 05-contas-a-receber-e-os-outros-tenants
source: [05-VERIFICATION.md]
started: 2026-09-24T23:59:00Z
updated: 2026-09-25T18:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Migração de receipts no Supabase do automation/ (05-23 Task 1)
expected: CHECK de status com 5 valores e de event_type com 4; a migração do corte do painel (04-14) segue não aplicada. Consultas antes/depois e método de aplicação (colar o arquivo inteiro no SQL Editor) no checkpoint de 05-23.
result: [passed]
evidence: |
  A pré-checagem revelou que a tabela `platform_event_receipts` nem existia — as três migrações da
  Fase 2 (2026-09-22) nunca tinham sido aplicadas em produção. O dono autorizou aplicar as quatro
  migrações pendentes mais uma nova (coluna `origem` em `solicitacoes_pagamentos_marcos_paulo`) numa
  transação só, pelo SQL Editor do projeto `qewznpnmaqhqfyhncdnx` — nunca `supabase db push`.
  Conferência DEPOIS colada no 05-23-SUMMARY.md: `CHECK (event_type = ANY (ARRAY[..4 valores
  incluindo 'automacao.notificar-canal.v1'..]))` e `CHECK (status = ANY (ARRAY[..5 valores
  incluindo 'falhou_retentavel'..]))`.
  Verificado nesta re-verificação por leitura direta dos arquivos (não só pelo SUMMARY):
  - Banners "APPLIED em 2026-09-25 pelo dono do produto, via SQL Editor (Plano 05-23...)" presentes em
    `20260922120000_create_platform_adapter_commands.sql`, `20260922140000_platform_event_receipts.sql`,
    `20260925120000_platform_event_receipts_retentavel_e_canal.sql` e `20260925130000_solicitacoes_mp_origem.sql`.
  - `20260922130000_solicitacoes_origem_unique.sql` tem banner "APLICADA PARCIALMENTE" — só a coluna
    `origem` entrou; o índice único ficou pendente por 180 `TaskID` duplicados (ver item 7 abaixo).
  - `20261001120000_remove_anon_read_painel.sql` continua com banner "NOT YET APPLIED" — o corte do
    painel não foi arrastado junto, como exigido.
  - `git -C ../financeiro-tria show --stat 58c7106` confirma commit tocando exatamente os 5 arquivos
    de migração (4 banners atualizados + 1 arquivo novo), autor do dono, `Co-Authored-By: Claude Opus 5.5`.

### 2. Deploy do automation/ (05-23 Task 2) — pode recusar
expected: GET /health 200 com três tenants; POST /webhooks/plataforma/notificar-canal e /solicitacao-criada sem Authorization → 401; nenhum webhook do ClickUp muda; nenhuma Lista arquivada. Precisa do commit hoje em produção e da presença (só nomes) das variáveis PLATAFORMA_*, EVOLUTION_*, MP_* na VPS.
result: [deferred]
evidence: |
  O dono ADIOU o deploy (verbatim, 2026-09-25): "vamos terminar a faase 5 depois vemos isso". Não é
  uma recusa nem uma pendência esquecida — é uma decisão tomada depois de um inventário somente-leitura
  da VPS (SSH autorizado pelo dono, nada alterado) que mostrou escopo bem maior que o plano previa:
  - Produção está no commit `4149032` (anterior à Fase 2 inteira, não só sem a Fase 5). O deploy real
    levaria 49 commits e ~12.500 linhas em 54 arquivos — não os ~10 commits das Fases 2/5 que o plano
    listava. 48 desses 49 commits não estão no GitHub.
  - O `.env` de produção NÃO tem `PLATAFORMA_WEBHOOK_TOKEN`, `PLATAFORMA_BASE_URL`,
    `PLATAFORMA_SERVICE_TOKEN`, `MP_EVOLUTION_INSTANCE` nem `MP_WHATSAPP_*` — o `user_setup` do
    05-23-PLAN.md presumia "Já configurada" para todas, e estava errado (o boot não quebra hoje
    porque essas variáveis só são lidas sob demanda para a fonte "plataforma"; mas as rotas da
    plataforma ficariam inertes sem elas).
  - `automation/package.json` e o lock estão modificados à mão na VPS (tsx atualizado); um `git pull`
    puro conflitaria.
  A fumaça 200/401/401 NÃO foi executada porque não houve deploy. Fica como passo próprio, fora
  desta fase, com o checklist do que falta (push dos 48 commits, `.env`, resolver o package.json
  sujo) registrado no 05-23-SUMMARY.md.

### 3. Corte de Marcos Paulo e Family Office (Critério 2, parte B — D5-20)
expected: ou o corte é executado (10 webhooks ClickUp desligados, Listas 901109642259/901111928443 arquivadas, 48h de silêncio) numa fase própria que o dono abre no ROADMAP, ou o Critério 2 é reescrito aceitando a recusa visível como alvo de curto prazo.
result: pass
note: "Dono respondeu 'pass' em 2026-09-25. Nenhuma das duas ações estava feita nessa data (o corte não tem fase no ROADMAP e o Critério 2 não foi reescrito) — o pass registra que o dono aceita a recusa visível de MP/FO como estado desta fase."

### 4. R7 e o relógio de Contas a receber (adiados em 05-25)
expected: exatamente 1 Tarefa de Saque com recurrence em lst_contas_a_receber; depois do Ensaio lido contra a simulação (executadas 0 / puladas 717), a primeira volta real não age sobre nenhuma das 240 Tarefas históricas. Pré-condições: processo de scheduler em produção (PERS-08) e Membro Agente do pipeline em ws_n1 (D-15).
result: pass
note: "Dono respondeu 'pass' em 2026-09-25. R7 não aplicado e relógio não ligado nessa data (pré-condições PERS-08/D-15 ausentes) — o pass registra que o dono aceita o adiamento de 05-25."

### 5. Espaços de teste com Automações temporais no Postgres de produção (WR-A)
expected: antes de ligar AUTOMACOES_WORKER_ATIVO em produção, os ~14 Espaços de teste (ws_outbox_*, ws_spike*, ws_debug_automations, ws_teste_*) são removidos por operação escopada com dry-run, ou o catálogo do worker é restrito a ws_n1.
result: pass
note: "Dono respondeu 'pass' em 2026-09-25. Os Espaços de teste não foram removidos nessa data; AUTOMACOES_WORKER_ATIVO segue desligado em produção (o apps/api nem roda lá), então o risco não está ativo. A limpeza continua pré-condição para ligar o worker."

### 6. Primeiro WhatsApp real por Canal
expected: com OUTBOX_WORKER_ATIVO=true em produção e uma Automação de Canal publicada na Lista de Solicitações de ws_n1, uma Solicitação nova do Marcos Paulo gera o evento automacao.notificar-canal.v1 e a rota entrega pela Evolution API. Depende dos testes 1 e 2.
result: [blocked]
evidence: |
  O teste 1 (schema) passou. Este item continua bloqueado pelo teste 2 (deploy), agora adiado pelo
  dono, mais o outbox worker do apps/api em produção (PERS-08) e a decisão de publicar a Automação —
  nenhum dos três aconteceu ainda.

### 7. Índice único (origem, "TaskID") em solicitacoes_pagamentos — novo, achado em 05-23
expected: os 180 TaskID duplicados (1.114 linhas, pior caso 868fjj9cz com 20 ocorrências) têm um destino decidido pelo dono, e então o índice único que protege contra colisão entre as coortes clickup/plataforma na mesma tabela é criado numa migração nova.
result: pass
note: "Dono respondeu 'pass' em 2026-09-25. Os duplicados seguem sem destino e o índice não existe nessa data; o código funciona sem ele (busca a linha antes de gravar). Pendência de dados, não bloqueio desta fase."

### 8. Rotação de credenciais coladas em texto puro durante a Task 2 de 05-23
expected: a senha de root da VPS e a senha do Postgres do Supabase do automation/ são trocadas; o SSH migra para chave; /root/credenciais-financeiro-tria.md (texto puro) é removido da VPS.
result: pass
note: "Dono respondeu 'pass' em 2026-09-25. Não verificado pelo agente (conferir exigiria logar na VPS/banco com a credencial antiga)."

## Summary

total: 8
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 1
deferred: 1

## Gaps

Nenhum gap de código. Os itens pendentes/bloqueados/adiados são todos decisões ou execuções que só
o dono do produto pode tomar (deploy em VPS própria, decisão sobre dados duplicados, corte de
webhooks, infraestrutura de scheduler, rotação de credencial) — nenhum plano de fechamento de
lacunas é necessário para eles.
