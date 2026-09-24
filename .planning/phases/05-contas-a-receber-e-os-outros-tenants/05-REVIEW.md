---
phase: 05-contas-a-receber-e-os-outros-tenants
reviewed: 2026-09-24T23:30:00Z
depth: standard
files_reviewed: 53
files_reviewed_list:
  - apps/api/migracoes/006-outbox-indice-unico-canal.sql
  - apps/api/package.json
  - apps/api/src/automacoes/scheduler-worker.ts
  - apps/api/src/automacoes/scheduler-worker.test.ts
  - apps/api/src/bootstrap/configuracao-por-empresa.test.ts
  - apps/api/src/contratos/notificar-canal.contrato.test.ts
  - apps/api/src/importacao/clickup/contas-a-receber.ts
  - apps/api/src/importacao/clickup/contas-a-receber.test.ts
  - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts
  - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.cli.ts
  - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.test.ts
  - apps/api/src/importacao/clickup/importar-contas-a-pagar.ts
  - apps/api/src/importacao/clickup/importar-contas-a-receber.ts
  - apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts
  - apps/api/src/importacao/clickup/importar-contas-a-receber.test.ts
  - apps/api/src/importacao/clickup/politica-do-marco-zero.ts
  - apps/api/src/importacao/clickup/politica-do-marco-zero.test.ts
  - apps/api/src/persistencia/eventos-de-canal.ts
  - apps/api/src/persistencia/eventos-de-canal.test.ts
  - apps/api/src/persistencia/integracao.test.ts
  - apps/api/src/persistencia/limpar-outbox-de-teste.ts
  - apps/api/src/persistencia/limpar-outbox-de-teste.cli.ts
  - apps/api/src/persistencia/limpar-outbox-de-teste.test.ts
  - apps/api/src/persistencia/outbox.ts
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/rotas/formularios-publicos.test.ts
  - apps/api/src/rotas/integracao-solicitacoes.test.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/api/src/rotas/operacoes.test.ts
  - contratos/notificar-canal-v1/README.md
  - contratos/notificar-canal-v1/campo.gasto-novo.json
  - contratos/notificar-canal-v1/rotulos.gasto-novo.json
  - contratos/notificar-canal-v1/sem-canal.tria.json
  - packages/dominio/src/configuracao-por-empresa-evolver.ts
  - packages/dominio/src/configuracao-por-empresa-evolver.test.ts
  - packages/dominio/src/operations/automations.ts
  - packages/dominio/src/operations/automations-canal.test.ts
  - packages/dominio/src/operations/automations-historico.test.ts
  - packages/dominio/src/operations/importacao-contas-a-receber.ts
  - packages/dominio/src/operations/importacao-contas-a-receber.test.ts
  - packages/dominio/src/operations/status-por-empresa.test.ts
  - packages/dominio/src/operations/tasks.ts
  - packages/dominio/src/solicitacao-de-pagamento.ts
  - packages/dominio/src/solicitacao-de-pagamento.test.ts
  - ../financeiro-tria/automation/src/http/notificar-canal-routes.ts
  - ../financeiro-tria/automation/src/http/notificar-canal-routes.test.ts
  - ../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts
  - ../financeiro-tria/automation/src/http/receipts-da-plataforma.ts
  - ../financeiro-tria/automation/src/http/receipts-da-plataforma.test.ts
  - ../financeiro-tria/automation/src/http/routes.ts
  - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
  - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts
  - ../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 05: Code Review Report — rodada GAP-CLOSURE (planos 05-13..05-25)

**Reviewed:** 2026-09-24T23:30:00Z
**Depth:** standard
**Files Reviewed:** 53 (44 em `crm-n1`, 9 no repositório irmão `../financeiro-tria`)
**Status:** issues_found (nenhum bloqueador; dois avisos, um informativo — nenhum novo bloqueador desde a rodada anterior)

## Summary

Esta é a SEGUNDA rodada de revisão da Fase 5, sobre os planos 05-13..05-25 (fechamento de
lacunas, D5-21). A primeira rodada (commit `8902985`) tinha achado 7 bloqueadores (CR-01..CR-07)
e 15 avisos; D5-21 pôs em escopo CR-01..07 inteiros e WR-02, WR-03, WR-04, WR-05, WR-07 e WR-11
dos avisos. Tracei cada um contra o código atual, não contra o que os SUMMARYs afirmam — para
cada CR/WR abaixo há evidência de arquivo:linha.

**Veredito: os 7 bloqueadores e os 6 avisos em escopo estão de fato fechados no código.** Não é
"os testes passam e o SUMMARY diz que sim" — segui a cadeia: `destinoDeCanal` (domínio) →
`eventos-de-canal.ts` (ponte) → `notificar-canal-routes.ts` (automation/) → fixtures de
`contratos/notificar-canal-v1/` geradas do seed real e consumidas pela rota real (05-24) — as
quatro pontas concordam sobre qual Lista, qual Campo e qual id de Campo é o canal de WhatsApp.
`changeTaskStatus` chama `statusNaoDeclaradoPelaEmpresa` de verdade (CR-04), e a regra foi
aplicada em produção (`ws_n1`, 05-20: 8 criados, 0 divergentes). A derivação do evento de Canal
saiu das rotas e passou a morar em `unidade-de-trabalho.ts::executar()` — não há mais como uma
rota nova esquecer o evento (CR-05), e confirmei que TODO caminho que roda Automações
(`operacoes.ts`, `formularios-publicos.ts`, `integracao-solicitacoes.ts`, `classificacoes.ts`,
`convidar-membro.ts`) passa por `executar()`. A data de pagamento é resolvida em
`America/Sao_Paulo` no mapeador (CR-06, código) e as 240 Contas a receber já importadas foram
auditadas contra o dia UTC errado — `afetadas = 0` nas duas origens, confirmado por duas fontes
independentes (05-22). `scheduler-worker.test.ts` limpa `integration_outbox`/`automacao_agenda`
no `beforeAll` E `afterAll`, e as 9 linhas órfãs que já tinham vazado para o Postgres de produção
foram removidas com autorização do dono (05-19). O índice único parcial de WR-04
(`integration_outbox_notificar_canal_uniq`) está aplicado em produção e provado com banco
(`integracao.test.ts` caso `a2`). CR-01: Marcos Paulo e Family Office agora recebem
`422 TENANT_SEM_FONTE_PLATAFORMA` antes de qualquer I/O (nunca mais `{ ignored: true }` com
receipt `concluido`) — confirmado com o `PaymentAutomationService` REAL dos dois tenants, não um
fake. CR-03: o módulo neutro `receipts-da-plataforma.ts` fecha `falhou_retentavel` em falha
transitória e a próxima entrega reivindica a linha de volta — consumido pelas DUAS rotas
plataforma → `automation/`, uma correção só, não duas.

**A única ressalva de peso**: a correção de CR-03 depende de uma migração de schema
(`20260925120000_platform_event_receipts_retentavel_e_canal.sql`, `falhou_retentavel` +
`event_type = 'automacao.notificar-canal.v1'`) que está escrita e commitada mas **ainda não
aplicada** em produção — 05-23 continua sem `SUMMARY.md` (confirmado: `05-23-SUMMARY.md` não
existe no repositório), é o único item dos 13 do fechamento de lacunas que segue esperando o
dono. Isto não é um bloqueador de CÓDIGO — é sequenciamento de deploy corretamente documentado
(banner "NOT YET APPLIED" na migração, e o `automation/` com este código também ainda não
deployado em produção, per 05-15/05-18 SUMMARY) — mas registro como aviso porque é o gancho onde
um deploy fora de ordem quebraria CR-03 na prática.

O achado genuinamente novo desta rodada é operacional, não de código: `scheduler-worker.ts`
continua sem filtro de Espaço na composição de produção (`apps/api/src/index.ts:114-130`, sem
`workspaceId`), e o Postgres de produção tem hoje 14 Espaços de teste com Automações temporais
ativas nas Listas `lst_contas_a_pagar`/`lst_contas_a_receber` (achado do próprio 05-25, não
corrigido). Não é regressão desta rodada — é uma lacuna pré-existente que 05-25 documentou e que
segue sem correção de código; incluída aqui como WARNING porque nenhum dos 12 planos anteriores a
fechou e ela é uma pré-condição para ligar o relógio com segurança.

Não encontrei nenhum bloqueador novo introduzido pelos planos 05-13..05-25. O nível de disciplina
é alto e consistente: `.strict()` em schemas, payloads pobres nos eventos, mensagens de erro
fixas sem interpolação de dado sensível, testes com o serviço REAL em vez de fakes que
escondiam os defeitos anteriores (CR-01), e travas estruturais (`semEventosDeSaida`,
`WR-11`, índice único) em vez de disciplina de quem lembra.

## Achados da rodada anterior

| Id | Título (rodada anterior) | Status | Evidência |
|---|---|---|---|
| CR-01 | MP/FO roteados para serviços que não sabem ler a plataforma — aprovação descartada como "concluída" | **Fechado** | `../financeiro-tria/automation/src/http/webhooks-plataforma.ts:315` (`TENANTS_COM_FONTE_PLATAFORMA = new Set(["tria"])`), `:343-357` (`resolverTenantDaTarefa` lança `TENANT_SEM_FONTE_PLATAFORMA` para qualquer tenant fora do conjunto, antes de tocar o serviço), `:601-613` (`/aprovacao-decidida`: ausência de `handlePlatformApprovalDecision` é `throw`, nunca `{ ignored: true }`). Testes (o)/(p) reescritos com o `PaymentAutomationService` REAL de marcos-paulo/family-office e `clickUpAdapter.getTask` espionado (05-15 SUMMARY) — a recusa é provada como acontecendo ANTES de qualquer I/O do ClickUp. O corte 05-05 permanece bloqueado por decisão (D5-20), corretamente não executado por nenhum plano desta rodada. |
| CR-02 | Canal (AUTO-02) não funciona de ponta a ponta em nenhuma configuração | **Fechado** | Domínio: `packages/dominio/src/operations/automations.ts:308-384` (`CANAL_LISTA_ID = SOLICITACAO_LISTA_ID`, `CANAL_CAMPO_EMPRESA_ID`/`CANAL_CAMPO_WHATSAPP_ID` derivadas do catálogo real via `campoDoCatalogo`, que lança se o catálogo divergir). `automation/`: `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:205-207` (`CAMPO_ID_PARA_CHAVE = { fld_sp_z_whatsapp: "requesterWhatsApp" }`, `fd_cp_whatsapp` saiu). Ponta a ponta: `contratos/notificar-canal-v1/*.json` + `apps/api/src/contratos/notificar-canal.contrato.test.ts` (gerador, sobre o seed real) + `../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts` (consumidor, contra a rota real) — 05-24 prova com duas mutações deliberadas (revertidas) que cada lado fica vermelho quando o outro diverge. |
| CR-03 | Receipt gravado antes do efeito + "duplicado" em retentativa = falha transitória vira perda silenciosa | **Fechado no código; aplicação em produção pendente (05-23, dono)** | `../financeiro-tria/automation/src/http/receipts-da-plataforma.ts:99-143` (`reivindicarReceipt`: `falhou_retentavel` é reivindicado de volta por UPDATE condicional, só `concluido`/`falhou`/`recebido` respondem "duplicado"); consumido por `webhooks-plataforma.ts:404-439` E `notificar-canal-routes.ts:368-444` (mesma correção, um módulo só — fecha IN-05 da rodada anterior de propósito). Ressalva: a migração que alarga a CHECK de `status`/`event_type` (`../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql`) tem banner "NOT YET APPLIED" e `05-23-SUMMARY.md` não existe no repositório — confirma que ainda não rodou. Ver WARNING WR-A abaixo. |
| CR-04 | D5-06 ("em revisão" só para quem declara) não é regra de domínio — só dica de tela | **Fechado** | `packages/dominio/src/operations/tasks.ts:212-216` (`changeTaskStatus` chama `statusNaoDeclaradoPelaEmpresa` antes de `entryAllowedMemberIds`), `:1015-1028` (fail-closed: Tarefa sem Empresa quando ALGUÉM declara o Status é agora recusa, não passagem livre — `if (!empresa) return "Este Status só vale..."`). `alterarStatusEmLote` herda por chamar `changeTaskStatus` (não tocado, não precisa). Aplicado em produção: 05-20 (`evoluirConfiguracaoPorEmpresa --apply`) gravou `statusDeclarados: ["em revisão"]` nas 3 Integrações do Family Office em `ws_n1`. |
| CR-05 | Evento de Canal só nasce em 2 de 4 caminhos; Timeline mente "enfileirado" nos outros | **Fechado** | `apps/api/src/persistencia/unidade-de-trabalho.ts:96-133` — `idsAntes` capturado dentro do laço de retry, `eventos` soma `opcoes.eventos` (o que a rota fornece) com `eventosDeNotificacaoPorCanal(...)` SEMPRE, para toda transação. Confirmei que os 4 caminhos citados no achado original passam todos por `executar()`: `apps/api/src/rotas/operacoes.ts:196` (ramo genérico) e `:106` (`convidarMembro` → `executar()` também), `apps/api/src/rotas/formularios-publicos.ts:279`, `apps/api/src/rotas/integracao-solicitacoes.ts:131`, `apps/api/src/rotas/classificacoes.ts:183`. Prova com banco: `formularios-publicos.test.ts` bloco `dCanal` (05-17) — formulário público sobre Solicitação com Automação de Canal grava exatamente 1 linha de `automacao.notificar-canal.v1`. `semEventosDeSaida` (T-5-57) trava as duas importações históricas contra qualquer vazamento futuro. |
| CR-06 | Data de pagamento importada cortada em UTC — D+1 para fechamentos após 21h BRT | **Fechado (código e dados)** | Código: `apps/api/src/importacao/clickup/contas-a-receber.ts:298-330` (`instanteDaDataDePagamento`, extraída) + `:417-427` (`comoDiaCivil(Date.parse(...))`, nunca mais `slice(0,10)`); `packages/dominio/src/operations/importacao-contas-a-receber.ts` recebe `CivilDate` pronto, só valida formato (`FORMATO_DE_DIA_CIVIL`), não corta. Dados: `corrigirDataDePagamentoImportada` (mesmo arquivo, linha 380) + `apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts` — dry-run contra `ws_n1` (05-22) devolveu `afetadas: {"campo":0,"date_closed":0}` sobre as 240 Tarefas reais, confirmado por uma segunda leitura independente do orquestrador direto do export (0 instantes na janela UTC < 3h). Nenhum `--apply` foi necessário. |
| CR-07 | `scheduler-worker.test.ts` deixa `pending` em `integration_outbox` do Postgres real | **Fechado** | `apps/api/src/automacoes/scheduler-worker.test.ts:122-127` (`limparWorkspace` agora apaga `integration_outbox` além de `automacao_agenda`/`registros`/`workspaces`) chamado no `beforeAll` (defensivo) E `afterAll` de todo `describe` que cria Espaço (linhas 273-296, 595-612, 870-881). As 9 linhas órfãs que já tinham vazado foram removidas em produção com autorização do dono (05-19, checkpoint documentado com dry-run antes/depois). `apps/api/src/persistencia/limpar-outbox-de-teste.ts` fica como ferramenta permanente para o resto da suíte. |
| WR-02 | `/notificar-canal` não confere Empresa/tenant — tudo sai pela instância do Marcos Paulo | **Fechado** | `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:393-396` — gate `tenantDaEmpresa(tarefa.fields.company) !== "marcos-paulo"` → `422 EMPRESA_SEM_CANAL`, logo após `obterTarefa`, ANTES de resolver destino, nos DOIS modos (campo e rótulos). Par no domínio: `automations.ts:366-369` (`destinoDeCanal` recusa quando a Empresa não declara `avisosPorCanal.whatsapp`). |
| WR-03 | Corpo de erro da Evolution (pode ter o número) vai inteiro para o log | **Fechado** | `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:428-439` — `resumo`/log carregam só `code`/`httpStatus`/`erro.name`, nunca `erro.message` nem o objeto `erro`; `classificarErroDeEnvio` (linha 304) checa `ErroPermanenteDaPlataforma`/`ErroTransitorioDaPlataforma` antes da regex textual da Evolution. |
| WR-04 | "Barreira de duplicidade" de eventos de Canal citada no código não existe no banco | **Fechado** | `apps/api/migracoes/006-outbox-indice-unico-canal.sql` — índice único parcial `integration_outbox_notificar_canal_uniq` sobre `(workspace_id, aggregate_type, aggregate_id, event_type) where event_type = 'automacao.notificar-canal.v1'`, aplicado em produção (05-21, confirmado por leitura de `pg_indexes` e `plataforma.migracoes`). `aggregateId = <executionId>:<indicePasso>` (`apps/api/src/persistencia/eventos-de-canal.ts:49-71`), nunca só `executionId`. Provado com banco: `apps/api/src/persistencia/integracao.test.ts` caso `(a2)` — mesmo passo colide, passo diferente ou Espaço diferente é aceito. |
| WR-05 | Evolver por Empresa não confere `avisosPorCanal` nem `statusDeclarados` | **Fechado** | `packages/dominio/src/configuracao-por-empresa-evolver.ts:245-249` — os dois campos comparados por JSON canônico (`canonico()`, linha 125) dentro de `conferirCampos`; qualquer divergência entra em `divergentes` e nada é sobrescrito. Aplicado em produção (05-20): dry-run pós-`--apply` devolveu `conferidos 8, divergentes 0`. |
| WR-07 | Importação grava `MARCO_ZERO` mesmo com rejeições; `--so-marco-zero` grava sem `--apply` | **Fechado** | `apps/api/src/importacao/clickup/politica-do-marco-zero.ts` — `decidirMarcoZero` pura: `rejeitadas > 0` sempre recusa (`acao: "recusar"`); `soMarcoZero` sem `apply` é sempre `"relatar"` (nunca grava). `apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts:151` chama a decisão ANTES de qualquer `marcarMarcoZero` do fluxo normal (linha 162); o ramo `--so-marco-zero` (linha 93-119) só grava dentro de `decisao.acao === "gravar"`. |
| WR-11 | Nenhuma barreira estrutural impede R2/R4/R5 de agir sobre o histórico importado | **Fechado** | `packages/dominio/src/operations/automations.ts:762-773` — dentro de `runScheduledAutomations`, Tarefa com `provenance.kind === "import"` nunca dispara gatilho temporal cujo `disparo` seja anterior ao início do dia civil de `provenance.at` (estrita: o próprio dia da importação ainda dispara). Vale para os três chamadores (agenda, rota manual, botão da tela) por ser dado da Tarefa, não parâmetro extra. Provado por simulação real contra `ws_n1` (05-25 pré-voo): `executed=0 · failed=0 · skipped=717` — os 717 pares (Tarefa × Automação temporal) já vencidos foram TODOS barrados. |

## Warnings

### WR-A: `scheduler-worker.ts` ainda sem filtro de Espaço na composição de produção — 14 Espaços de teste com Automações temporais ativas continuam no Postgres real

**File:** `apps/api/src/index.ts:114-130` (nenhum `workspaceId` passado a `criarSchedulerWorker`); `apps/api/src/automacoes/scheduler-worker.ts:246-273` (`catalogoDeListasComAgenda` sem filtro quando `workspaceId` é `undefined`)

**Issue:** Não é regressão desta rodada — é o achado do próprio 05-25 (pré-voo do relógio), registrado como "fora do escopo" e deixado sem correção de código pelos 12 planos anteriores. Confirmei a raiz: `catalogoDeListasComAgenda(opcoes.workspaceId)` só filtra por `workspace_id` quando a opção existe; a composição de produção em `index.ts` nunca a passa (só o teste passa, isolando sua própria fatia). O 05-25 encontrou, contra o mesmo Postgres, 14 Espaços de teste (`ws_outbox_*`, `ws_spike`, `ws_spike_10x`, `ws_debug_automations`, `ws_teste_classificacoes_*`, `ws_teste_integracao_solicitacoes_*`) com `lst_contas_a_pagar`/`lst_contas_a_receber` e Automações temporais publicadas — nenhum tem linha na agenda hoje, mas um worker ligado (`AUTOMACOES_WORKER_ATIVO=true`) criaria agenda e rodaria Automação neles também, inclusive potencialmente notificações de Canal por WhatsApp (a mesma classe de vazamento que CR-07 corrigiu para o outbox de teste, agora pelo lado da agenda). A limpeza de 05-19 (`limpar-outbox-de-teste.ts`) cobre `integration_outbox`/`automacao_agenda`, não os registros (`plataforma.registros`/`workspaces`) desses Espaços de teste antigos — então rodar a CLI existente hoje não resolve isto.

Hoje isto é dormente: nenhum processo do `apps/api` roda `AUTOMACOES_WORKER_ATIVO=true` em produção (PERS-08, confirmado pelo pré-voo de 05-25) e o dono decidiu adiar o relógio. Mas o código, por si, não impede o problema — é uma pré-condição operacional não codificada.

**Fix:** antes de ligar `AUTOMACOES_WORKER_ATIVO` em produção: (a) remover os Espaços de teste antigos do Postgres real (operação escopada com dry-run, no molde de `outbox:limpar-testes` — mas alcançando `plataforma.registros`/`workspaces`, não só outbox/agenda), OU (b) filtrar `catalogoDeListasComAgenda` por uma allowlist de Espaços de produção (o oposto do padrão atual de "todos, exceto"). Qualquer um dos dois fecha a lacuna antes do primeiro `iniciar()` real.

### WR-B: A correção de CR-03 depende de uma migração ainda não aplicada em produção (05-23 pendente)

**File:** `../financeiro-tria/supabase/migrations/20260925120000_platform_event_receipts_retentavel_e_canal.sql` (banner "NOT YET APPLIED"); `../financeiro-tria/automation/src/http/receipts-da-plataforma.ts:99-143` (grava `falhou_retentavel` e, na rota de Canal, `event_type = 'automacao.notificar-canal.v1'`)

**Issue:** O código de `receipts-da-plataforma.ts` (consumido por `webhooks-plataforma.ts` desde 05-15 e por `notificar-canal-routes.ts` desde 05-18) já grava valores que a CHECK de produção (`20260922140000`) não aceita: `status = 'falhou_retentavel'` e `event_type = 'automacao.notificar-canal.v1'`. `05-23-SUMMARY.md` não existe no repositório (confirmado por `ls`), então a migração que alarga essas duas CHECK segue "escrita, nunca aplicada" — exatamente como o SUMMARY de 05-15 registrou. Hoje isto não quebra nada porque o `automation/` com este código também ainda não foi deployado em produção (nota operacional de 05-15/05-18) — mas se algum dia o deploy do `automation/` acontecer ANTES da migração, `fecharReceipt` (best-effort, nunca lança — só faz `console.warn` em exceção de REDE, não confere `resultado.error` do Supabase) engoliria a violação de CHECK em silêncio, e o receipt ficaria preso no status anterior. Para o evento de Canal especificamente, o efeito é mais visível: `reivindicarReceipt` faz o INSERT inicial com `event_type = 'automacao.notificar-canal.v1'`, que violaria a CHECK antiga na primeira linha — `inserido.error` É checado (`if (inserido.error) return { tipo: "erro" }`), então a rota devolveria `500` retentável em vez de perder o evento; o risco fica concentrado no CAMINHO de retentativa de `falhou_retentavel` dos três webhooks do contrato v1, que reproduziria a lacuna aceita e documentada ("presa em `recebido`"), não pior que ela.

**Fix:** nenhuma mudança de código — é sequenciamento de deploy. Confirmar, antes de qualquer deploy do `automation/` com o código de 05-15/05-18/05-24, que a migração `20260925120000` já rodou (dono, 05-23). Considerar adicionar essa checagem ao próprio checklist de deploy do `automation/`, já que o código não se autoverifica contra o schema.

## Info

### IN-A: `automations-historico.test.ts` documenta um efeito colateral pré-existente do motor (mutação direta de `task.statusId`), não corrigido — correto não corrigir aqui

**File:** `packages/dominio/src/operations/automations-historico.test.ts` (comentário do caso de controle); `packages/dominio/src/operations/tasks.ts` (`changeTaskStatus` muta `task.statusId` no objeto, não substitui a entrada em `state.tasks`)

**Issue:** O SUMMARY de 05-13 documenta que, na MESMA rodada de `runScheduledAutomations`, R2 pode mudar `task.statusId` por mutação direta, e R4/R5 (que iteram a mesma referência de `task`) passam a ver o Status novo antes do fim da rodada — um cascateamento que pode disparar R4/R5 no mesmo ciclo em que R2 rodou, se os prazos deles já tiverem vencido. O plano registrou isso como comportamento pré-existente do motor, não introduzido pela barreira de WR-11, e isolou o teste de controle para não depender dele. Concordo com a leitura e com a decisão de não corrigir aqui (fora do escopo de D5-21) — registro como informativo porque é uma classe de bug (mutação compartilhada dentro de um laço de iteração) que vale a pena revisitar quando alguém tocar `runScheduledAutomations` de novo, não porque este fechamento de lacunas devesse tê-lo corrigido.

---

_Reviewed: 2026-09-24T23:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
