---
phase: 05-contas-a-receber-e-os-outros-tenants
verified: 2026-09-24T20:30:00Z
status: gaps_found
score: 1/4 critérios do ROADMAP totalmente atendidos (0 completos em produção; 1 substancialmente preparado e conscientemente pausado; 2 bloqueados por defeito de código confirmado de forma independente)
overrides_applied: 0
gaps:
  - truth: "Critério 2 — Solicitações de Marcos Paulo e Family Office nascem no CRM N1 e percorrem o MESMO pipeline de aprovação que a Tria"
    status: failed
    reason: "CR-01 (05-REVIEW.md), verificado por leitura direta do código, não só citado: `resolverTenantDaTarefa` roteia MP/FO para `marcosPauloPaymentService`/`familyOfficePaymentService`, mas (a) `startPaymentRequest` desses serviços chama `clickUpAdapter.getTask(taskId)` com o id da Tarefa da PLATAFORMA — o ClickUp nunca vai achar essa Tarefa, e o erro vira 422 permanente (webhooks-plataforma.ts:339-357 → marcos-paulo/payment-automation-service.ts:324-334); (b) nenhum dos dois serviços implementa `handlePlatformApprovalDecision` — confirmado por grep, só `tria/payment-automation-service.ts:1021` a implementa — então `/aprovacao-decidida` cai no ramo `{ ignored: true, reason: \"tenant sem suporte a decisão de aprovação da plataforma\" }` (webhooks-plataforma.ts:585-589), o receipt fecha `concluido` e a resposta é 202: uma decisão de aprovação de pagamento de MP/FO desaparece sem erro em lugar nenhum. Isto não é uma consequência do corte estar aberto — é um defeito que existiria MESMO SE os webhooks fossem desligados hoje."
    artifacts:
      - path: "../financeiro-tria/automation/src/http/webhooks-plataforma.ts"
        issue: "linhas 339-357 e 579-590: roteamento por tenant sem verificar se o serviço de destino sabe processar Solicitação de origem plataforma"
      - path: "../financeiro-tria/automation/src/tenants/marcos-paulo/payment-automation-service.ts"
        issue: "linha 324-334: `startPaymentRequest` sempre chama `clickUpAdapter.getTask(taskId)` — não tem caminho \"plataforma\""
      - path: "../financeiro-tria/automation/src/tenants/family-office/payment-automation-service.ts"
        issue: "mesmo defeito (linha ~359), e `handlePlatformApprovalDecision` ausente"
    missing:
      - "Um caminho \"plataforma\" real nos dois serviços (ou, no mínimo, recusa explícita em vez de `{ ignored: true }` com receipt `concluido`) ANTES de considerar o corte 05-05 executável — é a correção que o próprio 05-REVIEW.md propõe em CR-01"
      - "Teste com o serviço real de marcos-paulo/family-office provando a recusa (não só os stubs injetados que hoje escondem a dependência real do ClickUp)"
  - truth: "Critério 2 — os webhooks ClickUp dos dois tenants e as Listas 901109642259/901111928443 estão desligados/arquivados"
    status: failed
    reason: "05-05 Task 1 (o inventário) está completo; Tasks 2 e 3 (checkpoint:human-verify, gate=blocking-human — desligar os 10 webhooks e arquivar as Listas) NÃO foram executadas, por decisão explícita e registrada do dono do produto: \"Deixar aberto, seguir fase (Recomendado)\" (05-05-SUMMARY.md). Nenhum webhook foi desligado, nenhuma Lista foi arquivada, `automation/` com o roteamento de 05-04/05-08 não foi sequer deployado em produção."
    artifacts:
      - path: ".planning/phases/05-contas-a-receber-e-os-outros-tenants/05-CORTE-MP-FO.md"
        issue: "inventário completo, mas nenhuma ação executada — documento em si não é o corte"
    missing:
      - "Deploy de `automation/` com 05-04+05-08 em produção"
      - "Task 2 (desligar os 10 webhooks, confirmar silêncio de 48h) e Task 3 (arquivar as duas Listas) do plano 05-05"
  - truth: "Critério 4 — uma Automação consegue notificar por Canal (WhatsApp via Evolution API) usando o campo WhatsApp da Tarefa"
    status: failed
    reason: "CR-02 (05-REVIEW.md), verificado por leitura direta do código nos dois repositórios, não só citado: os dois lados discordam sobre qual Tarefa é notificável e nenhuma combinação funciona. `destinoDeCanal` (packages/dominio/src/operations/automations.ts:299-329) no modo `campo` lê qualquer id de Campo da Tarefa; no modo `rotulos` lê a Empresa por `CP.fields.empresa` — ambos os caminhos só fazem sentido em Tarefas de Contas a pagar. O `automation/` (notificar-canal-routes.ts:216-219) só reconhece UM id de Campo, `fd_cp_whatsapp → requesterWhatsApp` — também um Campo de Contas a pagar — e SEMPRE chama `obterTarefa(taskId)` (linha 375), que é `getTask` do contrato v1: `apps/api/src/servicos/dto-solicitacao.ts:181` devolve `undefined` (→ 404) para qualquer Tarefa fora da Lista \"Solicitações de pagamento\" — ou seja, para QUALQUER Tarefa de Contas a pagar. Resultado, confirmado por leitura, não por inferência: uma Ação de Canal sobre uma Tarefa de Contas a pagar recusa no domínio ou 404 no `automation/`; sobre uma Solicitação, o domínio às vezes resolve um destino, mas o `automation/` não tem mapeamento de Campo para ele. Nenhuma combinação entrega uma mensagem."
    artifacts:
      - path: "packages/dominio/src/operations/automations.ts"
        issue: "linhas 299-329 (`destinoDeCanal`): os dois modos só resolvem Campos/Empresa de Contas a pagar"
      - path: "../financeiro-tria/automation/src/http/notificar-canal-routes.ts"
        issue: "linhas 216-219 (`CAMPO_ID_PARA_CHAVE`) só conhece `fd_cp_whatsapp`; linha 375 chama `obterTarefa` incondicionalmente, sem checar se a Tarefa é uma Solicitação"
      - path: "apps/api/src/servicos/dto-solicitacao.ts"
        issue: "linha 181: `paraDtoV1` devolve `undefined` (404) para qualquer Tarefa fora de `lst_solicitacoes_de_pagamento` — inclui toda Tarefa de Contas a pagar"
    missing:
      - "Decisão de qual Lista é o alvo real de AUTO-02 (Contas a pagar ou Solicitação) e alinhamento dos três pontos — exatamente o Fix que 05-REVIEW.md CR-02 descreve"
      - "Um teste de contrato ponta a ponta que monte a Tarefa pelo seed real, rode `pedidosDeNotificacaoPorCanal`, passe o payload pelo schema do `automation/` e resolva o destino contra o DTO real — hoje cada lado testa só a própria metade"
missing_summary_note: "CR-03 (receipt gravado antes do efeito) e CR-07 (linhas pending órfãs de teste no outbox real) do 05-REVIEW.md continuam sem correção e agravam o Critério 4 mesmo depois de um eventual fix de CR-02 — ver seção Anti-Patterns."
deferred: []
---

# Phase 5: Contas a receber e os outros tenants — Verification Report

**Phase Goal:** Marcos Paulo e Family Office operam no CRM N1 como Empresas do Campo `Empresa`,
cada uma com a sua Integração Omie e sem um terceiro clone do serviço; Contas a receber vive na
plataforma na forma que D7 determinar; uma Automação sabe notificar por Canal.
**Verified:** 2026-09-24T20:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Summary Judgment

**Dos quatro critérios do ROADMAP, nenhum está totalmente atendido em produção hoje.** Um
(Critério 3, Contas a receber) está substancialmente preparado e pausado por decisão explícita e
registrada do dono do produto — no mesmo molde do corte do painel em `04-VERIFICATION.md`. Os
outros três carregam problemas reais: o Critério 1 (Empresa/Integração) tem todo o código e teste
prontos, mas o `--apply` que materializaria isso em `ws_n1` nunca rodou. Os Critérios 2 e 4 não são
apenas "código pronto, corte pendente" — eu verifiquei pessoalmente, lendo o código dos dois
repositórios (não só o relatório de code review), que **mesmo que o corte de 05-05 fosse executado
hoje, Marcos Paulo e Family Office ficariam sem nenhum caminho de pagamento funcionando** (CR-01),
e que **nenhuma configuração hoje entrega uma mensagem de WhatsApp de ponta a ponta** (CR-02). Isso
não é "não verificável sem infraestrutura ao vivo" — é uma incompatibilidade estrutural entre o
domínio e o `automation/` que eu confirmei lendo os três arquivos envolvidos em cada caso.

O trabalho de Fase 5 é real e extenso: 10 dos 12 planos fecharam completamente, com testes de
unidade, de contrato e de integração contra Postgres real, e o achado mais importante da fase — que
Contas a receber já operava em produção desde a Fase 1 e só precisava de conferência, não de
reescrita — foi corretamente identificado e seguido (D7, ramo processo, zero divergências). Mas o
critério goal-backward não é "os planos fecharam", é "a Empresa Marcos Paulo opera no CRM N1" e "uma
Automação consegue notificar por Canal" — e nenhuma das duas frases é verdadeira hoje, por razões
que vão além dos dois checkpoints humanos deliberadamente deixados abertos.

## Goal Achievement

### Observable Truths (Critérios do ROADMAP.md, Phase 5)

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Cada uma das 6 Empresas é opção do Campo `Empresa` e tem a própria Integração Omie; prefixo numérico e `em revisão` absorvidos, não clonados | ⚠️ PREPARADO, NÃO APLICADO | Catálogo (`CATALOGO_CONFIGURACAO_POR_EMPRESA`), evolver idempotente, teste de segurança por nome de Campo (regex contra `app_key`/`secret`/etc), CLI e tela — todos prontos e testados (05-01, 05-02). `npm run empresas:configurar -w @n1/api` rodado contra `ws_n1` real em modo dry-run: `criados: 7, conferidos: 0, divergentes: 0` (05-01-SUMMARY.md linha 76/158). **`--apply` nunca rodou** (05-01-SUMMARY.md linha 148/166: "`ws_n1` ainda não tem a configuração aplicada de verdade"). Hoje `ws_n1` tem zero das 6 Integrações por Empresa e o Campo `Empresa` ainda não tem a opção "Marcos Paulo" aplicada. Diferente de 05-05/05-10 Task 4, não há decisão registrada do dono adiando este `--apply` especificamente — é um passo operacional pendente, não uma pausa deliberada. |
| 2 | Solicitações de MP e FO nascem no CRM N1 e percorrem o MESMO pipeline; webhooks ClickUp e Listas `901109642259`/`901111928443` desligados/arquivados | ✗ NOT MET | Duas falhas independentes, ambas confirmadas por leitura direta do código (não só citadas do 05-REVIEW.md): **(a)** CR-01 — `resolverTenantDaTarefa` roteia MP/FO para serviços que tentam `clickUpAdapter.getTask(taskId)` com o id de Tarefa da PLATAFORMA (falha permanente, 422) e que não implementam `handlePlatformApprovalDecision` (só `tria/payment-automation-service.ts:1021` o faz — confirmado por grep nos três arquivos) — uma decisão de aprovação de MP/FO vira `{ ignored: true }`, o receipt fecha `concluido`, resposta 202: **a aprovação desaparece sem erro em lugar nenhum**. Isto vale independente do corte estar aberto. **(b)** O corte em si (05-05 Tasks 2/3) está deliberadamente aberto por decisão explícita do dono do produto: "Deixar aberto, seguir fase (Recomendado)" (05-05-SUMMARY.md) — nenhum webhook desligado, nenhuma Lista arquivada, `automation/` com o roteamento novo nem sequer deployado em produção. |
| 3 | Contas a receber conforme D7: Lista espelha Integração OU `createReceivableSeries` + R2–R7 no motor com prazos confirmados; importação usa `date_closed` (CON-CR-10) | ⚠️ SUBSTANCIALMENTE PREPARADO, RELÓGIO DESLIGADO por decisão | D7 respondido e registrado com evidência (ramo processo, default D5-02 acionado explicitamente em 2026-09-24, `05-CONFERENCIA-WS-N1.md` §4-5); zero divergências entre `ws_n1` e o catálogo do seed para Lista/6 Status/8 Campos/6 Automações R2-R6 (conferência somente-leitura, `05-CONFERENCIA-WS-N1.md` §1); R1 exposto como formulário `SerieDeParcelasDialog` com preview linha a linha (05-12); as 240 Tarefas históricas importadas com histórico preservado e ZERO Automações disparadas, `MARCO_ZERO` gravado, autorizado verbatim pelo dono do produto ("Aplicar agora, sem clientes", 05-11-SUMMARY.md) e confirmado por conferência independente (240 Tasks, zero divergências de configuração). **Mas:** R7 (Saque recorrente) tem código e teste prontos (05-10 Task 3) e NÃO foi aplicado a `ws_n1` ("tudo testado, nada aplicado em ws_n1", 05-10-SUMMARY.md). **E o relógio da Lista (R2-R7 rodando de verdade) está desligado** — Task 4 de 05-10 (Ensaio → ler relato → `automacoes:liberar`) é `checkpoint:human-verify` `gate=blocking-human`, deliberadamente sequenciada para depois da importação ("Relógio depois do 05-11", decisão verbatim do dono), e ainda não executada apesar da importação já ter terminado. WR-11 do 05-REVIEW.md (confirmado por leitura: `automations.ts:683-697`, gatilho temporal sem limite inferior) é um risco real para quando o relógio ligar: as ~240 Tarefas importadas sem Execução prévia vão, na primeira volta, disparar R2 (mover "para receber" vencidas para "pendente") e R4/R5 (Comentário com Menção sobre parcelas de 2025) em massa — quem protege hoje é só a leitura humana do relato do Ensaio, não uma barreira de código. |
| 4 | Uma Automação consegue notificar por Canal (WhatsApp via Evolution API) usando o campo WhatsApp da Tarefa | ✗ NOT MET | As três "pernas" (domínio 05-06, outbox 05-07, rota `automation/` 05-08) existem, são testadas isoladamente, e nenhuma delas mente sobre si mesma — mas a integração entre elas está estruturalmente quebrada. Confirmado por leitura direta, não só pelo 05-REVIEW.md (CR-02): `destinoDeCanal` (`packages/dominio/src/operations/automations.ts:299-329`) resolve destino por um Campo de Contas a pagar ou pela Empresa (também só útil em Contas a pagar); o `automation/` (`notificar-canal-routes.ts:216-219`) só mapeia o id de Campo `fd_cp_whatsapp` (Contas a pagar) e SEMPRE chama `getTask` (linha 375) — que devolve 404 para qualquer Tarefa fora da Lista de Solicitações (`apps/api/src/servicos/dto-solicitacao.ts:181`, confirmado por leitura). Uma Ação de Canal sobre Contas a pagar recusa no domínio ou 404 no `automation/`; sobre Solicitação, o `automation/` não tem o Campo mapeado. **Nenhuma combinação entrega uma mensagem hoje.** Nenhuma Automação real usa o Canal em produção ainda (confirmado nas próprias SUMMARYs de 05-06/05-07/05-08: "nenhuma foi publicada — decisão de produto"), então este não é um caso de regressão observada, é uma verificação de que a capacidade, apesar de parecer completa plano a plano, não fecha ponta a ponta. |

**Score:** 0/4 critérios totalmente atendidos em produção hoje; 1/4 (Critério 3) substancialmente
preparado e conscientemente pausado por decisão registrada; 1/4 (Critério 1) code-complete mas sem
`--apply`; 2/4 (Critérios 2 e 4) bloqueados por defeitos de integração confirmados por leitura direta
do código, que persistiriam mesmo que os checkpoints humanos abertos fossem executados hoje.

### Required Artifacts (amostra representativa dos 12 planos)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/dominio/src/configuracao-por-empresa.ts` + `-evolver.ts` | Catálogo das 6 Empresas + evolver idempotente | ✓ VERIFIED (código) / ⚠️ NÃO APLICADO (produção) | Existe, testado, dry-run contra `ws_n1` confirma `criados: 7`; `--apply` nunca rodou. |
| `../financeiro-tria/automation/src/tenants/empresa-para-tenant.ts` | Tabela total Empresa → tenant, sem fallback | ✓ VERIFIED (código, confirmado por humano) / ⚠️ NÃO DEPLOYADO | 12 entradas confirmadas linha a linha pelo dono do produto (05-04-SUMMARY.md); commit `9a7e723` existe no repositório irmão; `automation/` com este código não está em produção. |
| `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` (`resolverTenantDaTarefa`) | Roteamento por Empresa nos 3 handlers | ✓ VERIFIED (existe e roteia) / ✗ HOLLOW downstream | Rotea corretamente para `deps.servicos[tenantId]`, mas os serviços de destino (MP/FO) não sabem processar o que recebem — ver CR-01, Critério 2 acima. |
| `packages/dominio/src/operations/automations.ts` (`destinoDeCanal`, `case "notificar"`) | Ramo de Canal, recusa visível, sem I/O | ✓ VERIFIED (isolado) | Recusa corretamente quando vazio, nunca faz I/O (grep confirma ausência de `fetch`/`axios`), 9 testes verdes. Isolado do resto da cadeia, o comportamento é correto. |
| `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` | Rota de entrega, auth, idempotência, Evolution | ✓ VERIFIED (isolado) / ✗ HOLLOW downstream | Bearer em tempo constante, `Idempotency-Key`, schema `.strict()`, 16 testes verdes — mas nunca recebe um destino resolvível de nenhuma Tarefa real, porque nenhum id de Campo do domínio bate com `CAMPO_ID_PARA_CHAVE`, e `getTask` 404 para Contas a pagar. |
| `apps/api/src/bootstrap/conferir-contas-a-receber.ts` | Conferidor somente-leitura `ws_n1` × seed | ✓ VERIFIED | Rodado contra produção, zero divergências, prova de que nada foi gravado (prefixo de comandos SQL só `select`, `rollback` sempre no `finally`). |
| `packages/dominio/src/operations/importacao-contas-a-receber.ts` + CLI | Importação das 240 históricas, sem acordar Automação | ✓ VERIFIED | `runAutomations: false`, `recordActivity` com `at` original, idempotência por ledger provada por segunda execução real (0 importadas, 240 puladas). |
| `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx` | Preview linha a linha da série | ✓ VERIFIED | Preview antes do total, vencimento impossível desliga o botão pelo mesmo `confirmDisabledReason`. |

### Key Link Verification (as costuras que quebram os Critérios 2 e 4)

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `webhooks-plataforma.ts::resolverTenantDaTarefa` | `marcos-paulo`/`family-office` `PaymentAutomationService` | `service.syncAndAssignResponsible` / `service.handlePlatformApprovalDecision` | **NOT_WIRED (funcionalmente)** | O roteamento entrega a chamada, mas o serviço de destino não tem um caminho "plataforma" — `startPaymentRequest` presume ClickUp; `handlePlatformApprovalDecision` é `undefined` nos dois serviços. |
| `packages/dominio/src/operations/automations.ts::destinoDeCanal` | `../financeiro-tria/automation/src/http/notificar-canal-routes.ts::resolverDestinoPorCampo` | `campoDestinoId` → `CAMPO_ID_PARA_CHAVE` | **NOT_WIRED** | O domínio pode declarar qualquer id de Campo; o `automation/` só reconhece `fd_cp_whatsapp`. Nenhum contrato formal (schema compartilhado, teste cross-repo) garante que os dois concordem. |
| `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` | `apps/api/src/servicos/dto-solicitacao.ts::paraDtoV1` | `obterTarefa(taskId)` → `GET /payment-requests/:taskId` | **PARTIAL (fail-closed no lugar errado)** | Funciona para Solicitações; 404 permanente para qualquer Tarefa de Contas a pagar — mas Contas a pagar é exatamente onde o Campo `fd_cp_whatsapp`/Empresa faz sentido segundo o próprio domínio. |
| `05-CORTE-MP-FO.md` | ClickUp (painel) | desligar 10 webhooks, arquivar 2 Listas | **NOT_WIRED (por decisão)** | Documento pronto; nenhuma ação executada — decisão explícita do dono do produto. |
| `apps/api/src/automacoes/scheduler-worker.ts` | `CR.listId` | `catalogoDeListasComAgenda` (descoberta dinâmica) | **WIRED, mas GATED** | O mecanismo existe e é o mesmo do resto do motor; `primeiraVoltaPendente()` segue `true` para `(ws_n1, lst_contas_a_receber)` porque `automacoes:liberar` nunca foi chamado — nenhuma Execução real roda ainda, só Ensaio quando o worker rodar. |

### Requirements Coverage

| Requirement | Descrição (REQUIREMENTS.md) | Status | Evidência |
|---|---|---|---|
| TEN-01 | Empresas do Campo `Empresa`, config por Empresa, Integração Omie por Empresa, prefixo/`em revisão` absorvidos; observável: solicitações dos dois tenants nascem no CRM N1 e webhooks ClickUp desligados | ✗ BLOCKED | Nem a condição observável (webhooks desligados) nem a condição funcional subjacente (MP/FO conseguem de fato ser processados pela plataforma) são verdadeiras hoje — ver Critérios 1 e 2 acima. |
| AUTO-02 | Ação de notificar por Canal (WhatsApp via Evolution API) usando o Campo `Z WhatsApp` | ✗ BLOCKED | CR-02, confirmado por leitura direta: nenhuma configuração entrega ponta a ponta. |
| REC-01 | Contas a receber na plataforma conforme D7; `createReceivableSeries` já existe; R2-R7 viram Automações no motor com os prazos que o Financeiro confirmar | ⚠️ PARTIALLY SATISFIED | D7 respondido e aplicado (zero divergência de configuração, 240 importadas com autorização do dono); R2-R6 presentes em produção desde a Fase 1; R7 e o relógio (R2-R7 rodando de verdade) ficam para o próximo passo do operador, por decisão explícita e sequenciada, não por omissão. |

Nenhuma requirement órfã: TEN-01, AUTO-02 e REC-01 são exatamente as três mapeadas para a Fase 5 em
`REQUIREMENTS.md` (linhas 137-139) e aparecem no `requirements` de pelo menos um plano cada
(05-01..05-05 → TEN-01; 05-06..05-08 → AUTO-02; 05-09..05-12 → REC-01).

### Anti-Patterns Found (além dos 4 CRs já tratados como gaps de critério)

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` (358-409) e `webhooks-plataforma.ts` (413-431, 497-514) | CR-03 — receipt idempotente é gravado ANTES do efeito, e qualquer retentativa depois de uma falha transitória responde "202 duplicado" sem reenviar | 🛑 BLOCKER lógico para Critério 4 (e para a confiabilidade de Critério 2 mesmo quando ligado) | Uma falha transitória de rede na Evolution API, ou no `getTask` de resolução de tenant, perde a mensagem/Solicitação/decisão de aprovação silenciosamente na primeira retentativa do outbox. Confirmado por leitura: `inserirReceiptSeNovo` usa `ignoreDuplicates`, e o handler não distingue `status` da linha existente antes de responder "duplicated". |
| `apps/api/src/automacoes/scheduler-worker.test.ts` (108-117, 810-814) | CR-07 — teste grava, de propósito, uma linha `automacao.notificar-canal.v1` `pending` no `integration_outbox` do Postgres REAL de teste, e `limparWorkspace` não a apaga | ⚠️ WARNING | Cada rodada da suíte injeta uma linha órfã que o outbox worker de produção (criado sem filtro de `workspaceId`) pode reivindicar e tentar entregar contra `/webhooks/plataforma/notificar-canal` com um `taskId` de teste — mesma classe do defeito já corrigido em `operacoes.test.ts` nesta mesma fase (commit `1923892`), reintroduzida em outro arquivo. |
| `packages/dominio/src/operations/automations.ts` (683-697, gatilho temporal de R2/R4/R5) | WR-11 — nenhuma barreira estrutural impede as ~240 Tarefas importadas de serem processadas em massa na primeira volta real depois de `automacoes:liberar` | ⚠️ WARNING | Relevante especificamente para o próximo passo do operador em Critério 3 — sem isto corrigido (ou sem uma leitura muito cuidadosa do relato do Ensaio antes de liberar), a primeira volta real vai mover contas históricas já fechadas para "pendente" e comentar cobrança sobre parcelas de 2025. |
| `apps/api/src/importacao/clickup/contas-a-receber.ts` (254-258) | WR-08 — resolução de cliente por nome aceita o primeiro homônimo sem registrar ambiguidade | ℹ️ INFO | Baixo risco imediato (0 Contatos/Empresas em `ws_n1` hoje, então nenhuma das 240 bateu com um cliente ainda), mas value-affecting quando o CRM tiver clientes cadastrados. |

Nenhum marcador de dívida (`TBD`/`FIXME`/`XXX`) encontrado nos arquivos tocados pela fase, em
nenhum dos dois repositórios (grep dedicado rodado nesta verificação).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Suíte completa de `apps/api` (fato fornecido pelo orquestrador, não re-executado por regra operacional do projeto — reexecutar estoura o watchdog de 600s do agente) | — | 65 arquivos, 593 passed, 12 skipped, exit 0 | ✓ PASS (aceito como fornecido) |
| Suíte `automation/` (fato fornecido) | — | 187/188 — 1 falha pré-existente (`payment-rules.test.ts:37`, item 1 do deferred-items da Fase 4) | ✓ PASS (aceito como fornecido) |
| `handlePlatformApprovalDecision` só existe no serviço da Tria | `grep -n "handlePlatformApprovalDecision" automation/src/tenants/*/payment-automation-service.ts automation/src/http/webhooks-plataforma.ts` | 3 ocorrências: 2 no uso genérico (`webhooks-plataforma.ts`), 1 na implementação (`tria/payment-automation-service.ts:1021`); zero em `marcos-paulo`/`family-office` | ✓ PASS (confirma CR-01) |
| `CAMPO_ID_PARA_CHAVE` só mapeia um Campo, de Contas a pagar | `grep -n "CAMPO_ID_PARA_CHAVE\|fd_cp_whatsapp" notificar-canal-routes.ts` | Só `fd_cp_whatsapp → requesterWhatsApp` | ✓ PASS (confirma CR-02) |
| `getTask` 404 para Tarefa fora de Solicitações | Leitura de `apps/api/src/servicos/dto-solicitacao.ts:172-181` | `if (task.listId !== LISTA_SOLICITACOES_DE_PAGAMENTO_ID) return undefined;` | ✓ PASS (confirma CR-02) |
| `--apply` de `empresas:configurar` nunca rodou | `grep -n "apply\|ws_n1" 05-01-SUMMARY.md` | "ws_n1 ainda não tem a configuração aplicada de verdade — só o dry-run rodou" | ✓ PASS (confirma gap do Critério 1) |
| Nenhum marcador de dívida em arquivos da fase | `grep -rn "TBD\|FIXME\|XXX"` nos arquivos-chave dos dois repositórios | Nenhuma ocorrência | ✓ PASS |

### Probe Execution

Não aplicável — a fase não declara nem usa `scripts/*/tests/probe-*.sh`; a verificação de comportamento
usou leitura direta de código e os resultados de suíte já fornecidos pelo orquestrador (ver seção acima).

## Human Verification Required

Nenhum item desta verificação depende de decisão humana adicional além das já registradas
(05-05 e 05-10 Task 4 já têm decisão explícita do dono do produto, documentada acima como gap, não
como pendência de verificação). Os quatro gaps estruturados no frontmatter são, todos, corrigíveis
por trabalho de código ou por um comando de operador já documentado — não por julgamento visual,
tempo real ou confirmação de terceiro. Por isso o status não é `human_needed`.

## Gaps Summary

A Fase 5 fez o trabalho difícil de descobrir que Contas a receber já existia em produção e de
resolver D7 sem reescrever nada — isso está certo, testado, e a conferência prova. Mas os dois
critérios que dão nome à fase ("os outros tenants" e "uma Automação sabe notificar por Canal") não
fecham: **MP/FO roteados para serviços que não sabem processar Solicitações da plataforma (CR-01)**
e **nenhuma configuração de Canal entrega uma mensagem de ponta a ponta (CR-02)** são defeitos de
integração que eu confirmei lendo os arquivos, não inferências do relatório de code review — e que
persistiriam mesmo que os dois checkpoints humanos abertos (05-05, 05-10 Task 4) fossem executados
hoje. Nenhum dos quatro gaps listados é decoração: cada um tem um artefato, uma linha e um "missing"
concreto. Corrigir CR-01 e CR-02 (e, antes de confiar no relógio, tratar WR-11) é o que falta para
que os Critérios 2 e 4 deixem de ser "código pronto, plano a plano" e passem a ser "a coisa que o
ROADMAP promete".

---

_Verified: 2026-09-24T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
