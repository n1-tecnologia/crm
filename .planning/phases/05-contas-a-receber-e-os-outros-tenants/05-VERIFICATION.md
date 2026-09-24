---
phase: 05-contas-a-receber-e-os-outros-tenants
verified: 2026-09-24T23:45:00Z
status: human_needed
score: 1/4 critérios do ROADMAP totalmente verdadeiros em produção hoje; 3/4 code-complete e testados (inclusive ponta a ponta entre repositórios), aguardando ação do dono já identificada e sequenciada
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "0/4 critérios totalmente atendidos em produção; 2/4 bloqueados por defeito de código confirmado (CR-01, CR-02) — ver 7f0ef07"
  gaps_closed:
    - "Critério 2 (CR-01) — MP/FO agora recebem `422 TENANT_SEM_FONTE_PLATAFORMA` de `resolverTenantDaTarefa` ANTES de qualquer I/O, com o `PaymentAutomationService` REAL dos dois tenants nos testes (não mais stubs que escondiam a dependência do ClickUp); `/aprovacao-decidida` lança se `handlePlatformApprovalDecision` não existir — nunca mais `{ ignored: true }` com receipt `concluido`. Uma decisão de aprovação de MP/FO não desaparece mais silenciosamente."
    - "Critério 4 (CR-02) — domínio (`destinoDeCanal`) e `automation/` (`CAMPO_ID_PARA_CHAVE`) concordam agora sobre a Lista-alvo (Solicitações de pagamento, D5-19) e o Campo (`fld_sp_z_whatsapp`/`requesterWhatsApp`); provado por um contrato ponta a ponta real entre os dois repositórios (05-24) — fixtures geradas do seed real de um lado, consumidas pela rota real do outro, com duas mutações deliberadas revertidas confirmando que cada lado fica vermelho quando o outro diverge."
    - "Critério 1 — `--apply` de `empresas:configurar` finalmente rodou contra `ws_n1` (pelo dono, por bloqueio do classificador de permissão do agente): 6 Integrações por Empresa, \"Marcos Paulo\" nos DOIS Campos Empresa (`fd_cp_empresa` e `fld_sp_c_empresa`), dry-run de idempotência pós-apply `criados 0, conferidos 8, divergentes 0`."
  gaps_remaining:
    - "Critério 2, parte B (webhooks ClickUp + Listas 901109642259/901111928443 desligados/arquivados) — NÃO reaberto como defeito de código; continua bloqueado por decisão explícita do dono (D5-20), adiado para uma fase própria que ainda NÃO existe no ROADMAP.md. Roteado para human_verification, não para gaps de código."
    - "05-23 (migração de schema do `automation/` + deploy) — plano aberto, sem SUMMARY.md; roteado para human_verification."
    - "R7 aplicado em `ws_n1` e o relógio de Contas a receber ligado — adiados pelo dono em 05-25 (falta processo de scheduler em produção, PERS-08, e Membro Agente do pipeline em `ws_n1`, D-15); roteado para human_verification."
  regressions: []
human_verification:
  - test: "Aplicar a migração `20260925120000_platform_event_receipts_retentavel_e_canal.sql` no Supabase do `automation/` (05-23 Task 1) — SÓ este arquivo, nunca `supabase db push`"
    expected: "CHECK de `status` com 5 valores (incluindo `falhou_retentavel`) e de `event_type` com 4 (incluindo `automacao.notificar-canal.v1`); `20261001120000_remove_anon_read_painel.sql` continua NÃO aplicada"
    why_human: "Escrita de schema em produção; só o dono aplica migrações do Supabase (regra do projeto, já bloqueada uma vez pelo classificador de permissão do agente em 05-19/05-20/05-21)"
  - test: "Deploy do `automation/` para a VPS com 05-04+05-08+05-15+05-18+05-24 (05-23 Task 2), depois da Task 1 concluída"
    expected: "GET /health 200 com os três tenants; POST /webhooks/plataforma/notificar-canal e /solicitacao-criada sem Authorization → 401; nenhum webhook do ClickUp muda; nenhuma Lista é arquivada"
    why_human: "Deploy em infraestrutura que só o dono acessa; decisão que ele pode recusar (`user_setup` do 05-23-PLAN.md)"
  - test: "Decidir e executar (ou reafirmar o adiamento de) o corte de MP/FO — desligar os 10 webhooks ClickUp e arquivar as Listas 901109642259/901111928443 (05-05 Tasks 2/3)"
    expected: "Ou o corte é executado (webhooks desligados, Listas arquivadas, confirmado por silêncio de 48h) ou a decisão de adiar continua registrada — mas hoje não há fase alguma no ROADMAP.md que reserve este trabalho; o Critério 2 do ROADMAP para a Fase 5 permanece formalmente não atendido enquanto isso não acontecer em algum lugar"
    why_human: "Decisão de produto (D5-20) sobre quando portar a fonte \"plataforma\" para os serviços de marcos-paulo/family-office; fora do alcance de qualquer plano desta fase"
  - test: "Aplicar R7 (`garantirSaqueRecorrente`) em `ws_n1` e ligar o relógio de Contas a receber (`automacoes:liberar`, 05-10 Task 4)"
    expected: "exatamente 1 Tarefa de Saque com `recurrence` em `lst_contas_a_receber` (as 9 de hoje são avulsas); depois, a primeira volta real do scheduler processa só o que WR-11 permite (nenhuma das 240 históricas antes do início do dia da importação)"
    why_human: "Adiado pelo dono em 05-25 (\"Adiar R7\"/\"Adiar o relógio (Recomendado)\") — pré-condições ausentes: nenhum processo do `apps/api` roda o scheduler em produção (PERS-08) e nenhum Membro ocupa o Papel Agente do pipeline em `ws_n1` (D-15)"
  - test: "Antes de ligar `AUTOMACOES_WORKER_ATIVO` em produção: remover (ou isolar por allowlist) os ~14 Espaços de teste com Automações temporais ativas em `lst_contas_a_pagar`/`lst_contas_a_receber` no Postgres real (WR-A, achado novo do 05-REVIEW.md desta rodada)"
    expected: "`catalogoDeListasComAgenda` só enxerga Espaços de produção quando o scheduler roda de verdade — hoje `apps/api/src/index.ts` não passa `workspaceId`, então um worker ligado agendaria e executaria Automações também nesses Espaços de teste, inclusive potencialmente notificações de WhatsApp"
    why_human: "Operação de limpeza/filtragem contra o Postgres de produção real, decisão e execução do dono; não corrigido por nenhum dos 25 planos da fase"
  - test: "Para o primeiro envio real de WhatsApp: ligar `OUTBOX_WORKER_ATIVO=true` em produção e publicar de fato uma Automação de Canal na Lista de Solicitações de `ws_n1`"
    expected: "Uma Solicitação nova do Marcos Paulo dispara a Automação, o evento `automacao.notificar-canal.v1` sai do outbox, a rota entrega pela Evolution API"
    why_human: "Duas decisões de produto/infra fora do escopo de código desta fase (PERS-08 e publicar a Automação), registradas como pendência nas próprias SUMMARYs de 05-06/05-07/05-08/05-23"
---

# Phase 5: Contas a receber e os outros tenants — Verification Report (RE-VERIFICATION)

**Phase Goal:** Marcos Paulo e Family Office operam no CRM N1 como Empresas do Campo `Empresa`,
cada uma com a sua Integração Omie e sem um terceiro clone do serviço; Contas a receber vive na
plataforma na forma que D7 determinar; uma Automação sabe notificar por Canal.
**Verified:** 2026-09-24T23:45:00Z
**Status:** human_needed
**Re-verification:** Sim — depois da rodada de fechamento de lacunas 05-13..05-25 (planos 05-01..05-12
originais + 13 planos de fechamento; 05-23 permanece aberto, sem SUMMARY.md)

## Resumo do julgamento

A rodada anterior (`7f0ef07`) achou dois defeitos de código genuínos e independentes do corte
estar aberto ou fechado: CR-01 (uma decisão de aprovação de pagamento de MP/FO desaparecia sem
erro em lugar nenhum) e CR-02 (nenhuma configuração de Canal entregava uma mensagem de ponta a
ponta). Verifiquei os dois por leitura direta do código atual — não pelo que o `05-REVIEW.md`
diz, embora ele concorde — e **os dois estão fechados de verdade**:

- `../financeiro-tria/automation/src/http/webhooks-plataforma.ts:315-357,601-613` — MP/FO agora
  recebem `422 TENANT_SEM_FONTE_PLATAFORMA` antes de qualquer chamada ao ClickUp, e a ausência de
  `handlePlatformApprovalDecision` é `throw`, nunca sucesso silencioso.
- `packages/dominio/src/operations/automations.ts:298-384` e
  `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:190-230,370-445` — os dois
  lados concordam agora sobre Lista (Solicitações de pagamento) e Campo (`fld_sp_z_whatsapp` →
  `requesterWhatsApp`), e um contrato ponta a ponta real entre os dois repositórios (05-24,
  `apps/api/src/contratos/notificar-canal.contrato.test.ts` ↔
  `../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts`) prova isso com
  fixtures geradas do seed real, não inventadas.

Além dos dois CRs originais, esta rodada fechou mais cinco avisos em escopo (CR-03 retentativa,
CR-04 "em revisão" fail-closed, CR-05 evento de Canal obrigatório em `unidade-de-trabalho.ts`,
CR-06 fuso da Data de pagamento, CR-07 vazamento de outbox de teste, WR-02/03/04/05/07, WR-11
barreira do histórico importado) e aplicou o Critério 1 em produção de verdade (`--apply` rodou,
"Marcos Paulo" nos dois Campos Empresa, 0 divergências). Verifiquei cada um lendo o arquivo e a
linha, não só citando o `05-REVIEW.md` — ver tabela abaixo.

**O que muda o veredito de `gaps_found` para `human_needed`, e não para `passed`:** todo código
necessário para os quatro Critérios existe, está testado (inclusive ponta a ponta entre os dois
repositórios) e não tem stub, TODO ou marcador de dívida. O que falta para os Critérios serem
verdade **hoje, em produção** não é mais trabalho de código — é uma lista curta e já documentada
de ações que só o dono do produto pode tomar: aplicar uma migração de schema e decidir o deploy do
`automation/` (05-23, plano aberto sem SUMMARY), decidir quando executar (ou readiar) o corte de
webhooks do ClickUp que o Critério 2 exige literalmente, e ligar R7/o relógio de Contas a receber
quando a infraestrutura de scheduler existir (PERS-08/D-15). Marcar isso como `gaps_found` pediria
a um próximo `/gsd-plan-phase --gaps` para inventar planos de código onde não falta código — por
isso a distinção do enunciado desta verificação entre code-complete e production-true, e por isso
o status é `human_needed` com os itens listados no frontmatter, não `gaps_found`.

**Uma ressalva que não vira gap de código, mas também não pode ser silenciada:** o Critério 2 do
ROADMAP.md diz explicitamente que os webhooks ClickUp e as duas Listas "são desligados/arquivados".
Isso continua sem acontecer, por decisão deliberada do dono (D5-20), adiado para "uma fase própria"
que **ainda não existe** em `ROADMAP.md`. Não é um item que uma fase futura já cobre (não há
`Step 9b` aplicável — nenhuma fase posterior existe: a Fase 5 é a última do roadmap atual) — é uma
lacuna real do Critério 2 que precisa de uma decisão do dono (reabrir o corte como fase nova, ou
reescrever o Critério 2 do ROADMAP para refletir a recusa visível como o novo alvo). Está listada
em `human_verification`, não escondida.

## Goal Achievement

### Observable Truths (Critérios do ROADMAP.md, Phase 5)

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Cada uma das 6 Empresas é opção do Campo `Empresa` e tem a própria Integração Omie; prefixo numérico e `em revisão` absorvidos, não clonados | ✓ VERIFIED (produção) | `05-20-SUMMARY.md`: dry-run pós-`--apply` real contra `ws_n1` → `criados 0, conferidos 8, divergentes 0`; "Marcos Paulo" 1x em `fd_cp_empresa` e 1x em `fld_sp_c_empresa`; CR-04 (`tasks.ts:212-216,1015-1028`, `statusNaoDeclaradoPelaEmpresa`) aplicado junto — `em revisão` fail-closed por Empresa, não mais só dica de tela. |
| 2 | Solicitações de MP e FO nascem no CRM N1 e percorrem o mesmo pipeline; webhooks ClickUp e Listas `901109642259`/`901111928443` desligados/arquivados | ⚠️ PARCIAL — defeito de código fechado, cutover continua bloqueado por decisão | CR-01 fechado por leitura direta (`webhooks-plataforma.ts:315,343-357,601-613`): MP/FO recusam com `422 TENANT_SEM_FONTE_PLATAFORMA` antes de qualquer I/O — nunca mais `{ ignored: true }` com receipt `concluido`. Mas isso é recusa VISÍVEL, não processamento de verdade: uma Solicitação de MP/FO ainda não "nasce no CRM N1 e percorre o mesmo pipeline" — só existe fonte "plataforma" para a Tria (`TENANTS_COM_FONTE_PLATAFORMA = new Set(["tria"])`). E os 10 webhooks ClickUp seguem ligados, as duas Listas seguem ativas, por decisão explícita do dono (D5-20) — sem fase agendada para portar a fonte "plataforma" aos dois tenants. |
| 3 | Contas a receber conforme D7: R2-R7 no motor com prazos confirmados; importação usa `date_closed` (CON-CR-10) | ⚠️ SUBSTANCIALMENTE PREPARADO, ativação adiada pelo dono | D7 aplicado desde a Fase 1 (zero divergências, `05-CONFERENCIA-WS-N1.md`); as 240 históricas importadas com `MARCO_ZERO`. CR-06 (fuso da Data de pagamento): código corrigido (`contas-a-receber.ts:298-330,417-427`, `comoDiaCivil`) e as 240 já importadas auditadas — `afetadas = 0` nas duas origens, confirmado por duas fontes independentes (05-22). WR-11 (barreira do histórico importado): código existe (`automations.ts:762-773`, checado linha a linha acima) e a simulação real contra `ws_n1` bateu `executed=0 · skipped=717` — os 717 pares vencidos foram todos barrados. **Mas** R7 e o relógio (R2-R7 rodando de verdade) foram explicitamente ADIADOS pelo dono em 05-25 ("Adiar R7"/"Adiar o relógio") por falta de infraestrutura (nenhum processo de scheduler em produção — PERS-08; nenhum Membro Agente do pipeline em `ws_n1` — D-15), não por defeito de código. |
| 4 | Uma Automação consegue notificar por Canal (WhatsApp via Evolution API) usando o Campo WhatsApp da Tarefa | ⚠️ CODE-COMPLETE E TESTADO PONTA A PONTA, produção pendente de ação do dono | CR-02 fechado por leitura direta nos dois repositórios: `destinoDeCanal` (`automations.ts:298-384`) e `CAMPO_ID_PARA_CHAVE` (`notificar-canal-routes.ts:205-219`) concordam sobre Lista (Solicitações) e Campo (`fld_sp_z_whatsapp`); WR-02 (gate de Empresa, `notificar-canal-routes.ts:393-396`) e WR-03 (log sem número, `:428-439`) confirmados por leitura. Contrato ponta a ponta real entre os dois repositórios (05-24) prova o alinhamento com fixtures geradas do seed real, não inventadas. **Mas** produção exige: (a) a migração de schema do `automation/` aplicada (05-23 Task 1, ainda `NOT YET APPLIED` — banner confirmado por leitura do arquivo) — sem ela, `event_type = 'automacao.notificar-canal.v1'` viola a CHECK de `platform_event_receipts`; (b) o deploy do `automation/` corrigido (05-23 Task 2, não feito — nenhuma SUMMARY existe); (c) o outbox worker do `apps/api` ativo em produção (PERS-08); (d) uma Automação de Canal de fato publicada em `ws_n1` (decisão de produto ainda não tomada, per 05-06/05-07/05-08 SUMMARY). |

**Score:** 1/4 critérios totalmente verdadeiros em produção hoje (Critério 1). Os outros 3 têm
todo o código pronto e testado — inclusive ponta a ponta entre os dois repositórios para o
Critério 4 — mas dependem de ações do dono já identificadas e sequenciadas (05-23, corte 05-05,
R7/relógio) para virarem verdade em produção.

### Gaps da rodada anterior — fechados ou não

| Id | Achado anterior (`7f0ef07`) | Situação agora |
|---|---|---|
| Gap 1 (Critério 2, CR-01) | MP/FO roteados para serviços que tentam ler o ClickUp com id de Tarefa da plataforma; decisão de aprovação desaparecia como `{ ignored: true }` com receipt `concluido` | **FECHADO no código.** `TENANTS_COM_FONTE_PLATAFORMA = new Set(["tria"])` recusa MP/FO com `422` antes de tocar o serviço; `handlePlatformApprovalDecision` ausente é `throw`, nunca sucesso. Testes reescritos com o `PaymentAutomationService` REAL de MP/FO (não fakes). O corte 05-05 continua intocado, corretamente, por D5-20. |
| Gap 2 (Critério 2, webhooks/Listas) | 05-05 Tasks 2/3 não executadas, decisão explícita do dono de deixar aberto | **NÃO FECHADO, sem regressão.** Continua exatamente onde estava — mas agora explicitamente adiado para uma "fase própria" (D5-20) que ainda não existe no ROADMAP.md. Roteado para `human_verification`, não é mais tratado como defeito de código a corrigir num próximo `--gaps` (não há código faltando). |
| Gap 3 (Critério 4, CR-02) | `destinoDeCanal` e `automation/` discordavam sobre Lista/Campo; nenhuma combinação entregava mensagem | **FECHADO no código, verificado com contrato ponta a ponta real (05-24).** Produção ainda pendente de 05-23 (migração + deploy) — ver Critério 4 acima e `human_verification`. |

### Required Artifacts (amostra desta rodada)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/dominio/src/operations/automations.ts` (`destinoDeCanal`, `CANAL_LISTA_ID`, `CANAL_CAMPO_*`) | Canal mira Solicitações, derivado do catálogo real, recusa se a Empresa não declara `avisosPorCanal` | ✓ VERIFIED | Lido linha a linha; `campoDoCatalogo` lança se o catálogo divergir do id esperado — não é literal solto. |
| `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` (`CAMPO_ID_PARA_CHAVE`, gate de Empresa, retentativa) | Só `fld_sp_z_whatsapp`; recusa Empresa ≠ marcos-paulo; log sem `erro.message` | ✓ VERIFIED | Lido linha a linha; `fd_cp_whatsapp` (o id errado de CR-02) não existe mais no arquivo. |
| `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` (`resolverTenantDaTarefa`) | Recusa permanente e visível para tenant sem fonte "plataforma", antes de qualquer I/O | ✓ VERIFIED | `TENANTS_COM_FONTE_PLATAFORMA` só contém `"tria"`; recusa acontece dentro da própria função de resolução, antes de `deps.servicos[tenantId]` ser tocado. |
| `apps/api/src/persistencia/unidade-de-trabalho.ts::executar()` | Evento de Canal derivado obrigatoriamente de TODA transação que roda Automação, nunca opt-in por rota | ✓ VERIFIED | `eventosDeNotificacaoPorCanal(antes.state, execucoesNovas(...))` somado incondicionalmente aos eventos da rota; `semEventosDeSaida` lança se a lista não estiver vazia (usado pelas duas importações históricas). |
| `packages/dominio/src/operations/automations.ts` (barreira WR-11, `runScheduledAutomations`) | Gatilho temporal nunca dispara antes do início do dia civil da importação para Tarefa com `provenance.kind === "import"` | ✓ VERIFIED | Lido linha a linha (`disparo < inicioDoDiaDaImportacao` → `skipped`); simulação real 05-25 bateu `skipped=717` sobre os 717 pares vencidos. |
| `apps/api/migracoes/006-outbox-indice-unico-canal.sql` | Índice único parcial sobre evento de Canal, aplicado em produção | ✓ VERIFIED (produção) | 05-21-SUMMARY.md: `pg_indexes` confirma o índice, `plataforma.migracoes` registra `006` aplicada; `integracao.test.ts (a2)` prova colisão/aceitação com banco real. |
| `../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql` | CHECK ampliada aceitando `falhou_retentavel`/`automacao.notificar-canal.v1` | ✗ NOT APPLIED (produção) | Banner do arquivo, lido diretamente: "NOT YET APPLIED... Quem aplica é o dono do produto, em 05-23 — nunca automaticamente." `05-23-SUMMARY.md` não existe. |
| `apps/api/src/contratos/notificar-canal.contrato.test.ts` + `../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts` + `contratos/notificar-canal-v1/*.json` | Contrato ponta a ponta real, fixtures geradas do seed, não inventadas | ✓ VERIFIED | Lidos os dois arquivos: o gerador monta Estado pelo seed real e deriva DTO/evento reais; o consumidor lê as MESMAS fixtures por listagem de diretório e usa o adapter real (`criarPlataformaAdapter`). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `webhooks-plataforma.ts::resolverTenantDaTarefa` | `marcos-paulo`/`family-office` `PaymentAutomationService` | recusa `TENANT_SEM_FONTE_PLATAFORMA` | **WIRED (fail-closed corrigido)** | A recusa acontece antes do serviço ser tocado — CR-01 fechado. |
| `packages/dominio/src/operations/automations.ts::destinoDeCanal` | `../financeiro-tria/automation/src/http/notificar-canal-routes.ts::resolverDestinoPorCampo` | `campoDestinoId` (`fld_sp_z_whatsapp`) → `CAMPO_ID_PARA_CHAVE` | **WIRED, provado por contrato ponta a ponta (05-24)** | Os dois lados concordam; teste cross-repo garante regressão fica vermelha nos dois lados. |
| `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` | `apps/api/src/servicos/dto-solicitacao.ts::paraDtoV1` | `obterTarefa(taskId)` → `GET /payment-requests/:taskId` | **WIRED** | Agora consistente: o Canal só mira Solicitações (D5-19), e `paraDtoV1` só serve Solicitações — não há mais Lista errada dos dois lados. |
| `../financeiro-tria/automation/src/http/receipts-da-plataforma.ts` | `public.platform_event_receipts` (CHECK) | `status = 'falhou_retentavel'`, `event_type = 'automacao.notificar-canal.v1'` | **CÓDIGO PRONTO, SCHEMA DE PRODUÇÃO AINDA NÃO ACEITA** | Código grava valores que a CHECK atual (20260922140000) rejeitaria; migração escrita e commitada, não aplicada — ver `human_verification`. |
| `05-CORTE-MP-FO.md` | ClickUp (painel) | desligar 10 webhooks, arquivar 2 Listas | **NOT_WIRED (por decisão, sem fase que a reserve)** | Inalterado desde a rodada anterior; agora explicitamente sem fase agendada no ROADMAP.md. |
| `apps/api/src/automacoes/scheduler-worker.ts` | `CR.listId` | `catalogoDeListasComAgenda` | **WIRED, mas GATED e sem filtro de Espaço** | Barreira WR-11 pronta e simulada; mas `index.ts` não passa `workspaceId` — achado novo WR-A do `05-REVIEW.md` (14 Espaços de teste com Automações temporais ativas no Postgres real). |

### Requirements Coverage

| Requirement | Descrição | Status | Evidência |
|---|---|---|---|
| TEN-01 | Empresas do Campo `Empresa`, config por Empresa, Integração Omie por Empresa; observável: solicitações dos dois tenants nascem no CRM N1, webhooks desligados | ⚠️ PARTIALLY SATISFIED | Config por Empresa aplicada em produção de verdade (Critério 1 ✓); mas a condição observável do requisito ("solicitações dos dois tenants nascem no CRM N1", "webhooks desligados") continua falsa — MP/FO recusam visivelmente, ainda não processam, e os webhooks seguem ligados por decisão do dono sem fase que reserve o trabalho. |
| AUTO-02 | Ação de notificar por Canal usando o Campo WhatsApp da Tarefa | ⚠️ PARTIALLY SATISFIED | Código completo, testado isoladamente e ponta a ponta entre repositórios (05-24); zero mensagem real enviada ainda — falta a migração de schema (05-23), o deploy, o outbox worker ativo e uma Automação publicada. |
| REC-01 | Contas a receber na plataforma conforme D7; R2-R7 no motor com prazos confirmados | ⚠️ PARTIALLY SATISFIED | D7 aplicado e conferido (zero divergência); R2-R6 em produção desde a Fase 1; R7 e o relógio código-prontos e simulados com segurança (717/717 barrados), mas adiados pelo dono por falta de infraestrutura de scheduler (PERS-08) e de Ator (D-15). |

Nenhuma requirement órfã: TEN-01, AUTO-02 e REC-01 são as três mapeadas para a Fase 5 em
`REQUIREMENTS.md` (linhas 137-139) e aparecem no `requirements` de pelo menos um dos 25 planos
cada (confirmado por grep em todos os `*-PLAN.md` da fase).

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `apps/api/src/index.ts:114-130` / `apps/api/src/automacoes/scheduler-worker.ts:246-273` | WR-A (achado novo, `05-REVIEW.md`) — composição de produção não passa `workspaceId` a `criarSchedulerWorker`; ~14 Espaços de teste com Automações temporais ativas em `lst_contas_a_pagar`/`lst_contas_a_receber` seguem no Postgres real | ⚠️ WARNING | Hoje dormente (nenhum processo roda o scheduler em produção — PERS-08). Se o worker for ligado sem limpar/filtrar esses Espaços primeiro, Automações de teste (inclusive potencialmente notificações de Canal) rodariam sobre dados de teste em produção. Pré-condição para ligar o relógio com segurança — listado em `human_verification`. |
| `../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql` | WR-B — código já grava valores (`falhou_retentavel`, `automacao.notificar-canal.v1`) que a CHECK de produção ainda não aceita | ⚠️ WARNING | Não quebra nada hoje porque o `automation/` corrigido também não está deployado; risco fica concentrado em deploy fora de ordem (migração depois do deploy). Sequenciamento, não bug — listado em `human_verification`. |
| `packages/dominio/src/operations/automations-historico.test.ts` / `tasks.ts` (`changeTaskStatus` muta `task.statusId` por referência) | IN-A — efeito colateral pré-existente do motor (mutação direta dentro de um laço de iteração de `runScheduledAutomations`), documentado mas não corrigido | ℹ️ INFO | Fora do escopo de D5-21; registrado para quando alguém tocar `runScheduledAutomations` de novo. Não bloqueia nenhum Critério desta fase. |

Nenhum marcador de dívida (`TBD`/`FIXME`/`XXX`) encontrado nos arquivos-chave tocados por esta
rodada, em nenhum dos dois repositórios (grep dedicado rodado nesta verificação sobre os arquivos
citados em `05-REVIEW.md`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `TENANTS_COM_FONTE_PLATAFORMA` só contém `"tria"` | leitura de `webhooks-plataforma.ts:315` | `new Set(["tria"])` | ✓ PASS (confirma fechamento de CR-01) |
| `handlePlatformApprovalDecision` ausente é `throw`, não `{ ignored: true }` | leitura de `webhooks-plataforma.ts:601-613` | `if (!service.handlePlatformApprovalDecision) throw new ErroPermanenteDaPlataforma(...)` | ✓ PASS |
| `CAMPO_ID_PARA_CHAVE` só mapeia `fld_sp_z_whatsapp` (não mais `fd_cp_whatsapp`) | leitura de `notificar-canal-routes.ts:205-207` | `{ fld_sp_z_whatsapp: "requesterWhatsApp" }` | ✓ PASS (confirma fechamento de CR-02) |
| `CANAL_LISTA_ID` é a Lista de Solicitações, derivado do catálogo | leitura de `automations.ts:308` | `export const CANAL_LISTA_ID: Id = SOLICITACAO_LISTA_ID;` | ✓ PASS |
| Evento de Canal derivado obrigatoriamente em `executar()`, não opt-in por rota | leitura de `unidade-de-trabalho.ts:118-133` | `eventosDeNotificacaoPorCanal(...)` somado incondicionalmente | ✓ PASS (confirma fechamento de CR-05) |
| Barreira do histórico importado (WR-11) | leitura de `automations.ts:762-773` | `if (disparo < inicioDoDiaDaImportacao) { skipped += 1; continue; }` | ✓ PASS |
| Migração de receipts ainda NOT YET APPLIED | leitura do banner do arquivo | "NOT YET APPLIED... Quem aplica é o dono do produto, em 05-23" | ✓ PASS (confirma que produção ainda não aceita o Critério 4 de ponta a ponta) |
| `05-23-SUMMARY.md` não existe | `ls .planning/phases/05-.../` | ausente (24 de 25 SUMMARYs presentes) | ✓ PASS |
| Marcadores de dívida | `grep -n "TBD\|FIXME\|XXX"` nos arquivos-chave dos dois repositórios | nenhuma ocorrência | ✓ PASS |
| Suíte completa `apps/api`/dominio/web, lint, tokens, `automation/` (fato fornecido pelo orquestrador — não re-executado por regra operacional do projeto: `npm run test -w @n1/api`/`npx vitest run` sem escopo estoura o watchdog de 600s contra Postgres real) | — | typecheck 3 workspaces, lint, tokens, dominio 545, web 169, api (escopado por arquivo) 2x, next build — verdes; `automation/` 224/225 (1 falha pré-existente, `payment-rules.test.ts:37`, já registrada como deferred-item da Fase 4) | ✓ PASS (aceito como fornecido) |

### Probe Execution

Não aplicável — a fase não declara nem usa `scripts/*/tests/probe-*.sh`.

## Human Verification Required

Ver a lista estruturada em `human_verification` no frontmatter — seis itens, todos ações que só o
dono do produto pode tomar (escrita de schema em produção, deploy em VPS própria, decisão de
corte de webhooks, ligar processo de scheduler, publicar Automação de produção, limpar Espaços de
teste do Postgres real). Nenhum deles é código faltando; todos já estão documentados em algum
SUMMARY ou PLAN desta fase — esta verificação apenas os consolida como o que falta para os
Critérios 2, 3 e 4 do ROADMAP virarem verdade em produção, não só no código.

## Gaps Summary

Não há gap de código nesta rodada. Os dois defeitos estruturais que a verificação anterior achou
por leitura direta (CR-01: aprovação de MP/FO desaparecendo sem erro; CR-02: nenhuma combinação de
Canal entregando mensagem) estão corrigidos, com testes usando os serviços reais (não fakes) e um
contrato ponta a ponta real entre os dois repositórios que prova o alinhamento, não só o afirma. O
Critério 1 saiu de "código pronto, `--apply` nunca rodou" para aplicado em produção com zero
divergências.

O que resta para os Critérios 2, 3 e 4 serem verdade em produção — não só no código — é uma lista
curta, já identificada pelos próprios planos: a migração de schema e o deploy do `automation/`
(05-23, aberto), a decisão sobre quando portar a fonte "plataforma" para MP/FO e executar o corte
de webhooks (D5-20, sem fase que reserve o trabalho hoje), e a infraestrutura de scheduler para
ligar R7/o relógio (PERS-08/D-15). Nenhum desses é um "gap" no sentido de código faltando — por
isso o status desta verificação é `human_needed`, não `gaps_found`. A única peça que precisa de
uma decisão de produto explícita, e não só de execução, é o Critério 2: hoje ele está formalmente
não atendido pelo ROADMAP.md, e não há fase alguma reservando o trabalho de portá-lo — o dono
precisa decidir se abre uma fase nova para isso ou se reescreve o Critério 2 para refletir a
recusa visível (D5-20) como o alvo real de curto prazo.

---

_Verified: 2026-09-24T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
