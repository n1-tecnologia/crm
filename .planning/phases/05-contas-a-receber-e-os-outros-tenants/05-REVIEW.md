---
phase: 05-contas-a-receber-e-os-outros-tenants
reviewed: 2026-09-24T18:00:00Z
depth: standard
files_reviewed: 57
files_reviewed_list:
  - apps/api/src/bootstrap/configuracao-por-empresa.ts
  - apps/api/src/bootstrap/configuracao-por-empresa.cli.ts
  - apps/api/src/bootstrap/configuracao-por-empresa.test.ts
  - apps/api/src/bootstrap/conferir-contas-a-receber.ts
  - apps/api/src/bootstrap/conferir-contas-a-receber.cli.ts
  - apps/api/src/bootstrap/conferir-contas-a-receber.test.ts
  - apps/api/src/bootstrap/contas-a-receber.ts
  - apps/api/src/bootstrap/contas-a-receber.cli.ts
  - apps/api/src/bootstrap/contas-a-receber.test.ts
  - apps/api/src/contratos/v1.ts
  - apps/api/src/contratos/v1.test.ts
  - apps/api/src/servicos/dto-solicitacao.ts
  - apps/api/src/importacao/clickup/contas-a-receber.ts
  - apps/api/src/importacao/clickup/contas-a-receber.test.ts
  - apps/api/src/importacao/clickup/importar-contas-a-receber.ts
  - apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts
  - apps/api/src/importacao/clickup/importar-contas-a-receber.test.ts
  - apps/api/src/persistencia/eventos-de-canal.ts
  - apps/api/src/persistencia/eventos-de-canal.test.ts
  - apps/api/src/persistencia/outbox.ts
  - apps/api/src/persistencia/outbox.test.ts
  - apps/api/src/persistencia/outbox-worker.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/api/src/rotas/operacoes.test.ts
  - apps/api/src/automacoes/scheduler-worker.ts
  - apps/api/src/automacoes/scheduler-worker.test.ts
  - apps/api/package.json
  - apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx
  - apps/web/src/features/estrutura/financeiro/serie-dialog.tsx
  - apps/web/src/features/estrutura/financeiro/contas-view.tsx
  - apps/web/src/features/estrutura/financeiro/lens.ts
  - apps/web/src/features/estrutura/financeiro/lens.test.ts
  - packages/dominio/src/types/workspace.ts
  - packages/dominio/src/configuracao-por-empresa.ts
  - packages/dominio/src/configuracao-por-empresa-evolver.ts
  - packages/dominio/src/configuracao-por-empresa-evolver.test.ts
  - packages/dominio/src/contas-a-receber-evolver.ts
  - packages/dominio/src/contas-a-receber-evolver.test.ts
  - packages/dominio/src/seed-contas-a-receber.ts
  - packages/dominio/src/seed-financeiro.ts
  - packages/dominio/src/solicitacao-de-pagamento.ts
  - packages/dominio/src/operations/automations.ts
  - packages/dominio/src/operations/automations-canal.test.ts
  - packages/dominio/src/operations/tasks.ts
  - packages/dominio/src/operations/status-por-empresa.test.ts
  - packages/dominio/src/operations/importacao-contas-a-receber.ts
  - packages/dominio/src/operations/importacao-contas-a-receber.test.ts
  - packages/dominio/src/operations/index.ts
  - ../financeiro-tria/automation/src/adapters/plataforma.ts
  - ../financeiro-tria/automation/src/adapters/plataforma.test.ts
  - ../financeiro-tria/automation/src/tenants/empresa-para-tenant.ts
  - ../financeiro-tria/automation/src/tenants/empresa-para-tenant.test.ts
  - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
  - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts
  - ../financeiro-tria/automation/src/http/notificar-canal-routes.ts
  - ../financeiro-tria/automation/src/http/notificar-canal-routes.test.ts
  - ../financeiro-tria/automation/src/http/routes.ts
findings:
  critical: 7
  warning: 15
  info: 5
  total: 27
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-24T18:00:00Z
**Depth:** standard
**Files Reviewed:** 57
**Status:** issues_found

## Summary

Revisão dos diffs `6889514..HEAD` (crm-n1) e `3860ed4..HEAD` (financeiro-tria, só o
diff commitado; os arquivos revisados do repositório irmão estão limpos em relação a
`HEAD`).

O que está sólido: a Integração realmente só carrega `contaRotulo`/`bancoDeCategorias`
(nenhum `app_key`/`app_secret` em tipo, catálogo, evolver, tela ou payload — D5-03
cumprido); `TENANT_POR_EMPRESA` não tem fallback e a Empresa vem de `getTask`, nunca do
corpo; o payload de `automacao.notificar-canal.v1` é pobre (sem telefone, sem texto); a
autenticação da rota nova é Bearer por digest sha256 + `timingSafeEqual`, com
`Idempotency-Key === eventId`; os três CLIs de bootstrap e o de importação são dry-run
por padrão; `importarContaAReceberHistorica` cria com `runAutomations: false` e nenhuma
chamada de `setTaskFieldValue` dispara Automação.

O que não está: **o roteamento por tenant entrega Solicitações de Marcos Paulo e Family
Office a serviços que leem a Tarefa no ClickUp e não implementam a decisão de aprovação
da plataforma** — a decisão aprovada é descartada com `202`/`concluido`. **O Canal
(AUTO-02) não funciona de ponta a ponta em nenhuma configuração**: o domínio só resolve
destino em Tarefas de Contas a pagar, e o `automation/` só consegue ler Solicitações. O
receipt idempotente gravado ANTES do efeito transforma qualquer falha transitória em
perda silenciosa na retentativa. A regra D5-06 ("em revisão" só para quem declara) vive
só na dica da tela, não em `changeTaskStatus`. A Data de pagamento importada é cortada
em UTC em vez de São Paulo. E há uma nova ocorrência da classe "linhas órfãs no Postgres
real": `scheduler-worker.test.ts` deixa eventos `pending` em `integration_outbox`.

## Critical Issues

### CR-01: Marcos Paulo e Family Office roteados para serviços que não sabem ler a plataforma — aprovação descartada como "concluída"

**File:** `../financeiro-tria/automation/src/http/webhooks-plataforma.ts:339-357, 417-419, 579-590`; `../financeiro-tria/automation/src/http/routes.ts:387-391, 417`; `../financeiro-tria/automation/src/tenants/marcos-paulo/payment-automation-service.ts:324-334` (idem `family-office/payment-automation-service.ts:359`)

**Issue:** `resolverTenantDaTarefa` agora escolhe `marcosPauloPaymentService`/`familyOfficePaymentService` para Empresas "Marcos Paulo"/"EXO *"/"Oliveira Participações". Esses dois serviços:

1. em `syncAndAssignResponsible` → `startPaymentRequest(taskId)` fazem `clickUpAdapter.getTask(taskId)` com o **id da Tarefa da plataforma** — o ClickUp nunca vai achar essa Tarefa; o erro é genérico (`Error`), `classificarErro` o trata como `ERRO_INTERNO` não-retentável → `422` permanente. A Solicitação nunca é processada.
2. não implementam `handlePlatformApprovalDecision` (o próprio `routes.ts:113-118` diz "marcos-paulo/family-office não têm fonte 'plataforma' ainda"). Em `/aprovacao-decidida` o handler devolve `{ ignored: true }`, o receipt vira `concluido` e a resposta é `202`: o outbox de `crm-n1` marca entregue e **a aprovação de um pagamento some sem erro em lugar nenhum**.

Os testes `(o)`/`(p)` de `webhooks-plataforma.test.ts` passam porque injetam serviços falsos — a dependência real do ClickUp fica invisível. `05-CORTE-MP-FO.md` prevê desligar os webhooks do ClickUp e arquivar as Listas depois deste roteamento; após o corte, MP e FO ficam sem nenhum caminho de pagamento funcionando.

**Fix:** até os dois serviços terem fonte "plataforma", recusar explicitamente em vez de fingir sucesso, e não executar o corte (05-05) antes disso:
```ts
// resolverTenantDaTarefa
const service = deps.servicos[tenantId];
if (tenantId !== "tria") {
  throw new ErroPermanenteDaPlataforma(
    `Tenant ${tenantId} ainda não tem fonte "plataforma" (Tarefa ${taskId}).`,
    "TENANT_SEM_FONTE_PLATAFORMA",
  );
}
// e em /aprovacao-decidida: ausência de handlePlatformApprovalDecision é erro permanente,
// nunca { ignored: true } com receipt "concluido".
```
Acrescentar teste com o serviço real de marcos-paulo (ou um stub que reproduza `clickUpAdapter.getTask`) para provar a recusa.

### CR-02: AUTO-02 (Canal WhatsApp) não funciona de ponta a ponta em nenhuma configuração

**File:** `packages/dominio/src/operations/automations.ts:306-336`; `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:216-220, 375-384`; `apps/api/src/servicos/dto-solicitacao.ts:181`; `apps/api/src/rotas/integracao-solicitacoes.ts:100`

**Issue:** os dois lados discordam sobre QUAL Tarefa é notificável:

- Domínio, modo `campo`: lê `fieldValueOf(task, canalCampoDestinoId)`. O único id que o `automation/` aceita é `fd_cp_whatsapp` (`CAMPO_ID_PARA_CHAVE`), que só existe em Tarefas de **Contas a pagar** (o próprio teste do scheduler usa `CP.listId` + `CP.fields.whatsapp`).
- Domínio, modo `rotulos`: lê a Empresa por `CP.fields.empresa` (`fd_cp_empresa`) — também só em Contas a pagar; uma Solicitação (Empresa em `fld_sp_c_empresa`) é sempre recusada.
- `automation/`: chama `obterTarefa(taskId)` **incondicionalmente** (linha 375), e `getTask` do contrato v1 só devolve Tarefas da Lista de Solicitações (`dto-solicitacao.ts:181` → 404 para qualquer outra). Para uma Tarefa de Contas a pagar a entrega sempre falha.
- Além disso `fd_cp_whatsapp → requesterWhatsApp` é um mapeamento errado: `requesterWhatsApp` no DTO é o Campo `fld_sp_z_whatsapp` da Solicitação, não o Campo que o domínio validou como não-vazio.

Resultado: Contas a pagar → 404 no `automation/`; Solicitação → recusa no domínio (Empresa/WhatsApp em outro Campo). Nenhuma combinação envia. O 404 ainda é classificado como transitório (ver CR-03) e a retentativa o "entrega" como duplicado.

**Fix:** decidir a Lista-alvo e alinhar os três pontos. Se for Contas a pagar: expor uma leitura de serviço de Contas a pagar no contrato (ou um DTO mínimo de notificação por `taskId` que inclua o valor do Campo pedido por id), e ler Empresa por `CAMPOS_EMPRESA` como `tasks.ts` já faz. Se for Solicitação: `destinoDeCanal` precisa ler `fld_sp_c_empresa` e `CAMPO_ID_PARA_CHAVE` precisa mapear `fld_sp_z_whatsapp`. Em qualquer caso, um teste de contrato que monte a Tarefa pelo seed real, rode `pedidosDeNotificacaoPorCanal`, passe o payload pelo schema do `automation/` e resolva o destino contra o DTO real.

### CR-03: Receipt gravado antes do efeito + "duplicado" em qualquer retentativa = falha transitória vira perda silenciosa

**File:** `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:358-409, 305-313`; `../financeiro-tria/automation/src/http/webhooks-plataforma.ts:413-431, 497-514`

**Issue:** `inserirReceiptSeNovo` insere com `ignoreDuplicates` e o handler responde `202 duplicated` sempre que a linha já existe — sem olhar o `status` dela. Quando o efeito falha de forma transitória, o handler marca o receipt `falhou` e responde `500` para o outbox retentar; na retentativa a linha já existe → `202 { duplicated: true }` → o outbox marca `delivered`. Nada é reenviado.

O comentário das linhas 371-373 afirma o contrário ("um retry do outbox refaz o lote inteiro ... seguro porque o receipt só fecha `concluido` quando TODOS os envios terminaram") — o código não implementa isso. O mesmo vale para o novo ponto de falha de rede em `webhooks-plataforma.ts` (o `getTask` de `resolverTenantDaTarefa` em Solicitação criada/aprovação decidida/comentário): um soluço de rede na plataforma perde a Solicitação ou a aprovação.

Agravante: `classificarErroDeEnvio` só reconhece `falhou: NNN` da Evolution; `ErroPermanenteDaPlataforma` (ex.: 404 do `getTask`) vira `ERRO_INTERNO` **retentável**. Não há teste de "500 → retentativa → reenvio".

**Fix:**
```ts
// Só trata como duplicado o que já terminou; 'falhou' retentável volta a processar.
const { data } = await supabase.from(TABELA_RECEIPTS)
  .upsert({ event_id, event_type, task_id, status: "recebido" }, { onConflict: "event_id", ignoreDuplicates: true })
  .select("event_id");
if (!data?.length) {
  const atual = await supabase.from(TABELA_RECEIPTS).select("status").eq("event_id", eventId);
  if (atual.data?.[0]?.status !== "falhou_retentavel") return { inserted: false };
  // reivindica de novo (update ... where status = 'falhou_retentavel') e segue
}
```
Gravar `falhou_retentavel` vs `falhou` conforme `classificado.retryable`. Em `classificarErroDeEnvio`, tratar `ErroPermanenteDaPlataforma` como permanente e `ErroTransitorioDaPlataforma` como transitório antes da regex. Adicionar o teste de retentativa nos dois módulos.

### CR-04: D5-06 ("em revisão" só para a Empresa que o declara) não é regra de domínio — só dica de tela

**File:** `packages/dominio/src/operations/tasks.ts:1002-1013, 1020-1030` e `187-220` (`changeTaskStatus`); `apps/api/src/servicos/dto-solicitacao.ts:115`

**Issue:** `statusNaoDeclaradoPelaEmpresa` é chamado só em `statusOptionRefusal` (o que a tela usa para desabilitar a opção). `changeTaskStatus` não o chama. Então `POST /operacoes/changeTaskStatus` e o `PUT /:taskId/status` do contrato v1 (que agora aceita `"em revisão"` via `ID_DO_STATUS`) movem uma Solicitação da Tria para "em revisão" sem recusa. Viola a regra de arquitetura do `CONTEXT.md` ("o backend aplica a regra, não só a tela") e a própria docstring de `statusOptionRefusal` ("a mesma frase que `changeTaskStatus` devolveria"). Além disso a regra é fail-open: Tarefa sem Empresa (`if (!empresa) return undefined`) alcança "em revisão" — o teste `(d)` consagra esse comportamento.

**Fix:**
```ts
// changeTaskStatus, depois de resolver `target`:
const naoDeclarado = statusNaoDeclaradoPelaEmpresa(state, task, target);
if (naoDeclarado) return fail(naoDeclarado);
```
e, dentro de `statusNaoDeclaradoPelaEmpresa`, recusar quando o Status é declarável por alguém e a Tarefa não tem Empresa. Teste chamando `changeTaskStatus` (não só `statusOptionRefusal`).

### CR-05: O evento de Canal só nasce em 2 caminhos; nos outros a Timeline mente "Notificação por WhatsApp enfileirada"

**File:** `packages/dominio/src/operations/automations.ts:401-412`; `apps/api/src/rotas/formularios-publicos.ts:279-293`; `apps/api/src/rotas/integracao-solicitacoes.ts:131-138`; `apps/api/src/rotas/classificacoes.ts:183`; `apps/api/src/rotas/operacoes.ts:178-179` (ramo `servico`)

**Issue:** `runAction` grava a Atividade "notificou por WhatsApp" e devolve "Notificação por WhatsApp enfileirada" sempre que o destino resolve. Mas só `rotas/operacoes.ts` (ramo sem `servico`) e `scheduler-worker.ts` passam `eventos: eventosDeNotificacaoPorCanal(...)`. O formulário público (`submitForm` → `createTask` → Automações de criação — exatamente onde um "gasto-novo" nasceria), o contrato v1 (`integracao-solicitacoes.ts`, que muda Status e dispara `tarefaEntrouEmStatus`) e `classificacoes.ts` rodam Automações dentro de `executar()` sem essa derivação. O passo fica `concluido`, a Timeline diz que foi enfileirado, e nenhuma linha entra em `integration_outbox`.

**Fix:** tornar a derivação obrigatória na Unidade de Trabalho em vez de opt-in por rota — `executar()` captura `idsAntes` e concatena `eventosDeNotificacaoPorCanal(state, execucoesNovas(state, idsAntes))` aos `eventos` do chamador (a importação continua barrada pela guarda `"eventos" in opcoes` e por `runAutomations: false`). Teste: formulário público com Automação de Canal publicada na Lista → 1 linha no outbox.

### CR-06: Data de pagamento importada cortada em UTC — dia errado para fechamentos após 21h de Brasília

**File:** `packages/dominio/src/operations/importacao-contas-a-receber.ts:112-115, 234-236`; `apps/api/src/importacao/clickup/contas-a-receber.ts:388-395`

**Issue:** `comoDiaCivilDoInstante` usa `instante.slice(0, 10)` (dia UTC). O vencimento do mesmo mapeador usa `comoDiaCivil` em `America/Sao_Paulo` (`contas-a-pagar.ts:305-321`, que documenta por que São Paulo é a regra). Quando a Data de pagamento cai no fallback `date_closed` (lacuna `data-de-pagamento-por-date-closed`) e a conta foi fechada entre 21:00 e 23:59 BRT, o instante UTC é do dia seguinte e o Campo recebe D+1. O `--apply` já rodou em `ws_n1` (240 Tarefas, commit `87d2761`), então o dado errado, se ocorreu, já está em produção.

**Fix:** o mapeador deve entregar o dia civil já resolvido em São Paulo e o domínio gravar sem cortar:
```ts
// contas-a-receber.ts
dataPagamento = comoDiaCivil(campoDataDePagamento.value) ?? undefined; // idem date_closed
// importacao-contas-a-receber.ts: entrada.dataPagamento passa a ser CivilDate; remover o slice.
```
Depois, conferir no export quantas das 240 têm `date_closed` entre 00:00 e 03:00 UTC e corrigir essas por operação auditada.

### CR-07: `scheduler-worker.test.ts` deixa eventos `pending` de Canal no `integration_outbox` do Postgres real

**File:** `apps/api/src/automacoes/scheduler-worker.test.ts:108-117, 810-814` (e o caso que afirma `contarOutboxCanalDaTarefa(...) === 1`); `apps/api/src/index.ts:98-102`

**Issue:** mesma classe do defeito já corrigido em `operacoes.test.ts`. `limparWorkspace` apaga `automacao_agenda`, `registros` e `workspaces`, mas não `plataforma.integration_outbox`. O caso Canal A grava de propósito uma linha `automacao.notificar-canal.v1` com `status = 'pending'` e ela sobrevive a cada execução da suíte (não há FK para barrar o `delete` do workspace). O outbox worker de produção é criado sem `workspaceId` (`index.ts:98`), e `reivindicar` sem filtro pega `pending` de qualquer Espaço — então, contra o mesmo Postgres, cada rodada da suíte injeta um POST real para `/webhooks/plataforma/notificar-canal` com um `taskId` de teste, que ainda gera receipt no Supabase do `automation/` e passa pelo CR-03.

**Fix:**
```ts
async function limparWorkspace(workspaceId: string): Promise<void> {
  // ...
  await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [workspaceId]);
  await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1", [workspaceId]);
  // ...
}
```
Rodar também um `delete ... where workspace_id like 'ws_%canal_%'` uma vez para remover as linhas já acumuladas.

## Warnings

### WR-01: `ajustarPrazosDeCobranca` quebra o evolver e a conferência da mesma fase

**File:** `apps/api/src/bootstrap/contas-a-receber.ts:132-133`; `packages/dominio/src/contas-a-receber-evolver.ts:217, 283-285`; `apps/api/src/bootstrap/conferir-contas-a-receber.ts:207`

**Issue:** o propósito declarado (D5-15) é mudar o `temporalPredicate` de R4/R5 sem deploy. Mas o evolver compara `trigger.temporalPredicate` com o seed (30/60) e **recusa tudo** na primeira divergência. Depois do primeiro ajuste, `contas-a-receber:configurar` passa a falhar para sempre e a conferência acusa divergência permanente.

**Fix:** excluir `temporalPredicate` de `aut_cr_r4`/`aut_cr_r5` da comparação (ou comparar só `kind` e a presença de `dueDateOffsetDays` numérico), com teste "ajustar prazo → reaplicar evolver continua `ok`".

### WR-02: `/notificar-canal` não confere a Empresa/tenant da Tarefa — tudo sai pela instância e pelos números do Marcos Paulo

**File:** `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:452-469`

**Issue:** diferente de `webhooks-plataforma.ts`, esta rota não resolve o tenant pela Tarefa. `numeroPorRotulo` e a instância Evolution são sempre `MARCOS_PAULO_CONFIG`. Se amanhã a Integração de outra Empresa declarar `avisosPorCanal.whatsapp: ["mari"]`, dados de pagamento de outra empresa vão para o WhatsApp do Marcos Paulo.

**Fix:** ler a Empresa da Tarefa (já buscada por `obterTarefa`) e recusar (`422 EMPRESA_SEM_CANAL`) quando `tenantDaEmpresa(empresa) !== "marcos-paulo"`, até existir um mapa rótulo→número por tenant.

### WR-03: Corpo de erro da Evolution (pode trazer o número) vai inteiro para o log

**File:** `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:404`; `../financeiro-tria/automation/src/adapters/evolution.ts:60`

**Issue:** `sendText` lança `Evolution sendText falhou: ${status} ${await response.text()}`, e a rota faz `console.error(..., erro)`. As respostas 400 da Evolution costumam repetir `number`/`jid` do destinatário, então o número de telefone vai para o log do processo, contra a doutrina declarada no cabeçalho da rota.

**Fix:** registrar só `classificado.code` e o status HTTP, e no máximo `erro.name`; nunca o `message` cru.

### WR-04: A "barreira de duplicidade" de eventos de Canal citada no código não existe

**File:** `apps/api/src/persistencia/eventos-de-canal.ts:16-21, 48-50`; `apps/api/src/persistencia/outbox.ts:81`; `apps/api/migracoes/004-outbox-indice-unico-por-workspace.sql:24-26`

**Issue:** o comentário diz que `aggregateId = executionId` faz "o índice único parcial da migração 003" garantir "uma Execução gera no máximo um evento de Canal". O índice (recriado em 004) tem `where event_type = 'solicitacao.criada.v1'` e não cobre `automacao.notificar-canal.v1`. Além disso, uma Execução com dois passos de Canal gera dois pedidos com o mesmo `executionId`.

**Fix:** ou criar uma migração com índice único para `(workspace_id, aggregate_type, aggregate_id, event_type, <índice do passo>)` com `event_type = 'automacao.notificar-canal.v1'` e acrescentar o índice do passo ao `aggregateId`, ou corrigir o comentário para não prometer uma garantia que o banco não dá.

### WR-05: O evolver por Empresa não confere `avisosPorCanal` nem `statusDeclarados`

**File:** `packages/dominio/src/configuracao-por-empresa-evolver.ts:157-162`

**Issue:** só `name`, `empresa`, `omie.contaRotulo` e `omie.bancoDeCategorias` são comparados. `statusDeclarados` (base de D5-06) e `avisosPorCanal` (destinatários de WhatsApp) podem divergir do catálogo, ou faltar numa Integração criada antes desses campos existirem, e o evolver responde `ok` com "conferidos".

**Fix:** acrescentar os dois ao `conferirCampos` via `canonico(...)`.

### WR-06: A CLI de Empresas imprime rótulos de conta e nomes de Empresa, contra o contrato de saída dela

**File:** `apps/api/src/bootstrap/configuracao-por-empresa.cli.ts:20-22, 50-51`; `packages/dominio/src/configuracao-por-empresa-evolver.ts:62-65, 128-130`

**Issue:** o cabeçalho promete "nunca rótulo de conta, nome de Empresa ou valor de Campo" (T-5-07), mas `console.error(resultado.error)` imprime `formatarDivergencias` com `esperado "omie-tria", encontrado "<valor gravado>"`. Se alguém um dia colar um segredo em `contaRotulo`, ele vai para o terminal/CI.

**Fix:** na CLI, imprimir só `id.campo` de cada divergência (o evolver já devolve `divergentes` estruturado — expor isso no `fail` ou num resultado próprio).

### WR-07: A importação de Contas a receber grava `MARCO_ZERO` mesmo com rejeições; `--so-marco-zero` grava sem `--apply`

**File:** `apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts:89-99, 127-155`

**Issue:** (a) o bloco do `MARCO_ZERO` roda antes da checagem `resultado.rejeitadas > 0`, então uma importação parcial abre a agenda como se tivesse terminado. A própria mensagem diz "importar pela metade é pior que não importar", e o CONTEXT diz que a marca significa "terminou". (b) `--so-marco-zero` escreve em produção sem `--apply`, o único caminho de escrita que foge do padrão dry-run; se for rodado antes da importação, abre a agenda com contas ainda entrando.

**Fix:** mover o `if (resultado.rejeitadas > 0) throw` para antes do `MARCO_ZERO`, e exigir `--apply` junto de `--so-marco-zero` (dry-run: só relatar se a marca existe).

### WR-08: Resolução de cliente por nome aceita o primeiro homônimo — Vínculo errado sem lacuna

**File:** `apps/api/src/importacao/clickup/contas-a-receber.ts:254-258`

**Issue:** `catalogoDeClientes.find(...)` devolve o primeiro Contato/Empresa com o mesmo nome normalizado. Um Contato e uma Empresa homônimos, ou dois Contatos "Daniel Botelho", ligam a Conta a receber ao cliente errado sem registrar lacuna (D5-12 diz nunca inventar vínculo).

**Fix:**
```ts
const candidatos = contexto.catalogoDeClientes.filter((c) => normalizarNome(c.nome) === alvo);
if (candidatos.length !== 1) return undefined; // e o chamador registra "cliente-ambiguo" quando > 1
```

### WR-09: Cópia do domínio de `Empresa` no mapeador ficou velha na mesma fase

**File:** `apps/api/src/importacao/clickup/contas-a-receber.ts:138-141`

**Issue:** `DOMINIO_DOS_CAMPOS[CP.fields.empresa]` tem 11 opções. A fase acrescentou "Marcos Paulo" (`seed-financeiro.ts:195`), então uma Conta a receber com essa Empresa é descartada como `opcao_fora_do_dominio`.

**Fix:** derivar as opções do `DataState` hidratado (o catálogo de clientes já é hidratado uma vez; hidratar as opções junto) em vez de manter uma cópia literal.

### WR-10: Rejeição de domínio vai para o ledger como terminal e com texto que pode conter valor de Campo

**File:** `apps/api/src/importacao/clickup/importar-contas-a-receber.ts:121-136, 162-168, 181-191, 346-351`

**Issue:** (a) linhas recusadas pelo domínio entram no ledger como `rejeitada` com `on conflict do nothing`, e a próxima execução as conta como `puladas`: depois de corrigir a causa (por exemplo, criar o Contato) não há como reimportá-las sem mexer no ledger à mão. (b) `motivo: resultado.error.slice(0, 200)` guarda mensagens como `“<valor>” não é uma opção de <Campo>` (`setTaskFieldValue`), ou seja, valor de Campo no ledger e no `rejeicoes.log`, contra D-25. (c) as rejeições de domínio não entram em `rejeicoesPorCategoria`, então o relatório agregado não fecha com `rejeitadas`.

**Fix:** gravar no ledger uma categoria fixa (por exemplo `dominio:campo:<definitionId>`), contar essa categoria no relatório e permitir reprocessar `rejeitada` (filtrar `jaNoLedger` só por `importada`/`avisada`, com `on conflict ... do update` para `rejeitada`).

### WR-11: Nenhuma barreira estrutural impede R2/R4/R5 de agir sobre o histórico importado

**File:** `packages/dominio/src/operations/automations.ts:683-697`

**Issue:** o gatilho temporal é `hoje >= vencimento + offset`, sem limite inferior, e a deduplicação é "existe Execução `concluida`". As contas importadas não têm Execução nenhuma, então na primeira volta real depois de `automacoes:liberar` todas as "para receber" vencidas vão para "pendente" (R2, que reescreve Status histórico e dispara R2b), e todas as "pendente" recebem Comentário com Menção de 30 e 60 dias (R4/R5). O `MARCO_ZERO` limita dias da agenda, não Tarefas. O Ensaio só mede; quem protege hoje é a leitura humana do relato.

**Fix:** ignorar nos gatilhos temporais as Tarefas com `provenance.kind === "import"` cujo disparo seja anterior ao `MARCO_ZERO` (passar a data da marca para `runScheduledAutomations`), ou gravar Execuções sintéticas `concluida` para R2/R4/R5 nas contas importadas já vencidas.

### WR-12: Diálogo de série recusa o que o domínio aceita, com mensagem errada e sem teto no preview

**File:** `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx:104-131`

**Issue:** (a) `primeiroVencimentoData < hoje` bloqueia datas passadas, mas `createReceivableSeries` aceita (`financeiro.ts:771-774`). A paridade tela ↔ operação quebra, e cadastrar um contrato cuja 1ª parcela já venceu fica impossível pela tela. (b) A mensagem "a 1ª parcela precisa vencer numa data real" aparece também quando o problema é a data da entrada, ou quando a data é real mas está no passado. (c) `podeMostrarPreview` não respeita o limite de 60 do domínio: digitar `100000` renderiza 100 mil linhas.

**Fix:** remover a regra de data passada, ou movê-la para o domínio; separar as mensagens de entrada e de 1ª parcela; exigir `parcelas <= 60` em `podeMostrarPreview`.

### WR-13: Saque recorrente nasce com vencimento no passado

**File:** `apps/api/src/bootstrap/contas-a-receber.ts:206-212, 257`

**Issue:** `primeiroDiaUtilDoMes(new Date())` é o 1º dia útil do mês **corrente**. Rodado depois do dia 1–3, o Saque já nasce vencido em "disponível para saque"; quando o relógio ligar, as regras temporais da Lista agem sobre ele no dia seguinte.

**Fix:** usar o 1º dia útil do mês seguinte quando o do mês corrente já passou.

### WR-14: Cast de tipo esconde o 5º Status do `automation/`

**File:** `../financeiro-tria/automation/src/adapters/plataforma.ts:284-304`

**Issue:** `validar(...) as PaymentRequestDtoV1` finge que `status` só tem 4 valores. Qualquer `switch` exaustivo sobre `status` no código Tria passa no `tsc` e cai em `default`/`undefined` com "em revisão". Hoje o mapper devolve `null` e está tudo bem, mas o compilador não vai avisar o próximo uso.

**Fix:** alargar `PaymentRequestDtoV1.status` em `payment-request-adapter.ts` (uma linha) e remover os dois casts.

### WR-15: Teste de integração com workspace fixo no Postgres compartilhado

**File:** `apps/api/src/bootstrap/configuracao-por-empresa.test.ts:21`

**Issue:** `WS = "ws_config_empresa_teste"` é literal. Duas execuções simultâneas (dois worktrees, ou CI em paralelo) apagam o workspace uma da outra no `beforeAll`/`afterAll` e dão falhas intermitentes. Os irmãos da fase usam `ws_${RUN}` aleatório.

**Fix:** `const WS = \`ws_config_empresa_${Date.now()}_${randomUUID().slice(0, 8)}\`;`

## Info

### IN-01: `--resume` documentado e nunca lido

**File:** `apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts:15-16`
**Issue:** `temFlag("resume")` não existe; a retomada acontece de qualquer jeito pelo ledger. **Fix:** remover a flag da documentação ou recusar flags desconhecidas.

### IN-02: Tela de Integrações conta Empresas sem Integração como "Integrações" e alarma as seis servidas pela Tria

**File:** `apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx:39-43, 54`
**Issue:** Loovi, PLX, IVL, USI, O2 e Inevitaveis aparecem permanentemente como "sem Integração — aponte para uma conta Omie antes de lançar", embora sejam servidas pela conta da Tria (`TENANT_POR_EMPRESA`). O `meta` soma essas Empresas ao total de Integrações. **Fix:** contar à parte ("N Integrações · M Empresas sem conta") e decidir se essas seis ganham Integração apontando para `omie-tria`.

### IN-03: Dry-run da importação suja a árvore versionada

**File:** `apps/api/src/importacao/clickup/importar-contas-a-receber.ts:424-465`
**Issue:** cada dry-run cria `apps/api/exportacoes/importacao-contas-a-receber/<uuid>/` (as duas pastas não rastreadas no `git status` atual). **Fix:** gravar o relatório de dry-run fora da árvore versionada, ou só com flag.

### IN-04: `--lote` inválido vira lote único em silêncio

**File:** `apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts:66`
**Issue:** `Number("abc")` dá `NaN`, `length >= NaN` é sempre falso, e as 240 entram numa transação só. **Fix:** recusar quando `!Number.isInteger(lote) || lote < 1`.

### IN-05: ~100 linhas de autenticação e receipt duplicadas entre as duas rotas do `automation/`

**File:** `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:95-184`
**Issue:** a duplicação é deliberada, mas CR-03 precisa ser corrigido nos dois lugares. É o tipo de divergência que essa cópia produz. **Fix:** extrair `autenticacao-de-webhook.ts` e `receipts.ts` neutros (sem depender do módulo do contrato v1).

---

_Reviewed: 2026-09-24T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
