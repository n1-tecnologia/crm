---
phase: 05-contas-a-receber-e-os-outros-tenants
verified: 2026-09-25T16:20:00Z
status: human_needed
score: 1/4 critérios do ROADMAP totalmente verdadeiros em produção hoje; o schema do `automation/` que o Critério 4 precisa já está aplicado, mas o deploy que o usaria foi adiado pelo próprio dono; Critérios 2 e 3 seguem como na rodada anterior — code-complete, aguardando decisão/execução do dono
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "1/4 critérios do ROADMAP totalmente verdadeiros em produção hoje; 3/4 code-complete e testados (inclusive ponta a ponta entre repositórios), aguardando ação do dono já identificada e sequenciada"
  gaps_closed:
    - "05-23 Task 1 (migração de schema do `automation/`) — aplicada em produção pelo dono em 2026-09-25. A pré-checagem revelou que a tabela `platform_event_receipts` nem existia: as três migrações da Fase 2 (20260922120000, 20260922130000, 20260925130000 nunca tinham sido aplicadas. O dono autorizou aplicar as quatro (mais uma nova para a coluna `origem` em `solicitacoes_pagamentos_marcos_paulo`) numa transação só, pelo SQL Editor — nunca `supabase db push`. Conferido por leitura direta dos banners: `APPLIED em 2026-09-25` em 20260922120000, 20260922140000, 20260925120000 e 20260925130000; `20261001120000_remove_anon_read_painel.sql` continua `NOT YET APPLIED` (confirmado por grep nesta rodada); commit `58c7106` no `financeiro-tria` toca só os 5 arquivos de migração."
  gaps_remaining:
    - "05-23 Task 2 (deploy do `automation/`) — NÃO fechada. O dono ADIOU explicitamente (verbatim no SUMMARY: \"vamos terminar a faase 5 depois vemos isso\") depois que o inventário somente-leitura da VPS mostrou escopo muito maior do que o plano previa: produção está em `4149032` (anterior à Fase 2, não só sem a Fase 5); o deploy levaria 49 commits e ~12.500 linhas em 54 arquivos, dos quais 48 commits não estão no GitHub; e o `.env` de produção NÃO tem `PLATAFORMA_WEBHOOK_TOKEN`, `PLATAFORMA_BASE_URL`, `PLATAFORMA_SERVICE_TOKEN`, `MP_EVOLUTION_INSTANCE` nem `MP_WHATSAPP_*` — o `user_setup` do 05-23-PLAN.md dizia \"Já configurada\" para todas, e estava errado. Fica como um passo próprio, fora desta fase."
    - "Índice único `(origem, \"TaskID\")` de `20260922130000_solicitacoes_origem_unique.sql` — NÃO criado. A pré-checagem achou 180 `TaskID` duplicados em 1.114 linhas (pior caso `868fjj9cz`, 20 vezes). Só a coluna `origem` entrou (o que o código de produção exige); o banner do arquivo diz `APLICADA PARCIALMENTE` e proíbe reaplicar o arquivo inteiro até o dono decidir o destino dos duplicados."
    - "Critério 2, parte B (webhooks ClickUp + Listas 901109642259/901111928443 desligados/arquivados) — sem mudança desde a rodada anterior; continua bloqueado por decisão do dono (D5-20), sem fase própria no ROADMAP.md."
    - "R7 aplicado em `ws_n1` e o relógio de Contas a receber ligado — sem mudança; adiados pelo dono em 05-25 por falta de infraestrutura de scheduler (PERS-08) e de Membro Agente do pipeline (D-15)."
  regressions: []
human_verification:
  - test: "Deploy do `automation/` para a VPS com 05-04+05-08+05-15+05-18+05-24 (05-23 Task 2), como passo próprio"
    expected: "Antes de tentar de novo: push dos 48 commits ausentes para o GitHub, resolver o `package*.json` modificado à mão na VPS, configurar `PLATAFORMA_*`/`MP_*` no `.env` de produção (hoje ausentes), então `git pull`+`npm ci`+`pm2 restart`. Fumaça: `GET /health` 200 com os três tenants; `POST /webhooks/plataforma/notificar-canal` e `/solicitacao-criada` sem `Authorization` → 401; nenhum webhook do ClickUp muda; nenhuma Lista é arquivada."
    why_human: "Decisão e execução em infraestrutura que só o dono acessa; ele já adiou uma vez (verbatim, 05-23-SUMMARY.md) depois que o inventário da VPS mostrou 49 commits e variáveis de ambiente ausentes — o plano original subestimava o escopo"
  - test: "Decidir o destino dos 180 `TaskID` duplicados em `solicitacoes_pagamentos` e então criar o índice único `(origem, \"TaskID\")` numa migração nova"
    expected: "Ou os duplicados são resolvidos (merge, exclusão, ou aceitar a duplicidade com uma constraint diferente) e o índice é criado, ou a decisão de conviver sem o índice fica registrada — hoje a tabela não tem a rede de segurança que impede uma coorte `plataforma` sobrescrever silenciosamente uma linha `clickup` com o mesmo `TaskID`"
    why_human: "Decisão sobre dados de produção reais (180 TaskID repetidos, pior caso 20x); nenhum plano da fase decide isso por conta própria"
  - test: "Decidir e executar (ou reafirmar o adiamento de) o corte de MP/FO — desligar os 10 webhooks ClickUp e arquivar as Listas 901109642259/901111928443 (05-05 Tasks 2/3)"
    expected: "Ou o corte é executado (webhooks desligados, Listas arquivadas, confirmado por silêncio de 48h) ou a decisão de adiar continua registrada — mas hoje não há fase alguma no ROADMAP.md que reserve este trabalho; o Critério 2 do ROADMAP para a Fase 5 permanece formalmente não atendido enquanto isso não acontecer em algum lugar"
    why_human: "Decisão de produto (D5-20) sobre quando portar a fonte \"plataforma\" para os serviços de marcos-paulo/family-office; fora do alcance de qualquer plano desta fase"
  - test: "Aplicar R7 (`garantirSaqueRecorrente`) em `ws_n1` e ligar o relógio de Contas a receber (`automacoes:liberar`, 05-10 Task 4)"
    expected: "exatamente 1 Tarefa de Saque com `recurrence` em `lst_contas_a_receber` (as 9 de hoje são avulsas); depois, a primeira volta real do scheduler processa só o que WR-11 permite (nenhuma das 240 históricas antes do início do dia da importação)"
    why_human: "Adiado pelo dono em 05-25 (\"Adiar R7\"/\"Adiar o relógio (Recomendado)\") — pré-condições ausentes: nenhum processo do `apps/api` roda o scheduler em produção (PERS-08) e nenhum Membro ocupa o Papel Agente do pipeline em `ws_n1` (D-15)"
  - test: "Antes de ligar `AUTOMACOES_WORKER_ATIVO` em produção: remover (ou isolar por allowlist) os ~14 Espaços de teste com Automações temporais ativas em `lst_contas_a_pagar`/`lst_contas_a_receber` no Postgres real (WR-A, achado do 05-REVIEW.md)"
    expected: "`catalogoDeListasComAgenda` só enxerga Espaços de produção quando o scheduler roda de verdade — hoje `apps/api/src/index.ts` não passa `workspaceId`, então um worker ligado agendaria e executaria Automações também nesses Espaços de teste, inclusive potencialmente notificações de WhatsApp"
    why_human: "Operação de limpeza/filtragem contra o Postgres de produção real, decisão e execução do dono; não corrigido por nenhum dos 25 planos da fase"
  - test: "Para o primeiro envio real de WhatsApp: concluir o deploy do `automation/`, ligar `OUTBOX_WORKER_ATIVO=true` em produção e publicar de fato uma Automação de Canal na Lista de Solicitações de `ws_n1`"
    expected: "Uma Solicitação nova do Marcos Paulo dispara a Automação, o evento `automacao.notificar-canal.v1` sai do outbox, a rota entrega pela Evolution API"
    why_human: "Três decisões de produto/infra fora do escopo de código desta fase (o deploy adiado, PERS-08 e publicar a Automação), registradas como pendência nas próprias SUMMARYs de 05-06/05-07/05-08/05-23"
  - test: "Trocar a senha de root da VPS e a senha do Postgres do Supabase do `automation/`; migrar o SSH para chave; remover `/root/credenciais-financeiro-tria.md` (texto puro) da VPS"
    expected: "Nenhuma credencial de produção continua em texto puro em disco ou repetida sem rotação depois de ter sido colada numa conversa"
    why_human: "05-23-SUMMARY.md registra que a senha de root da VPS e a senha do Postgres do Supabase foram coladas na conversa durante a Task 2; rotação de credencial é ação do dono, fora do alcance de qualquer plano de código desta fase"
---

# Phase 5: Contas a receber e os outros tenants — Verification Report (RE-VERIFICATION)

**Phase Goal:** Marcos Paulo e Family Office operam no CRM N1 como Empresas do Campo `Empresa`,
cada uma com a sua Integração Omie e sem um terceiro clone do serviço; Contas a receber vive na
plataforma na forma que D7 determinar; uma Automação sabe notificar por Canal.
**Verified:** 2026-09-25T16:20:00Z
**Status:** human_needed
**Re-verification:** Sim — depois que 05-23 (o último plano aberto da fase) fechou. Todos os 25
planos da Fase 5 (05-01..05-25) agora têm SUMMARY.md.

## Resumo do julgamento

A rodada anterior desta verificação (`gaps_found` → `human_needed`, sem hash porque foi a própria
rodada corrente) já tinha achado todo o código dos quatro Critérios pronto e testado — inclusive
um contrato ponta a ponta real entre `crm-n1` e `../financeiro-tria` para o Critério 4 — e reduzido
o que faltava a uma lista curta de ações do dono, com 05-23 (migração de schema + deploy do
`automation/`) ainda aberto e sem SUMMARY.

**O que mudou nesta rodada:** 05-23 fechou, mas não do jeito que o plano previa. A Task 1
(migração de receipts) revelou, na pré-checagem, que a tabela `platform_event_receipts` **nem
existia** em produção — as três migrações da Fase 2 (2026-09-22) nunca tinham sido aplicadas. O
dono autorizou aplicar as quatro migrações pendentes numa transação só, mais uma nova para uma
coluna que faltava na tabela do Marcos Paulo. Verifiquei isso por leitura direta dos banners nos
seis arquivos de migração do repositório irmão (não pelo que o SUMMARY diz) e por
`git -C ../financeiro-tria show --stat 58c7106`: os cinco arquivos batem exatamente com o que o
SUMMARY descreve, e `20261001120000_remove_anon_read_painel.sql` — a migração do corte do painel,
que não pode ir junto — continua com o banner `NOT YET APPLIED`.

A Task 2 (deploy do `automation/`) não fechou como "feito": o dono, depois de ver o inventário
somente-leitura da VPS, **adiou** o deploy (verbatim, 05-23-SUMMARY.md: "vamos terminar a faase 5
depois vemos isso"). O motivo documentado é concreto e verificável no próprio SUMMARY: produção
está em `4149032`, um commit anterior à Fase 2 inteira — não só sem a Fase 5 — e o deploy real
levaria 49 commits (48 deles nem estão no GitHub), não os 5 que o plano listava; o `.env` de
produção não tem nenhuma das variáveis `PLATAFORMA_*`/`MP_*` que o `05-23-PLAN.md` presumia já
configuradas; e o `package.json` da VPS foi editado à mão, o que quebraria um `git pull` puro.
Nenhuma dessas afirmações depende de eu confiar no SUMMARY — são achados que o próprio plano de
deploy exigia coletar antes de agir, e o SUMMARY os registra como achados, não como trabalho feito.

**Isso muda o Critério 4 de "todo o código pronto, nada em produção" para "o schema que o código
precisa já está em produção; o serviço que o usaria continua fora, por decisão explícita e
justificada do dono".** Não é uma regressão — é o schema (a metade que dependia só de uma
autorização de escrita em banco) fechando, enquanto a metade que dependia de um deploy maior do
que o esperado abre um escopo novo, documentado, e adiado conscientemente.

Nenhum código de aplicação (`apps/api`, `apps/web`, `packages/dominio`) mudou desde a rodada
anterior desta verificação — confirmado por `git log` nos três diretórios de código-fonte: o
último commit que toca `src/` é `e850eab` (05-22), de antes da rodada anterior. As únicas adições
desde então são `scripts/aplicar-migracao-automation.mjs` (não usado para escrever — o dono aplicou
pelo SQL Editor) e os arquivos de documentação/migração do repositório irmão.

## Goal Achievement

### Observable Truths (Critérios do ROADMAP.md, Phase 5)

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Cada uma das 6 Empresas é opção do Campo `Empresa` e tem a própria Integração Omie; prefixo numérico e `em revisão` absorvidos, não clonados | ✓ VERIFIED (produção) | Sem mudança desde a rodada anterior. `05-20-SUMMARY.md`: dry-run pós-`--apply` real contra `ws_n1` → `criados 0, conferidos 8, divergentes 0`; "Marcos Paulo" 1x em `fd_cp_empresa` e 1x em `fld_sp_c_empresa`. |
| 2 | Solicitações de MP e FO nascem no CRM N1 e percorrem o mesmo pipeline; webhooks ClickUp e Listas `901109642259`/`901111928443` desligados/arquivados | ⚠️ PARCIAL — defeito de código fechado, cutover continua bloqueado por decisão | Sem mudança de código nesta rodada. CR-01 continua fechado (`webhooks-plataforma.ts:315,343-357,601-613`). Os 10 webhooks ClickUp seguem ligados, as duas Listas seguem ativas, por decisão explícita do dono (D5-20). |
| 3 | Contas a receber conforme D7: R2-R7 no motor com prazos confirmados; importação usa `date_closed` (CON-CR-10) | ⚠️ SUBSTANCIALMENTE PREPARADO, ativação adiada pelo dono | Sem mudança nesta rodada. D7 aplicado desde a Fase 1; CR-06 e WR-11 verificados na rodada anterior. R7 e o relógio seguem ADIADOS pelo dono em 05-25 (PERS-08/D-15). |
| 4 | Uma Automação consegue notificar por Canal (WhatsApp via Evolution API) usando o Campo WhatsApp da Tarefa | ⚠️ CODE-COMPLETE E TESTADO PONTA A PONTA; **schema de produção agora aceita o evento (novo)**; deploy que o usaria ADIADO pelo dono | CR-02 continua fechado no código (verificado na rodada anterior, sem mudança). **Mudou:** (a) a migração de schema do `automation/` agora está `APPLIED em 2026-09-25` — confirmado por leitura direta do banner nos 4 arquivos e por `git show --stat 58c7106`; `event_type` aceita 4 valores incluindo `automacao.notificar-canal.v1`, `status` aceita 5 incluindo `falhou_retentavel`. Ainda pendente: (b) o deploy do `automation/` corrigido — ADIADO pelo dono depois do inventário da VPS mostrar 49 commits e variáveis `PLATAFORMA_*`/`MP_*` ausentes no `.env` de produção; (c) o outbox worker do `apps/api` ativo em produção (PERS-08); (d) uma Automação de Canal de fato publicada em `ws_n1` (decisão de produto ainda não tomada). |

**Score:** 1/4 critérios totalmente verdadeiros em produção hoje (Critério 1), sem mudança nesta
rodada. O Critério 4 avançou uma etapa concreta (schema de produção pronto), mas continua não
verdadeiro em produção porque o serviço que gravaria nesse schema não foi deployado — por decisão
do dono, não por trabalho pendente de código. Critérios 2 e 3 permanecem exatamente como na rodada
anterior.

### Gaps da rodada anterior — fechados ou não

| Id | Achado da rodada anterior | Situação agora |
|---|---|---|
| 05-23 Task 1 (migração de receipts) | Plano aberto, migração `NOT YET APPLIED`, sem SUMMARY | **FECHADO em produção.** A pré-checagem revelou que a tabela nem existia (3 migrações da Fase 2 nunca aplicadas); o dono autorizou aplicar as 4 pendentes + 1 nova numa transação só. Banners `APPLIED em 2026-09-25` confirmados por leitura direta em 4 arquivos; `20261001120000` (corte do painel) confirmado ainda `NOT YET APPLIED`. |
| 05-23 Task 2 (deploy do `automation/`) | Não feito, roteado para `human_verification` | **NÃO FECHADO, por decisão informada do dono, não por omissão.** O inventário da VPS (feito nesta rodada de execução, não nesta verificação) mostrou escopo muito maior que o plano previa: 49 commits (48 fora do GitHub), `.env` de produção sem as variáveis da plataforma, `package.json` sujo na VPS. O dono adiou verbatim. Continua em `human_verification`, agora com o motivo documentado. |
| (novo) Índice único `(origem, "TaskID")` | — | **NÃO CRIADO.** 180 `TaskID` duplicados encontrados na pré-checagem (1.114 linhas, pior caso 20x). Só a coluna `origem` entrou; o índice espera decisão do dono sobre os duplicados. Novo item em `human_verification`. |
| (novo) Coluna `origem` faltando em `solicitacoes_pagamentos_marcos_paulo` | — | **FECHADO.** A migração de 2026-09-22 só cobria a tabela da Tria/FO; o `SupabaseAdapter#upsertSolicitacao` filtra `.eq('origem')` em toda tabela de solicitações desde 02-18, o que quebraria o fluxo ClickUp do Marcos Paulo se a coluna não existisse. Nova migração `20260925130000_solicitacoes_mp_origem.sql`, aplicada e commitada. |
| Critério 2, parte B (webhooks/Listas) | Bloqueado por D5-20, sem fase própria | **Sem mudança.** |
| R7 e o relógio | Adiados em 05-25 (PERS-08/D-15) | **Sem mudança.** |

### Required Artifacts (amostra desta rodada)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql` | CHECK ampliada aceitando `falhou_retentavel`/`automacao.notificar-canal.v1`, aplicada em produção | ✓ VERIFIED (produção) — **mudou desde a rodada anterior** | Banner lido diretamente: `-- APPLIED em 2026-09-25 pelo dono do produto, via SQL Editor (Plano 05-23...)`. Confirmado também nos banners de `20260922120000` e `20260922140000` (mesma data/via). `git -C ../financeiro-tria show --stat 58c7106` toca exatamente esses arquivos. |
| `../financeiro-tria/supabase/migrations/20260922130000_solicitacoes_origem_unique.sql` | Coluna `origem` + índice único `(origem, "TaskID")` | ⚠️ APLICADA PARCIALMENTE (produção) — novo item | Banner lido diretamente: "APLICADA PARCIALMENTE... SÓ o passo 1 (coluna origem)... O passo 2 (índice único) NÃO foi aplicado: a checagem abaixo devolveu 180 TaskID duplicados". A coluna existe; o índice, não. |
| `../financeiro-tria/supabase/migrations/20260925130000_solicitacoes_mp_origem.sql` | Coluna `origem` em `solicitacoes_pagamentos_marcos_paulo` | ✓ VERIFIED (produção) — novo arquivo | Existe no diretório de migrações; banner "APPLIED em 2026-09-25"; listado no `git show --stat 58c7106`. |
| `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql` | Continuar `NOT YET APPLIED` — não pode ir junto com nenhum `db push` | ✓ VERIFIED (não aplicada, como esperado) | Banner lido diretamente nesta rodada: `-- NOT YET APPLIED. Este arquivo foi escrito em 2026-09-23 (Plano 04-14...)`. Confirma que a Task 1 de 05-23 não arrastou o corte do painel. |
| `scripts/aplicar-migracao-automation.mjs` (`crm-n1`) | Script para aplicar migrações do `automation/` com ensaio por ROLLBACK | ✓ VERIFIED (existe) | Arquivo presente (`ls -la`, 5776 bytes). SUMMARY registra que não foi usado para escrever — o dono aplicou pelo SQL Editor — mas fica disponível. Não foi wired em nenhum `npm run`; uso manual, fora do escopo de verificação de wiring de aplicação. |
| Demais artefatos da fase (`destinoDeCanal`, `CAMPO_ID_PARA_CHAVE`, `resolverTenantDaTarefa`, `unidade-de-trabalho.ts::executar()`, barreira WR-11, índice `006-outbox-indice-unico-canal.sql`, contrato ponta a ponta 05-24) | — | ✓ VERIFIED (sem mudança) | Nenhum desses arquivos mudou desde a rodada anterior (confirmado por `git log` em `apps/api/src`, `apps/web/src`, `packages/dominio/src` — último commit `e850eab`, 05-22). Ver a rodada anterior desta mesma VERIFICATION.md para o detalhe linha a linha; não repetido aqui por não ter mudado. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `../financeiro-tria/automation/src/http/receipts-da-plataforma.ts` | `public.platform_event_receipts` (CHECK) | `status = 'falhou_retentavel'`, `event_type = 'automacao.notificar-canal.v1'` | **WIRED EM PRODUÇÃO — mudou desde a rodada anterior** | O schema de produção agora aceita esses valores (banner `APPLIED`, confirmado por leitura direta). O que falta para o link valer de ponta a ponta é o `automation/` corrigido estar rodando em produção — isso é o deploy adiado (Task 2), não mais o schema. |
| `20260922130000_solicitacoes_origem_unique.sql` | `public.solicitacoes_pagamentos` (índice único) | `create unique index ... (origem, "TaskID")` | **NOT_WIRED (parcial) — novo** | Coluna `origem` existe (wired); o índice único que protegeria contra colisão entre coortes `clickup`/`plataforma` não foi criado, por 180 duplicados pré-existentes. |
| `05-CORTE-MP-FO.md` | ClickUp (painel) | desligar 10 webhooks, arquivar 2 Listas | **NOT_WIRED (por decisão, sem fase que a reserve)** | Sem mudança. |
| `apps/api/src/automacoes/scheduler-worker.ts` | `CR.listId` | `catalogoDeListasComAgenda` | **WIRED, mas GATED e sem filtro de Espaço** | Sem mudança (WR-A). |
| Demais key links da fase (`webhooks-plataforma.ts::resolverTenantDaTarefa` → `PaymentAutomationService`; `destinoDeCanal` → `CAMPO_ID_PARA_CHAVE`; rota de Canal → `paraDtoV1`) | — | **WIRED (sem mudança)** | Verificados na rodada anterior; nenhum arquivo de código mudou. |

### Requirements Coverage

| Requirement | Descrição | Status | Evidência |
|---|---|---|---|
| TEN-01 | Empresas do Campo `Empresa`, config por Empresa, Integração Omie por Empresa; observável: solicitações dos dois tenants nascem no CRM N1, webhooks desligados | ⚠️ PARTIALLY SATISFIED (sem mudança) | Config por Empresa aplicada em produção (Critério 1 ✓); a condição observável do requisito (solicitações dos dois tenants processando, webhooks desligados) continua falsa. |
| AUTO-02 | Ação de notificar por Canal usando o Campo WhatsApp da Tarefa | ⚠️ PARTIALLY SATISFIED — **avançou** | Código completo e testado ponta a ponta (05-24); **o schema de produção que a rota de Canal grava agora existe** (05-23 Task 1); zero mensagem real enviada ainda — falta o deploy (adiado pelo dono), o outbox worker ativo e uma Automação publicada. |
| REC-01 | Contas a receber na plataforma conforme D7; R2-R7 no motor com prazos confirmados | ⚠️ PARTIALLY SATISFIED (sem mudança) | D7 aplicado e conferido; R2-R6 em produção; R7 e o relógio código-prontos e simulados, adiados pelo dono (PERS-08/D-15). |

Nenhuma requirement órfã: TEN-01, AUTO-02 e REC-01 continuam as três mapeadas para a Fase 5 em
`REQUIREMENTS.md` e aparecem no `requirements` de pelo menos um dos 25 planos (05-23 declara
`requirements: [TEN-01, AUTO-02]` no seu frontmatter — confirmado por leitura do arquivo).

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `apps/api/src/index.ts:114-130` / `apps/api/src/automacoes/scheduler-worker.ts:246-273` | WR-A — composição de produção não passa `workspaceId` a `criarSchedulerWorker`; ~14 Espaços de teste com Automações temporais ativas seguem no Postgres real | ⚠️ WARNING (sem mudança) | Hoje dormente (scheduler não roda em produção — PERS-08). |
| `../financeiro-tria/supabase/migrations/20260922130000_solicitacoes_origem_unique.sql` | 180 `TaskID` duplicados impedem o índice único que protegeria contra colisão entre coortes `clickup`/`plataforma` na mesma tabela | ⚠️ WARNING — novo | Hoje sem efeito prático (a coorte `plataforma` só existe para a Tria); vira risco real assim que MP/FO passarem a gravar na mesma tabela (Critério 2, parte pendente). Decisão de dados do dono, listada em `human_verification`. |
| VPS do `automation/` — `.env` de produção sem `PLATAFORMA_*`/`MP_*`; `package.json`/lock modificados à mão; senha de root da VPS e senha do Postgres do Supabase coladas em texto puro numa conversa; `/root/credenciais-financeiro-tria.md` em texto puro | Higiene operacional de infraestrutura, registrada no 05-23-SUMMARY.md | ⚠️ WARNING — novo | Não é código desta fase, mas é exposição de credencial real, documentada pelo próprio executor. Listada em `human_verification` para rotação pelo dono. |
| `packages/dominio/src/operations/automations-historico.test.ts` / `tasks.ts` (`changeTaskStatus` muta `task.statusId` por referência) | Efeito colateral pré-existente do motor | ℹ️ INFO (sem mudança) | Fora do escopo desta fase. |

Nenhum marcador de dívida (`TBD`/`FIXME`/`XXX`) sem referência a acompanhamento encontrado nos
arquivos tocados por 05-23 (as seis migrações do `automation/` e `scripts/aplicar-migracao-automation.mjs`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Banner de `20260925120000` (receipts) mudou de `NOT YET APPLIED` para `APPLIED` | `grep -n -i "APPLIED\|NOT YET" ...20260925120000...sql` | `-- APPLIED em 2026-09-25 pelo dono do produto, via SQL Editor (Plano 05-23...)` | ✓ PASS |
| Banner de `20260922130000` (índice origem) indica aplicação parcial | `grep -n -i "APLICADA PARCIALMENTE" ...20260922130000...sql` | `-- APLICADA PARCIALMENTE em 2026-09-25...` | ✓ PASS |
| `20260925130000_solicitacoes_mp_origem.sql` existe e está aplicada | `ls` + leitura do banner | Arquivo presente, `APPLIED em 2026-09-25` | ✓ PASS |
| `20261001120000_remove_anon_read_painel.sql` continua NÃO aplicada | `grep -n -i "NOT YET APPLIED" ...20261001120000...sql` | `-- NOT YET APPLIED. Este arquivo foi escrito em 2026-09-23 (Plano 04-14...)` | ✓ PASS |
| Commit `58c7106` toca só os 5 arquivos de migração declarados | `git -C ../financeiro-tria show --stat 58c7106` | 5 arquivos alterados: as 4 migrações de banner + `20260925130000` novo | ✓ PASS |
| Nenhum código de aplicação do `crm-n1` mudou desde a rodada anterior | `git log --oneline -- apps/api/src apps/web/src packages/dominio/src` | Último commit `e850eab` (05-22), anterior à rodada anterior | ✓ PASS |
| `05-23-SUMMARY.md` agora existe (todos os 25 planos com SUMMARY) | `ls .planning/phases/05-.../*SUMMARY.md \| wc -l` | 25 | ✓ PASS |

### Probe Execution

Não aplicável — a fase não declara nem usa `scripts/*/tests/probe-*.sh`. Nenhuma conexão com banco
ou VPS foi feita por esta verificação (regra operacional) — todas as checagens acima são leitura de
arquivo e `git`/`ls` locais.

## Human Verification Required

Ver a lista estruturada em `human_verification` no frontmatter — sete itens agora (a migração de
receipts saiu da lista, aplicada e confirmada). Todos são ações que só o dono do produto pode
tomar: concluir o deploy do `automation/` (agora um passo próprio, com escopo maior que o previsto),
decidir o destino dos 180 `TaskID` duplicados antes do índice único, decidir/executar o corte de
webhooks de MP/FO, ligar R7/o relógio quando a infraestrutura de scheduler existir, limpar os
Espaços de teste do Postgres real antes de ligar o worker de Automações, publicar a primeira
Automação de Canal real, e rotacionar as credenciais que foram coladas em texto puro durante a
Task 2 de 05-23. Nenhum deles é código faltando.

## Gaps Summary

Não há gap de código nesta rodada — nenhum arquivo de aplicação mudou desde a verificação anterior,
que já não tinha achado gaps de código. O que mudou é produção: o schema do `automation/` que o
Critério 4 precisa está aplicado (05-23 Task 1, verificado por leitura direta dos banners e do
commit `58c7106`), fechando a metade desse Critério que dependia só de uma autorização de escrita
em banco.

A outra metade — o deploy do serviço que gravaria nesse schema — não fechou, mas por um motivo
concreto e documentado: o inventário da VPS revelou que o deploy real é 49 commits e não os 5 que
o plano original previa, que o `.env` de produção não tem as variáveis que o plano presumia
configuradas, e que a VPS tem modificações manuais que impedem um `git pull` direto. O dono viu
esse inventário e decidiu adiar — uma decisão informada, não uma omissão. Isso, mais os 180
`TaskID` duplicados que impedem o índice único de proteção entre coortes, são achados novos desta
rodada de execução, não desta verificação — e ficam registrados como itens de `human_verification`,
com o motivo de cada um.

Os itens que já vinham de rodadas anteriores (Critério 2 parte B — corte de webhooks; Critério 3 —
R7/relógio) não mudaram. A ressalva da rodada anterior sobre o Critério 2 do ROADMAP.md ("são
desligados/arquivados") continuar formalmente não atendido, sem fase própria que reserve esse
trabalho, permanece válida e não foi endereçada nesta rodada — 05-23 explicitamente não tocou o
corte de 05-05.

O status desta verificação continua `human_needed`, não `passed`: mesmo com o avanço real do
Critério 4, sete itens que só o dono pode decidir ou executar continuam entre o código pronto e os
quatro Critérios do ROADMAP valerem em produção.

---

_Verified: 2026-09-25T16:20:00Z_
_Verifier: Claude (gsd-verifier)_
