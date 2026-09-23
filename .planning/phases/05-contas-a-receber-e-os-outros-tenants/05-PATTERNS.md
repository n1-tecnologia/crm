# Phase 5: Contas a receber e os outros tenants - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 16 (agrupados por TEN-01, AUTO-02, REC-01)
**Analogs found:** 13 / 16 (3 sem analogo direto — ver seção dedicada)

**Aviso estrutural — leia antes do resto.** Esta fase é majoritariamente
COSTURA. Vários "arquivos a criar" listados abaixo **já existem em produção**
e a ação certa não é escrevê-los do zero. Classifico cada linha como
**NOVO**, **CRESCE** (arquivo existente ganha um caso/ramo/campo) ou **JÁ
FEITO** (nenhuma ação de código — só verificação/leitura). Um plano que trata
"JÁ FEITO" como greenfield reescreve produção e é o principal modo de falha
apontado pelo orquestrador.

---

## File Classification

| Arquivo (novo/tocado) | Estado | Role | Data Flow | Analogo mais próximo | Match |
|---|---|---|---|---|---|
| Evolver de config por Empresa (Campo `Empresa` + 5º Status + Integração) | **NOVO** | evolver de domínio | CRUD idempotente | `packages/dominio/src/solicitacao-de-pagamento-evolver.ts` | exato |
| `packages/dominio/src/seed-financeiro.ts` (Campo Empresa ganha "Marcos Paulo" + rótulo FINQ/Konq) | **CRESCE** (só o catálogo-fonte; produção precisa do evolver acima para refletir) | seed/config | CRUD | ele mesmo (arquivo já existe, 11 opções) | exato |
| `packages/dominio/src/seed-contas-a-receber.ts` | **JÁ FEITO** (em produção via `bootstrap-gestao.ts:191`, `{fixtures:false}`) — só avaliar Campo "Contrato" de §9 se realmente faltar após a conferência de D5-02b | seed/config | CRUD | — (é ele mesmo) | — |
| `packages/dominio/src/types/workspace.ts` — `Integration` (campo de config por Empresa) | **CRESCE** (extensão de tipo, se o planner escolher esse mecanismo — discretion aberta) | model/type | CRUD | trecho já lido, linhas 182-194 abaixo | role-match |
| `packages/dominio/src/operations/automations.ts` — `case "notificar"` (ramo canal) | **CRESCE** | service/executor | event-driven | ele mesmo, linhas 306-317 (comentário "Por Canal é Phase 5" marca o ponto) | exato |
| `apps/api/src/persistencia/outbox.ts` — `EVENTOS["automacao.notificar-canal.v1"]` | **CRESCE** | schema/config | event-driven | os 3 tipos existentes, linhas 32-53 | exato |
| `apps/api/src/persistencia/outbox-worker.ts` — `CAMINHO_POR_EVENTO` | **CRESCE** | worker | event-driven | ele mesmo, linha 63 (mapa) + `sanitizarErro` linha 107 | exato |
| `apps/api/src/automacoes/scheduler-worker.ts` — `catalogoDeListasComAgenda` | **JÁ FEITO** (descoberta é dinâmica por SQL; nenhum código novo necessário) — só acrescentar teste cobrindo `CR.listId` | worker | batch/scheduled | ele mesmo, linhas 245-271 | — |
| `apps/api/src/bootstrap/` — evolver de reconciliação de `ws_n1` (Wave 0, read-only) | **NOVO** (script/checkpoint, não necessariamente evolver que grava) | script/checkpoint | request-response (leitura) | molde: qualquer leitura read-only já existente em `apps/api/src/automacoes/` | parcial |
| `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` (tenantId hardcoded → payload/Task) | **CRESCE** | route/controller | request-response | ele mesmo, linha 347 (o hardcode a remover) | exato |
| `../financeiro-tria/automation/src/http/routes.ts` — `pickService` | **JÁ FEITO** (referência do padrão antigo sendo substituído, não é para editar além do necessário) | route/controller | request-response | ele mesmo | — |
| `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` (nova rota do canal) | **NOVO** | route/controller | request-response | `../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts` | exato |
| `../financeiro-tria/automation/src/adapters/evolution.ts` | **JÁ FEITO** (sem mudança — `EvolutionAdapter.sendText` já pronto) | adapter | request-response | — (é ele mesmo) | — |
| `packages/dominio/src/operations/importacao-contas-a-receber.ts` (`importarContaAReceberHistorica`) | **NOVO** | service/operation | batch/import | `packages/dominio/src/operations/importacao-contas-a-pagar.ts` (`importarContaAPagarHistorica`, linha 136) | exato |
| `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx` (preview da série, erro de data inválida) | **CRESCE** | component | request-response (form) | ele mesmo — já existe, formulário completo | exato |
| `apps/web/src/features/estrutura/financeiro/contas-view.tsx` (Contas a receber reusa `FinanceToolbar`) | **JÁ FEITO** para o filtro por Empresa (dinâmico); **CRESCE** só se Contas a receber precisar de uma instância nova da toolbar apontando para a nova Lista | component | request-response | ele mesmo, linhas ~219-335 | exato |
| `apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx` (linhas Empresa/Conta Omie/rotação + cartão "sem Integração") | **CRESCE** | page/component | request-response | ele mesmo, linhas 1-50 lidas abaixo | exato |
| `design/components.tsx` — `StatusPicker` `optionBlockReason` | **JÁ FEITO** (prop já existe) — só o cálculo de quando bloquear é novo, e mora em quem chama o componente, não no componente | component (prop existente) | request-response | `design/components.tsx:1221` | — |
| `design/components.tsx` — `ActivityTimeline` / `recordActivity` (Execução de notificar-por-Canal) | **JÁ FEITO** (componente e helper já existem) — só o `ActivityEntry` novo (texto/detail) é acrescentado por quem chama | component (existente) | event-driven | precedente Fase 3: `recusar()` que gera `ActivityEntry` em vez de escrita de Tarefa | exato |

---

## Pattern Assignments

### 1. Evolver de configuração por Empresa (TEN-01) — NOVO

**Analogo:** `packages/dominio/src/solicitacao-de-pagamento-evolver.ts` (Plan 02-08)

**Cabecalho/doutrina a copiar** (comentario do arquivo, integral):
```typescript
/**
 * Evolver idempotente de configuração: transforma um CATALOGO numa Lista de
 * verdade no `DataState` — a peça que falta porque `bootstrapGestao()`
 * só grava em Espaço vazio (`count(*) > 0` recusa) e não serve para
 * acrescentar algo a um Espaço "Gestão" que já opera em produção.
 *
 * Regra central — criar-ou-conferir, nunca substituir:
 *   - id do catálogo ausente no estado → cria;
 *   - id do catálogo presente no estado → compara campo a campo; qualquer
 *     divergência é reportada, nunca sobrescrita;
 *   - id presente no estado mas ausente do catálogo → reportado como
 *     divergência, nunca removido.
 *
 * Três regras duras:
 *   1. NUNCA remove nada.
 *   2. NUNCA toca `state.tasks` nem Comentário/valor de Campo já gravado.
 *   3. Ids são sempre os literais do catálogo, nunca gerados por sequência.
 */
```

**Imports** (linhas 27-38):
```typescript
import { CP } from "./operations/financeiro";
import { memberActor, nextId, recordActivity } from "./operations/activity";
import {
  CATALOGO_SOLICITACAO_DE_PAGAMENTO,
  SOL,
  type CampoDaSolicitacao,
  type PapelDaSolicitacao,
} from "./solicitacao-de-pagamento";
import { fail, ok, type DataState, type OperationResult } from "./state";
```

**O que copiar para esta fase:** o mesmo molde serve para três coisas
diferentes — (a) acrescentar "Marcos Paulo" e o rótulo FINQ/Konq às opções do
Campo `Empresa` (`fd_cp_empresa`, hoje 11 opções, em `seed-financeiro.ts`);
(b) acrescentar o 5º Status `em revisão` ao `statusSet` de Solicitações sem
tocar os 4 já travados por D-01; (c) reconciliar `ws_n1` com
`seed-contas-a-receber.ts` atual (Wave 0, read-only antes de qualquer
escrita — ver Open Question 2 do RESEARCH). Retorna `OperationResult<Diff>`
igual ao molde: sucesso ou `fail` com diff legível, nunca escrita parcial.

---

### 2. `Integration` — extensão de tipo para config por Empresa

**Estado atual, lido diretamente** (`packages/dominio/src/types/workspace.ts:182-194`):
```typescript
export interface Integration {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly name: string;
  readonly systemType: string;
  state: "conectada" | "desconectada" | "comErro";
  /** B35 — traceability, never governance. There is no Proprietário. */
  configuredBy: Id;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
  /** Derived catalogue: identifiers of the tools it exposes. */
  readonly exposedTools: readonly string[];
}
```

**Confirmação do achado do RESEARCH (A1): não há campo de configuração
estruturada hoje.** Se o planner escolher o mecanismo "Integração" (D5-03,
discretion aberta), este tipo precisa crescer com algo como
`empresaId?: Id` + um bloco `omie?: { contaLabel: string; categoryBank?:
string; ultimaRotacao?: Instant }` — nunca `appKey`/`appSecret`. A UI-SPEC §2
já assume essa forma ("Conta Omie: {rótulo estável}", "Banco de categorias",
"Última rotação") e não muda seja qual for o mecanismo de armazenamento
escolhido, contanto que a leitura seja "Empresa → rótulo, situação, data".

**Alternativa não escolhida por padrão, mas legítima:** Campos de
configuração na Lista/Espaço, reusando `FieldDefinition`/`FieldValue` —
evita extensão de tipo, mas mistura "config de sistema" com "dado de
negócio" (RESEARCH, tabela "Alternatives Considered"). Documentar a escolha
explicitamente no plano.

---

### 3. `case "notificar"` — ramo de Canal (AUTO-02)

**Analogo:** `packages/dominio/src/operations/automations.ts`, linhas 306-317

```typescript
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
  if (!r.ok) return { ok: false, output: r.error };
  return { ok: true, output: `Notificados: ${alvos.map((id) => state.members.find((m) => m.id === id)?.displayName ?? id).join(", ")}` };
}
```

**O que copiar:** o comentário "Por Canal é Phase 5" é literalmente o ponto
de extensão marcado pelo autor original. O padrão de recusa visível
(`{ ok: false, output: "..." }` com aspas curvas + motivo explícito) é o
mesmo que D5-10 exige para o Campo `Z WhatsApp` vazio — não inventar um novo
formato de mensagem de erro. **Regra D3-02 inegociável:** o domínio nunca faz
I/O — o ramo novo deve produzir um pedido/estado (para `opcoes.eventos`
gravar via outbox), nunca chamar `fetch` aqui.

---

### 4. Evento novo no outbox (`EVENTOS`) — AUTO-02

**Analogo:** `apps/api/src/persistencia/outbox.ts`, linhas 1-53

```typescript
export const EVENTOS = {
  "solicitacao.criada.v1": z
    .object({
      taskId: z.string(),
      readableId: z.string(),
      listId: z.string(),
      origin: z.literal("plataforma"),
    })
    .strict(),
  // ... "solicitacao.comentario-criado.v1", "solicitacao.aprovacao-decidida.v1"
} as const;
```

**Doutrina a preservar (comentário de cabeçalho do arquivo, verbatim):**
> "`EVENTOS` fecha o payload de cada tipo com `.strict()` de propósito: um
> campo a mais no objeto passado para `gravarEventos` lança em vez de ser
> silenciosamente descartado. O payload é deliberadamente pobre — só ids e
> metadados que identificam o agregado, nunca valor monetário, documento,
> chave Pix ou URL assinada."

**Novo entry a acrescentar** (forma, não literal): `"automacao.notificar-canal.v1": z.object({ taskId: z.string(), automationId: z.string(), executionId: z.string(), fieldDefinitionId: z.string() }).strict()` — **nunca** o número de telefone nem o texto da mensagem (Pitfall 3 do RESEARCH: não inflar um evento existente, criar um novo).

**`apps/api/src/persistencia/outbox-worker.ts`** — `CAMINHO_POR_EVENTO` (linha 63) é um `Record<NomeDeEvento, string>`: acrescentar `"automacao.notificar-canal.v1": "/webhooks/plataforma/notificar-canal"`. `sanitizarErro()` (linha 107) já redige Bearer/CNPJ/CPF/URL — reusar sem reescrever.

---

### 5. Rota nova em `automation/` para o canal — AUTO-02

**Analogo:** `../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts`

**Doutrina de cabecalho a seguir (comentario do proprio arquivo):**
> "Ordem obrigatória em cada handler: 1) Autenticar `Authorization: Bearer`
> em tempo constante — ANTES de qualquer leitura do corpo. Sem token ou
> token errado → 401. 2) `Idempotency-Key`. 3) Corpo contra o schema `zod`
> (`.strict()`) — forma desconhecida → 400. 4) Executar."
>
> "Reusa a DISCIPLINA de `webhooks-plataforma.ts`... mas recria as ~40
> linhas (`digestoConstante`/`credenciaisIguais`/`extrairBearer`/
> `lerCorpoBruto`/`requestIdDe`/`responderErro`) em vez de importá-las:
> importar acoplaria esta superfície NOVA ao módulo do contrato v1."

**Imports** (linhas 38-52):
```typescript
import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { z } from "zod";
import { optionalEnv } from "../adapters/env";
```

**O que copiar:** a MESMA disciplina (Bearer em tempo constante, corpo
`.strict()`, `MENSAGENS_FIXAS` própria, nunca `pg.message`/stack/eco do
corpo) — mas o código de auth é **recriado**, não importado, seguindo a
decisão já travada de que superfícies novas não acoplam ao módulo do
contrato v1. `Idempotency-Key` = `id` da linha do outbox (mesmo padrão dos
outros 3 eventos).

---

### 6. Roteamento de tenant por payload — `webhooks-plataforma.ts`

**O hardcode a remover** (linha 347, confirmado por leitura direta):
```typescript
return res.status(202).json({ accepted: true, event: eventType, tenantId: "tria", taskId: evento.taskId, resultado: resultadoServico });
```

**O que muda:** `tenantId: "tria"` precisa vir do payload/Task em vez de
literal. `resolveAccountConfig` (analogo funcional em
`family-office/payment-rules.ts`, mesmo padrão em `tria/payment-rules.ts`)
já resolve nome de Empresa → credencial; o que falta é QUEM decide
`empresaName` — hoje vem do path (`pickService` em `routes.ts`), amanhã
precisa vir do Campo `Empresa` da Tarefa (buscado via `getTask`, nunca
confiado cegamente no payload — Threat Pattern "Tenant spoofing" do
RESEARCH). `pickService(req)` em `routes.ts` é o padrão antigo sendo
substituído — não editar além do necessário para provar o contraste.

---

### 7. `EvolutionAdapter` — sem mudança, só uso

**Ja pronto** (`../financeiro-tria/automation/src/adapters/evolution.ts`, linhas 1-60):
```typescript
export class EvolutionAdapter {
  constructor(options: EvolutionAdapterOptions = {}) { /* baseUrl, apiKey, instance via env */ }
  async sendText(to: string, text: string, options: { delay?: number; mentions?: string[] } = {}): Promise<Record<string, unknown>> {
    // POST {baseUrl}/message/sendText/{instance}
  }
}
```
A rota nova (item 5) instancia e chama `sendText` — nenhuma mudança no
adapter em si.

---

### 8. `importarContaAReceberHistorica` — NOVO, molde travado

**Analogo:** `packages/dominio/src/operations/importacao-contas-a-pagar.ts`, `importarContaAPagarHistorica` (linha 136) + `importacao-contas-a-pagar.test.ts`.

**Regra a copiar literalmente (do CONTEXT/RESEARCH, confirmada pelo nome da função irmã):** a importação usa `recordActivity` com o `at` original das 240 Tarefas — **nunca** `changeTaskStatus`, para que nenhuma Automação (R2-R6) dispare no replay. Ledger transacional idempotente (molde de 03-10). D5-14 (saque exige Valor > 0) e D5-18 (duplicatas/subtarefa) entram como lacunas registradas dentro desta mesma operação, seguindo D-25 ("nunca dado inventado").

**Teste a espelhar:** `importacao-contas-a-pagar.test.ts` linhas 29/84/98/112 — mesma estrutura de describe/casos (Tarefa nasce no Status final sem side-effect de Automação).

---

### 9. `serie-dialog.tsx` — o que já existe e o que cresce

**Já implementado, confirmado por leitura:**
- `confirmDisabledReason` (linha 91) — botão nunca desliga sem dizer por quê.
- Total em `.app-numero`, `fontWeight: 600` (linhas 162-163):
```tsx
<strong className="app-numero" style={{ color: "var(--texto)", fontWeight: 600 }}>
  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
</strong>
```
- Cálculo do total (linha 83): `const total = (valorEntrada ?? 0) + (valorParcela > 0 && parcelas > 0 ? valorParcela * parcelas : 0);`

**O que a UI-SPEC pede acrescentar (não reescrever):** lista de preview
(padrão `RecordRow`, uma linha por parcela) inserida ANTES do bloco de
total, mais o erro client-side de "Vencimento inválido" usando o MESMO
mecanismo `confirmDisabledReason` — não um componente de erro novo. Erro de
série duplicada já é tratado por `result.error` vindo verbatim de
`createReceivableSeries` — nenhuma mudança aí.

---

### 10. `contas-view.tsx` — `FinanceToolbar`, filtro dinâmico já pronto

**Confirmado por leitura** (linhas 219-240, assinatura da função):
```typescript
export function FinanceToolbar({
  listId, profile, filters, onFilters, onOpenFilters,
  filtrosAvancados, selecionando, onToggleSelecionar, report,
}: { /* ... */ }) {
  const state = useData((data) => data);
  // lê state.fieldDefinitions.find(d => d.id === CP.fields.empresa)?.options dinamicamente
}
```
**Nenhum código novo necessário** para o filtro por Empresa em si — quando o
Campo ganhar "Marcos Paulo"/FINQ, filtro, chip e coluna crescem sozinhos.
Contas a receber reusa a MESMA `FinanceToolbar` (não uma tela paralela),
instanciada com o `listId` da Lista "Contas a receber" — isso é o único
ponto de "código a escrever" (uma chamada a mais, não um componente novo).

---

### 11. `configuracoes/integracoes/page.tsx` — cartão por Empresa

**Estado atual confirmado** (linhas 1-50):
```tsx
"use client";
import { useData } from "@/dados/store";
import { ConditionMarker, CorpoDeTela, EmptyState, PageHeader, Pilula, Section } from "@/features/shell/ui";

const STATE_LABEL: Record<string, string> = { conectada: "conectada", desconectada: "desconectada", comErro: "com erro" };

export default function IntegracoesPage() {
  const state = useData((data) => data);
  const integrations = state.integrations;
  const broken = integrations.filter((integration) => integration.state !== "conectada");
  // PageHeader + aviso "X Integração(ões) fora do ar" + grid de cartões
}
```
**O que cresce:** hoje itera só `state.integrations` — uma Empresa sem
Integração correspondente não aparece. A UI-SPEC §2 pede iterar as opções do
Campo `Empresa` também, renderizando um cartão `ConditionMarker
tone="warning"` + `EmptyState compact` para cada Empresa sem `Integration`.
Reusa `Pilula`/`ConditionMarker` já importados — nenhum componente novo.

---

## Shared Patterns

### Evolver idempotente (criar-ou-conferir, nunca sobrescrever)
**Fonte:** `packages/dominio/src/solicitacao-de-pagamento-evolver.ts`
**Aplicar a:** Campo `Empresa` (Marcos Paulo/FINQ), 5º Status `em revisão`, reconciliação de `ws_n1` contra `seed-contas-a-receber.ts`.
Regra dura: NUNCA remove nada; divergência é sempre `fail` com diff legível, nunca escrita silenciosa.

### Payload de evento "pobre" + busca autenticada de volta
**Fonte:** `apps/api/src/persistencia/outbox.ts` (doutrina de cabeçalho)
**Aplicar a:** `automacao.notificar-canal.v1` — nunca carregar telefone/texto; `automation/` busca via `getTask`.

### Disciplina de rota nova autenticada (recriar, não importar)
**Fonte:** `../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts`
**Aplicar a:** rota nova do canal WhatsApp — Bearer em tempo constante recriado localmente, `.strict()`, `MENSAGENS_FIXAS` próprias.

### Domínio nunca faz I/O (D3-02)
**Fonte:** doutrina já travada em Fase 3 (A7/A8/03-11), reafirmada em `automations.ts`
**Aplicar a:** `case "notificar"` ramo canal — produz pedido/evento, nunca `fetch`.

### Recusa vira Registro de Atividade, nunca Comentário fantasma
**Fonte:** precedente Fase 3 (`recusar()` — recusa de Agente vira passo de raciocínio, não escrita de Tarefa)
**Aplicar a:** Execução de notificar-por-Canal com Campo vazio — `recordActivity`, `ActivityTimeline` já genérico, sem componente novo.

---

## No Analog Found / Genuinamente Novo

| Arquivo | Role | Data Flow | Motivo |
|---|---|---|---|
| Script/checkpoint de leitura read-only de `ws_n1` (Wave 0 de REC-01) | script | request-response (leitura) | Nenhum precedente de "script de verificação contra produção" foi lido nesta pesquisa; usar qualquer query direta via `pool()` no molde de `scheduler-worker.ts`, sem escrita |
| Cálculo de "esta Empresa alcança `em revisão`?" para `optionBlockReason` | lógica de apresentação (quem chama `StatusPicker`) | request-response | `StatusPicker` já aceita a prop; o CÁLCULO (ler condição `valorDeCampo` da Automação publicada e comparar com a Empresa da Tarefa) é novo — não há função pronta para isso hoje, é combinação de Pattern 2 (R6) do RESEARCH com leitura de `state.automations` do lado do cliente/servidor (decidir onde no plano) |
| Superfície Omie `ListarContasReceber` (ramo espelho, NÃO-default) | adapter | request-response | `adapters/omie.ts` tem zero chamadas de Contas a receber (`grep -c "Receber"` = 0, confirmado no RESEARCH); só relevante se D7 escolher o ramo espelho, que é explicitamente o ramo NÃO-default de D5-02 — não planejar por padrão |

---

## Open Questions do RESEARCH que o planner NÃO deve responder sozinho

1. **Campo `Z WhatsApp` vs. números fixos (Mari/Marcos/grupo financeiro).**
   Nenhum Campo hoje corresponde ao dado real que MP notifica. Decisão de
   plano explícita necessária: Campo novo por Empresa/Automação vs. números
   como `params` da Automação/config da Empresa. Ver RESEARCH "Pitfall 2".
2. **Drift de `ws_n1` desde o bootstrap.** Não verificado nesta pesquisa (sem
   `DATABASE_URL`). Wave 0 de REC-01 deve ser essa leitura, antes de
   qualquer escrita — evolver só entra em jogo SE houver divergência real.
3. **Evento existente pode ganhar campo novo, ou só evento novo?** Tratado
   como resolvido nesta pesquisa (Pitfall 3): a opção segura é sempre criar
   um evento novo (`automacao.notificar-canal.v1`), nunca inflar
   `solicitacao.criada.v1`. O planner deve seguir essa opção, não reabrir o
   debate.

---

## Metadata

**Analog search scope:** `packages/dominio/src/`, `apps/api/src/`,
`apps/web/src/features/estrutura/financeiro/`,
`apps/web/src/app/(shell)/configuracoes/`, `../financeiro-tria/automation/src/http/`,
`../financeiro-tria/automation/src/adapters/`, `../financeiro-tria/automation/src/tenants/`.
**Files scanned:** ~20 (leitura direta, sem re-leitura de faixas repetidas)
**Pattern extraction date:** 2026-09-23
