# Phase 10: Clone ClickUp: Contêineres - Pattern Map

**Mapped:** 2026-10-28
**Files analyzed:** 30 (novos/alterados principais)
**Analogs found:** 28 / 30
Todos os analogs foram conferidos como arquivos do repositório (`packages/`, `apps/`), nenhum espelho gitignorado.

## File Classification

### Domínio (`packages/dominio/src/`) — primeiro

| Arquivo novo/alterado | Role | Data Flow | Analog | Match |
|---|---|---|---|---|
| `operations/structure.ts` (+`moveContainer`, `reorderContainers`) | service/operação | CRUD | `operations/tasks.ts::moveTask` + `structure.ts::createList` | exact |
| `operations/configuration.ts` (+`setContainerDefaultViews`, `setContainerBlock`) | service/operação | CRUD | `configuration.ts::setContainerFeature` | exact |
| `operations/registro.ts`, `operations/index.ts` | config/registro | — | entradas de `setContainerFeature` | exact |
| `derive.ts` (+`sobrescritasAbaixo`, `definesAspect`, `views` em `effectiveContainerConfig`, L1–L5; −`workload`) | utility/leitura | transform | `derive.ts::effectiveContainerConfig` (177-214) | exact |
| `types/structure.ts` (`defaultViews`, `blocks` só Espaço/Pasta, `InheritanceMode`, `View.kind`) | model | — | o próprio arquivo (:73, :83-89, :111, :222-233) | exact |
| `operations/mover-conteiner.test.ts`, `visualizacoes-padrao.test.ts`, `bloqueio-de-aspecto.test.ts`, `agenda-do-relogio.test.ts` | test | request-response | `operations/operations.test.ts`, `quem-pode.test.ts` | role-match |
| `packages/dominio/CONTEXT.md` (tabela "Quem pode") | config/doc | — | linha 183 `setContainerFeature` | exact |
| `operations/planning.ts` (−`setMemberCapacity`), `ia/automacoes-editor.ts::criarAutomacao` (+`blockedAbove`) | service | CRUD | `setContainerFeature` (uso de `blockedAbove`) | role-match |

### Backend (`apps/api/`)

| Arquivo | Role | Data Flow | Analog | Match |
|---|---|---|---|---|
| `src/rotas/esquemas/{estrutura,configuracao}.ts` (+4 esquemas), `planejamento.ts` (−1), `escala.ts` (−`carga`) | esquema Zod | request-response | `configuracao.ts:154` | exact |
| `src/rotas/esquemas-de-argumentos.test.ts` (j) 286→289 | test | — | o próprio (:107) | exact |
| `src/automacoes/scheduler-worker.ts` | service/worker | batch | o próprio (`catalogoDeListasComAgenda` :270-310) | exact |
| `src/automacoes/scheduler-worker.test.ts` | test | batch | o próprio (`const d = temBanco ? describe : describe.skip`) | exact |
| `migracoes/010-*.sql` | migration (só dados) | batch | `009-seguranca-e-cofre.sql` (cabeçalho) — **sem analog de DML** | partial |
| `src/persistencia/migracao-010.test.ts` | test banco | CRUD | `persistencia/migrar-seco.test.ts` + `testes/banco-crm.ts` | role-match |

### Web (`apps/web/src/`)

| Arquivo | Role | Data Flow | Analog | Match |
|---|---|---|---|---|
| `features/shell/app-shell.tsx` (árvore arrastável) + `zona-de-soltura.ts` + hook | component | event-driven | `estrutura/calendario-mensal.tsx` (drag) + `app-shell.tsx` ChatTree (menu) | role-match |
| `features/estrutura/mover-conteiner-dialog.tsx` | component | request-response | `estrutura/move-task-dialog.tsx` | exact |
| `features/estrutura/{quadro-de-tarefas,tabela-plana,barra-de-criacao,selecao-em-lote}.tsx` | component | extração | trechos de `listas/[lista]/page.tsx` (1179-1407) e `bulk-status-bar.tsx` | exact |
| `features/estrutura/container-settings.tsx` (abas `?aba=`, editor Visualizações, interruptor) | component | CRUD | o próprio + `design/basicos.tsx::Abas` | role-match |
| `app/(shell)/estrutura/espacos/[espaco]/page.tsx` | page | CRUD | `pastas/[pasta]/page.tsx` | exact |
| `features/estrutura/view-bar.tsx`, `tipo-de-visualizacao.ts` | component/util | transform | si próprios (`abaDaView`, `ROTULO_DA_ABA`) | exact |
| testes de árvore/diálogo | test | event-driven | `features/crm/quadro-do-funil.test.tsx:258-322` | exact |
| `features/estrutura/sem-codigo-de-regra.test.ts` | test | file-I/O | `packages/dominio/src/quem-pode.test.ts` (lê arquivos com `readFileSync`) | role-match |

## Pattern Assignments — Domínio

### `moveContainer` / `reorderContainers` (structure.ts)

**Analog A — `moveTask`** (`operations/tasks.ts:485-575`). Núcleo a **extrair para função compartilhada** (RESEARCH Pattern 3, item 10):

```ts
const from = effectiveListConfig(state, task.listId);
const to = effectiveListConfig(state, targetListId);
if (from.statusSet.id !== to.statusSet.id) {
  const inUse = new Set(tree.map((t) => t.statusId));
  const missing: string[] = [];
  for (const statusId of inUse) {
    const mapped = mapping.find((m) => m.fromStatusId === statusId);
    const destination = mapped ? to.statusSet.definitions.find((d) => d.id === mapped.toStatusId) : undefined;
    if (!destination) { /* missing.push(nome) */ }
  }
  if (missing.length > 0) return fail(`Mapeie ${...} para continuar.`, "mapeamento");
}
const keptDefinitions = new Set(to.fieldDefinitionIds);
for (const item of tree) {
  // remapeia statusId + recordActivity "Status alterado por remapeamento"
  for (const value of item.fieldValues) {                       // B37
    value.state = keptDefinitions.has(value.definitionId) ? "ativo" : "arquivado";
  }
  if (!to.taskTypeIds.includes(item.taskTypeId)) { const fallback = to.taskTypeIds[0]; if (fallback) item.taskTypeId = fallback; }
  if (item.publicShare?.active && !to.features.compartilhamentoPublico) { item.publicShare.active = false; recordActivity(... "Link público revogado" ...); }
  item.listId = targetListId;   // NÃO entra na versão compartilhada: no moveContainer o listId não muda
  item.updatedAt = now();
}
recordActivity(state, { actor: memberActor(actingMemberId), action: "Tarefa movida", objectType: "task", objectId: task.id, objectName: task.title,
  before: previousPath /* from.path.map(p=>p.name).join(" › ") */, after: to.path.map((p) => p.name).join(" › ") });
```

**Analog B — guardas e criação em `structure.ts`** (:18-37, :345-372): `mayBuild(state, actor, parent)` ("criar no destino"), `nameTaken(siblings, name)` (ignora `naLixeira`), `order: siblings.length` (Pitfall 3: trocar por `max+1`; `siblings` inclui lixeira), `requireContainer`, `containerAdminRefusal`. Todas privadas ao módulo: `moveContainer` e `reorderContainers` ficam em `structure.ts` (ou exportar). Mensagem reaproveitável: `"Uma Subpasta não contém outra Pasta: a estrutura para aqui."` (structure.ts:199).

**Armadilha de `blockedAbove`** (`configuration.ts:42-52`): ela pula o próprio nó:
```ts
export function blockedAbove(state, type, id, aspect): string | undefined {
  for (const node of containerPath(state, type, id)) {
    if (node.id === id) continue;
    const ancestor = findContainer(state, node.type, node.id);
    if (ancestor?.blocks[aspect]) return `${CONTAINER_LABEL[node.type]} ${ancestor.name} bloqueia ${ASPECT_LABEL[aspect]} abaixo dele.`;
  }
  return undefined;
}
```
Ao mover, incluir `destino.blocks[aspecto]` à mão (precedente `planning.ts:391` `doPai`). Depois de D-15, `ancestor.blocks` só existe em Espaço/Pasta (guarda de tipo). `reorderContainers` segue RESEARCH Pattern 4 (preenchimento de vagas, não permutação completa) — ajuste a confirmar (A3).

### `setContainerDefaultViews` / `setContainerBlock` (configuration.ts)

**Analog:** `setContainerFeature` (`configuration.ts:820-865`) — molde literal; copiar a ordem de guardas, `modes`, e `recordActivity` só se mudou:
```ts
const container = findContainer(state, containerType, containerId);
if (!container) return fail(`${CONTAINER_LABEL[containerType]} não encontrado(a).`);
const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
if (refusal) return fail(refusal);
if (container.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não muda de configuração.");
const bloqueio = blockedAbove(state, containerType, containerId, "features");   // trocar por "defaultViews"
if (bloqueio) return fail(bloqueio);
...
container.modes = { ...container.modes, features: Object.keys(proprias).length > 0 ? "sobrescrito" : "herdado" };
if (antes !== depois) recordActivity(state, { actor: memberActor(actingMemberId), action: "Funcionalidade alterada",
  objectType: containerType, objectId: container.id, objectName: container.name, detail: feature, before: ..., after: ... });
return ok(proprias);
```
`defaultViews` difere de `features`: o nó mais próximo vence **por inteiro** (não mescla por chave). `setContainerBlock` usa um único `definesAspect(state, tipo, id, aspecto)` compartilhado com `sobrescritasAbaixo` e com a recusa de `moveContainer`. Nomear contêiner privado só se `memberReachesContainer` (Pitfall 7).

### `derive.ts::effectiveContainerConfig` (+`views`) — `derive.ts:177-214`

```ts
// B25 — features substitute: the nearest level that defines one wins, per feature.
const features: EnabledFeatures = { ...DEFAULT_FEATURES };
for (const node of path) {
  const container = containerOf(state, node);
  if (container?.features) Object.assign(features, container.features);
}
return { statusSet, statusSetDefinedAt: definedAt, fieldDefinitionIds, taskTypeIds, features, path };
```
Para `views`: replicar o laço de `statusSet` (percorre do nó ao Espaço e para no primeiro que define; :186-196), com fallback `VISUALIZACOES_DA_PLATAFORMA`. É o único construtor de `EffectiveListConfig` (:213).

### Cadeia de registro (aplicar às 4 operações novas; remover `setMemberCapacity`)

Elos reais (verificados):

1. `operations/registro.ts` — import e entrada (ex.: `setContainerFeature` em :146 e :529). Para `moveContainer`/`reorderContainers` (structure.ts) e `setContainerDefaultViews`/`setContainerBlock` (configuration.ts) acrescentar nos blocos de import do módulo correspondente **e** em `OPERACOES`:
```ts
  removeTaskType,
  setContainerFeature,      // import (linha ~146) e entrada em OPERACOES (~529)
  updateFieldDefinition,
```
2. `operations/index.ts:166`:
```ts
export const setContainerFeature = instrumentar("setContainerFeature");
```
3. Esquema — `apps/api/src/rotas/esquemas/configuracao.ts:153-154` (e `estrutura.ts`, que fecha com `} satisfies Esquemas;` na linha 100):
```ts
  // `null` = "herdar" — valor de domínio.
  setContainerFeature: z.tuple([CONTAINER_TYPE, ID, FEATURE, z.boolean().nullable()]),
```
Fragmentos úteis: `CONTAINER_TYPE`, `ID`, `opcional(...)`, `FOLDER_OU_LIST`, `z.array(ID)` (`reorderStatuses: z.tuple([CONTAINER_TYPE, ID, z.array(ID)])`). `StatusMapping` não tem esquema pronto — `moveTask` em `tarefas.ts` é o exemplo de como o mapeamento é descrito (confirmar). O portão de tipo é `EsquemasCompletos` (`fragmentos.ts:39`): sem o esquema o `tsc` do `apps/api` falha. Cabeçalho de `estrutura.ts` diz "8 operações" — atualizar para 10; `estrutura.test.ts` e `configuracao.test.ts` têm teste "(a) cobertura" com a lista literal de chaves (`configuracao.test.ts:30-31,114-116,152-156`) e "(b) formas literais".
4. Contagem — `apps/api/src/rotas/esquemas-de-argumentos.test.ts:103-107`:
```ts
  it("(j) ESQUEMAS cobre exatamente OPERACOES — mesmas chaves, 286, todas nomes de operação válidos", () => {
    const chaves = Object.keys(ESQUEMAS);
    expect(chaves.sort()).toEqual(Object.keys(OPERACOES).sort());
    ...  // comentário longo acumulando "... = 286"
    expect(chaves.length).toBe(286);
```
Novo valor **289** (−`setMemberCapacity` +4); estender o comentário-cabeçalho com a parcela da Fase 10.
5. Tabela "Quem pode" — `packages/dominio/CONTEXT.md:183`:
```
| `setContainerFeature` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
```
Linhas novas: `moveContainer`/`reorderContainers` → `operations/structure.ts`; `setContainerDefaultViews`/`setContainerBlock` → `operations/configuration.ts`. Remover a linha de `setMemberCapacity` (:196). Atualizar a linha de `criarAutomacao` (hoje `recusaDeConvidado`). O teste `quem-pode.test.ts` exige (lido nesta sessão): linha para toda operação, sem órfã/duplicada, "Conferência" nunca vazia nem "a conferir", e (:103-113) Arquivo == módulo do import em `registro.ts`:
```ts
const registro = readFileSync(new URL("./operations/registro.ts", import.meta.url), "utf8");
for (const m of registro.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/([^"]+)"/g)) { ... moduloDe.set(nome, `operations/${m[2]}.ts`) }
```
**Regra para o planejador:** os 5 elos acima vão no **mesmo plano** que cria/remove a operação.

### Testes de domínio novos
Analog: `operations/operations.test.ts` (padrão `seed` → operação → `result.ok`/mensagem) e `registro.test.ts`. Cobrir casos listados em EST-05/08/10. Comando: `cd packages/dominio && npx vitest run <arq>`.

## Pattern Assignments — Backend

### `scheduler-worker.ts` (batch)
**Analog:** o próprio arquivo. Catálogo a ampliar (`:270-310`, `catalogoDeListasComAgenda`): hoje lê só `automations`:
```ts
const resultado = await pool().query<{ workspace_id: string; dados: AutomationRegistrada }>(
  `select workspace_id, dados from plataforma.registros
    where colecao = 'automations' and dados->>'lifecycle' = 'ativo' and dados->>'scopeType' = 'list' ${filtroWorkspace}`, parametros);
const pares = new Map<string, ParDoCatalogo>();
...  pares.set(`${linha.workspace_id}::${linha.dados.scopeId}`, { workspaceId: ..., listId: ... });
```
Acrescentar as duas consultas de `tasks` (RESEARCH "Catálogo candidato", usa a coluna gerada `list_id` da 002) e unir no mesmo `Map`. O comentário do arquivo manda manter o SQL como **candidato** (a decisão é do domínio). Regime/ator: funções puras novas no domínio (`listaTemAgendaPorVencimento`, `atorDoRelogio`), chamadas **dentro** do callback de `executar()`; `emEnsaio` hoje é opção global (`ensaioNaPrimeiraVolta`, :331,553). Volta drenando: `iniciar()` (:610-621) usa `setInterval` com uma linha por volta → trocar por `while (await processarUm())` com teto. Códigos: `CODIGOS_DA_AGENDA` (:142). Ponte: `invocar-agente.ts:1222-1241` deve compor os 3 relógios.

### `scheduler-worker.test.ts`
**Analog:** o próprio. Cabeçalho (linhas 30-40): `carregarEnv(); const temBanco = Boolean(process.env.DATABASE_URL); const d = temBanco ? describe : describe.skip;` — mas Pitfall 9: para testes novos use `describeComBanco` de `testes/banco-crm.ts:37` (só host local). Puras sem banco rodam sempre (`dataCivil`, `diasCiveisPendentes`). Comando: `DATABASE_URL=postgres://postgres:x@localhost:55701/postgres npx vitest run src/automacoes/scheduler-worker.test.ts`.

### `migracoes/010-*.sql`
**Analog parcial:** `009-seguranca-e-cofre.sql` só pelo estilo de cabeçalho em ASCII sem acento (comentário "O que esta migracao faz, nesta ordem", fonte, decisões, "Roda ... inteira dentro da transacao de migrar()"). Não há DML em 007/008/009 — corpo: usar o modelo de RESEARCH § Code Examples (`update ... jsonb_set`, `dados - 'blocks'`, bloco `do $$ ... raise exception` de pós-condição). Imutável depois de aplicada.

### `migracao-010.test.ts`
**Analog:** `persistencia/migrar-seco.test.ts` — padrão `describeComBanco`, `beforeAll(prepararBancoCrm)`, `afterAll(encerrar)`, bancos descartáveis por `create database seco_${uuid}` com `Pool` próprio e `poolDoDono()` para DDL/DML do dono:
```ts
describeComBanco("migracoesPendentes e migrar --seco (D-12) — Postgres local", () => {
  beforeAll(async () => { await prepararBancoCrm(); });
  afterAll(async () => { await encerrar(); });
  ...
    const nome = `seco_${randomUUID().slice(0, 8)}`;
    await pool().query(`create database ${nome}`);
```
Atenção: `migrar-seco.test.ts (b)` compara `aplicadas` com `arquivos()` do disco — a 010 entra sozinha, mas conferir que o teste continua verde. Cobrir: inserir `views` carga e `lists` com `blocks`, executar o SQL, zero e idempotência.

## Pattern Assignments — Web

### Árvore arrastável (`app-shell.tsx` + novos `zona-de-soltura.ts`, hook)
**Analog de arrastar:** `estrutura/calendario-mensal.tsx:93-105,144-165` (estado do item em trânsito em React, nunca ler `dataTransfer` em `dragover`; realce `--acento-lavado`):
```tsx
<button draggable={editavel} onDragStart={() => setArrastando(task.id)}
  onDragEnd={() => { setArrastando(null); setSobre(null); }} ...
<div onDragOver={(event) => { if (!editavel || !arrastando) return; event.preventDefault(); if (sobre !== celula.dia) setSobre(celula.dia); }}
     onDragLeave={() => { if (sobre === celula.dia) setSobre(null); }}
     onDrop={(event) => { event.preventDefault(); soltar(celula.dia); }}
     style={{ background: sobre === celula.dia ? "var(--acento-lavado)" : ... }}>
```
**Analog de menu "Mover para…" por linha (caminho de teclado):** ChatTree em `app-shell.tsx:933-963` (`menu={[… "Mover para …"]}` em `TreeRow`; `moveChatSessionToFolder` via `run`). **Não** é arrastar (F1). Diferenças: `onDragLeave` por linha não serve na árvore (filhos) — limpar por `onDragEnd`; `draggable={false}` nas `Link`. Ordenar por `order` em `foldersUnder`/`listsUnder` (app-shell.tsx:624-648 só ordena Espaços — F2).

### `mover-conteiner-dialog.tsx`
**Analog:** `move-task-dialog.tsx` — imports `moveTask, type StatusMapping` de `@n1/dominio/operations`, `ConfirmDialog, Field, Select` de `@/features/shell/ui`; abertura por `useSearchParams` + `router.replace(..., { scroll: false })` (:34-48 do analog, hook `useMoveTaskDialog` com `MOVE_TASK_PARAM = "mapear-status"`):
```tsx
const router = useRouter(); const query = useSearchParams();
openMove: (taskId) => { const next = new URLSearchParams(query.toString()); next.set(MOVE_TASK_PARAM, taskId); router.replace(`${pathname}?${next}`, { scroll: false }); },
closeMove: () => { ...next.delete(MOVE_TASK_PARAM); router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false }); },
```
Montado na casca (`?mover=`), seguro com `useSearchParams` por causa do `<Suspense>` de `app/(shell)/layout.tsx` (Pitfall 12).

### Teste de arrastar na árvore
**Analog:** `features/crm/quadro-do-funil.test.tsx:258-322` — `fireEvent.dragStart(cartao(...))`, `fireEvent.drop(coluna(...))`, `await waitFor(...)`, `gravacoes()` vazio para soltar no mesmo lugar, recusa → frase na tela, Convidado → nada grava e menu só com "Abrir", menu como alternativa ao arrastar:
```tsx
fireEvent.dragStart(cartao("Contrato Ana"));
fireEvent.drop(coluna("Proposta"));
await waitFor(() => expect(within(coluna("Proposta")).getByText("Contrato Ana")).toBeTruthy());
```
Em jsdom `getBoundingClientRect()` é zerado: a zona (antes/dentro/depois) é função **pura** testada à parte com números injetados.

### Configurações em abas, Espaço no formato da Pasta, extrações da página da Lista
- `container-settings.tsx` (único componente das três páginas de Configurações; tocado por 2.1.8 → 2.6.2 → 2.6.5, sequencial): usar `Abas` de `design/basicos.tsx:250` + `?aba=` com o mesmo `useSearchParams/router.replace`.
- `espacos/[espaco]/page.tsx`: modelo é `pastas/[pasta]/page.tsx` (seções Listas e Pastas, menu "Criar" com `useCreateContainerDialog().openCreate`). Ordenar por `order` (hoje `state.lists.filter(...)` sem sort — `espacos/[espaco]/page.tsx:40-42`, `pastas/[pasta]/page.tsx:60-61`).
- `Quadro`/`Tabela`/barras de criação: mover verbatim de `listas/[lista]/page.tsx` (1179-1285, 1286-1407, ~647-870) — meta ≤ 950 linhas.
- `view-bar.tsx:99,214` e `tipo-de-visualizacao.ts:11-25`: `abaDaView` deve virar total (`kind` fora de `ROTULO_DA_ABA` → `"lista"`) antes da `010` (Pitfall 4).

## Shared Patterns

### Atividade em toda mutação
`recordActivity(state, { actor: memberActor(actingMemberId), action, objectType, objectId, objectName, detail?, before?, after? })` — só quando mudou (ver `setContainerFeature`). `objectType` é `string` livre (`types/primitives.ts:274`): ordem de Espaços usa `"workspace"` + `state.workspace.id`.

### Resultado como valor
`OperationResult` (`fail(msg, codigo?)` / `ok(valor, id?)`), nunca exceção. A tela desliga o controle com a mesma frase que a operação devolve (precedente `taskWriteRefusal`, `derive.ts:937-942`) — por isso L1–L5 vivem em `derive.ts`.

### Privacidade B38a
`memberReachesContainer`, `containerAdminRefusal`; `mayBuild` para "criar no destino". Estado do Membro é recorte (`store.rodarNaCopia`): operações de fatia/mapeamento precisam dar o mesmo resultado na cópia e no servidor.

### Teste de banco
`describeComBanco` + `prepararBancoCrm` + `poolDoDono` (`apps/api/src/testes/banco-crm.ts`): só roda em `localhost`/`127.0.0.1`. Sempre prefixar `DATABASE_URL=` nos testes de `apps/api` sem banco.

## No Analog Found

| Arquivo | Role | Data Flow | Motivo |
|---|---|---|---|
| `010-*.sql` (corpo DML) | migration | batch | 007/008/009 são só DDL; usar RESEARCH § Code Examples |
| `zona-de-soltura.ts` (função pura antes/dentro/depois) | utility | transform | nenhuma árvore ordena por zona; calendário só tem células, não zonas por Y |
| `reorderContainers` (preenchimento de vagas) | operação | CRUD | o precedente do CRM (`PUT /funis/:id/etapas/ordem`) recebe lista completa; o algoritmo de fatia é novo (RESEARCH Pattern 4) |
| `sem-codigo-de-regra.test.ts` | test | file-I/O | só há `quem-pode.test.ts` como teste que varre arquivos; as 4 cadeias do domínio precisam de asserção própria |

## Metadata

**Analog search scope:** `packages/dominio/src/{operations,derive.ts,quem-pode.test.ts}`, `packages/dominio/CONTEXT.md`, `apps/api/src/{rotas,automacoes,persistencia,testes}`, `apps/api/migracoes`, `apps/web/src/features/{estrutura,shell,crm}`
**Pattern extraction date:** 2026-10-28
