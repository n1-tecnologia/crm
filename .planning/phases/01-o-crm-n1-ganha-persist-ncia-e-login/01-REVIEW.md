---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
reviewed: 2026-09-17T14:03:22Z
depth: standard
round: 2
supersedes: 01-REVIEW.md de 2026-09-16T20:03:40Z (rodada 1 — CR-01/CR-02 primeira passada)
files_reviewed: 34
files_reviewed_list:
  - apps/api/src/rotas/CONTEXT.md
  - apps/api/src/rotas/esquemas-de-argumentos.test.ts
  - apps/api/src/rotas/esquemas-de-argumentos.ts
  - apps/api/src/rotas/esquemas/CONTEXT.md
  - apps/api/src/rotas/esquemas/automacoes.ts
  - apps/api/src/rotas/esquemas/colaboracao.test.ts
  - apps/api/src/rotas/esquemas/colaboracao.ts
  - apps/api/src/rotas/esquemas/configuracao.test.ts
  - apps/api/src/rotas/esquemas/configuracao.ts
  - apps/api/src/rotas/esquemas/construtor-de-agentes.test.ts
  - apps/api/src/rotas/esquemas/construtor-de-agentes.ts
  - apps/api/src/rotas/esquemas/contatos.test.ts
  - apps/api/src/rotas/esquemas/contatos.ts
  - apps/api/src/rotas/esquemas/conversas.test.ts
  - apps/api/src/rotas/esquemas/conversas.ts
  - apps/api/src/rotas/esquemas/escala.test.ts
  - apps/api/src/rotas/esquemas/escala.ts
  - apps/api/src/rotas/esquemas/estrutura.test.ts
  - apps/api/src/rotas/esquemas/estrutura.ts
  - apps/api/src/rotas/esquemas/financeiro.ts
  - apps/api/src/rotas/esquemas/fragmentos.ts
  - apps/api/src/rotas/esquemas/ia.test.ts
  - apps/api/src/rotas/esquemas/ia.ts
  - apps/api/src/rotas/esquemas/membros.test.ts
  - apps/api/src/rotas/esquemas/membros.ts
  - apps/api/src/rotas/esquemas/negocios.test.ts
  - apps/api/src/rotas/esquemas/negocios.ts
  - apps/api/src/rotas/esquemas/pastas-de-chat.test.ts
  - apps/api/src/rotas/esquemas/pastas-de-chat.ts
  - apps/api/src/rotas/esquemas/planejamento.test.ts
  - apps/api/src/rotas/esquemas/planejamento.ts
  - apps/api/src/rotas/esquemas/tarefas.ts
  - apps/api/src/rotas/operacoes.test.ts
  - apps/api/src/rotas/operacoes.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Fase 01: Relatório de Revisão de Código — rodada 2 (fechamento de CR-02, Plans 01-12..01-16)

**Revisado em:** 2026-09-17T14:03:22Z
**Profundidade:** standard
**Arquivos revisados:** 34 (delta `c6f0d1c^..6d3103d`, só `apps/api/src/rotas/`)
**Status:** issues_found

> Este arquivo **substitui** o `01-REVIEW.md` da rodada 1 (2026-09-16T20:03:40Z). Os IDs CR-01..CR-02, WR-01..WR-11 e IN-01..IN-11 referem-se àquela rodada; o status atualizado de cada um que esta rodada toca está na tabela abaixo. Os que não são citados (WR-01, WR-03..WR-09, IN-01, IN-03..IN-09) continuam com o status da rodada 1: os arquivos não mudaram neste delta. Os IDs novos desta rodada começam em WR-12 / IN-12.

## Sumário

O delta revisado é a segunda rodada de CR-02: o fallback estrutural `ARGUMENTOS_GENERICOS` foi removido e as 132 operações de `OPERACOES` ganharam schema zod próprio, em 15 arquivos por módulo (`esquemas/<modulo>.ts`) compostos em `esquemas-de-argumentos.ts` sob `satisfies EsquemasCompletos`. `operacoes.ts` deixou de mapear `TypeError → 400` (WR-11) e captura `RangeError` de `reviverArgumentos` (WR-10).

**O que conferi e está certo.** (1) Os 132 schemas batem, campo a campo e posição a posição, com as assinaturas reais em `packages/dominio/src/operations/*.ts` — inclusive os tipos importados (`CreateTaskInput`, `UpdateTaskInput`, `SendMessageInput`, `ImportRow`, `AgentDraft`, `SaveViewInput`, `GoalInput`, `FormInput`, `ReceivableSeriesInput`, `StatusSet`, `RecurrenceRule`). `Object.keys(ESQUEMAS).length === 132 === Object.keys(OPERACOES).length`; a soma dos módulos (20+1+2+12+11+17+7+4+2+14+9+11+14+5+3) dá 132. (2) **Todo** objeto é `.strict()` — contei `.object(` vs `.strict()` por arquivo; a única exceção é `INVITE_MEMBER_INPUT` (`.strip()`, T-1-08), como documentado. Nenhum `z.any`, `z.unknown`, `z.record`, `.passthrough()`, `.loose()`. (3) `opcional()` só aparece em posição posicional final cujo tipo não admite `null` (`moveTask`, `convertChecklistItem`, `migrateDealsToFunnel`, `moveDealToFunnel`, `assignConversation`, `moveConversationToContact`, `setContactCatalogValue`, `decideApproval`, `removeStatus`, `stopTimer`, `instantiateTaskTemplate`, `transferWorkspaceOwnership`); `.nullable()` só onde o domínio trata `null` como valor (`UpdateTaskInput.startDate/dueDate/estimate`, `configureChatSession`, `moveChatSessionToFolder`, `setContainerFeature`, `setRecurrence`). Verifiquei em runtime (zod 4.6.5) que a tupla com `opcional()` no fim aceita entrada mais curta e devolve `undefined` na posição — o parâmetro com default do domínio (`mapping = []`, `scope = "todos"`, `resolveExisting = false`) recebe `undefined`, não `null`. (4) `operacoes.ts`: `RangeError` do reviver continua capturado antes do schema (teste (s) passa); `ErroDeEntrada` só nasce em `SERVICOS.inviteMember`, cujo `args[0]` já veio de `MEMBROS.inviteMember` — redundância documentada. A mensagem de 400 (`path.join(".")`) hoje só contém chaves declaradas no schema e índices: com `.strict()`, a chave desconhecida vai para `issue.keys`, não para `path` — **IN-11 fechou por remoção do `z.record`**. `.strict()` do zod 4 itera com `for...in`, então uma chave herdada via `__proto__` polui só o objeto intermediário do reviver e é recusada como `unrecognized_keys` (IN-02 continua mitigado, verificado). (5) Conferi manualmente os call sites do `apps/web` para todas as entradas de objeto `.strict()` (`saveView`, `createGoal`/`updateGoal`, `createForm`/`updateForm`, `createSpace`, `setRecurrence`, `createAgent`, `assignTask`, `setChecklistItemDone`, …): nenhuma manda chave que o schema desconheça — não há 400 falso hoje. `tsc --noEmit` limpo; `vitest run src/rotas` 73/73.

**O que não fechou.** Três coisas, nenhuma crítica, todas provadas nesta revisão:

1. **WR-12** — a promessa de `operacoes.ts` ("um erro dentro da operação só pode ser estado inconsistente ou bug, nunca entrada") é falsa para duas entradas **válidas pelo schema**: `updateTask` com `dueDate: { form: "instant", value: "garbage" }` (é `z.string()`, e `Instant = string`) grava o lixo no `jsonb` (200), e `setRecurrence` com `interval: 1e15` passa `Number.isInteger`. Em ambos, a primeira conclusão da Tarefa (`changeTaskStatus` → `nextOccurrenceRefusal` → `shift()` → `toISOString()`) lança `RangeError: Invalid time value` — 500 para qualquer Membro, reproduzido contra o seed. É o resíduo do efeito 2 de CR-02 ("JSON malformado no jsonb compartilhado") no nível de **valor**, não de forma.
2. **WR-13** — o portão bidirecional `Igual<>` (IN-10) cobre a maioria dos enums, mas não todos os que espelham uniões **nomeadas** do domínio: `RecurrenceRule.whenStillOpen`/`.businessDays`, `View.sortBy.by`/`.direction`, `Goal.measure.target`, `FormQuestion.target.kind`; e `CONTAINER_TYPE` é conferido contra um literal, não contra o tipo do domínio (que não é exportado). Provei que um `businessDays: z.enum(["anterior"])` (sem `"posterior"`) e um `sortBy.by` sem `"createdAt"` compilam sob `satisfies Esquemas` — exatamente o 400 falso que IN-10 descreveu.
3. **WR-14** — `tarefas.ts`, `automacoes.ts` e `financeiro.ts` não têm `<modulo>.test.ts`; `esquemas-de-argumentos.test.ts` cobre 8 das 23 operações desses módulos com forma literal do web. `esquemas-de-argumentos.ts:39-41` afirma que "cada `esquemas/<modulo>.test.ts`" prova as formas do web — a única rede contra a assimetria de IN-10 está ausente justamente para o módulo maior (20 operações).

## Status das constatações anteriores tocadas por este delta

| ID | Status | Evidência |
|---|---|---|
| CR-02 | **RESOLVIDO no nível de forma** (132/132 schemas `.strict()`, sem fallback); **resíduo no nível de valor** → WR-12 | `ESQUEMAS satisfies EsquemasCompletos`; testes (h)/(j) de `esquemas-de-argumentos.test.ts`; (t)/(u)/(v) de `operacoes.test.ts` provam `createGoal`/`saveView` por HTTP. |
| WR-10 | **RESOLVIDO** | `operacoes.ts:138-150`; teste (s) com 10.000 níveis → 400. |
| WR-11 | **RESOLVIDO por remoção** | `operacoes.ts:170-189`: nenhum `instanceof TypeError`; só `ErroDeEntrada` vira 400. Ver WR-12 para a premissa que ficou. |
| IN-02 | mitigado (inalterado) | `.strict()` do zod 4 recusa chave herdada como `unrecognized_keys` (reproduzido: `{"__proto__":{"polluted":true},…}` → 400 com `keys:["polluted"]`). O `reviver` em `registro.ts` continua atribuindo `__proto__` — fora deste delta. |
| IN-10 | **PARCIALMENTE RESOLVIDO** | `Igual<>`/`Confere<>` em `fragmentos.ts` + 9 arquivos de módulo fecham os enums que cobrem; lacunas em WR-13; rede de testes (b) ausente para 3 módulos em WR-14. |
| IN-11 | **RESOLVIDO por remoção** | Sem `z.record`, `issue.path` só tem chaves do schema e índices; a chave do cliente vai para `issue.keys` e só ao `request.log.warn`. Verificado com `filters: { "<script>": 1 }` → `path: [0,"filters"]`. |
| WR-02 | STILL OPEN (inalterado) | `runScheduledAutomations: z.tuple([ID, z.date()])` — o `today` continua do cliente. Fora deste delta. |

## Avisos

### WR-12: Entradas válidas pelo schema que o domínio persiste e que depois lançam `RangeError` na conclusão da Tarefa — 500 para qualquer Membro; resíduo do efeito 2 de CR-02

**Arquivo:** `apps/api/src/rotas/esquemas/fragmentos.ts:70-73` (`TASK_DATE.value: z.string()`), `apps/api/src/rotas/esquemas/colaboracao.ts:39` (`interval: z.number()`), `apps/api/src/rotas/operacoes.ts:19-23, 174-181` (premissa de WR-11)
**Problema:** O schema espelha fielmente o tipo (`Instant = string`, `CivilDate = string`, `interval: number`), mas o domínio **não valida** esses valores nos pontos de escrita: `updateTask`/`createTask` gravam `dueDate.value` sem `Date.parse` (`tasks.ts:1037-1043` só compara, `NaN > x` é `false`), e `setRecurrence` só exige `Number.isInteger(interval) && interval >= 1` (`collaboration.ts:299`). Reproduzido contra `buildSeed()` (lista `lst_revisoes`, com `recorrencia` ligada):

```
updateTask(…, { dueDate: { form: "instant", value: "garbage" } })  → ok:true, persistido
setRecurrence(…, { frequency:"diaria", interval:1, triggerMode:"aoConcluir", copies:{…} }) → ok:true
changeTaskStatus(…, <status concluído>) → THREW RangeError: Invalid time value
```

e, com `dueDate` válido, `setRecurrence(…, { interval: 1e15, … })` → `ok:true`; `changeTaskStatus` → o mesmo `RangeError` (`shift()` → `d.setDate(NaN)` → `toISOString()`, `collaboration.ts:347`). Pela rota isso é: dois `POST /operacoes/…` em 200 que gravam no `jsonb` compartilhado, e a partir daí **toda** tentativa de concluir a Tarefa, por qualquer Membro, cai no `setErrorHandler` com 500 "Erro interno." e log `error` — o comentário de `operacoes.ts:174-181` diz que isso "só pode ser estado hidratado inconsistente ou bug do domínio, nunca entrada", e aqui é entrada. Recuperável (outro `updateTask` com data válida), sem perda de dados, blast radius de uma Tarefa — por isso aviso, não crítico; mas é a classe exata de defeito que CR-02 fechou no nível de forma e que continua aberta no nível de valor para strings de data (`TaskDate.value`, `RecurrenceRule.endsOn`, `endContactCompanyLink.endDate`) e para números sem faixa.
**Correção:** Duas camadas, ambas necessárias pela regra de dependência do `CONTEXT.md` da raiz ("as mesmas regras precisam valer nos dois lados"):
1. **Domínio** (`packages/dominio`, fora deste delta — abrir plano): em `updateTask`/`createTask`, recusar `TaskDate` cujo `value` não parseia (`form:"instant"` → `Number.isNaN(Date.parse(value))`; `form:"civilDay"` → `/^\d{4}-\d{2}-\d{2}$/` + `Date.parse`), como `setTaskFieldValue` já faz para `date`/`dateTime` (`tasks.ts:1250-1260`); em `setRecurrence`, teto para `interval` e `endsAfter` (e `weekDays` em 0..6).
2. **Transporte** (este delta): formato ISO é FORMA, não regra — o mesmo critério pelo qual `z.date()` já recusa `Invalid Date` (teste (g)). Em `fragmentos.ts`:
```ts
export const TASK_DATE = z.discriminatedUnion("form", [
  z.object({ form: z.literal("civilDay"), value: z.iso.date() }).strict(),
  z.object({ form: z.literal("instant"), value: z.iso.datetime() }).strict(),
]);
```
   e um caso (c) em `esquemas-de-argumentos.test.ts`: `updateTask` com `{ form: "instant", value: "garbage" }` → `success:false`. Aplicar o mesmo a `RecurrenceRule.endsOn` (`z.iso.date()`), `ADD_TIME_ENTRY_INPUT.on`, `endContactCompanyLink` (`z.iso.date()`), `ReceivableSeriesInput.primeiroVencimento/vencimentoEntrada`, `GoalInput.dueDate`. Ajustar o comentário de `operacoes.ts:174-181` para não prometer que exceção nunca é entrada enquanto (1) não estiver feito.

### WR-13: O portão bidirecional `Igual<>` não cobre todos os `z.enum` que espelham uniões nomeadas do domínio — um membro a menos compila e vira 400 falso

**Arquivo:** `apps/api/src/rotas/esquemas/colaboracao.ts:42, 45, 78-85`; `apps/api/src/rotas/esquemas/escala.ts:32, 53, 92-96, 142-150`; `apps/api/src/rotas/esquemas/fragmentos.ts:82, 93`
**Problema:** A regra 4 de `esquemas/CONTEXT.md` ("todo `z.enum` que espelha uma união nomeada do domínio entra no `Confere<[Igual<…>]>`") está violada em:
- `colaboracao.ts:42` `whenStillOpen: z.enum(["gerarMesmoAssim","aguardarConclusao"])` e `:45` `businessDays: z.enum(["anterior","posterior"])` — campos de `RecurrenceRule`; o `Confere` do arquivo (linhas 78-85) confere `frequency` e `triggerMode`, mas não estes dois.
- `escala.ts:32` `SORT_BY.by`/`.direction` — `View["sortBy"]`; `:53` `GOAL_MEASURE.target: z.enum(["task","deal"])` — `Goal["measure"]["target"]`; `:92-96` os três `kind` de `FORM_QUESTION_TARGET` — `FormQuestion["target"]["kind"]`. O `Confere` (142-150) cobre `VIEW_KIND`, `GROUP_BY`, `GOAL_KIND`, `scopeType`, `aggregation` — os vizinhos, não estes.
- `fragmentos.ts:93` `Igual<z.infer<typeof CONTAINER_TYPE>, "space" | "folder" | "list">` — confere contra um literal repetido, não contra `ContainerType` (que `configuration.ts:28` declara sem `export`); se o domínio ganhar um membro, o portão continua verde.

Provado: um arquivo de sondagem com `businessDays: z.enum(["anterior"]).optional()` (sem `"posterior"`) e `SORT_BY.by` sem `"createdAt"`, ambos sob `satisfies Esquemas`, compila com `tsc --noEmit` limpo — é a assimetria de IN-10 (saída mais estreita é atribuível). Hoje os seis enums batem com o domínio (conferido um a um), então não há bug ativo; mas os testes (b) que seriam a segunda rede só exercitam `businessDays: "anterior"` (`colaboracao.test.ts:29`) e `sortBy: { by: "priority", direction: "asc" }` (`escala.test.ts:66`) — `"posterior"`, `"desc"`, `"dueDate"`, `"title"`, `"createdAt"`, `target: "deal"`, `kind: "description"` nunca são provados.
**Correção:** Acrescentar ao `Confere` de cada arquivo (todos os tipos já são exportados por `@n1/dominio`, exceto `ContainerType` — para esse, usar `ArgumentosDe`, já exportado por `fragmentos.ts`):
```ts
// colaboracao.ts
Igual<NonNullable<z.infer<typeof RECURRENCE_RULE>["whenStillOpen"]>, NonNullable<RecurrenceRule["whenStillOpen"]>>,
Igual<NonNullable<z.infer<typeof RECURRENCE_RULE>["businessDays"]>, NonNullable<RecurrenceRule["businessDays"]>>,
// escala.ts
Igual<z.infer<typeof SORT_BY>["by"], NonNullable<View["sortBy"]>["by"]>,
Igual<z.infer<typeof SORT_BY>["direction"], NonNullable<View["sortBy"]>["direction"]>,
Igual<z.infer<typeof GOAL_MEASURE>["target"], NonNullable<Goal["measure"]>["target"]>,
Igual<z.infer<typeof FORM_QUESTION_TARGET>["kind"], FormQuestion["target"]["kind"]>,
// fragmentos.ts — contra o domínio, não contra um literal
Igual<z.infer<typeof CONTAINER_TYPE>, ArgumentosDe<"addStatus">[0]>,
```
E incluir nos testes (b) uma forma com cada membro que falta (`businessDays: "posterior"`, `sortBy: { by: "createdAt", direction: "desc" }`, `measure.target: "deal"`, `target: { kind: "description" }`).

### WR-14: `tarefas.ts`, `automacoes.ts` e `financeiro.ts` (23 operações) não têm `<modulo>.test.ts` — a rede contra a assimetria de IN-10 falta justamente no módulo maior, e o código afirma que ela existe

**Arquivo:** `apps/api/src/rotas/esquemas/` (ausentes: `tarefas.test.ts`, `automacoes.test.ts`, `financeiro.test.ts`); `apps/api/src/rotas/esquemas-de-argumentos.ts:39-41`; `apps/api/src/rotas/esquemas-de-argumentos.test.ts`
**Problema:** `esquemas-de-argumentos.ts:39-41` diz que "o caso '(b) formas literais do web' de cada `esquemas/<modulo>.test.ts` prova, call site a call site, que a forma real passa". Para 12 módulos é verdade; para os 3 do Plan 01-12 a cobertura ficou em `esquemas-de-argumentos.test.ts`, que exercita `updateTask`, `createTask`, `addTaskComment`, `setTaskTags`, `setTaskFieldValue`, `createReceivableSeries`, `moveTask`, `runScheduledAutomations` — 8 de 23. Sem nenhuma forma literal: `changeTaskStatus`, `assignTask`, `unassignTask`, `convertChecklistItem`, `trashTask`, `restoreTask`, `restoreList`, `addChecklist`, `addChecklistItem`, `setChecklistItemDone`, `startMeeting`, `endMeeting`, `resolveTaskComment`, `watchTask`, `runLancamentoAgent`. Também não há caso (a) de cobertura para esses módulos — a única prova de que `TAREFAS` tem exatamente as 20 chaves de `tasks.ts` é o `satisfies` (que aceitaria uma chave a menos, já que `Esquemas` é parcial) e o (j) global (que só vê a união). Conferi manualmente os call sites (`tarefas/[tarefa]/page.tsx:257-326, 781-910`, `task-editors.tsx:443-586`, `reunioes/[reuniao]/page.tsx:289, 440`, `lixeira/page.tsx:157`, `bulk-status-bar.tsx:108`, `contas-view.tsx:373`) e todos batem — não há 400 falso hoje; a lacuna é de rede, não de bug. Como o `satisfies` só prende num sentido, um `assignTask: z.tuple([ID, z.object({ kind: z.literal("member"), id: ID })])` compilaria e quebraria a atribuição a Agentes (`page.tsx:312-316` manda `kind: "agent"`), sem nenhum teste vermelho.
**Correção:** Criar `tarefas.test.ts`, `automacoes.test.ts` e `financeiro.test.ts` no molde dos demais — (a) cobertura com a lista das 20/1/2 chaves, (b) `FORMAS_DO_WEB` com uma entrada mínima e uma máxima por operação, via `viaJson`, (c) hostis — e mover para lá os casos (a)–(g) de `esquemas-de-argumentos.test.ts`, deixando neste só (h)–(k) (composição/completude), como o cabeçalho dele já promete ("este arquivo não repete os casos por operação"). Corrigir o comentário de `esquemas-de-argumentos.ts:39-41` até então.

## Informações

### IN-12: Os `z.enum` que espelham uniões **inline** da assinatura (não nomeadas) também só são conferidos num sentido — `ArgumentosDe<N>` já permite fechar os dois de graça

**Arquivo:** `apps/api/src/rotas/esquemas/contatos.ts:35, 96`; `ia.ts:58`; `negocios.ts:56`; `configuracao.ts:56`; `planejamento.ts:16`; `estrutura.ts:55`; `membros.ts:30`
**Problema:** `onCollision`, `setContactCatalogValue.kind`, `decideApproval.decision`, `migrateDealsToFunnel.scope`, `FOLDER_OU_LIST`, `parentType` (×2) e `subjectKind` espelham uniões escritas inline na assinatura. A regra 4 de `esquemas/CONTEXT.md` só exige o portão para uniões nomeadas, então não é violação — mas a assimetria é a mesma de WR-13, e `ArgumentosDe<"decideApproval">[1]` (exportado por `fragmentos.ts`) dá o tipo exato sem depender de export do domínio.
**Correção:** `Igual<z.infer<typeof X>, ArgumentosDe<"decideApproval">[1]>`, `Igual<…, ArgumentosDe<"importContacts">[1]["onCollision"]>`, `Igual<…, ArgumentosDe<"overrideStatusSet">[0]>`, etc. Uma linha por enum no `Confere` de cada arquivo; atualizar a regra 4 para "todo `z.enum`".

### IN-13: Os testes (a) de cobertura repetem listas à mão e não provam que os módulos são disjuntos — uma chave duplicada entre dois módulos seria silenciosamente sobrescrita pelo spread e passaria em (j)

**Arquivo:** `apps/api/src/rotas/esquemas-de-argumentos.ts:76-92`; `apps/api/src/rotas/esquemas-de-argumentos.test.ts:103-108`; todos os `esquemas/*.test.ts` caso (a)
**Problema:** `{ ...TAREFAS, ...AUTOMACOES, … }` com a mesma chave em dois módulos: TypeScript não avisa, o último spread vence, `Object.keys(ESQUEMAS).length` continua 132 e (j) passa. Os casos (a) dos módulos pegariam se a chave a mais estivesse num módulo com teste — mas `tarefas`/`automacoes`/`financeiro` não têm (WR-14). Além disso, os (a) dizem "chaves de X.ts em registro.ts" mas não consultam `registro.ts`: são listas literais duplicadas do arquivo de schema.
**Correção:** Em `esquemas-de-argumentos.test.ts`, um caso: `expect([TAREFAS, AUTOMACOES, …].reduce((n, m) => n + Object.keys(m).length, 0)).toBe(Object.keys(OPERACOES).length)` — soma 132 só se forem disjuntos. Opcionalmente, um único teste parametrizado que, para cada módulo, confira `Object.keys(MODULO)` contra as chaves de `OPERACOES` que vêm do arquivo de domínio correspondente (o registro já agrupa por comentário; um mapa `modulo → chaves` num só lugar substitui 15 listas à mão).

### IN-14: Fragmento `z.enum(["space", "folder"])` duplicado em dois módulos — viola a regra 5 de `esquemas/CONTEXT.md`

**Arquivo:** `apps/api/src/rotas/esquemas/planejamento.ts:16`; `apps/api/src/rotas/esquemas/estrutura.ts:55`
**Problema:** "Fragmentos usados por dois módulos ou mais vivem só em `fragmentos.ts` — nunca duplicados entre arquivos de módulo." `parentType: z.enum(["space","folder"])` aparece idêntico em `INSTANTIATE_LIST_TEMPLATE_INPUT` e em `CREATE_CONTAINER_INPUT`; espelham o mesmo `"space" | "folder"` de `planning.ts:376` e `structure.ts:168/284`.
**Correção:** `export const PARENT_TYPE = z.enum(["space", "folder"]);` em `fragmentos.ts`, com `Igual<z.infer<typeof PARENT_TYPE>, ArgumentosDe<"createFolder">[0]["parentType"]>` no `Confere`, e importar nos dois módulos.

### IN-15: Comentários e rótulos de teste desatualizados ou duplicados

**Arquivo:** `apps/api/src/rotas/esquemas-de-argumentos.ts:39-41`; `apps/api/src/rotas/esquemas/fragmentos.ts:14-15`; `apps/api/src/rotas/esquemas/escala.test.ts:158, 202`; `apps/api/src/rotas/esquemas/membros.test.ts:64, 78`; `apps/api/src/rotas/esquemas/construtor-de-agentes.ts:13`; `apps/api/src/rotas/esquemas/escala.ts:62`
**Problema:** (i) `esquemas-de-argumentos.ts:39-41` promete um `<modulo>.test.ts` por módulo — três não existem (WR-14). (ii) `fragmentos.ts:14-15` ainda fala em "os que o Plan 01-13/14/15 acrescentam" — já acrescentados. (iii) `escala.test.ts` e `membros.test.ts` têm dois `it("(c) …")` cada; a saída do vitest e as referências em comentários ("o caso (c)") ficam ambíguas. (iv) `agent-builder.ts:37` e `scale.ts:198` são referências por número de linha — corretas hoje, apodrecem na primeira edição do domínio.
**Correção:** Ajustar (i) e (ii) ao estado real; renomear os segundos `(c)` para `(d)`; trocar números de linha por nomes (`validate()` em `agent-builder.ts`, `validateGoal` em `scale.ts`).

### IN-16: `operacoes.test.ts` (i) aceita `ok:false` — não prova que o marcador de `Date` foi revivido e a operação executou

**Arquivo:** `apps/api/src/rotas/operacoes.test.ts:272-281`
**Problema:** `expect(typeof resposta.json().ok).toBe("boolean")` passa tanto para `ok:true` quanto para uma recusa do domínio ("Lista não encontrada", "sem permissão") — o teste só distingue 200 de 400/500. Como `CP.listId` vem do seed e Maryane é Membro ativo do Financeiro, a operação deveria executar de fato. Pré-existente à rodada, mas continua a única prova HTTP do revive de `Date`.
**Correção:** `expect(corpo.ok).toBe(true); expect(typeof corpo.value.executed).toBe("number");` — e, se a intenção for só "não é 400/500", dizer isso no nome e tirar a asserção vazia.

---

_Revisado em: 2026-09-17T14:03:22Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
_Rodada: 2 (substitui a revisão de 2026-09-16T20:03:40Z)_
