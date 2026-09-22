# Phase 3: Contas a pagar - Research

**Researched:** 2026-09-22
**Domain:** Motor de Automações genérico (event + schedule) sobre a ontologia de Tarefas; importação histórica com preservação de trilha; Agente de lançamento Omie real com Ensaio; permissão de Convidado por campo.
**Confidence:** MEDIUM-HIGH — a maior parte das perguntas foi respondida por leitura direta de código real (`packages/dominio`, `apps/api`, `financeiro-tria/automation`) e de dados reais exportados do ClickUp, não por suposição. As duas lacunas de recorrência (feriado, dia inexistente) permanecem checkpoints por falta de evidência real suficiente, como o `03-CONTEXT.md` já previa.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D3-01 — FINQ sai de escopo; só TRIA.** O de-para e as credenciais do Omie ficam restritos à TRIA nesta fase. `financeiro-tria` resolve duas empresas por Centro de Custo (`payment-rules.ts::resolveAccountConfig`), cada uma com credenciais e tabela de categorias próprias (`conciliador_contas_pagar_finq` fora de escopo; `conciliador_contas_pagar_tria` nesta fase). A partição por empresa permanece no código legado; esta fase apenas não a exercita para FINQ. Não remover o caminho FINQ do `financeiro-tria`.

**D3-02 — OQ-CP-04 está respondida: o de-para já existe.** O banco de categorias já existe e está em produção — `conciliador_contas_pagar_tria`, referenciado por `banco_de_categorias` em `solicitacoes_pagamentos` e resolvido por `resolveAccountConfig(centroCusto).categoryBank`. A questão real é "como alcançar", e DEC-08 já decidiu: os dois schemas vivem em projetos Supabase distintos, nenhuma leitura cruzada por JOIN, tudo por HTTP (OQ-SYN-03). Não gerar um segundo de-para; não exportar do Omie para criar uma cópia divergente.

**D3-03 — O Agente roda em SOMBRA na primeira semana.** "Ensaio" do critério 4 significa: durante a primeira semana o Agente calcula o que lançaria e registra ao lado do que o humano de fato lançou, sem nenhuma escrita no Omie. Mede-se a taxa de acerto antes de dar a caneta a ele. Mais conservador que o Ensaio da Phase 2 (02-27), onde os dois caminhos escrevem e a reconciliação confere — aqui não há escrita do Agente, a comparação é contra o lançamento humano. Consequência de projeto: **o cálculo do lançamento tem que ser separável da execução dele**. A peça que decide "qual categoria, qual conta, qual valor" não pode estar entrelaçada com a chamada `IncluirContaPagar`.

**D3-04 — Importação histórica preserva a trilha completa.** `date_created`, `date_closed` e todo o histórico de status viram Registros de Atividade com a data original, como o critério 2 exige literalmente. "Tempo em `para pagar`" (29–31 dias é o ciclo normal) continua mensurável depois da importação. A data de vencimento vive só no campo nativo, nunca duplicada.

**D3-05 — A regra de recorrência já está modelada; duas lacunas ficam abertas.** `seed-financeiro.ts::recorrente()` e `types/structure.ts::RecurrenceRule` já definem: frequência mensal, intervalo 1, `triggerMode: "aoConcluir"` (nasce ao fechar, não por calendário), `businessDays: "anterior"` (fim de semana → dia útil anterior), Responsável padrão = Financeiro, cópia de valores de campo exceto Anexo/Data de Emissão. Respondido pelo modelo: fim de semana antecipa; a regra é por Tarefa (cada conta recorrente carrega a sua, podem divergir); reabertura não duplica (`triggerMode: "aoConcluir"` + RN-CP-06). **Duas lacunas reais, a decidir antes de codificar A1** (não inventar default silencioso — se a pesquisa não achar resposta nos dados reais, volta como checkpoint):
1. **Feriado** — não existe no modelo; uma conta que vence num feriado seria tratada como dia útil comum.
2. **Dia inexistente no mês** — conta que vence todo dia 31: em fevereiro vai para 28/29, ou transborda para 1º de março? Nenhuma regra hoje.

### Claude's Discretion

Não há uma seção `## Claude's Discretion` explícita em `03-CONTEXT.md`; o documento trata as decisões acima como travadas e devolve as duas lacunas de D3-05 como checkpoints obrigatórios. Fora essas duas lacunas, esta pesquisa trata como discricionário apenas o desenho interno do motor de Automações (AUTO-01) — a infraestrutura (fila, catch-up, tabelas) não está prescrita em nenhum documento, só o comportamento observável ("não perde o dia se o processo cair").

### Deferred Ideas (OUT OF SCOPE)

- **FINQ e os outros tenants** — D3-01 restringe à TRIA. Marcos Paulo e Family Office são Phase 5.
- **`notificar` por Canal** — nesta fase `notificar` é in-app; por Canal (WhatsApp/Evolution API) é Phase 5 (AUTO-02).
- **OQ-PF-03 (C14)** — Definições de Campo de Tarefa em Automação de escopo Espaço de Trabalho segue aberta na ontologia. Relevante para AUTO-01, mas não bloqueia A1–A9, que são de Lista.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAG-01 | Importar a Lista `901107637383` com `date_created`, `date_closed` e histórico de status como Registros de Atividade com data original; campo `L` → Data de vencimento nativa; de-para de usuários (PREP-04) | R5 — export real inspecionado (2.861 Tarefas, `time-in-status` com `status_history`), `recordActivity`/`at` já aceita timestamp custom, `changeTaskStatus` NÃO aceita — gap identificado e caminho de solução dado |
| PAG-02 | A1–A9 rodando no motor de Automações | R1, R2, R3 — tabela completa das 9 automações contra o `Automation`/executor reais; gaps de vocabulário (`aguardar`, `notificar`, `solicitarAprovacao`) identificados linha a linha |
| PAG-03 | `runLancamentoAgent` deixa de simular; lança de verdade via `automation/`, idempotente | R6 — `buildResumoDePagamento` já é a peça pura que D3-03 exige; ponto exato de acoplamento ClickUp no `automation/` identificado (`legacyClickUpRaw().updateTaskStatus`) |
| PAG-04 | Substituir `CATEGORIA_OMIE`/`CNPJ_POR_EMPRESA` fictícios pelo plano real do Omie, com `REVISAR` | R6 — `ListarCategorias`/`ListarDepartamentos` e `resolveCategoryCodeAgainstOmie` já existem no `automation/`; threshold `CATEGORY_MIN_SIMILARITY` confirmado |
| PAG-05 | Lote de 61 fechamentos + A1 disparando 61 vezes | R7 — origem real do "lote de 61" confirmada no export (recorrência mensal, não fechamento manual em massa); DEC-06 e o Unit of Work analisados |
| PAG-06 | Pessoa da conta só vê suas Tarefas; edita só Anexo/Data de Emissão | R7 — `guestFieldWriter`/`memberSeesTask` lidos; gap real identificado: hoje depende de Grant estático por Tarefa, não de derivação dinâmica do campo Pessoa |
| AUTO-01 | Motor de Automações genérico (evento + agenda, 4 ações, Execuções auditáveis) | R1, R2 — outbox/outbox-worker lidos por inteiro; resposta fundamentada de que o motor NÃO é a mesma peça que o outbox |
</phase_requirements>

## Summary

O motor de Automações não existe como processo — mas boa parte do que ele precisa já existe como função pura dentro de `packages/dominio`, só falta o "relógio" que a chama. `runListAutomations` (gatilho por evento) já roda de verdade, síncrono, dentro da MESMA transação de `changeTaskStatus`/`createTask` — não precisa de fila porque nunca cruza um limite de processo. `runScheduledAutomations` (gatilho `condicaoTemporal`, o que A5/A6/A7 usam) também já existe como função pura e **já é idempotente por desenho** (verifica execuções anteriores antes de rodar) — o que falta não é lógica de negócio, é um processo em `apps/api` que a chame pelo menos uma vez por dia por Lista, no mesmo padrão do `outbox-worker.ts` (`setInterval` in-process, sem cron do SO). Por isso a resposta a "é a mesma peça do outbox?" é **não**: o outbox existe para eventos que cruzam para um sistema EXTERNO (`automation/`) depois do commit; o motor de Automações de evento roda dentro do processo, na mesma transação, sem I/O de rede. O ponto de contato real entre as duas peças é só um: quando `invocarAgente` (A7) precisar de fato chamar o Omie via `automation/`, essa chamada é I/O de rede e não pode morrer dentro de `packages/dominio` — precisa de um novo componente em `apps/api`, estruturalmente parecido com o outbox mas para "chamada de Ferramenta de Agente", não para "notificar `automation/` de um fato".

A importação histórica (PAG-01) tem um precedente direto e bem desenhado — `importarSolicitacaoHistorica` (Plan 02-22) — mas reusar o padrão ingenuamente quebra: aquela função chama `changeTaskStatus` uma vez (a Lista de Solicitações não tem Automação nenhuma hoje), enquanto Contas a Pagar tem nove. Chamar `changeTaskStatus` para replayar cada transição histórica dispararia A1 (nasceria uma recorrência nova para cada conta paga há meses), A2, A3, A5/A6 (comentários de cobrança em Tarefas fechadas há anos) — um desastre de dados. `changeTaskStatus` também não aceita um timestamp custom, então nem serviria para preservar a data original mesmo se as automações fossem desligadas. A importação de Contas a Pagar precisa construir a Tarefa e as Atividades diretamente (como `importarSolicitacaoHistorica` já faz para `createdAt`/`completedAt`, via substituição de objeto), nunca chamando `changeTaskStatus` para o histórico.

O Agente de lançamento já tem a peça pura que D3-03 exige — `buildResumoDePagamento(state, task)` — só que ela lê de três tabelas fictícias (`CATEGORIA_OMIE`, `CONTA_POR_TAG`, `CNPJ_POR_EMPRESA`) que precisam ser substituídas por dados resolvidos fora do domínio (o domínio não faz I/O). O `automation/` já sabe fazer essa resolução de verdade — `ListarCategorias`, `ListarDepartamentos`, `resolveCategoryCodeAgainstOmie` (RAG + validação contra o plano real do Omie, com `REVISAR` sob o threshold `CATEGORY_MIN_SIMILARITY`) — mas hoje essa lógica está entranhada num arquivo de ~2.100 linhas que TAMBÉM escreve status na Lista ClickUp de Contas a Pagar via `legacyClickUpRaw().updateTaskStatus` (linha explicitamente comentada como "raw/ClickUp-only" porque a Lista de Contas a Pagar está "fora do Conjunto de Status que a porta modela"). Isso é o achado mais acionável de toda a pesquisa: **o caminho de lançamento real de hoje termina escrevendo em ClickUp**, e depois que a Lista `901107637383` for arquivada (critério 1) esse caminho para de existir. `automation/` precisa de uma nova rota HTTP dedicada — "calcule e lance no Omie, devolva o resultado" — que NÃO tente mexer em status nenhum; o `apps/api` (a Automação A7/A8) decide o status pelo próprio domínio, local, sem depender do `automation/` escrever nada fora do Omie.

**Primary recommendation:** construir o motor de Automações como dois executores independentes em `apps/api/src/automacoes/` — um síncrono in-process para `evento` (que já é o comportamento atual, só precisa ganhar um lugar fora do domínio para orquestrar quando `invocarAgente` precisa de I/O), e um poller in-process (padrão `outbox-worker.ts`) para `condicaoTemporal`/`agendamento` que chama `runScheduledAutomations` pelo menos uma vez por dia por Lista — sem inventar fila nova, porque a idempotência já mora no domínio. A2, A3, A4, A9 (evento) e A5, A6 (agenda, texto de comentário) não têm bloqueio técnico e podem ser ligados quase como estão. A1 (recorrência) tem duas lacunas de regra a fechar com o Financeiro antes de codificar. A7/A8 (Agente real) é o item de maior risco e exige um NOVO endpoint em `automation/` e uma reestruturação de `buildResumoDePagamento` para consumir de-para resolvido por HTTP em vez de tabelas fictícias.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gatilho por evento (A2, A3, A4, A9) | `packages/dominio` (síncrono) | `apps/api` (invocação via Unit of Work) | Já é assim hoje: `runListAutomations` roda dentro da mesma transação de `changeTaskStatus`/`createTask`. Não cruza processo. |
| Gatilho por agenda/temporal (A5, A6, A7) | `apps/api` (poller) | `packages/dominio` (função pura `runScheduledAutomations`, já existe) | A decisão de "está na hora" e "já rodou" é pura e já mora no domínio; só falta o relógio que chama, e o relógio é I/O — não pertence ao domínio. |
| Recorrência (A1) | `packages/dominio` | — | `RecurrenceRule`/`spawnNextOccurrence`/`nextOccurrenceRefusal` já modelam isso como atributo da Tarefa (B6), não como Automação — correto, e já testado (RN-CP-06). |
| Chamada real ao Omie (A7/A8, PAG-03/04) | `apps/api` (novo componente HTTP) | `automation/` (novo endpoint dedicado) | `packages/dominio` não pode fazer I/O de rede; a resolução de categoria/conta real depende de `ListarCategorias`/RAG que só o `automation/` alcança. |
| Cálculo do lançamento (de-para, RESUMO) | `packages/dominio` (função pura, parametrizada) | `apps/api` (busca os dados reais e injeta) | D3-03 exige separação cálculo/execução; `buildResumoDePagamento` já é pura — só precisa parar de ler tabelas fictícias fixas e passar a receber o de-para resolvido como parâmetro. |
| Importação histórica com trilha (PAG-01) | `apps/api` (CLI, como Plan 02-25) | `packages/dominio` (nova função de import, não reusar `changeTaskStatus`) | Mesma família de `importarSolicitacaoHistorica`, mas sem could disparar Automação nenhuma durante o replay. |
| Permissão da Pessoa da conta (PAG-06) | `packages/dominio` (`memberSeesTask`/Grant) | `apps/api` (nada de novo — já aplica quem tem Grant) | O enforcement de Grant já é real (Phase 1 aplica); o que falta é uma forma DINÂMICA de conceder a Grant quando o campo Pessoa é preenchido, hoje só existe estática, escrita no seed. |
| Lote de 61 (PAG-05) | `apps/api` (Unit of Work, uma operação em lote) | `packages/dominio` (nova operação de lote, ou N chamadas sequenciais) | DEC-06 serializa escrita por Espaço; decisão de tamanho de transação pesa em tempo de lock e em quantas vezes A1 dispara dentro vs. fora da transação. |

## Standard Stack

### Core

Este é um domínio majoritariamente de CÓDIGO PRÓPRIO — o "motor de Automações" e a importação não são resolvidos por biblioteca nenhuma; são composições sobre o que `packages/dominio`/`apps/api` já têm. Não há novo framework a introduzir para AUTO-01, PAG-01/02/03/05/06.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.23.0 (já no `apps/api`) | `for update skip locked` para o poller de Automações agendadas, no mesmo padrão do `outbox-worker.ts` | Já é a dependência usada pelo outbox; reusar a mesma primitiva de lease evita reinventar concorrência |
| `zod` | ^4.6.5 (já em ambos workspaces) | Validar o payload do novo endpoint HTTP de lançamento Omie em `automation/`, e o corpo do novo endpoint em `apps/api` se A7 vier a expor um | Já é o padrão do contrato v1 (`apps/api/src/contratos/`, Plan 02-02) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nenhuma nova em `packages/dominio` | — | — | O domínio permanece só com `zod` (DEC — nenhuma decisão travada pede o contrário; a introdução de qualquer lib de datas/feriados no domínio pesa contra o padrão observado de dependências mínimas — ver Don't Hand-Roll) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Poller in-process (`setInterval`, como `outbox-worker.ts`) para o gatilho por agenda | `node-cron`/cron do SO | O cron do `automation/` é o antipadrão citado explicitamente no ROADMAP ("sem fila, sem retry persistente"); um poller in-process com idempotência no domínio (o que já existe) resolve "não perde o dia" sem processo externo a operar. `node-cron` adicionaria uma dependência nova SEM resolver o problema real (a idempotência é o que falta ser CHAMADA regularmente, não a sintaxe de agendamento). |
| Tabela hand-rolled de feriados nacionais | `date-holidays` (npm, ISC, 10 anos, ~633k downloads/semana) | Ver seção Don't Hand-Roll — decisão explicitamente aberta como checkpoint (D3-05, lacuna 1) |

**Installation:** nenhuma instalação nova é estritamente necessária para AUTO-01/PAG-02 (é composição sobre o que já existe). Se D3-05 (feriado) for resolvida optando por uma biblioteca, ver Package Legitimacy Audit abaixo antes de instalar.

**Version verification:**
```bash
npm view date-holidays version   # 3.37.0, publicado há 2 dias (2026-09-20) — ver nota SUS abaixo
npm view date-fns version        # 4.4.0 — já teria uso indireto se decidido usar addBusinessDays/isWeekend em vez do hand-rolled atual
```
`packages/dominio` hoje depende só de `zod` (`packages/dominio/package.json`); `apps/api` depende de `fastify`, `@fastify/cors`, `@fastify/type-provider-zod`, `@supabase/supabase-js`, `pg`, `zod`. Nenhuma lib de datas em nenhum dos dois workspaces hoje — a lógica de recorrência (`addMonths`, `toBusinessDay`, `shift`) é 100% hand-rolled em `packages/dominio/src/operations/collaboration.ts`. [VERIFIED: leitura direta de `packages/dominio/package.json` e `apps/api/package.json`]

## Package Legitimacy Audit

> Só relevante SE D3-05 (lacuna 1, feriados) for resolvida com uma biblioteca nesta fase. Nenhuma outra parte de PAG-01..06/AUTO-01 introduz pacote novo.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `date-holidays` | npm | ~10 anos (primeiro publish 2016-01-01); última versão publicada há 2 dias | 632.887/semana | `github.com/commenthol/date-holidays` | `SUS` (sinal automático: "too-new" — a ÚLTIMA versão é recente, não o pacote) | **Flagged** — falso positivo provável dado o histórico de 10 anos e o motivo plausível (feriados mudam de ano para ano, releases frequentes são esperadas); planner deve inserir `checkpoint:human-verify` antes de instalar, mesmo assim |
| `date-fns` | npm | ~mesma família já usada em discussões de tooling; não instalada hoje em nenhum workspace | 72.360.904/semana | `github.com/date-fns/date-fns` | `OK` | Só entraria em cena se a solução escolhida for hand-rolled + `date-fns` para aritmética de dias úteis; não resolve feriados por si só |

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** `date-holidays` — falso positivo de heurística ("too-new" mede a última publicação, não a idade do pacote), mas o protocolo exige checkpoint humano antes de instalar de qualquer forma.

Nomes de pacote acima vieram de conhecimento de treinamento, não de busca ativa nesta sessão (não há provedores de busca habilitados em `.planning/config.json` — todos os `*_search`/`firecrawl`/`jina`/`ref_search`/`perplexity` estão `false`) — por isso ambos ficam `[ASSUMED]` quanto à identidade do pacote, mesmo com a existência confirmada no registry via `gsd-tools query package-legitimacy check` [VERIFIED: npm registry — existência e metadados, não a escolha do pacote].

## Architecture Patterns

### System Architecture Diagram

```text
                          ┌─────────────────────────────────────────┐
                          │              apps/web (UI)               │
                          │  contas-view.tsx: seleção múltipla,      │
                          │  botão "rodar automações do dia"         │
                          └───────────────┬───────────────────────────┘
                                          │ POST /operacoes/:nome (por Tarefa)
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                                 apps/api                                    │
│                                                                              │
│  changeTaskStatus/createTask ──(síncrono, MESMA transação)──► runListAutomations
│         │                                                          │        │
│         │ (A1: RecurrenceRule, dentro do domínio, sem Automation)  │ evento │
│         │                                                          ▼        │
│         │                                              A2/A3/A4/A9 executam │
│         │                                              (escrita local, sem  │
│         │                                               I/O de rede)       │
│         ▼                                                                   │
│  gravarEventos() → integration_outbox  (só para SOL-07: automation/)       │
│                                                                              │
│  ┌────────────────────────── NOVO: apps/api/src/automacoes/ ─────────────┐ │
│  │  scheduler-worker.ts (padrão outbox-worker.ts: setInterval, sem cron  │ │
│  │  de SO) — pelo menos 1x/dia por Lista com Automação `condicaoTemporal`│ │
│  │       │                                                               │ │
│  │       ▼                                                               │ │
│  │  chama runScheduledAutomations(state, ..., today) dentro da UoW       │ │
│  │  (hidratar → função pura já idempotente → gravar diff)                │ │
│  │       │                                                               │ │
│  │       ├─► A5/A6: comentário local (sem I/O externo)                  │ │
│  │       └─► A7: invocarAgente ──────────────┐                          │ │
│  └─────────────────────────────────────────────┼──────────────────────┘ │
└──────────────────────────────────────────────────┼──────────────────────┘
                                                     │ HTTP (novo endpoint,
                                                     │ NÃO usa os 7 métodos
                                                     │ de solicitação-de-pagamento)
                                                     ▼
                          ┌──────────────────────────────────────────┐
                          │        financeiro-tria/automation          │
                          │  NOVO: POST /v1/contas-a-pagar/lancar      │
                          │  (calcula de-para real via ListarCategorias│
                          │   + RAG conciliador_contas_pagar_tria,     │
                          │   chama IncluirContaPagar no Omie,         │
                          │   devolve payableId/RESUMO/REVISAR —       │
                          │   NUNCA escreve status em lugar nenhum)    │
                          └──────────────────────────────────────────┘
                                                     │
                                                     ▼
                                              Omie (ERP real)
```

### Recommended Project Structure
```
apps/api/src/automacoes/           # NOVO — não existe hoje
├── scheduler-worker.ts            # poller in-process, padrão outbox-worker.ts
├── invocar-agente.ts              # ponte HTTP para o NOVO endpoint do automation/
└── CONTEXT.md

packages/dominio/src/operations/
├── automations.ts                 # runAction ganha os casos aguardar/notificar/solicitarAprovacao
└── financeiro.ts                  # buildResumoDePagamento passa a receber de-para por parâmetro

apps/api/src/importacao/clickup/
└── contas-a-pagar.ts              # NOVO — paralelo a financeiro/solicitacoes.ts, mas para a Lista 901107637383, sem chamar changeTaskStatus

../financeiro-tria/automation/src/tenants/tria/
└── contas-a-pagar-launch-service.ts  # NOVO — extrai resolveCategoryCodeAgainstOmie + IncluirContaPagar de payment-automation-service.ts para uma rota dedicada, sem escrita de status em Lista nenhuma
```

### Pattern 1: Automação por evento — síncrona, sem fila (já existe, só falta plugar A7)
**What:** `runListAutomations(state, event)` é chamada DIRETO dentro de `changeTaskStatus`/`spawnNextOccurrence`, na mesma `DataState` mutável, antes do `gravar()` da Unidade de Trabalho fazer o diff.
**When to use:** qualquer Automação cujo gatilho seja `evento` e cujas ações sejam só escritas locais (Status, Responsável, Comentário, Campo, Observadores) — A2, A3, A4, A9.
**Example:**
```typescript
// packages/dominio/src/operations/tasks.ts:270-272 (código real, não hipotético)
runListAutomations(state, { kind: "tarefaEntrouEmStatus", taskId: task.id, statusId: target.id, ...(before ? { previousStatusId: before.id } : {}) });
```

### Pattern 2: Automação por agenda — idempotência já embutida na função pura
**What:** `runScheduledAutomations(state, actingMemberId, listId, today)` escaneia todas as Tarefas ativas da Lista, calcula `disparo = vencimento + dueDateOffsetDays`, e só executa se `hoje >= disparo` E não existe já uma `AutomationExecution` concluída (ou falhada no mesmo dia) para aquele par (Automação, Tarefa).
**When to use:** A5 (D-5), A6 (D-2), A7 (D-1) — qualquer gatilho `condicaoTemporal`.
**Why isso resolve "não perde o dia":** rodar a função duas vezes no mesmo dia, ou pular um dia por o processo ter caído, não duplica nem perde nada — `hoje >= disparo` continua verdadeiro em qualquer dia posterior ao disparo, e `jaRodou` impede repetição.
```typescript
// packages/dominio/src/operations/automations.ts (código real)
const jaRodou = state.automationExecutions.some(
  (e) => e.automationId === automation.id && e.objectId === task.id &&
    (e.state === "concluida" || (e.state === "falhou" && new Date(e.startedAt).toDateString() === today.toDateString())),
);
if (jaRodou) { skipped += 1; continue; }
```
**Consequência para o scheduler novo:** o worker em `apps/api` só precisa GARANTIR pelo menos uma chamada por dia civil por (workspace, Lista) — não precisa de watermark persistido nem de tabela de agenda própria. Um `setInterval` de, por exemplo, 1 hora, chamando a operação já registrada em `OPERACOES` (`runScheduledAutomations`) através da MESMA Unidade de Trabalho que `POST /operacoes/:nome` usa, com um Membro/Ator de sistema (mesmo padrão da credencial de serviço "Agente do pipeline", D-15 da Phase 2) é suficiente. Chamar de mais é inofensivo (idempotente); chamar de menos só atrasa o disparo dentro do mesmo dia.

### Pattern 3: Import histórico sem disparar Automação (adaptado de `importarSolicitacaoHistorica`, com correção)
**What:** construir a Tarefa e cada Registro de Atividade de status DIRETO, nunca via `changeTaskStatus`, porque a Lista de Contas a Pagar tem 9 Automações ativas (a de Solicitações não tem nenhuma — por isso o padrão original é seguro lá e NÃO é seguro aqui sem adaptação).
**When to use:** PAG-01, replay de `date_created`/`date_closed`/`status_history` do export ClickUp.
**Example (padrão a seguir, real, de `packages/dominio/src/operations/importacao.ts`):**
```typescript
// Trecho real — o padrão de "rodar a operação, descartar o ruído de Atividade,
// substituir o objeto por cópia com os timestamps corretos" é o que se reusa.
// A DIFERENÇA necessária para Contas a Pagar: NÃO chamar changeTaskStatus para
// cada hop do histórico (dispararia A1/A2/A3/A5/A6/A9); construir a Task já no
// status final e escrever manualmente um recordActivity por transição observada
// no status_history do ClickUp, cada um com o `at` daquela transição.
const criada = createTask(state, actingMemberId, { listId, title }, { runAutomations: false });
// ...
const tarefaFinal: Task = { ...task, createdAt: criadaEm, completedAt: fechadaEm, statusId: statusFinalId, provenance: {...} };
state.tasks[indice] = tarefaFinal;
for (const transicao of statusHistoryOrdenado) {
  recordActivity(state, { actor: importActor("clickup"), action: "Status alterado", objectType: "task", objectId: task.id, objectName: task.title, before: transicao.de, after: transicao.para, at: transicao.since });
}
```
**Gap real identificado:** `recordActivity` já aceita `at` (linha 100 de `activity.ts`: `at: input.at ?? new Date().toISOString()`), então isso funciona. `changeTaskStatus` NÃO tem parâmetro de timestamp nem de `runAutomations` — por isso o import não pode usá-lo para o histórico; só pode ler `effectiveListConfig`/`statusDefinition` para resolver o status final e escrever a Tarefa diretamente, como o Pattern acima faz.

### Pattern 4: Ensaio como registro paralelo, sem escrita no Omie (D3-03)
**What:** `buildResumoDePagamento` já é pura — recebe `state`+`task`, devolve `{ texto, conta, categoria, codigo }`, sem nenhum efeito colateral. É exatamente a peça "calcula o que lançaria" que D3-03 exige. O que falta: (a) ela lê de tabelas fictícias fixas — precisa passar a receber o de-para real como parâmetro; (b) não existe hoje um lugar para GRAVAR o resultado "ao lado do que o humano lançou" para depois medir taxa de acerto.
**When to use:** primeira semana de PAG-03, antes de qualquer escrita real no Omie.
**Recomendação:** um novo tipo de registro (não seria `AgentExecution` real, porque não houve execução de verdade — seria uma variante "rehearsal": o tipo `AgentExecution` já tem o campo `rehearsal: boolean` em `runLancamentoAgent`'s execution object, hoje sempre `false`. Usar `rehearsal: true` quando D3-03 estiver ativo é reaproveitar um campo que JÁ EXISTE no tipo e já é escrito (apenas hardcoded como `false` hoje) — não precisa de tipo novo.

```typescript
// packages/dominio/src/operations/financeiro.ts:224 (código real)
rehearsal: false,   // ← já existe o campo; D3-03 só precisa passar true e nunca chamar o Omie de verdade quando true
```

### Anti-Patterns to Avoid
- **Reusar `changeTaskStatus` para replay histórico:** dispara as 9 Automações da Lista para transições que já aconteceram há meses — cria recorrências fantasmas (A1), reenvia cobranças de nota fiscal para contas já pagas (A5/A6), reatribui Responsável (A2/A3). Sempre construir a Tarefa/Atividade direto, como o Pattern 3 mostra.
- **Colocar a chamada HTTP ao `automation/` dentro de `packages/dominio`:** o domínio "não conhece ninguém" (regra do monorepo, `CONTEXT.md` raiz). `invocarAgente`/A7 precisa que a ORQUESTRAÇÃO da chamada HTTP fique em `apps/api`, entregando o RESULTADO já resolvido (categoria, conta, código, ou erro) para a função pura do domínio compor o Resumo e decidir o próximo passo.
- **Fazer o `automation/` escrever o status "lançado omie" via ClickUp raw:** é o que o código faz HOJE para a Solicitação (`legacyClickUpRaw().updateTaskStatus`, comentado no próprio código como escape hatch por a Lista de Contas a Pagar estar fora do conjunto de status modelado pela porta) — e deixa de fazer sentido no instante em que a Lista `901107637383` for arquivada. O NOVO endpoint de lançamento não deve escrever status em lugar nenhum; A8 (mudar para "lançado omie") é uma ação local do próprio motor de Automações, já modelada no seed como `acao(2, "tarefa.alterarStatus", ...)` dentro da MESMA versão de A7.
- **Cron do sistema operacional / `node-cron` para o gatilho por agenda:** é o antipadrão nomeado pelo ROADMAP ("sem fila, sem retry persistente: se o processo cair no minuto errado, o dia é pulado"). O `outbox-worker.ts` já prova o padrão certo: `setInterval` dentro do MESMO processo `apps/api`, ligado/desligado por env, com `for update skip locked` quando precisa de exclusão entre instâncias.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fila com retry e backoff para eventos que cruzam para o `automation/` | Um scheduler próprio com `setTimeout` manual | O `outbox`/`outbox-worker.ts` já existentes (Plan 02-10) | Já resolve lease (`for update skip locked`), backoff em escada com jitter, classificação transitório/permanente, sanitização de erro — reconstruir isso para AUTO-01 duplicaria ~230 linhas já testadas |
| Idempotência de execução de Automação agendada | Uma tabela nova de "próxima execução programada" com watermark | `AutomationExecution` já existente + a checagem `jaRodou` já em `runScheduledAutomations` | A idempotência por (automationId, taskId, dia civil) já está codificada e testada; um watermark separado adicionaria uma segunda fonte de verdade a manter sincronizada com a primeira |
| Feriados nacionais/bancários (D3-05, lacuna 1) | Tabela de feriados calculada à mão (ex.: algoritmo de Páscoa para Carnaval/Corpus Christi) dentro de `packages/dominio` | Se a decisão do Financeiro exigir feriados: uma dependência dedicada (`date-holidays` — ver Package Legitimacy Audit) OU uma tabela estática de datas fixas para os próximos 2-3 anos, mantida por dado, não por algoritmo | O cálculo de feriados móveis (Páscoa-relativos) é uma classe de bug conhecida (off-by-one em anos bissextos, fusos); um algoritmo hand-rolled dentro do domínio pesa contra o padrão de "poucas dependências, mas certeiras" que `packages/dominio` já segue (só `zod` hoje) |
| Idempotência do lançamento no Omie | Gerar `codigo_lancamento_integracao` com timestamp/random | Determinístico por Tarefa, no MESMO padrão que a Phase 2 (Plan 02-27) já construiu para Solicitações: `tria:payment-request:<origem>:<taskId>` → para Contas a Pagar, algo como `tria:contas-a-pagar:<taskId>` | `ConsultarContaPagar` antes de `IncluirContaPagar` só protege contra duplicidade se a chave for sempre a mesma para a mesma Tarefa; um `Date.now()` no meio (como o caminho legado do ClickUp ainda faz, preservado propositalmente) quebra isso |
| Resolução de categoria/conta do Omie | Reinventar uma tabela de-para nova na plataforma | `resolveCategoryCodeAgainstOmie` + `ListarCategorias`/`ListarDepartamentos`, já existentes em `automation/src/adapters/omie.ts` e `payment-automation-service.ts` | D3-02 já decidiu isso — gerar um segundo de-para cria uma cópia que diverge da primeira vez que alguém mudar o plano de contas no Omie |

**Key insight:** quase todo "hand-roll" que essa fase tentaria evitar já foi resolvido — ou pela Phase 2 (outbox, idempotência determinística, credencial de serviço) ou pelo próprio `automation/` legado (resolução de categoria contra o Omie real). O trabalho de AUTO-01 é majoritariamente **encanamento e extração**, não algoritmo novo — com a excepção real das duas lacunas de recorrência (feriado, dia inexistente no mês), que são as únicas peças onde um algoritmo genuinamente não existe ainda em lugar nenhum do código.

## Common Pitfalls

### Pitfall 1: Confundir o "evento de saída" do outbox com o motor de Automações
**What goes wrong:** tentar fazer A2/A3/A4/A9 passarem pelo outbox (`gravarEventos`), adicionando latência e complexidade onde já existia execução síncrona correta.
**Why it happens:** o próprio ROADMAP convida à pergunta ("a mesma peça de evento de saída?") e o outbox é o componente mais recente e visível de Phase 2.
**How to avoid:** o outbox só existe para sair do PROCESSO `apps/api` até o `automation/`. Uma Automação cujas ações são só `tarefa.*` (escrita local) nunca precisa cruzar esse limite — ela já roda dentro da Unidade de Trabalho corrente.
**Warning signs:** uma Automação "evento" que nunca aparece na tela até o próximo request — sinal de que foi implementada como assíncrona sem necessidade.

### Pitfall 2: Reusar `changeTaskStatus` para importação histórica
**What goes wrong:** A1 spawna recorrências fantasmas; A5/A6 comentam pedindo nota fiscal em Tarefas fechadas há mais de um ano; A9 adiciona Observadores retroativamente.
**Why it happens:** `importarSolicitacaoHistorica` (o precedente direto, Plan 02-22) usa esse padrão e funciona — mas só porque a Lista de Solicitações não tem NENHUMA Automação hoje. Copiar o padrão sem essa checagem quebra silenciosamente.
**How to avoid:** ver Pattern 3. Nunca chamar `changeTaskStatus` para replay; construir a Tarefa já no status final e as Atividades de histórico diretamente.
**Warning signs:** depois de importar, `state.tasks` cresce mais do que o número de linhas importadas (recorrências fantasmas), ou Tarefas fechadas ganham Comentários novos com data de hoje.

### Pitfall 3: Achar que a chamada real ao Omie pode continuar dentro de `packages/dominio`
**What goes wrong:** tentar fazer `runLancamentoAgent` chamar `fetch()` para o `automation/` diretamente — quebra a regra "domínio não conhece ninguém" e torna `packages/dominio` impossível de testar sem rede.
**Why it happens:** `runLancamentoAgent` já orquestra tudo hoje (comentário, execução, status) de forma síncrona e pura, porque o Omie é simulado. É tentador só "trocar a simulação por uma chamada real" no mesmo lugar.
**How to avoid:** a chamada de rede migra para `apps/api`; o domínio recebe o RESULTADO já pronto (via um parâmetro novo em `runLancamentoAgent` ou uma função irmã que aceita o de-para resolvido) e continua puro.
**Warning signs:** `packages/dominio` ganhando uma dependência de `fetch`/`http` ou de variável de ambiente — nenhuma das duas deveria aparecer lá (hoje só `zod`).

### Pitfall 4: Assumir que a Grant estática do seed é a "permissão real" da Pessoa da conta
**What goes wrong:** achar que PAG-06 "só precisa o backend aplicar" (como o ROADMAP resume) quando, na verdade, a Grant que faz `memberSeesTask` devolver `true` para a Pessoa da conta é criada UMA VEZ, à mão, no seed (`gr_cp_pessoa_${i+1}`) — nada cria essa Grant quando uma Conta nova é criada com o campo Pessoa preenchido em produção.
**Why it happens:** o enforcement em si (Phase 1, `guestFieldWriter`/`memberSeesTask`) está correto e já é aplicado de verdade pelo backend — é fácil confundir "o mecanismo de checagem funciona" com "a Grant é concedida automaticamente".
**How to avoid:** decidir explicitamente como a Grant nasce: (a) uma nova ação de Automação (ex.: `tarefa.compartilharComCampoPessoa`, simétrica a `tarefa.adicionarObservadores`) chamada por A9 ("Tarefa criada"), ou (b) mudar `memberSeesTask`/`grantsOn` no domínio para derivar a visibilidade diretamente do valor do campo Pessoa, sem Grant persistida. A opção (b) é mais robusta a troca de Pessoa no meio do caminho; a opção (a) é menor e mais parecida com o vocabulário de ações já existente.
**Warning signs:** teste manual: criar uma Conta a pagar nova com Pessoa = Thiago, logar como Thiago, ver se a Tarefa aparece. Sem a correção, ela não aparece.

## Code Examples

### `runListAutomations` chamado dentro de `changeTaskStatus` (evento, síncrono)
```typescript
// Source: packages/dominio/src/operations/tasks.ts, linhas 253-287 (código real do repositório)
task.statusId = target.id;
task.updatedAt = now();
if (concluiuAgora) { task.completedAt = now(); } else if (!isTerminalCategory(target.category)) { delete task.completedAt; }
recordActivity(state, { actor: memberActor(actingMemberId), action: "Status alterado", objectType: "task", objectId: task.id, objectName: task.title, before: before?.name, after: target.name });
runListAutomations(state, { kind: "tarefaEntrouEmStatus", taskId: task.id, statusId: target.id, ...(before ? { previousStatusId: before.id } : {}) });
if (concluiuAgora && task.recurrence?.triggerMode === "aoConcluir") {
  const next = spawnNextOccurrence(state, actingMemberId, task.id);
  // ...
}
```

### Transferência da regra de recorrência ao spawnar (prova real de RN-CP-06)
```typescript
// Source: packages/dominio/src/operations/collaboration.ts, linhas 493-498
next.recurrence = rule;                       // a NOVA Tarefa recebe a regra
state.tasks.push(next);
delete task.recurrence;                       // a Tarefa CONCLUÍDA perde a regra —
                                               // reabrir e concluir de novo não gera outra ocorrência
```

### `recordActivity` já aceita timestamp custom (base para importação histórica)
```typescript
// Source: packages/dominio/src/operations/activity.ts, linha ~100
export function recordActivity(state: DataState, input: RecordActivityInput): ActivityRecord {
  // ...
  at: input.at ?? new Date().toISOString(),
  // ...
}
```

### O formato exato do RESUMO (CON-CP-08), confirmado em dois lugares independentes
```text
// Source: docs/07-processos/contas-a-pagar.md §6.3 (spec lida da Lista real)
// e financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts::renderResumoComment (código em produção)
📋 RESUMO DE PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que pagar:    <nome>
Centro de custo: <centro>
Conta pagamento: <conta>
Categoria:      <categoria>
Código:         <código do plano de contas>

📅 Vencimento:        <dd/mm/aaaa>
📅 Previsão pagto:    <dd/mm/aaaa>
💰 Valor:             R$ <valor>

💳 Forma de pagamento:
  • Tipo: <forma>: <dado>

📝 Observações: <texto da regra usada para inferir conta/categoria>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que é e como será utilizado. Caso hajam parcelas, especifique aqui:
<descrição>
```
`packages/dominio/src/operations/financeiro.ts::buildResumoDePagamento` já produz este formato byte a byte (com dados fictícios) — é a peça pura a ser mantida, só trocando a origem do de-para.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Cron do `automation/` sem fila nem retry persistente | `outbox`/`outbox-worker.ts` com lease + backoff (Plan 02-10) | Phase 2 (2026-09) | É o precedente arquitetural que AUTO-01 deve seguir para o lado de agenda, adaptado (não copiado 1:1, porque o problema é distinto — ver Pattern 2) |
| `codigo_lancamento_integracao` com `Date.now()` | Determinístico por `origem:taskId`, com `ConsultarContaPagar` antes de incluir (Plan 02-27) | Phase 2 (2026-09) | O mesmo padrão vale para a chave de idempotência do lançamento de Contas a Pagar |
| Usuário humano "ADM Tria Company" publicando o Resumo à mão no ClickUp | Agente simulado (`runLancamentoAgent`) publicando comentário no protótipo | Antes desta fase | PAG-03 é o próximo passo: Agente publicando E lançando de verdade |

**Deprecated/outdated:**
- A leitura de `contasAPagarId`/`listContasPagarId` do `automation/` (env vars `CLICKUP_CONTAS_A_PAGAR_ID`, `CLICKUP_LIST_CONTAS_PAGAR_ID`) para escrever status em ClickUp fica sem função no dia em que a Lista `901107637383` for arquivada (critério 1) — ver Runtime State Inventory.

## Runtime State Inventory

> Esta fase envolve migração de dados (importação do ClickUp) e arquivamento de um sistema externo (a Lista `901107637383`). As cinco categorias abaixo foram verificadas explicitamente.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | ClickUp guarda 2.861 Tarefas na Lista `901107637383` (117 hoje em `para pagar`, 2.726 em `pago`, o resto em estágios intermediários) — todo esse dado precisa ser lido do EXPORT em disco (`apps/api/exportacoes/clickup/901107637383/`), não da API do ClickUp ao vivo, para a importação | Importação lê do export estático já feito (PREP-02); nenhuma nova chamada à API do ClickUp é necessária para PAG-01 |
| Live service config | `financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts` (linha ~1908) escreve o status "lançado omie" DIRETO no ClickUp via `legacyClickUpRaw().updateTaskStatus`, com `addAssignees` do usuário `CLICKUP_CONTAS_A_PAGAR_ID` — esse caminho fica sem função quando a Lista for arquivada, mas o código não é removido por esta fase (fora do território: pertence ao fluxo de Solicitação→Conta, ver Open Questions) | Nenhuma ação de código nesta fase; documentar como código morto-a-ser depois de Phase 3, e abrir a Open Question sobre quem cria a Conta a pagar quando uma Solicitação nova é aprovada (ver Open Questions) |
| OS-registered state | Nenhum cron de sistema operacional, PM2 job ou Task Scheduler específico de Contas a Pagar encontrado — a busca por `cron`/`node-cron`/`setInterval` em `automation/src` não achou nada ligado a Contas a Pagar (só a outros fluxos: sync semanal de clientes, relatório WhatsApp) | Nenhuma — confirma que AUTO-01 é greenfield também no lado operacional, não só no código |
| Secrets/env vars | `CLICKUP_LIST_CONTAS_PAGAR_ID` (default `901107637383`), `CLICKUP_CONTAS_A_PAGAR_ID` (default `81581816`), `MP_CLICKUP_CONTAS_A_PAGAR_ID`, `FO_CLICKUP_CONTAS_A_PAGAR_ID` — todas continuam válidas como env vars do `automation/` (não mudam de nome nem de valor); ficam sem uso funcional relevante para TRIA depois do arquivamento, mas D3-01 mantém o caminho FINQ e a Phase 5 usa as variantes MP/FO | Nenhuma mudança de nome ou de valor nesta fase |
| Build artifacts | Nenhum artefato de build específico de Contas a Pagar identificado (`apps/api` não tem build compilado comitado; `automation/` roda via `tsx`/build padrão) | Nenhuma |

**Nothing found in category:** "OS-registered state" e "Build artifacts" — verificado por grep em `automation/src` e por inspeção de `apps/api/package.json`/`automation/package.json`; nenhum cron, PM2 ecosystem file ou artefato compilado específico deste domínio existe hoje.

## Common Pitfalls

(ver seção acima — mantida junto por ordem de template)

## Open Questions

1. **Quem cria a Conta a pagar quando uma Solicitação nova é aprovada, depois do corte do ClickUp?**
   - What we know: hoje, uma Solicitação aprovada é sincronizada para uma NOVA Tarefa na Lista ClickUp de Contas a Pagar via `legacyClickUpRaw().updateTaskStatus`/`addAssignees` dentro de `payment-automation-service.ts`. O Status `convertida` da Lista de Solicitações (`solicitacao-de-pagamento.ts`) existe no catálogo mas seu código-fonte marca explicitamente: "`convertida`/`recebida`/`em validação` nesta fase é erro (D-14)" — ou seja, a conversão real Solicitação→Conta nunca foi construída, nem na Phase 2.
   - What's unclear: se PAG-01 só resolve o HISTÓRICO (Tarefas que já existiam), e a Lista ClickUp some no critério 1, o que acontece com uma Solicitação aprovada NO DIA SEGUINTE ao corte? Nada no REQUIREMENTS.md (PAG-01..06, SOL-01..09) parece cobrir explicitamente "criar a Conta a pagar em-plataforma a partir de uma Solicitação aprovada, dali para frente".
   - Recommendation: levar este gap ao Financeiro/dono do produto antes do planejamento; é provável que precise de uma nova operação pequena (`createPayableFromApprovedRequest` ou similar) fora do escopo nomeado de PAG-01..06, mas dentro do "critério 1: uma semana sem abrir o ClickUp" — sem ela, o Financeiro continuaria precisando do ClickUp para QUALQUER conta nova que vier de Solicitação.

2. **Feriado na recorrência (D3-05, lacuna 1)**
   - What we know: o export real do ClickUp tem pelo menos 4 Tarefas com vencimento em 2025-02-17 (segunda-feira de Carnaval — não é fim de semana), sem nenhum sinal de terem sido deslocadas. Mas são ocorrências isoladas (sem série mensal antes/depois na mesma Tarefa) — não há evidência de uma SÉRIE recorrente cruzando um feriado nacional nos dados exportados.
   - What's unclear: se a ausência de deslocamento é intencional (o processo real ignora feriados) ou coincidência (ninguém notou porque o campo é editado à mão).
   - Recommendation: checkpoint ao Financeiro, com as três opções que `03-CONTEXT.md` já enumera (nacional / nacional+bancário / ignorar) e o custo de cada: ignorar = zero código novo; nacional = tabela estática de ~12 datas/ano (viável hand-rolled, poucas datas, atualizada uma vez por ano); nacional+bancário = já justifica uma dependência (feriados bancários variam por praça e têm regra própria do Bacen).

3. **Dia inexistente no mês na recorrência (D3-05, lacuna 2)**
   - What we know: nenhuma série recorrente real no export cruza janeiro→fevereiro com vencimento no dia 29/30/31. As séries de dia alto encontradas (CSLL/IRPJ, dia 30-31) são de cadência TRIMESTRAL (impostos), não mensal, e nenhuma delas caiu especificamente em fevereiro dentro da janela exportada (2025-2026).
   - What's unclear: a regra real quando isso acontecer — a implementação atual de `addMonths` (`collaboration.ts:325-331`) já resolve isso de um jeito específico: `Math.min(dia, ultimoDiaDoMesDestino)` (ex.: 31/01 + 1 mês = 28/02, nunca 03/03) — ou seja, **o código já tem uma escolha implementada** (satura no último dia do mês, não transborda), só não foi confirmada como a intenção do produto.
   - Recommendation: checkpoint mais leve que o do feriado — o comportamento já existe e é razoável (a alternativa, transbordar para o mês seguinte, é o que MUITOS sistemas financeiros evitam por gerar cobrança "dupla" perto do fim do mês); recomendar CONFIRMAR o comportamento atual do código com o Financeiro, não necessariamente mudar nada.

4. **Onde exatamente mora o novo endpoint HTTP de lançamento em `automation/`?**
   - What we know: o padrão dos 7 métodos de Solicitação (`adapters/plataforma.ts`, contrato v1) é especificamente para o fluxo de Solicitação, com um contrato versionado (`docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`). O lançamento de Contas a Pagar é um fluxo DIFERENTE (parte de A7, não de SOL-05).
   - What's unclear: se este novo endpoint deve ser um 8º método do MESMO contrato v1, ou um contrato v2 dedicado a Contas a Pagar.
   - Recommendation: dado que D3-03 e PAG-03/04 são específicos de Contas a Pagar e não tocam Solicitação, um contrato/rota nova e nomeada explicitamente (`/v1/integrations/contas-a-pagar/lancar` ou similar) parece mais limpa que forçar o vocabulário dos 7 métodos existentes — mas é decisão de planejamento, não travada por nenhum documento.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Supabase `epomplsskqpluxuujpxl`) | Unit of Work, novo poller de Automações agendadas | ✓ (confirmado em fases anteriores) | 17 | — |
| `financeiro-tria/automation` rodando e acessível por HTTP | A7 (lançamento real), PAG-03/04 | ✓ (repositório presente em `../financeiro-tria`; endpoints HTTP existentes, mas o NOVO endpoint de lançamento de Contas a Pagar não existe ainda) | Express 4 + Mastra, Node 20 | Sem fallback — é a única via para o Omie real; Ensaio (D3-03) evita depender dele para nada além do cálculo na primeira semana |
| Export do ClickUp em disco | PAG-01 | ✓ | Exportado 2026-09-17, commit `d35183c0`, 2.861 Tarefas + 4.266 Comentários + `time-in-status` para todas | — |
| Credenciais Omie (TRIA) | PAG-03/04 lançamento real | Não verificado nesta pesquisa (fora do alcance de leitura de código; depende de `.env` do `automation/` em produção) | — | Ensaio (D3-03) não depende de escrita real; a Política de aprovação/lançamento real deve confirmar credenciais antes do fim da primeira semana |

**Missing dependencies with no fallback:** nenhuma bloqueia o INÍCIO do planejamento; a ausência do novo endpoint em `automation/` é trabalho desta fase, não uma dependência externa faltante.

**Missing dependencies with fallback:** nenhuma relevante além do já descrito.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`^5.0.0`, já em `packages/dominio` e `apps/api`) |
| Config file | `packages/dominio/vitest.config.mts`, `apps/api/vitest.config.mts` |
| Quick run command | `npm run test --workspace=@n1/dominio` (roda em memória, sem banco) |
| Full suite command | `npm run check` (tipos + lint + tokens + testes nos três workspaces; testes de persistência do `apps/api` pulam sem `DATABASE_URL`, DEC-09) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAG-01 | Tarefa importada preserva `date_created`/`date_closed`/histórico de status com data original | unit (domínio, puro) | `vitest run packages/dominio/src/operations/importacao.test.ts` (novo arquivo, paralelo a `importacao.ts` existente) | ❌ Wave 0 — criar `packages/dominio/src/operations/importacao-contas-a-pagar.ts` + teste |
| PAG-01 | "Tempo em para pagar" continua mensurável (29-31 dias) | unit (domínio) — calcular a partir dos Registros de Atividade importados | `vitest run` no mesmo arquivo acima | ❌ Wave 0 |
| PAG-02/A1 | Recorrência: uma ocorrência por fechamento, mesmo reabrindo (RN-CP-06) | unit (domínio) | `vitest run packages/dominio/src/operations/operations.test.ts -t "RN-CP-06"` | ✅ já existe (linha ~3665) |
| PAG-02/A2-A4,A9 | Automações de evento disparam corretamente | unit (domínio) | novo describe em `automations.test.ts` (verificar se já existe arquivo dedicado; hoje as automações são testadas dentro de `operations.test.ts`) | ⚠️ Wave 0 — confirmar se precisa de arquivo dedicado ou se estende `operations.test.ts` |
| PAG-02/A5-A7 | Automações de agenda disparam no dia certo e não repetem | unit (domínio, com `today` injetado) | `vitest run` — `runScheduledAutomations` já é testável com `today: Date` explícito, sem relógio real | ⚠️ Wave 0 — confirmar cobertura de "processo cai e retoma" (chamar duas vezes com o mesmo `today`) |
| AUTO-01 (scheduler) | Poller em `apps/api` chama pelo menos 1x/dia por Lista, mesmo após reinício | integration (contra Postgres real, com `Relogio` injetável — mesmo padrão de `outbox-worker.ts`) | novo `apps/api/src/automacoes/scheduler-worker.test.ts`, seguindo o padrão de `outbox-worker` (que já injeta `Relogio` e testa `backoff()`/`processarUm()` sem esperar tempo real) | ❌ Wave 0 |
| PAG-03/04 | Cálculo do lançamento (de-para real) separado da execução; Ensaio grava sem escrever no Omie | unit (domínio, `buildResumoDePagamento` parametrizada) + integration (com Omie falso, `automation/src/testing/omie-falso.ts` já existe) | `vitest run` (domínio) + `npm test` em `financeiro-tria/automation` (novo teste do endpoint de lançamento) | ⚠️ Wave 0 — `omie-falso.ts` já existe e é reusável; o novo endpoint e sua função de cálculo pura não |
| PAG-05 | Lote de 61 fechamentos, cada um dispara A1 | integration (contra Postgres real — mede tempo de lock, DEC-06) | novo teste em `apps/api`, medindo `console.time`/duração da transação com 61 Tarefas | ❌ Wave 0 |
| PAG-06 | Pessoa da conta só vê suas Tarefas, edita só Anexo/Data de Emissão | unit (domínio, já parcialmente coberto por `guestFieldWriter`) + novo teste de concessão dinâmica da Grant | `vitest run` | ⚠️ Wave 0 — cobertura da checagem existe; cobertura da CONCESSÃO dinâmica não, porque a concessão dinâmica ainda não existe em código |

### Sampling Rate
- **Per task commit:** `npm run test --workspace=@n1/dominio` (rápido, em memória)
- **Per wave merge:** `npm run check` (três workspaces, com `DATABASE_URL` setado localmente quando a wave tocar persistência)
- **Phase gate:** suite completa verde antes de `/gsd-verify-work`, incluindo os testes de `financeiro-tria/automation` que este plano tocar (`cd ../financeiro-tria/automation && npm test`)

**Risco de amostragem explícito:** A5 (D-5)/A6 (D-2)/A7 (D-1) disparam uma vez por dia civil — um teste que roda em 1 segundo não pode esperar um dia real. Solução já disponível no código: `runScheduledAutomations` recebe `today: Date` como parâmetro explícito (não lê `new Date()` internamente), então o teste injeta datas arbitrárias (`new Date("2026-08-31")`, depois `new Date("2026-09-01")`) para simular a passagem de dias sem esperar. O NOVO scheduler-worker de `apps/api` precisa do MESMO cuidado: seguir o padrão de `outbox-worker.ts`, que já aceita um `Relogio` injetável (`apps/api/src/testes/relogio.ts`) em vez de chamar `Date.now()`/`new Date()` direto — sem isso, testar "o processo caiu e retomou sem perder o dia" exigiria esperar tempo real.

### Wave 0 Gaps
- [ ] `packages/dominio/src/operations/importacao-contas-a-pagar.test.ts` (ou nome equivalente) — cobre PAG-01
- [ ] `apps/api/src/automacoes/scheduler-worker.test.ts` — cobre AUTO-01, seguindo o padrão de `outbox-worker.test.ts` (relógio injetável, `processarUm()` sem esperar `intervaloMs`)
- [ ] Teste do novo endpoint de lançamento em `financeiro-tria/automation` (Omie falso já existe em `automation/src/testing/omie-falso.ts` — reusar, não recriar)
- [ ] Teste de concessão dinâmica da Grant da Pessoa da conta — não existe hoje porque o mecanismo de concessão dinâmica também não existe

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não (esta fase não muda autenticação) | herda Supabase Auth já validado (Fase 1) |
| V3 Session Management | não | — |
| V4 Access Control | **sim** | `memberSeesTask`/Grant (já real desde Fase 1); PAG-06 precisa da concessão DINÂMICA da Grant da Pessoa da conta (ver Pitfall 4) — sem ela, V4 fica incompleto na prática mesmo com o mecanismo de checagem correto |
| V5 Input Validation | sim | `zod` nos esquemas de `apps/api/src/rotas/esquemas/` (padrão já em uso, CR-02 fechado na Fase 1); o novo endpoint em `automation/` também precisa de `zod` no corpo, seguindo o contrato v1 |
| V6 Cryptography | não (nenhuma chave/segredo novo nesta fase) | credenciais Omie continuam só em `.env` do `automation/` (D3-01 não altera isso) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Convidado (Pessoa da conta) vendo Tarefa de outro fornecedor por falta de concessão dinâmica correta (Pitfall 4) | Information Disclosure | Implementar a concessão (ou derivação) do campo Pessoa ANTES de abrir a tela ao primeiro fornecedor real; testar explicitamente "Pessoa A não vê Tarefa da Pessoa B" (não só "Pessoa A vê a própria") |
| Replay de importação criando Tarefas duplicadas se o CLI for executado duas vezes | Tampering (integridade de dado) | Mesmo padrão de `jaImportada()`/`importacao_ledger` já usado em SOL-09 (Plan 02-22/02-25) — reusar, não reinventar |
| Endpoint novo de lançamento em `automation/` chamado sem autenticação/idempotência | Tampering + Repudiation | Seguir o mesmo padrão de credencial de serviço (D-15, Phase 2) e `Idempotency-Key`/`codigo_lancamento_integracao` determinístico já usado pelo outbox e por 02-27 |
| Dado financeiro (CPF/CNPJ/chave Pix/valor) vazando em log de erro do novo scheduler | Information Disclosure | Reusar `sanitizarErro()` (`outbox-worker.ts`) — já filtra Bearer, CPF, CNPJ e URLs com query string; aplicar ao novo componente em vez de logar erro cru |

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` inclui `./CONTEXT.md` (mapa de camadas) e `./AGENTS.md` (aviso sobre o Next.js 16 fora do treinamento). Diretrizes acionáveis para esta fase:

- **A regra de dependência é estrita:** `apps/web` e `apps/api` dependem de `@n1/dominio`; nunca um do outro. Nenhuma recomendação desta pesquisa propõe uma seta `web → api` ou `dominio → api`/`web`.
- **Onde uma mudança nasce:** "o que a coisa é" (novo campo, nova regra, novo status) nasce em `packages/dominio`; "como se guarda ou se serve" nasce em `apps/api`. Isso implica: o novo tipo/campo para concessão dinâmica de Grant (Pitfall 4) e qualquer ajuste em `Automation`/`AutomationAction` (aguardar/notificar/solicitarAprovacao) nascem em `packages/dominio`; o scheduler-worker e a ponte HTTP para o `automation/` nascem em `apps/api`.
- **`apps/api` ainda é jovem:** a partir da Fase 1, verifica JWT do Supabase e resolve Membro por `userId` dentro do Espaço de Trabalho — qualquer novo componente (scheduler) precisa de um Ator de sistema, não de sessão de usuário (mesmo padrão da credencial de serviço da Phase 2, D-15).
- **`node_modules/next/dist/docs/`** — irrelevante para esta fase (não toca `apps/web` de forma significativa; PAG-05's UI de lote em `contas-view.tsx` já existe, só falta a versão persistida no backend).
- **Este arquivo é regravado por `next dev`** — não editar manualmente `AGENTS.md`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `date-holidays` e `date-fns` são os nomes corretos das bibliotecas relevantes para resolver feriados/dias úteis, caso D3-05 (lacuna 1) opte por uma dependência | Package Legitimacy Audit, Don't Hand-Roll | Baixo — a existência e os metadados foram confirmados via `npm view`/`gsd-tools query package-legitimacy check` nesta sessão; o risco é só de haver uma alternativa mais adequada não considerada, não de o pacote citado ser inexistente ou malicioso |
| A2 | O comportamento de `addMonths` (satura no último dia do mês, nunca transborda) é a intenção do produto para "dia inexistente no mês" (D3-05, lacuna 2), não apenas um acidente de implementação | Open Questions #3 | Médio — se o Financeiro esperar transbordo (31/01 → 03/03 em vez de 28/02), a recorrência gerará vencimentos "errados" silenciosamente até alguém notar |
| A3 | O gap "quem cria a Conta a pagar a partir de uma Solicitação aprovada, depois do corte" (Open Questions #1) não está coberto por nenhum requisito nomeado em PAG-01..06 ou SOL-01..09 | Open Questions #1, Summary | Alto se errado — se JÁ existir uma operação de conversão que esta pesquisa não encontrou (procurada só em `packages/dominio` e nos dois `automation/`/`payment-automation-service.ts`), o achado é redundante; se a pesquisa estiver certa e ninguém notar, o critério 1 (uma semana sem ClickUp) quebra na primeira Solicitação aprovada pós-corte |
| A4 | Nenhuma variante de `runAction`/`AutomationAction` fora de `automations.ts` implementa `aguardar`/`notificar`/`solicitarAprovacao` — a busca foi por `grep` em `packages/dominio/src/**/*.ts`, não exaustiva linha a linha em todo o pacote | R2, Standard Stack, Don't Hand-Roll | Baixo — se existir uma implementação em outro arquivo não encontrada, o trabalho de "wire" seria menor do que estimado, não maior |

**Se esta tabela estivesse vazia:** não está — as quatro entradas acima precisam de confirmação antes de planejar como decisão travada.

## Sources

### Primary (HIGH confidence — leitura direta de código no repositório real)
- `packages/dominio/src/operations/automations.ts` — executor de Automações completo (runAction, runListAutomations, runScheduledAutomations)
- `packages/dominio/src/operations/collaboration.ts` — `setRecurrence`, `shift`, `toBusinessDay`, `spawnNextOccurrence`, `nextOccurrenceRefusal`, `addMonths`
- `packages/dominio/src/operations/tasks.ts` — `changeTaskStatus`, `guestFieldWriter`, `guestStatusWriter`, `createTask`
- `packages/dominio/src/operations/importacao.ts` — `importarSolicitacaoHistorica` (o precedente direto para PAG-01)
- `packages/dominio/src/operations/financeiro.ts` — `buildResumoDePagamento`, `runLancamentoAgent`, `CATEGORIA_OMIE`/`CONTA_POR_TAG`/`CNPJ_POR_EMPRESA`
- `packages/dominio/src/operations/activity.ts` — `recordActivity` (`at` override), `nextId`, `syncIdSequence`
- `packages/dominio/src/types/ai.ts` (linhas 382-489) — `AutomationTrigger`, `AutomationAction`, `AutomationVersion`, `AutomationExecution`, `Automation`
- `packages/dominio/src/types/structure.ts` (linhas 288-309) — `RecurrenceRule`
- `packages/dominio/src/seed-financeiro.ts` — A2-A9 como dados de seed, `recorrente()`
- `packages/dominio/src/derive.ts` — `memberSeesTask`, `memberReachesContainer`
- `apps/api/src/persistencia/outbox.ts`, `outbox-worker.ts` — precedente de fila/lease/backoff, integralmente lidos
- `apps/api/src/index.ts` — como o worker é ligado hoje (só o outbox; nenhum scheduler existe)
- `apps/api/exportacoes/clickup/901107637383/` — export real (list.json, task/*.json, time-in-status/*.json), inspecionado com script Python ad-hoc nesta sessão
- `apps/api/exportacoes/MANIFESTO.md` — contagens reais da exportação
- `docs/07-processos/contas-a-pagar.md` — spec inteira lida, especialmente §6 (fluxo), §7 (recorrência), §8 (automações), §9 (agente), §10 (permissões), §11 (regras), §12 (lacunas)
- `../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts` — lido em profundidade (RESUMO, resolução de categoria, chamada IncluirContaPagar, escrita raw em ClickUp)
- `../financeiro-tria/automation/src/adapters/omie.ts` — `IncluirContaPagar`, `ConsultarContaPagar`, `ListarCategorias`, `ListarDepartamentos`
- `../financeiro-tria/automation/src/tenants/tria/payment-rules.ts` — `resolveAccountConfig`, `APPROVAL_ROUTES`
- `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-27-PLAN.md` — padrão de idempotência determinística e reconciliação (Ensaio da Phase 2)
- `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` — confirma OQ-CMP-03 (Departamento Omie falta na plataforma) e o estado real do de-para

### Secondary (MEDIUM confidence)
- `gsd-tools query package-legitimacy check --ecosystem npm date-holidays date-fns` — metadados de registry confirmados por ferramenta, mas a ESCOLHA dos nomes de pacote vem de conhecimento de treinamento (sem busca web habilitada nesta sessão)

### Tertiary (LOW confidence)
- Inferência sobre datas de feriado a partir de 4 ocorrências isoladas no export (sem série mensal comprovada cruzando o feriado) — tratada como evidência fraca, não como resposta, e devolvida como checkpoint

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma lib nova necessária; o que existe foi lido diretamente do código
- Architecture (motor de Automações): HIGH — o comportamento de evento/agenda já existe como função pura testável; a lacuna é só "quem chama" e "como cruzar para o `automation/`", ambas respondidas com precedente direto (outbox, Plan 02-27)
- Importação histórica: HIGH — precedente direto lido por inteiro, gap real identificado (changeTaskStatus não serve para replay)
- Agente/Omie real: MEDIUM-HIGH — a arquitetura de separação está clara; o ponto de maior incerteza é a forma exata do novo endpoint em `automation/` (não travada por nenhum documento)
- Permissão da Pessoa da conta: HIGH — mecanismo de checagem lido por completo; gap de concessão dinâmica confirmado por ausência de qualquer código que crie Grant fora do seed
- Recorrência (feriado/dia inexistente): MEDIUM — código lido por completo; dados reais insuficientes para responder as duas lacunas, como o `03-CONTEXT.md` já previa

**Research date:** 2026-09-22
**Valid until:** ~30 dias (o domínio é estável — código próprio, sem framework externo mudando de versão) — exceto a decisão de feriados/dia-31, que expira no instante em que o Financeiro responder o checkpoint
