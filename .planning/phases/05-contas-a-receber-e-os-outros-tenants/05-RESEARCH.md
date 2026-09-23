# Phase 5: Contas a receber e os outros tenants - Research

**Researched:** 2026-09-23
**Domain:** Multi-tenant configuration (Omie por Empresa), motor de Automações (agenda), canal de notificação (WhatsApp/Evolution), migração de um processo dormente (Contas a receber)
**Confidence:** HIGH para TEN-01 e AUTO-02 (código lido diretamente dos dois repositórios); MÉDIA-ALTA para REC-01 ramo processo (o domínio já existe e está testado); LOW/CITED para REC-01 ramo espelho (depende de API externa não integrada nesta base)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ordem e o portão**
- D5-01 — TEN-01 primeiro, AUTO-02 junto, REC-01 por último.
- D5-02 — D7 vira um plano com checkpoint bloqueante, não uma espera. Uma pergunta ao Financeiro: *onde o recebimento é controlado hoje?* Default declarado se a resposta não vier dentro da fase: **o ramo processo** (não o espelho) — (a) `createReceivableSeries` já existe, testada; (b) `adapters/omie.ts` não tem nenhuma chamada de contas a receber (`grep -n "Receber"` dá zero); (c) uma Lista com o processo absorve depois um espelho do Omie, o contrário não.

**TEN-01 — as Empresas**
- D5-03 — A Integração da Empresa guarda a identidade da conta Omie, nunca o segredo. Seis Integrações: Tria, FINQ/Konq, Marcos Paulo, EXO Loteamento, EXO Participações, Oliveira Participações. Rótulo estável, banco de categorias, situação, data da última rotação. `app_key`/`app_secret` continuam só no ambiente do `automation/`.
- D5-04 — A não-clonagem acontece na plataforma, não no `automation/`. Não consolidar os três `payment-automation-service.ts` (5.880 linhas, território de D12). Uma Lista "Solicitações de pagamento" e uma "Contas a pagar" com `Empresa` como Campo, em vez de três de cada. `automation/` segue escolhendo o serviço por `tenantId`, que passa a vir no payload em vez de vir do path do webhook do ClickUp.
- D5-05 — Os prefixos numéricos dos Campos do Family Office (`01-Centro de Custo`…) morrem com o ClickUp. `customFieldNames` de `family-office/config.ts` vira código morto. Nenhum Campo da plataforma nasce com prefixo numérico.
- D5-06 — `em revisão` entra como 5º Status da Lista de Solicitações. Como Conjunto de Status é da Lista (uma só), os cinco valem para todas as Empresas — mas só a configuração de Automação da Empresa que o declara move para lá. TRIA nunca o alcança.
- D5-07 — O corte de MP e FO é um só, não dois. `901111928443` é ao mesmo tempo Contas a pagar do FO e Solicitações do MP: arquivá-la aposenta os dois tenants no mesmo gesto. Coortes por origem, nunca double-write no Omie, desligar webhook antes de arquivar, rollback por reabrir a entrada no ClickUp só para pedidos novos.
- D5-08 — FINQ/Konq entra como Empresa e Integração, e nada além disso (D3-01 mantém o caminho FINQ fora de `payment-rules.ts`).

**AUTO-02 — notificar por Canal**
- D5-09 — O WhatsApp sai pelo `automation/`, não pela plataforma. `notificar` ganha variante de canal cuja entrega passa pelo outbox → `automation/` → `adapters/evolution.ts`.
- D5-10 — Destino é o Campo `Z WhatsApp` da Tarefa, e vazio é recusa. Sem número, a Ação falha visível na Execução — nunca adivinha, nunca cai num número padrão. Números de Mari, Marcos e do grupo financeiro (hoje em `marcos-paulo/config.ts`) viram configuração da Empresa (D5-03), não constantes.
- D5-11 — Escopo de AUTO-02 é o que o Marcos Paulo já faz (aviso de gasto novo, relatório), não notificação genérica. Canal disponível para qualquer Automação de qualquer Lista fica adiado.

**REC-01 — o que não depende de D7**
- D5-12 — Cliente é Contato ou Empresa do CRM, nunca uma Lista "Gestão de clientes". A Lista `901109161381` não é recriada.
- D5-13 — `disponível para saque` fica (dá sentido ao Saque de plataforma, R7); `estornado` vira Motivo dentro de `descartado`.
- D5-14 — Saque passa a exigir Valor > 0 (RN-CR-03 sem exceção). Os 240 históricos com valor `0` entram como lacuna de importação registrada (padrão D-25), não como zero legítimo.
- D5-15 — Os prazos de R4/R5 (30/60 dias) não são número no código; viram parâmetro da configuração da Automação da Lista, mesmo mecanismo de D-07.
- D5-16 — Data de pagamento sobre `date_closed` na importação (CON-CR-10); `date_closed` só como fallback.
- D5-17 — `conta tria` vira o Campo "Conta de recebimento", não Tag; os cinco Campos de §9 entram no catálogo da Lista.
- D5-18 — Duplicatas e a subtarefa indevida não são consertadas em silêncio: entram como lacuna registrada (RN-CR-07), RN-CR-06 aplicada desabilitando Subtarefas, `868cpdawp` desamarrada com Registro de Atividade.

### Claude's Discretion
- Como a configuração por Empresa é modelada (registro na Integração, catálogo do Espaço, ou Campos de configuração da Lista) — desde que o segredo fique fora da plataforma e a regra saia do `config.ts`.
- Divisão dos planos e ondas; quantos planos cada uma das três entregas recebe.
- Forma da rota e do payload do canal WhatsApp no `automation/`.
- Layout das telas de Contas a receber, reusando o que a Lista já entrega.
- Se REC-01 cabe inteiro nesta fase ou se o ramo processo merece a sua própria.

### Deferred Ideas (OUT OF SCOPE)
- Consolidar os três `payment-automation-service.ts` num serviço só (D12).
- Notificação por Canal como capacidade genérica de qualquer Automação.
- Reabrir o caminho FINQ de `payment-rules.ts`.
- Gestão contratual como Lista (o gatilho "correto" de R1).
- Go High Level.
- Limpeza das 13 tabelas vetoriais por empresa e das 7 views `_v`.
- Mover o `automation/` para o monorepo (D12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEN-01 | Marcos Paulo e Family Office viram Empresas do Campo `Empresa`; regras de cada `config.ts` viram configuração por Empresa; uma Integração Omie por Empresa; webhooks ClickUp dos dois tenants desligados, Listas arquivadas | §"TEN-01" abaixo: diff dos três `config.ts`/`payment-rules.ts`, forma da Integração/config por Empresa, evolver do 5º Status, evidência do corte único, roteamento por tenant |
| AUTO-02 | Ação `notificar` ganha canal WhatsApp via Evolution API, lendo o Campo `Z WhatsApp` da Tarefa | §"AUTO-02" abaixo: ponto exato de extensão em `automations.ts`, arquitetura outbox → webhook novo → `EvolutionAdapter`, achado sobre a ausência de um Campo que corresponda a "Mari/Marcos/grupo financeiro" |
| REC-01 | Contas a receber na plataforma conforme D7 (processo ou espelho); restrições CON-CR-01..10; leituras conservadoras CAND-05 | §"REC-01" abaixo: gap list contra a spec, evidência para D7, estado real do domínio (já em produção via bootstrap), mapeamento R1-R7 → motor da Fase 3 |
</phase_requirements>

## Summary

TEN-01 e AUTO-02 são trabalho de COSTURA, não de invenção: a plataforma já tem o Campo `Empresa` (11 opções, faltando só "Marcos Paulo" e um rótulo para FINQ/Konq), o padrão de evolver idempotente (`solicitacao-de-pagamento-evolver.ts`, Plan 02-08) que resolve tanto o 5º Status quanto a extensão do banco de configuração por Empresa, e o vocabulário de condição `valorDeCampo`/`equals` que já resolve o gate "só a Empresa que declara alcança `em revisão`" sem nenhum tipo novo. O ponto que falta nascer é a Integração como onde o **rótulo** Omie mora — hoje `Integration` é rasa (`id/workspaceId/name/systemType/state/exposedTools`, sem campo de configuração) e vai precisar de um mecanismo de config por Empresa (na Integração, no catálogo do Espaço ou em Campos — decisão do planner). Do lado do `automation/`, o achado mais concreto é que `webhooks-plataforma.ts` **hoje hardcoda `tenantId: "tria"`** na resposta — é literalmente o único ponto de código que precisa mudar para o roteamento vir do payload em vez do path.

AUTO-02 tem arquitetura clara pela leitura de `outbox.ts`: `EVENTOS` é um registro fechado (`.strict()`) de 3 tipos, todos de Solicitação; adicionar um `automacao.notificar-canal.v1` segue o mesmo padrão (payload pobre, o `automation/` busca o resto via API autenticada). O achado que precisa de decisão do planner: nem `fd_cp_whatsapp` ("Contato do fornecedor") nem `fld_sp_z_whatsapp` ("Contato do solicitante") correspondem aos números fixos (Mari, Marcos, grupo financeiro) que MP realmente notifica hoje — o Campo `Z WhatsApp` da Tarefa, como D5-10 descreve, não é obviamente o mesmo dado que o comportamento observado usa.

REC-01 é o achado mais surpreendente da pesquisa: **o domínio de Contas a receber já está em produção**. `bootstrap-gestao.ts` chama `applyContasAReceber(state, clock, { fixtures: false })` desde o Plan 01-05/01-06 (Fase 1, fechada 2026-09-16), e `STATE.md` confirma que `bootstrapGestao()` rodou contra o Supabase real (`ws_n1`). Isso significa que a Lista "Contas a receber", os 6 Status (com `entryRequirements`/`entryFromStatusIds` batendo com RN-CR-03/04), 8 Campos e as Automações R2/R2b/R3/R4/R5/R6 (como registros `condicaoTemporal`/`evento`) **já existem em `ws_n1`**, e o `scheduler-worker.ts` de Fase 3 descobre `(workspaceId, listId)` **dinamicamente** por SQL (`colecao = 'automations' and dados->>'scopeType' = 'list'` com gatilho `condicaoTemporal` publicado) — não há lista hardcoded para estender. O que falta é mecânico: nenhuma importação histórica das 240 Tarefas existe ainda (nenhum `importarContaAReceberHistorica`), o Campo "Contrato" de §9 não está modelado (não há "Gestão contratual" na plataforma), e a Recorrência nativa de R7 (Saque) precisa do mesmo tratamento de A1 (Fase 3) para rodar de verdade.

**Primary recommendation:** planejar TEN-01 como extensão de padrões já provados (evolver + Campo `Empresa` + condição `equals`); AUTO-02 como um evento novo no outbox + uma rota nova em `automation/` no molde de `contas-a-pagar-routes.ts`; REC-01 como uma Wave 0 de **verificação** (confirmar que `ws_n1` de fato já tem a config do seed atual, já que o bootstrap só grava uma vez) seguida de importação histórica + preenchimento dos gaps de §9/§10, deixando o checkpoint de D7 como o primeiro passo do plano, não o último.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config por Empresa (rótulo Omie, banco de categorias) | Domínio (`@n1/dominio`, via Integration/catálogo) | API (`apps/api` grava via operação) | D5-03: a config É dado da plataforma; o segredo NUNCA é |
| Credencial Omie (`app_key`/`app_secret`) | `automation/` (env do processo) | — | D5-03/CON-10: a plataforma nunca chama o Omie; um segredo que não usa não deve guardar |
| Roteamento por tenant do payload | `automation/` (`webhooks-plataforma.ts`) | API (`apps/api` inclui `empresa`/`tenantId` no evento ou o payload permite buscar) | D5-04: hoje resolvido por path (`services[tenantId]`); tem que virar dado do payload/Task |
| 5º Status `em revisão` + gate por Empresa | Domínio (`StatusSet` da Lista + `Automation` com condição `valorDeCampo`) | — | Conjunto de Status é global à Lista; o filtro é regra de Automação, não de Status |
| Ação `notificar` por Canal | Domínio (gera o pedido; nunca chama rede) | API (outbox → HTTP) → `automation/` (Evolution) | D5-09/D3-02: domínio não faz I/O; outbox é o único portão de saída já existente |
| Contas a receber — Lista/Status/Campos/R1-R6 | Domínio (já existe, já em produção via bootstrap) | API (evolver para reconciliar, scheduler para agendar) | O protótipo em memória JÁ é o modelo de produção (`{ fixtures: false }`) |
| Contas a receber — R7 (recorrência do Saque) | Domínio (`Task.recurrence`, mecanismo nativo, não Automação) | API (o mesmo runner que materializa A1 em Fase 3) | R7 usa Regra de Recorrência, não o motor de Automações — mecanismo diferente de R2-R6 |
| Contas a receber — leitura espelho do Omie (SE D7 disser isso) | `automation/` (nova superfície Omie, `ListarContasReceber`) | API (`/v1/leituras/*`, D4-03) → web | Molde de D4-01/02/03: navegador nunca fala com `automation/` |
| Importação histórica das 240 Tarefas | Domínio (operação pura, allowlist) | API (CLI, ledger transacional — molde de PAG-01/03-09/03-10) | Precedente direto: `importarContaAPagarHistorica` |

## Standard Stack

Esta fase não introduz nenhuma biblioteca nova nos três workspaces do `crm-n1` nem no `automation/`. O trabalho é: (a) novos registros de domínio (Integration/config, Automation, evento de outbox), (b) uma rota HTTP nova no `automation/` no molde de `contas-a-pagar-routes.ts`, (c) opcionalmente uma nova superfície Omie (`ListarContasReceber`) SE o ramo espelho vencer D7. Nenhuma dessas exige pacote além do que já está no `package.json` de cada workspace.

### Core (já presentes, reusados)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 4.6.5 (`npm view zod version`, [VERIFIED: npm registry]) | Schemas `.strict()` do evento novo de outbox e da rota nova em `automation/` | Já é a dependência única de `packages/dominio` (provada por teste, ver Plan 03-03) e padrão do monorepo inteiro |
| `pg` | já em uso em `apps/api` | Query dinâmica do catálogo de listas com agenda (`scheduler-worker.ts`) | Nenhuma mudança necessária — o mecanismo de descoberta já é genérico |
| `express` | já em uso em `automation/` | Rota nova `/webhooks/plataforma/notificar-canal` (ou nome equivalente) | Mesmo padrão de `contas-a-pagar-routes.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Config por Empresa na Integração (campo novo) | Config por Empresa como Campos da Lista/Espaço | Integração é o local semanticamente correto (A8: "configured connection with an external system") mas hoje `Integration` não tem espaço para dado estruturado — extensão de tipo é trabalho real; Campos de configuração reusam infraestrutura existente (FieldDefinition/FieldValue) mas confundem "config do sistema" com "dado de negócio" |
| SDK oficial da Omie para `ListarContasReceber` | `fetch` cru (como `adapters/omie.ts` já faz para contas a pagar) | Omie não publica SDK oficial JS mantido; `adapters/omie.ts` já é 100% `fetch` — manter o padrão |

## Package Legitimacy Audit

Nenhum pacote novo é instalado nesta fase (ver "Standard Stack" acima — todo o trabalho reusa dependências já presentes nos `package.json` de `crm-n1` e `financeiro-tria/automation`). Gate de legitimidade de pacote: **N/A — nenhuma instalação nova**.

**Packages removed due to SLOP verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram — TEN-01 (roteamento por Empresa)

```text
                    ┌─────────────────────────────────────────┐
                    │  apps/web — Formulário de Solicitação    │
                    │  (Campo Empresa: singleSelect, 1 opção   │
                    │   por Empresa, inclui "Marcos Paulo")    │
                    └───────────────────┬───────────────────────┘
                                        │ POST /operacoes/submitForm (ou createTask)
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  apps/api — POST /operacoes/:nome        │
                    │  hidratar → operação (domínio) → gravar  │
                    │  + gravarEventos (outbox, dentro da UoW) │
                    └───────────────────┬───────────────────────┘
                                        │ outbox: solicitacao.criada.v1
                                        │ payload: { taskId, readableId, listId, origin }
                                        │        (SEM tenantId/empresa hoje — achado)
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  outbox-worker.ts (apps/api)              │
                    │  CAMINHO_POR_EVENTO[tipo] → POST HTTP     │
                    └───────────────────┬───────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ automation/ — webhooks-plataforma.ts      │
                    │ HOJE: tenantId hardcoded "tria" (L347)    │
                    │ PRECISA: ler Empresa da Tarefa (getTask)  │
                    │   ou receber empresa/tenantId no payload  │
                    │   → resolveAccountConfig(empresa) por     │
                    │     tenant (tria/mp/fo já têm a função)   │
                    └───────────────────┬───────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ payment-automation-service.ts (por tenant,│
                    │ D5-04 mantém os três) → Omie via app_key/ │
                    │ app_secret do env, resolvido pelo rótulo  │
                    │ (D5-03)                                   │
                    └─────────────────────────────────────────┘
```

### System Architecture Diagram — AUTO-02 (notificar por Canal)

```text
┌──────────────────────────┐   scheduler-worker.ts descobre    ┌───────────────────────┐
│ Automation "aviso gasto"  │   (workspaceId, listId) por SQL   │ plataforma.registros   │
│ trigger: evento OU        │◄───────────────────────────────── │ colecao='automations'  │
│ condicaoTemporal          │                                    └───────────────────────┘
└─────────────┬──────────────┘
              │ runAction() — controlKind: "notificar"
              │ spec.channel === "whatsapp" (extensão de ActionSpec)
              ▼
┌──────────────────────────────────────────┐
│ automations.ts — case "notificar":        │
│ HOJE: sempre Comentário in-app (L302-311) │
│ NOVO: se spec.channel === "whatsapp",     │
│  gera um "pedido de notificação por       │
│  Canal" (nunca chama rede — D3-02)        │
└─────────────┬──────────────────────────────┘
              │ opcoes.eventos (mesma costura de SOL-07: a rota que
              │ chama executar() decide passar o evento)
              ▼
┌──────────────────────────┐
│ gravarEventos() dentro da │  evento novo: "automacao.notificar-canal.v1"
│ Unidade de Trabalho       │  payload pobre: { taskId, automationId, executionId,
│ (outbox.ts, EVENTOS)      │    fieldDefinitionId } — NUNCA o texto nem o número
└─────────────┬──────────────┘
              ▼
┌──────────────────────────┐
│ outbox-worker.ts          │  CAMINHO_POR_EVENTO["automacao.notificar-canal.v1"]
│                            │  = "/webhooks/plataforma/notificar-canal" (novo)
└─────────────┬──────────────┘
              ▼
┌──────────────────────────────────────────┐
│ automation/ — rota nova (molde de         │
│ contas-a-pagar-routes.ts): Bearer         │
│ constant-time, Idempotency-Key, zod       │
│ .strict(); busca a Tarefa via             │
│ adapters/plataforma.ts (getTask) para ler │
│ o valor do Campo Z WhatsApp e montar o    │
│ texto — o payload do evento não carrega   │
│ dado sensível (mesma doutrina do §caption)│
└─────────────┬──────────────────────────────┘
              ▼
┌──────────────────────────┐
│ EvolutionAdapter.sendText  │  número + texto → Evolution API
└──────────────────────────┘
```

### Recommended Project Structure (arquivos tocados, não criados do zero)
```
packages/dominio/src/
├── types/workspace.ts                    # Integration — avaliar campo de config por Empresa
├── seed-financeiro.ts                    # Campo Empresa: acrescentar "Marcos Paulo" (evolver, não edição direta em produção)
├── operations/automations.ts             # case "notificar": ramo de Canal (ActionSpec.channel)
├── solicitacao-de-pagamento-evolver.ts   # MOLDE para o evolver do 5º Status / config por Empresa
└── seed-contas-a-receber.ts              # já completo — avaliar Campo "Contrato" (§9) e ajustes finos

apps/api/src/
├── persistencia/outbox.ts                # EVENTOS: novo tipo automacao.notificar-canal.v1
├── persistencia/outbox-worker.ts         # CAMINHO_POR_EVENTO: nova entrada
├── automacoes/scheduler-worker.ts        # nenhuma mudança (descoberta já é dinâmica) — só MARCO_ZERO/liberação para CR.listId
└── bootstrap/ (novo evolver, se necessário para reconciliar `ws_n1`)

automation/src/ (financeiro-tria)
├── http/webhooks-plataforma.ts           # tenantId hardcoded "tria" → derivar de payload/Task
├── http/notificar-canal-routes.ts        # NOVA — molde de http/contas-a-pagar-routes.ts
├── tenants/family-office/config.ts       # customFieldNames vira código morto (D5-05)
└── adapters/evolution.ts                 # sem mudança — já pronta para uso
```

### Pattern 1: Evolver idempotente de configuração
**What:** função pura `estadoAtual + catálogo → criar-ou-conferir`, nunca sobrescreve, recusa (`fail`) em qualquer divergência com diff legível.
**When to use:** sempre que uma Lista/config JÁ pode existir em produção (bootstrap só grava em Espaço vazio) e precisa crescer sem migração SQL.
**Example (já existe, é o molde — não reescrever):**
```typescript
// Source: packages/dominio/src/solicitacao-de-pagamento-evolver.ts
export function evoluirConfiguracaoDeSolicitacoes(
  state: DataState,
  actingMemberId: Id,
  opcoes: { readonly tasksPerListMinimo?: number } = {},
): OperationResult<DiffDeConfiguracao> {
  // 1. localizar Espaço/Pasta; recusar se ausentes
  // 2. criar-ou-conferir Lista, Status, Campos, Tag, Papéis
  // 3. qualquer divergência → fail, nada mais muda
  // 4. elevar tasksPerList (só sobe)
  // 5. Atividade por elemento criado
}
```
Este é o padrão a copiar para: (a) acrescentar `em revisão` ao `statusSet` de Solicitações sem tocar nos 4 Status travados por D-01; (b) acrescentar "Marcos Paulo" às opções do Campo `Empresa` (`fd_cp_empresa`); (c) reconciliar `ws_n1` com a versão atual de `seed-contas-a-receber.ts`, SE houver divergência (ver Open Questions).

### Pattern 2: Condição `valorDeCampo` com `equals` — gate por Empresa
**What:** `AutomationCondition { kind: "valorDeCampo", expression: JSON.stringify({ definitionId, equals }) }` já é o vocabulário usado por R6 (`cond({ definitionId: F.situacao, equals: CR.situacoes.emCobranca })`).
**When to use:** D5-06 pede que só a Automação da Empresa que declara `em revisão` a alcance — nenhuma extensão de tipo necessária.
**Example:**
```typescript
// Source: packages/dominio/src/seed-contas-a-receber.ts (padrão R6, adaptar para Empresa)
automation("aut_sp_revisao_fo", "Revisão · Family Office", "…", entrou("aprovada"), [
  cond({ definitionId: CP.fields.empresa, equals: "Konq Intermediações" }),
], [
  acao(1, "tarefa.alterarStatus", { statusName: "em revisão" }),
]);
```

### Pattern 3: Evento de saída "pobre" + busca autenticada de volta
**What:** o payload do outbox NUNCA carrega dado financeiro/sensível; quem recebe (`automation/`) busca o resto via API autenticada (`getTask`/`getCommentReplies`, credencial de serviço).
**When to use:** AUTO-02 — o texto da notificação e o número do Campo `Z WhatsApp` NÃO devem viajar no payload do evento.
**Example:**
```typescript
// Source: apps/api/src/persistencia/outbox.ts (comentário de cabeçalho, doutrina já travada)
// "O payload é deliberadamente pobre — só ids e metadados que identificam o
//  agregado, nunca valor monetário, documento, chave Pix ou URL assinada."
```

### Anti-Patterns to Avoid
- **Editar `seed-financeiro.ts`/`seed-contas-a-receber.ts` esperando que produção reflita a mudança:** o bootstrap só grava em Espaço vazio (`count(*) > 0` recusa). Qualquer mudança ao catálogo depois do primeiro bootstrap PRECISA de um evolver — editar o seed sozinho não toca `ws_n1`.
- **Rotear tenant pelo path do webhook, à moda antiga:** D5-04 é explícito — path funciona só enquanto existe webhook ClickUp por tenant; MP/FO não terão mais webhook ClickUp nenhum depois do corte (D5-07).
- **Colocar `app_key`/`app_secret` em qualquer lugar do schema `plataforma`:** contraria D5-03/CON-10 categoricamente — mesmo um "cache" temporário é uma cópia.
- **Fazer a Ação `notificar` (Canal) chamar `fetch` dentro de `packages/dominio`:** viola D3-02 (domínio nunca faz I/O), a mesma regra que já disciplinou A7/A8/03-11.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agendamento de R2/R4/R5 por proximidade de vencimento | Um cron novo em `apps/api` ou em `automation/` | O motor de Fase 3 (`plataforma.automacao_agenda`, `scheduler-worker.ts`, `runScheduledAutomations`) — já descobre `(workspaceId, listId)` dinamicamente por SQL | `catalogoDeListasComAgenda()` já varre `colecao = 'automations'` com `trigger.kind === 'condicaoTemporal'` publicado — nenhuma lista hardcoded para editar |
| Envio HTTP para Evolution API | Um novo cliente HTTP em `apps/api` | `EvolutionAdapter` já existe em `financeiro-tria/automation/src/adapters/evolution.ts` (`sendText`, `sendListMessage`) | A plataforma não deve ter credencial de terceiro (D5-09); o adapter já resolve `baseUrl`/`apiKey`/`instance` por env |
| Autenticação Bearer em tempo constante na rota nova do `automation/` | Comparação `===` de string | Reusar a DISCIPLINA (não o import) de `contas-a-pagar-routes.ts`: `createHash`/`timingSafeEqual` | Comentário do próprio arquivo: "recria as ~40 linhas… em vez de importá-las: importar acoplaria esta superfície NOVA ao módulo do contrato v1" — reusar o PADRÃO, escrever de novo o código |
| Import histórico das 240 Tarefas de Contas a receber | Um script ad hoc lendo o export do ClickUp | O molde de `importarContaAPagarHistorica` (03-09) + orquestração por lotes com ledger (03-10) | Já resolveu: Tarefa nasce no Status final sem disparar Automação, `recordActivity` com `at` original, ledger transacional idempotente |

**Key insight:** as três entregas desta fase são, em proporção esmagadora, COSTURA de mecanismos que a Fase 1-3 já construiu e provou (evolver idempotente, motor de agenda dinâmico, outbox pobre + busca autenticada, disciplina de rota nova). O risco real está nos poucos pontos genuinamente novos: a forma da config por Empresa na Integração, e o de-para entre "Campo Z WhatsApp da Tarefa" e os números fixos que o comportamento observado de MP usa.

## Common Pitfalls

### Pitfall 1: assumir que "editar o seed corrige produção"
**What goes wrong:** um plano edita `seed-contas-a-receber.ts` (ex.: acrescenta o Campo "Contrato") e assume que isso aparece em `ws_n1`.
**Why it happens:** `bootstrapGestao()` já rodou uma vez contra produção (STATE.md, Plan 01-06) — a guarda `count(*) > 0` faz qualquer nova chamada virar no-op silencioso (`criado: false`).
**How to avoid:** todo Campo/Status/Automação novo depois do bootstrap inicial precisa de um evolver explícito (Pattern 1), testado contra o mesmo `count > 0` que bloqueia reaplicação acidental.
**Warning signs:** `bootstrapGestao()` devolve `{ criado: false, motivo: "... já tem N registros" }` e o plano segue como se tivesse gravado algo.

### Pitfall 2: tratar `Z WhatsApp` como um único Campo óbvio
**What goes wrong:** o plano assume que existe (ou cria) um único Campo `Z WhatsApp` que já contém os números de Mari/Marcos/grupo financeiro.
**Why it happens:** D5-10 fala em "Campo Z WhatsApp da Tarefa", mas o comportamento observado (MP notifica pessoas FIXAS por Empresa, não um contato variável por Tarefa) sugere que o alvo real é configuração da Empresa (D5-03), não um valor de Campo por registro. Os dois Campos existentes hoje (`fd_cp_whatsapp` = "Contato do fornecedor"; `fld_sp_z_whatsapp` = "Contato do solicitante") são sobre OUTRA pessoa.
**How to avoid:** o planner precisa decidir explicitamente: (a) o Campo é o mecanismo genérico (`fromFieldDefinitionId`, no molde de `mentionFieldDefinitionId`) e, para o caso observado de MP, um NOVO Campo por Empresa/Automação é criado apontando para os números fixos; ou (b) os números ficam como parâmetro (`params`) da Automação, e o "Campo da Tarefa" só se aplica a casos futuros/genéricos.
**Warning signs:** teste de aceite de AUTO-02 que só cobre "Campo preenchido → mensagem sai" sem cobrir o caso real de MP (Mari validando antes do grupo financeiro).

### Pitfall 3: esquecer que `EVENTOS` é fechado com `.strict()`
**What goes wrong:** adicionar um campo a um evento existente (`solicitacao.criada.v1`) para carregar `empresa`/`tenantId`, quebrando o contrato v1 já "congelado" (comentário de Plan 03-07, §9).
**Why it happens:** parece o caminho mais curto para dar ao `automation/` o dado que falta para rotear por tenant.
**How to avoid:** criar um evento NOVO (`automacao.notificar-canal.v1` já é exemplo) ou fazer o `automation/` buscar a Empresa da Tarefa via `getTask` (mesma doutrina "payload pobre + busca de volta"), nunca inflar um tipo existente.
**Warning signs:** `EVENTOS[tipo].strict()` lançando em teste depois de um campo novo ser adicionado ao payload de um evento já usado em produção.

### Pitfall 4: a Lista `901111928443` — dois tenants, um arquivamento
**What goes wrong:** desligar o webhook/arquivar a Lista pensando só no Family Office (ou só no Marcos Paulo), deixando o outro tenant com webhook ainda ativo apontando para uma Lista arquivada.
**Why it happens:** os dois `config.ts` (`marcos-paulo/config.ts.listSolicitacaoPagamentoId` e `family-office/config.ts.listContasPagarId`) apontam para o MESMO id sem isso ser óbvio a quem lê só um dos dois arquivos.
**How to avoid:** D5-07 já documenta isso; o plano precisa listar EXPLICITAMENTE todos os `MP_*CLICKUP*`/`FO_*CLICKUP*` env vars e webhooks antes de tocar qualquer um.
**Warning signs:** o corte "termina" mas um dos dois tenants continua criando Tarefas na Lista arquivada via webhook esquecido.

## Code Examples

### Extensão do vocabulário `notificar` para Canal (ponto exato)
```typescript
// Source: packages/dominio/src/operations/automations.ts, linhas ~302-311 (case "notificar" atual)
case "notificar": {
  if (!spec.template) return { ok: false, output: "“notificar” sem texto: declare `template` nos parâmetros da Ação." };
  const alvos = membrosMencionados(state, task, spec);
  if (!alvos.length) return { ok: false, output: "“notificar” sem alvo: declare memberId, mentionMemberIds ou fromFieldDefinitionId." };
  // O aviso é in-app nesta fase: um Comentário com Menção, que `pendingMentions`
  // entrega a quem ENXERGA a Tarefa. Por Canal é Phase 5.
  const r = addTaskComment(state, owner, task.id, {
    content: fillTemplate(state, task, spec.template, opcoes?.cnpjPorEmpresa),
    mentions: alvos.map((id) => ({ type: "member", id })),
    actor: { kind: "automation", id: automation.id },
  });
  // ...
}
```
O comentário do próprio código ("Por Canal é Phase 5") já marca este como o ponto de extensão — a mudança é acrescentar um ramo `if (spec.channel === "whatsapp")` antes do comportamento in-app atual, produzindo um evento em vez de (ou além de) um Comentário.

### O hardcode que precisa mudar para roteamento por payload
```typescript
// Source: financeiro-tria/automation/src/http/webhooks-plataforma.ts:347
return res.status(202).json({ accepted: true, event: eventType, tenantId: "tria", taskId: evento.taskId, resultado: resultadoServico });
```

### `resolveAccountConfig` já existe por tenant — reusar, não reescrever
```typescript
// Source: financeiro-tria/automation/src/tenants/family-office/payment-rules.ts (Family Office já resolve por nome de Empresa)
export function resolveAccountConfig(empresaName: string): AccountConfig {
  const key = normalizeEmpresaKey(empresaName);
  try {
    const empresa = resolveEmpresaOmie(empresaName);
    return { key, appKey: empresa.omieAppKey, appSecret: empresa.omieAppSecret, categoryBank: empresa.categoryBank, clickupTag: key.toLowerCase().replace(/\s+/g, "-"), matched: true };
  } catch {
    return { key: key || "UNKNOWN", appKey: "", appSecret: "", categoryBank: "", clickupTag: "", matched: false };
  }
}
```
Este padrão (nome de Empresa → credencial) já é exatamente o que TEN-01 precisa generalizar: o `automation/` continua tendo essa função por serviço; o que muda é QUEM decide `empresaName` — hoje vem do Campo `02-Empresas` do ClickUp lido por `pickService`/webhook path, amanhã vem do Campo `Empresa` já unificado na plataforma.

### Descoberta dinâmica de listas com agenda (por que R2-R7 não pedem código novo no motor)
```typescript
// Source: apps/api/src/automacoes/scheduler-worker.ts:245-271
async function catalogoDeListasComAgenda(workspaceId?: string): Promise<ParDoCatalogo[]> {
  const resultado = await pool().query<{ workspace_id: string; dados: AutomationRegistrada }>(
    `select workspace_id, dados
       from plataforma.registros
      where colecao = 'automations'
        and dados->>'lifecycle' = 'ativo'
        and dados->>'scopeType' = 'list'
        ${filtroWorkspace}`,
    parametros,
  );
  // filtra por versão publicada com trigger.kind === "condicaoTemporal"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Tenant resolvido pelo path do webhook ClickUp (`/webhooks/:tenantId/*`) | Tenant resolvido pelo payload/Empresa da Tarefa | Esta fase (TEN-01) | `automation/` para de depender de qual URL o ClickUp chamou; passa a depender do dado que a Tarefa carrega |
| `customFieldNames` com prefixo numérico (`01-Centro de Custo`…) do Family Office | Campos lidos por id estável (já é como a plataforma funciona desde a Fase 2, `plataforma-payment-mapper.ts`) | Fase 2 (mapper) + esta fase (corte do ClickUp do FO) | Prefixo numérico vira código morto, não precisa de tradução |
| `notificar` só in-app (Comentário + Menção) | `notificar` com variante de Canal (WhatsApp) | Esta fase (AUTO-02) | Primeiro canal externo do motor de Automações — precedente para futuros canais (fora de escopo aqui, D5-11) |
| Contas a receber como Lista dormente desde out/2025, sem Automação nenhuma | Config completa (6 Status, 8 Campos, 6 Automações R2-R6) já materializada em `ws_n1` desde Fase 1 | Plan 01-05/01-06 (2026-09-16), ANTES desta fase começar | O trabalho de REC-01 é majoritariamente IMPORTAÇÃO + telas + reconciliação, não modelagem de domínio |

**Deprecated/outdated:**
- `MARCOS_PAULO_CONFIG.omie.appKey`/`appSecret` hardcoded como default (`marcos-paulo/config.ts`) — risco aceito por D-13, não deve ser copiado para lugar nenhum durante esta fase.
- `family-office/config.ts.customFieldNames` — vira código morto quando o webhook ClickUp do FO for desligado (D5-05/D5-07).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O planner deve modelar a config por Empresa estendendo `Integration` (campo de configuração estruturado) em vez de usar Campos da Lista/Espaço — é a leitura mais alinhada com A8/D5-03, mas o tipo `Integration` hoje NÃO tem esse campo; é decisão de discretion, não fato travado | Standard Stack / Architectural Map | Se o planner escolher outro mecanismo (Campos), esta recomendação simplesmente não se aplica — baixo risco, é área de discretion explícita |
| A2 | Para AUTO-02, o payload do evento novo deve seguir a doutrina "pobre" (buscar o resto via `getTask`) em vez de carregar `empresa`/`numero` diretamente — inferido da doutrina documentada em `outbox.ts`, não travado por D5-09/D5-10 explicitamente | AUTO-02 / Common Pitfalls | Se o planner decidir que o payload PODE carregar o número (não é dado financeiro sensível como CPF/chave Pix), a arquitetura simplifica — risco baixo, mas contraria o padrão estabelecido nas 3 rotas equivalentes |
| A3 | `ws_n1` de produção já reflete exatamente o `seed-contas-a-receber.ts` atual (nenhum drift desde o bootstrap) — inferido de `git log` mostrando um único commit tocando o arquivo (0a63c4b, mesma onda do bootstrap) e de `STATE.md` confirmando que o bootstrap rodou contra Supabase real | REC-01 / Pitfall 1 | Se houver drift (ex.: o bootstrap rodou ANTES do commit final do arquivo, ou uma migração manual divergiu), o evolver de reconciliação vai reportar divergências — o plano já deveria incluir essa verificação como Wave 0, não assumir |
| A4 | Omie expõe `ListarContasReceber`/`ConsultarContaReceber`/`IncluirContaReceber`/`LancarRecebimento` em `https://app.omie.com.br/api/v1/financas/contareceber/` — via busca na documentação pública da Omie (ajuda.omie.com.br), não verificado contra uma chamada real | REC-01 ramo espelho | Se a API divergir (nomes de método, parâmetros), só afeta o ramo espelho — que é o ramo NÃO-default de D5-02; risco de planejamento baixo dado que o ramo processo é o default declarado |

## Open Questions (RESOLVED)

> **As três foram decididas no planejamento de 2026-09-23.** A resolução de cada
> uma está logo abaixo do enunciado, citando o plano que decide. Nenhuma segue
> aberta; o texto original fica para quem quiser ver o raciocínio.

1. **O Campo `Z WhatsApp` de D5-10 é o mesmo dado que os números fixos (Mari/Marcos/grupo financeiro) de `marcos-paulo/config.ts`, ou são coisas diferentes que a fase precisa conciliar?**
   - **(RESOLVED — Plan 05-06):** são **dois mecanismos com uma doutrina de
     recusa**. `canalCampoDestinoId` é o Campo da Tarefa (D5-10 literal);
     `canalDestinatariosDaEmpresa` são os **rótulos** `mari`/`marcos`/`grupo-financeiro`
     declarados em `Integration.avisosPorCanal.whatsapp` (D5-03). Os dois modos
     juntos, ou nenhum, é recusa. Os números continuam só em `MP_WHATSAPP_*` no
     ambiente do `automation/` — a plataforma guarda rótulo, como faz com a conta
     Omie.
   - O que sabemos: nenhum Campo hoje na plataforma tem esse papel; os dois Campos "WhatsApp" existentes (`fd_cp_whatsapp`, `fld_sp_z_whatsapp`) são sobre o contato do fornecedor/solicitante, não sobre os destinatários fixos da automação de aviso.
   - O que é incerto: se o planner deve criar um Campo novo por Empresa (ex. "WhatsApp de aviso"), ou se o alvo continua sendo config estática da Automação/Empresa (D5-03), com o "Campo da Tarefa" reservado para usos futuros/genéricos.
   - Recomendação: tratar como decisão de plano (Claude's Discretion já cobre "forma da rota e do payload") — documentar explicitamente qual caminho foi escolhido e por quê, já que D5-10 e o comportamento observado de MP (D5-11) não são obviamente o mesmo mecanismo.

2. **`ws_n1` de produção já tem a config atual de Contas a receber, ou há drift desde o bootstrap de Fase 1?** *(RESOLVED como plano — Plan 05-09: a conferência somente-leitura de `ws_n1` é a primeira tarefa de REC-01, com saída em `05-CONFERENCIA-WS-N1.md`; o que ela achar É o escopo restante. A incerteza não foi eliminada por pesquisa — foi convertida em passo executável, que é o desfecho correto.)*
   - O que sabemos: `bootstrap-gestao.ts` chama `applyContasAReceber(..., { fixtures: false })`; `git log` mostra o arquivo estável desde o commit do bootstrap; `STATE.md` confirma execução real contra Supabase.
   - O que é incerto: nenhuma verificação direta contra o banco foi feita nesta pesquisa (sem acesso a `DATABASE_URL` de produção nesta sessão).
   - Recomendação: primeiro passo do plano de REC-01 deve ser uma leitura read-only de `ws_n1` (contagem/comparação de Status, Campos, Automações da Lista `lst_contas_a_receber`) — barato, resolve a incerteza antes de qualquer escrita.

3. **O evento `solicitacao.criada.v1` (e os outros dois do contrato v1) pode ganhar um campo novo (`empresa`), ou isso conta como quebra do contrato "congelado"?** *(RESOLVED — Plan 05-07: **evento novo**, `automacao.notificar-canal.v1`, nunca um campo a mais num evento existente. A ambiguidade sobre o alcance de "congelado" deixa de importar, e a escolha é consistente com o precedente de 03-07, "superfície nova, não um 8º método". Não reabrir.)*
   - O que sabemos: o comentário de Plan 03-07 chama o contrato v1 de "congelado por §9"; `EVENTOS` usa `.strict()`.
   - O que é incerto: se "congelado" se refere só aos 7 métodos de `adapters/plataforma.ts` (a direção `automation/` → plataforma) ou também aos 3 eventos de outbox (a direção oposta, plataforma → `automation/`, adicionados por SOL-07/Plan 02-10).
   - Recomendação: tratar como pergunta de design a decidir no plano — a opção mais segura (evento NOVO em vez de campo novo num evento existente) evita a ambiguidade por completo e é consistente com o precedente de 03-07 ("superfície nova, não um 8º método").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Acesso a `../financeiro-tria` (worktree local) | Leitura de config/payment-rules/routes | ✓ | — | — |
| `npm view` (registro npm) | Verificação de versão de `zod` | ✓ | 4.6.5 confirmado | — |
| Acesso a `DATABASE_URL` de produção (`ws_n1`) | Verificar se o bootstrap já tem a config atual de Contas a receber (Open Question 2) | ✗ (nesta sessão de pesquisa) | — | Wave 0 do plano roda a verificação com acesso real, sob checkpoint se necessário |
| Documentação oficial da Omie para `ListarContasReceber` | Ramo espelho de REC-01 (não-default) | Parcial — só via busca web, não testado contra credencial real | — | Ramo processo (default de D5-02) não depende disso |
| Evolution API (credenciais MP) | Testar AUTO-02 fim-a-fim | ✗ (fora do alcance desta pesquisa) | — | `EvolutionAdapter` já tem testes/mocks no `automation/`; teste de integração real fica para execução |

**Missing dependencies with no fallback:** nenhuma bloqueia o planejamento — todas têm caminho de verificação dentro da própria execução da fase (checkpoints/Wave 0).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (crm-n1, 3 workspaces) | Vitest (`"test": "vitest run"` em `packages/dominio`, `apps/api`, `apps/web`) |
| Framework (`financeiro-tria/automation`) | `tsx --test --test-concurrency=1 "src/**/*.test.ts"` (node:test nativo) |
| Config file | `vitest.config.ts` por workspace (padrão já usado nas fases anteriores); `automation/` sem config extra além do script |
| Quick run command (domínio, foco na fase) | `npm run test --workspace=@n1/dominio -- contas-a-receber` / `-- automations` |
| Full suite command | `npm run check` (tipos, lint, tokens, testes nos três workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEN-01 | Campo `Empresa` ganha "Marcos Paulo"; evolver não duplica nem sobrescreve rodando 2x | unit (domínio) | `npm run test --workspace=@n1/dominio -- evolver` | ❌ Wave 0 (evolver de Empresa ainda não existe) |
| TEN-01 | 5º Status `em revisão` só alcançável pela Automação da Empresa que declara | unit (domínio) | `npm run test --workspace=@n1/dominio -- automations` | ✅ (arquivo existe; caso novo a acrescentar) |
| TEN-01 | Roteamento por payload (não mais por path) no `automation/` | integration (`automation/`) | `npm test -w automation -- webhooks-plataforma` | ❌ (teste do hardcode `tenantId: "tria"` não existe ainda) |
| AUTO-02 | `notificar` com Campo vazio recusa visível na Execução, nunca envia | unit (domínio) | `npm run test --workspace=@n1/dominio -- automations` | ❌ Wave 0 (caso "channel" ainda não existe) |
| AUTO-02 | Evento novo grava no outbox só dentro da transação (mesma garantia D-18) | integration (`apps/api`) | `npm run test --workspace=@n1/api -- outbox` | ❌ Wave 0 (tipo de evento novo) |
| AUTO-02 | Rota nova em `automation/` recusa sem Bearer válido, aceita idempotência | integration (`automation/`) | `npm test -w automation -- notificar-canal` | ❌ Wave 0 |
| REC-01 | `ws_n1` de produção tem (ou não) a config atual de Contas a receber | manual/checkpoint | leitura read-only contra `DATABASE_URL` real | N/A — checkpoint, não teste automatizado |
| REC-01 | Importação histórica das 240 Tarefas não dispara Automação no replay | unit (domínio) | `npm run test --workspace=@n1/dominio -- importacao-contas-a-receber` | ❌ Wave 0 (molde: `importacao-contas-a-pagar.test.ts`) |
| REC-01 | R2/R4/R5 descobertos pelo `scheduler-worker.ts` sem código novo no motor | integration (`apps/api`, requer Postgres) | `npm run test --workspace=@n1/api -- scheduler-worker` (com `DATABASE_URL`) | ✅ (arquivo existe; adicionar caso com `CR.listId`) |
| REC-01 | RN-CR-01..07/INV-CR-01/02 cobertas | unit (domínio) | `npm run test --workspace=@n1/dominio -- contas-a-receber` | ✅ (parcial — `contaSemCliente`/`parcelaDuplicada`/`createReceivableSeries` já testados; INV-CR-01/02 e o Campo "Contrato" ainda não) |

### Sampling Rate
- **Per task commit:** teste focado do módulo tocado (`npm run test --workspace=@n1/dominio -- <termo>` ou `npm test -w automation -- <termo>`)
- **Per wave merge:** `npm run check` (três workspaces do `crm-n1`); `npm test` em `automation/` separadamente (repositório distinto, CON-05 proíbe alterar o que não é desta fase)
- **Phase gate:** `npm run check` verde + suíte de `automation/` verde antes de `/gsd-verify-work`; para REC-01, o checkpoint de D7 é bloqueante e antecede qualquer código do ramo escolhido

### Wave 0 Gaps
- [ ] Evolver de configuração por Empresa (Campo `Empresa` + Integração/config) — molde: `solicitacao-de-pagamento-evolver.ts`
- [ ] Teste do caso "notificar com `channel: whatsapp`" em `automations-motor.test.ts` (ou arquivo próprio)
- [ ] Tipo de evento `automacao.notificar-canal.v1` em `outbox.ts` + teste de gravação transacional
- [ ] Rota nova `notificar-canal` em `automation/` + teste `tsx --test` (molde: `contas-a-pagar-routes.ts`)
- [ ] Verificação read-only de `ws_n1` (Contas a receber) contra o catálogo atual — script ou query, não necessariamente teste automatizado
- [ ] `importarContaAReceberHistorica` + teste (molde: `importacao-contas-a-pagar.test.ts`, `Plan 03-09`)
- [ ] Teste do `scheduler-worker.ts` cobrindo `CR.listId` sendo descoberto dinamicamente (hoje só há caso para `CP.listId`)
- [ ] Framework: nenhum framework novo — Vitest e `node:test` já cobrem tudo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | sim | Bearer `Authorization` em tempo constante (`timingSafeEqual`), mesmo padrão de `contas-a-pagar-routes.ts`/`webhooks-plataforma.ts` — reusar a DISCIPLINA, não o código |
| V3 Session Management | não diretamente | Sessão de usuário já resolvida por Supabase JWT (Fase 1); esta fase não altera esse caminho |
| V4 Access Control | sim | Grants/`memberSeesTask` já modelam "Comercial vê só clientes próprios" (RN-CR-02/§10); TEN-01 não introduz papel novo, reusa Papéis existentes |
| V5 Input Validation | sim | `zod().strict()` em toda superfície HTTP nova (evento de outbox, rota de canal, payload de webhook) — nenhum campo desconhecido tolerado silenciosamente |
| V6 Cryptography | sim (indireta) | Nenhum segredo Omie/Evolution passa pela plataforma (D5-03/D5-09); a única credencial que a plataforma emite é o Bearer de serviço próprio (molde `PLATAFORMA_LANCAMENTO_TOKEN`/`PLATAFORMA_LEITURA_TOKEN`), nunca gerado nem armazenado com lógica nova nesta fase |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Vazamento de credencial Omie/Evolution por log ou payload de erro | Information Disclosure | `sanitizarErro()` já redige Bearer/CNPJ/CPF/URL com query string — a rota nova de Canal deve usar a mesma função, nunca ecoar corpo cru |
| Tenant spoofing (payload declarando uma Empresa que a Tarefa real não tem) | Spoofing | `automation/` deve resolver a Empresa buscando a Tarefa de volta via API autenticada (`getTask`), nunca confiar cegamente num campo `empresa` que o chamador declarou no payload do webhook |
| Replay de notificação (a mesma Execução dispara o WhatsApp duas vezes) | Repudiation / duplicate side-effect | `Idempotency-Key` = `id` da linha do outbox, igual ao padrão já usado nos outros 3 eventos — a rota nova precisa aceitar e deduplicar por essa chave |
| Vazamento de número de telefone/nome de cliente em log de erro do outbox | Information Disclosure | Payload pobre (Pattern 3) já evita isso por desenho — o número só existe do lado do `automation/`, nunca no `apps/api` |

## Sources

### Primary (HIGH confidence — leitura direta de código neste monorepo e no `financeiro-tria`)
- `packages/dominio/src/types/workspace.ts` (`Integration`, `Workspace`) — forma atual, sem campo de configuração estruturada
- `packages/dominio/src/types/primitives.ts` (`FieldDefinition`, `FieldType`) — `singleSelect`/`options`
- `packages/dominio/src/seed-financeiro.ts` — Campo `Empresa` (`fd_cp_empresa`) com 11 opções atuais
- `packages/dominio/src/seed-contas-a-receber.ts` — 6 Status, 8 Campos, Automações R2-R6, já com `{ fixtures: false }`
- `packages/dominio/src/bootstrap-gestao.ts` — confirma `applyContasAReceber(..., { fixtures: false })` na composição de produção
- `packages/dominio/src/operations/financeiro.ts` — `createReceivableSeries`, `contaSemCliente`, `parcelaDuplicada`, `CP`/`CR` (ids)
- `packages/dominio/src/operations/automations.ts` — `case "notificar"`, `runScheduledAutomations`, `runListAutomations`, `ActionSpec`
- `packages/dominio/src/solicitacao-de-pagamento-evolver.ts` — molde do evolver idempotente
- `apps/api/src/persistencia/outbox.ts` — `EVENTOS` (fechado, `.strict()`), doutrina de payload pobre
- `apps/api/src/persistencia/outbox-worker.ts` — `CAMINHO_POR_EVENTO`, `sanitizarErro`, backoff
- `apps/api/src/automacoes/scheduler-worker.ts` — `catalogoDeListasComAgenda` (descoberta dinâmica por SQL)
- `apps/api/src/automacoes/invocar-agente.ts` — molde de ponte HTTP síncrona (para contraste com o padrão outbox, assíncrono)
- `apps/api/src/bootstrap/gestao.ts` — guarda "Espaço vazio" do bootstrap
- `apps/api/exportacoes/MANIFESTO.md` — confirma export das 3 Listas de Fase 0 (incluindo `901107648977`, 240 Tarefas); confirma AUSÊNCIA de `901109642259`/`901111928443`
- `docs/07-processos/contas-a-receber.md` — spec completa (§1-§12)
- `../financeiro-tria/automation/src/tenants/{tria,marcos-paulo,family-office}/config.ts` e `payment-rules.ts` — diff completo lido
- `../financeiro-tria/automation/src/adapters/omie.ts` — `grep -c "Receber"` = 0 (verificado nesta sessão)
- `../financeiro-tria/automation/src/adapters/evolution.ts` — `EvolutionAdapter`
- `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` — `tenantId: "tria"` hardcoded (linha 347)
- `../financeiro-tria/automation/src/http/routes.ts` — `pickService`, montagem `/webhooks/:tenantId`
- `../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts` — molde de disciplina de rota nova
- `git log` deste repositório — confirma estabilidade de `seed-contas-a-receber.ts` desde o commit do bootstrap

### Secondary (MEDIUM confidence)
- `npm view zod version` — 4.6.5, confirmado nesta sessão [VERIFIED: npm registry]
- `.planning/STATE.md` — confirma execução real de `bootstrapGestao()` contra Supabase de produção

### Tertiary (LOW confidence, marcado para validação)
- Documentação Omie (`ajuda.omie.com.br`) sobre `ListarContasReceber`/`IncluirContaReceber`/`LancarRecebimento` — via WebSearch, não testado contra credencial real; só relevante ao ramo espelho (não-default)

## Metadata

**Confidence breakdown:**
- TEN-01/AUTO-02 (Standard Stack, Architecture, Pitfalls): HIGH — todo o material vem de leitura direta de código em ambos os repositórios, incluindo o achado do hardcode `tenantId: "tria"` e a descoberta dinâmica de listas do scheduler
- REC-01 ramo processo: MÉDIA-ALTA — o domínio já existe e está em produção (verificado por grep no `bootstrap-gestao.ts` e por `STATE.md`), mas a confirmação FINAL de que `ws_n1` reflete o seed atual depende de acesso a `DATABASE_URL` de produção que esta pesquisa não teve (Open Question 2)
- REC-01 ramo espelho: LOW — depende de API Omie não integrada nesta base; só citada via busca web

**Research date:** 2026-09-23
**Valid until:** 2026-10-23 (30 dias — stack estável, mas a Fase 2/3 seguem em execução paralela e podem mudar `outbox.ts`/`scheduler-worker.ts` antes desta fase começar; reverificar `EVENTOS`/`catalogoDeListasComAgenda` no início do planejamento se muito tempo tiver passado)
