---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 23
subsystem: infra
tags: [supabase, automation, migration, receipts, deploy, checkpoint, production]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 15)
    provides: "20260925120000_platform_event_receipts_retentavel_e_canal.sql (NOT YET APPLIED) — a CHECK que aceita falhou_retentavel e automacao.notificar-canal.v1"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 18)
    provides: "CR-02/WR-02/WR-03/CR-03 no automation/ — o que o deploy levaria"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 24)
    provides: "contrato ponta a ponta de notificar-canal verde — pré-condição do deploy"
provides:
  - "Supabase do automation/ (qewznpnmaqhqfyhncdnx) com platform_adapter_commands, platform_event_receipts (CHECK de 5 status / 4 event_type), automation_workflow_runs.waiting_command_id e a coluna origem em solicitacoes_pagamentos e solicitacoes_pagamentos_marcos_paulo — aplicado pelo dono em 2026-09-25"
  - "banners APPLIED nas migrações 20260922120000, 20260922140000, 20260925120000; APLICADA PARCIALMENTE em 20260922130000; migração nova 20260925130000_solicitacoes_mp_origem.sql registrando o que foi aplicado (financeiro-tria 58c7106)"
  - "inventário somente-leitura da VPS de produção e do que o deploy de fato levaria (49 commits, não só a Fase 5)"
  - "scripts/aplicar-migracao-automation.mjs — aplica migrações do Supabase do automation/ numa transação, com ensaio por ROLLBACK e recusa da migração do corte do painel"
affects: ["deploy do automation/ (adiado — passo próprio)", "corte MP/FO (05-05, D5-20)", "índice único (origem, TaskID) — pendente de decisão sobre 180 duplicados", "PERS-08 (outbox worker em produção)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migração de produção aplicada numa transação única com pré-checagem que aborta tudo (tabela de base ausente, duplicados) — a checagem pegou 180 TaskID duplicados antes de qualquer escrita"

key-files:
  created:
    - ../financeiro-tria/supabase/migrations/20260925130000_solicitacoes_mp_origem.sql
    - scripts/aplicar-migracao-automation.mjs
  modified:
    - ../financeiro-tria/supabase/migrations/20260922120000_create_platform_adapter_commands.sql
    - ../financeiro-tria/supabase/migrations/20260922130000_solicitacoes_origem_unique.sql
    - ../financeiro-tria/supabase/migrations/20260922140000_platform_event_receipts.sql
    - ../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql

key-decisions:
  - "O plano previa aplicar UMA migração; a tabela nem existia — as três migrações de 2026-09-22 (Fase 2) nunca tinham sido aplicadas em produção. O dono autorizou aplicar todas; foram numa transação só."
  - "O índice único (origem, TaskID) de 20260922130000 NÃO foi criado: 180 TaskID duplicados em 1.114 linhas (pior caso 868fjj9cz, 20 vezes, ids 200..219). Só a coluna origem entrou — é o que o código exige; o índice é rede de segurança e espera a decisão do dono sobre os duplicados."
  - "A coluna origem também foi criada em solicitacoes_pagamentos_marcos_paulo: SupabaseAdapter#upsertSolicitacao filtra .eq('origem') em toda tabela de solicitações desde 02-18, e 20260922130000 só cobria a da Tria/FO. Sem ela o deploy quebraria o fluxo ClickUp do Marcos Paulo."
  - "Deploy do automation/ ADIADO pelo dono (2026-09-25, verbatim: 'vamos terminar a faase 5 depois vemos isso'), depois do inventário da VPS mostrar que ele é muito maior do que o plano supunha."

requirements-completed: []

# Metrics
duration: ~3h de sessão (maior parte esperando ações do dono no Studio)
completed: 2026-09-25
---

# Plano 05-23: schema do automation/ em produção; deploy adiado

**O Supabase do `automation/` passa a ter tudo o que o código das Fases 2 e 5 grava. O dono aplicou quatro migrações numa transação só, depois que a checagem de 05-23 revelou que nem a tabela de receipts existia. O deploy ficou para um passo próprio, porque é muito maior do que o plano supunha.**

## Task 1: migração de receipts, que virou "todas as migrações da Fase 2"

**Consultas somente-leitura (2026-09-25, SQL Editor do projeto `qewznpnmaqhqfyhncdnx`):**

1. Ao colar a migração de 05-15 veio `ERROR: 42P01: relation "public.platform_event_receipts" does not exist`. Era a condição de PARE do plano, porque a migração de 02-21 também não tinha sido aplicada.
2. O diagnóstico das três migrações de 2026-09-22 deu:

   | adapter_commands | índice origem | coluna origem | receipts | waiting_command |
   |---|---|---|---|---|
   | null | null | false | null | false |

   Nenhuma das três migrações da Fase 2 existia em produção.
3. **Autorização do dono (verbatim):** "vc tem acesso ao postgres, eu autorizo vc criar todas as migrations". O agente não conseguiu aplicar: o classificador do modo automático recusou, e a conexão direta `db.*.supabase.co` só existe em IPv6. **O dono rodou manualmente:** "eu vou rodar manualmente mande aqui a sql".
4. **Primeira tentativa (transação única):** a pré-checagem abortou com `ABORTADO: 180 TaskID duplicado(s) em solicitacoes_pagamentos — decidir antes da 130000`. Nada foi aplicado.
5. **Diagnóstico dos duplicados:** 180 `TaskID` repetidos, nenhum nulo, em 1.114 linhas. O pior é `868fjj9cz`, 20 vezes (ids 200..219), seguido de `868jq6kn1`, 13 vezes. `solicitacoes_pagamentos_marcos_paulo` existe **sem** `origem`.
6. **Segunda tentativa (transação única, sem o índice único e com `origem` também na tabela do MP):** aplicada. Conferência DEPOIS:

   | adapter_commands | receipts | origem_tria_fo | origem_mp | waiting_command |
   |---|---|---|---|---|
   | platform_adapter_commands | platform_event_receipts | true | true | true |

   `checks_receipts`:
   - `CHECK ((event_type = ANY (ARRAY['solicitacao.criada.v1', 'solicitacao.comentario-criado.v1', 'solicitacao.aprovacao-decidida.v1', 'automacao.notificar-canal.v1'])))`
   - `CHECK ((status = ANY (ARRAY['recebido', 'processando', 'concluido', 'falhou', 'falhou_retentavel'])))`

**Registro explícito:**
- `supabase db push` **não** foi usado.
- `20261001120000_remove_anon_read_painel.sql` continua **NÃO aplicada**.
- Nenhuma dessas migrações foi registrada em `supabase_migrations.schema_migrations`.

**Banners e commit (`financeiro-tria` `58c7106`, só os 5 arquivos de migração, `git add` por caminho):**
- `grep -c "APPLIED em" …20260925120000…sql` = 1.
- O banner de `20260922130000` diz APLICADA PARCIALMENTE e proíbe re-aplicar o arquivo inteiro enquanto houver duplicados.

## Task 2: deploy do `automation/`, ADIADO

**Pré-checagem (checkout principal do `financeiro-tria`):**
- `npm run build` → `===EXIT=0===`.
- `npm test` → 225 testes, 224 passam. A única falha é a já conhecida, `payment-rules.test.ts:37` (`/FINQ/i` vs `'Elifas'`).
- Commits do deploy:
  - 05-04: `9a7e723`, `25716c1`
  - 05-08: `6abe57d`, `d3216f2`
  - 05-15: `f245337`, `986f7e7`, `8049586`
  - 05-18: `20ac4e2`, `5f9241b`
  - 05-24: `0e71af8`
- Os mounts do ClickUp não mudaram (`routes.ts:398-404`: `/webhooks/${tenantId}` e o retrocompatível `/webhooks` → tria).

**Inventário somente-leitura da VPS (SSH autorizado pelo dono, nada alterado):**
- `automation/` em `/root/financeiro-tria/automation`, pm2 `financeiro-tria-automation`, porta 4100, nginx `financeiro.85.155.186.214.nip.io`. É a URL que os webhooks do ClickUp chamam.
- Produção está em **`4149032`** (fix de NF-e), anterior à Fase 2. O deploy levaria **49 commits e ~12.500 linhas em 54 arquivos**, com Fases 2, 4 e 5, e não só as quatro da Fase 5 que o plano listou. 48 desses commits **não estão no GitHub**.
- O `.env` de produção **não tem** `PLATAFORMA_WEBHOOK_TOKEN`, `PLATAFORMA_BASE_URL`, `PLATAFORMA_SERVICE_TOKEN`, `MP_EVOLUTION_INSTANCE` nem `MP_WHATSAPP_*`. O `user_setup` do plano dizia "Já configurada", e estava errado.
  - O boot não quebra: com fonte `clickup` essas variáveis são lidas sob demanda, e `PLATAFORMA_WEBHOOK_TOKEN` tem default `""`.
  - Mas as rotas da plataforma ficariam inertes.
- `automation/package.json` e o lock estão modificados na VPS (tsx atualizado à mão). Um `git pull` puro conflita.

**Decisão do dono (2026-09-25, verbatim):** "vamos terminar a faase 5 depois vemos isso". A fumaça 200/401/401 não foi executada porque não houve deploy.

**Registro explícito:** o 05-05 não foi executado, nenhum webhook do ClickUp foi desligado e nenhuma Lista foi arquivada.

## Desvios do plano

1. **Escopo das migrações:** eram 1 no plano e foram 4 aplicadas mais 1 nova, por causa da tabela inexistente. O dono autorizou.
2. **Índice único (origem, TaskID) não criado:** 180 duplicados. Fica como pendência de decisão de dados.
3. **Coluna `origem` na tabela do Marcos Paulo:** não estava em migração nenhuma. É exigida pelo código desde 02-18. Criada e registrada em `20260925130000_solicitacoes_mp_origem.sql`.
4. **Deploy adiado:** Task 2 fica registrada como decisão do dono, não como feita.
5. **Script novo `scripts/aplicar-migracao-automation.mjs` (crm-n1):** escrito para o agente aplicar com ensaio por ROLLBACK. Não chegou a ser usado para escrever, porque o dono aplicou pelo SQL Editor. Fica disponível e lê `AUTOMATION_DATABASE_URL` do `automation/.env` (gitignored).

## O que falta

**Para o deploy do `automation/`, como passo próprio:**
1. Push dos 48 commits para `tria-company/financeiro-tria`.
2. Resolver o `package*.json` sujo na VPS.
3. Configurar `PLATAFORMA_*` (e `MP_*` se for usar Canal).
4. `git pull`, `npm ci`, `pm2 restart financeiro-tria-automation`.
5. Fumaça: `/health` → 200; `/webhooks/plataforma/notificar-canal` e `/webhooks/plataforma/solicitacao-criada` sem `Authorization` → 401.
6. Antes do deploy, conferir no Supabase a existência das tabelas lidas pelo código: `conciliador_contas`, `transacoes`, `produtos_cadastrados_emissao_notas`, `automation_workflows`, `financas_mp`, `relatorio_semanal_marcos_paulo`, as colunas `empresa`, e a função `match_conciliador_contas`. A consulta está pronta na conversa de 05-23, e o resultado não foi colhido.

**Para o primeiro WhatsApp real:**
- deploy acima;
- outbox worker do `apps/api` em produção (PERS-08). O backend do crm-n1 ainda não roda em produção; o dono pretende colocá-lo na mesma VPS;
- uma Automação de Canal publicada em `ws_n1`.

**Para o Critério 2 (MP/FO):** fonte "plataforma" nos serviços de MP/FO (D5-20, fase própria); depois, 05-05 Tasks 2/3.

**Dados:** decidir o destino dos 180 `TaskID` duplicados e então criar o índice único numa migração nova.

**Segurança:**
- A senha de root da VPS e a senha do Postgres do Supabase foram coladas na conversa. Trocar as duas e migrar o SSH para chave.
- `/root/credenciais-financeiro-tria.md` existe em texto puro na VPS.

## Self-Check: PASSED

- Banner `APPLIED em` em `20260925120000` (grep = 1) ✓
- Commit `58c7106` no `financeiro-tria` com os 5 arquivos ✓
- Conferência DEPOIS colada (definições de CHECK, sem dado de linha) ✓
- `20261001120000` não aplicada ✓ · `05-05-PLAN.md` e `05-CORTE-MP-FO.md` intocados ✓
- Nenhum valor de variável ou token neste SUMMARY. As senhas coladas na conversa não foram reproduzidas aqui ✓
