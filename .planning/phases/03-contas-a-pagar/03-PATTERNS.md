# Fase 3: Contas a pagar — Mapa de Padrões

**Mapeado em:** 2026-09-22
**Arquivos analisados:** 13 (novos + modificados)
**Analogias encontradas:** 11 / 13 (2 greenfield sem analogia direta no repo — motor de Automações e ponte HTTP para o Agente — ver seção final)

## Classificação de Arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Analogia mais próxima | Qualidade |
|---|---|---|---|---|
| `packages/dominio/src/operations/importacao-contas-a-pagar.ts` (novo) | model/operation (import histórico) | batch/file-I/O (via CLI) | `packages/dominio/src/operations/importacao.ts::importarSolicitacaoHistorica` | exato-com-correção (não pode chamar `changeTaskStatus`) |
| `packages/dominio/src/operations/financeiro.ts::createPayableFromApprovedRequest` (D3-08, novo) | operation (conversão Tarefa→Tarefa entre Listas) | CRUD | `packages/dominio/src/operations/importacao.ts::importarSolicitacaoHistorica` (composição `createTask`+`setTaskFieldValue`) + `collaboration.ts::spawnNextOccurrence` (cria Tarefa nova a partir de outra, copiando campos) | papel-match |
| `packages/dominio/src/operations/automations.ts::runAction` (modificado) | operation (executor) | event-driven | o próprio `runAction` (linhas 127-218) — os 3 `controlKind` que faltam (`aguardar`, `notificar`, `solicitarAprovacao`) seguem o molde do `case "controle"` de `invocarAgente` (linha 135-141) | exato (extensão do mesmo switch) |
| `packages/dominio/src/operations/financeiro.ts::buildResumoDePagamento` (modificado — parametrizar de-para) | operation (função pura) | transform | a própria função (linhas 146-182) — refatorar assinatura para receber `deParaConta`/`deParaCategoria` como parâmetro em vez de ler `CONTA_POR_TAG`/`CATEGORIA_OMIE` do módulo | exato (refactor local) |
| `packages/dominio/src/derive.ts` ou `operations/tasks.ts` — concessão dinâmica da Grant "Pessoa da conta" (PAG-06, novo) | operation (derivação/Grant) | event-driven (ao definir Campo Pessoa) | `operations/automations.ts::runAction` caso `"tarefa.adicionarObservadores"` (linhas 159-172, deriva de `fromFieldDefinitionId`) — mesmo padrão de "ler o Campo Pessoa e agir" | papel-match |
| `apps/api/src/automacoes/scheduler-worker.ts` (novo, greenfield) | service (poller in-process) | event-driven/batch | `apps/api/src/persistencia/outbox-worker.ts` (arquivo inteiro) | exato na forma, diferente no papel de negócio |
| `apps/api/src/automacoes/scheduler-worker.test.ts` (novo) | test | event-driven | `apps/api/src/persistencia/outbox-worker.test.ts` (padrão de teste — Relógio injetável, `processarUm()`) | exato |
| `apps/api/src/automacoes/invocar-agente.ts` (novo, ponte HTTP para A7) | service (cliente HTTP) | request-response | `apps/api/src/persistencia/outbox-worker.ts::entregar` (linhas 225-262 — `fetchImpl`, `AbortSignal.timeout`, classificação de erro) | papel-match |
| `apps/api/migracoes/005-*.sql` (novo, próximo número após 004) | migration | — | `apps/api/migracoes/003-integracao-e-importacao.sql` (estilo de comentário + tabela) e `004-outbox-indice-unico-por-workspace.sql` (estilo de ajuste incremental) | exato |
| `apps/api/src/importacao/clickup/contas-a-pagar.ts` (novo CLI/orquestração) | service (batch, lê export do disco) | file-I/O | `apps/api/src/importacao/financeiro/solicitacoes.ts` (`lerSolicitacoesLegadas`, `classificarLinha`) — mesma família "ler export → classificar → chamar operação de domínio" | papel-match |
| `../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-launch-service.ts` (novo endpoint) | controller/service (rota HTTP dedicada) | request-response | `../financeiro-tria/automation/src/adapters/plataforma.ts` (`criarPlataformaAdapter`, `requisitar`, validação `zod` por método) | papel-match |
| `../financeiro-tria/automation/*.test.ts` (novo, teste do endpoint) | test | request-response | `../financeiro-tria/automation/src/testing/omie-falso.ts` (reusar, não recriar) | exato |
| `apps/web/src/features/estrutura/financeiro/contas-view.tsx` (PAG-05, wiring) | component | request-response (POST em lote) | o próprio arquivo — gesto de seleção múltipla já existe (`selecionando`, `onToggleMany`, checkbox por linha e por grupo) | exato — não precisa construir UI nova, só ligar ao backend |

## Atribuições de Padrão

### `packages/dominio/src/operations/importacao-contas-a-pagar.ts` (novo — import histórico, PAG-01)

**Analogia:** `packages/dominio/src/operations/importacao.ts::importarSolicitacaoHistorica` (arquivo inteiro, 240 linhas)

**O que copiar literalmente** — cabeçalho de intenção (linhas 1-51): explica ausência de registro em `OPERACOES`, o Ator `importActor`, o padrão "tudo ou nada" com `antes`/`desfazer`, e — crítico — a frase final do cabeçalho (linhas 34-41) que autoriza `changeTaskStatus` **só porque** a Lista de Solicitações não tem Automação. Este é exatamente o aviso que PAG-01 precisa desobedecer conscientemente.

**Padrão de "tudo ou nada" a copiar** (linhas 136-146):
```typescript
const antes = {
  tasks: state.tasks.length,
  activity: state.activity.length,
  readable: state.workspace.taskReadableId.next,
};
const desfazer = (motivo: string, field?: Id): OperationResult<Task> => {
  state.tasks.splice(antes.tasks);
  state.activity.splice(0, state.activity.length - antes.activity);
  state.workspace.taskReadableId.next = antes.readable;
  return fail(motivo, field);
};
```

**Padrão de substituição de objeto para honrar `createdAt`/`completedAt` (readonly)** (linhas 190-202) — copiar a técnica, adaptar o `provenance` e o Ator:
```typescript
const indice = state.tasks.findIndex((t) => t.id === task.id);
const tarefaFinal: Task = {
  ...task,
  createdAt: criadaEm,
  provenance: { kind: "import", sourceId: entrada.legacyTaskId, sourceName: entrada.origem, at: agora },
  ...(entrada.descricao !== undefined ? { description: entrada.descricao } : {}),
  completedAt: entrada.fechadaEm ?? criadaEm,
};
state.tasks[indice] = tarefaFinal;
```

**A DIFERENÇA OBRIGATÓRIA — não usar `changeTaskStatus` para o histórico.** `importarSolicitacaoHistorica` usa (linha 161):
```typescript
const statusMudado = changeTaskStatus(state, actingMemberId, task.id, statusAlvo);
```
Isso dispara `runListAutomations` (ver `tasks.ts:270-272`/`automations.ts:289-310`) a cada chamada — inofensivo lá (zero Automações na Lista de Solicitações), catastrófico aqui (9 Automações ativas: A1 spawnaria recorrência para cada conta paga há meses, A5/A6 comentariam cobrança em Tarefas fechadas, A9 adicionaria Observadores retroativamente). **Para Contas a Pagar:** criar a Tarefa já com `statusId` = status final (resolvido via `effectiveListConfig`/`statusDefinition`, como o Pattern 3 do RESEARCH.md mostra), nunca chamando `changeTaskStatus`.

**Padrão de `recordActivity` com timestamp custom, um por transição do `status_history`** (analogia: linhas 204-213 e 214-225 do arquivo-fonte, adaptado ao loop de transições):
```typescript
recordActivity(state, {
  actor: ator,
  ...(delegate ? { delegate } : {}),
  action: "Status alterado",
  objectType: "task",
  objectId: task.id,
  objectName: task.title,
  before: transicao.de,
  after: transicao.para,
  at: transicao.since,   // ← `recordActivity` (activity.ts, `at: input.at ?? new Date().toISOString()`) já aceita isto
});
```
**Verificado:** `recordActivity` aceita `at` — confere no código-fonte, não só no RESEARCH.md. `changeTaskStatus` (`tasks.ts`) NÃO tem parâmetro de timestamp nem de `runAutomations` — por isso este arquivo nunca deve importar `changeTaskStatus` de `./tasks`, só `createTask` (com `{ runAutomations: false }`, como a linha 151 do arquivo-fonte já demonstra) e `setTaskFieldValue`.

**Padrão de idempotência de reimportação** (linha 97-101, `jaImportada`):
```typescript
function jaImportada(state: DataState, origem: string, legacyTaskId: string): boolean {
  return state.tasks.some(
    (t) => t.provenance?.kind === "import" && t.provenance.sourceId === legacyTaskId && t.provenance.sourceName === origem,
  );
}
```
Copiar igual — mesma dupla barreira que SOL-09 usa (barreira em memória aqui + `plataforma.importacao_ledger` no banco, ver seção de migration abaixo).

---

### `packages/dominio/src/operations/financeiro.ts` — D3-08: conversão Solicitação aprovada → Conta a pagar (novo, fora dos IDs nomeados)

**Analogia primária:** composição de `createTask`+`setTaskFieldValue` de `importacao.ts` (linhas 151-158) — a forma de criar uma Tarefa numa Lista e preencher Campos a partir de outra estrutura de dados.

**Analogia secundária para "copiar campos de uma Tarefa para outra Tarefa nova":** `packages/dominio/src/operations/collaboration.ts::spawnNextOccurrence` (linhas ~470-498, RESEARCH.md Code Examples) — o padrão real de "nasce uma Tarefa nova a partir da que fechou, com `recurrence` transferida e a origem perdendo a regra":
```typescript
// Source: packages/dominio/src/operations/collaboration.ts, linhas 493-498
next.recurrence = rule;
state.tasks.push(next);
delete task.recurrence;
```
Para D3-08, o equivalente é: a Solicitação aprovada entra no status `convertida` (D3-08 remove o erro hardcoded que hoje bloqueia esse status, ver `03-CONTEXT.md`) e uma nova Tarefa nasce na Lista de Contas a Pagar via `createTask` + `setTaskFieldValue` (campos equivalentes: fornecedor, valor, forma de pagamento, centro de custo), como cópia dirigida, não como automação de Lista — porque atravessa Listas diferentes, o que `runListAutomations` não cobre (ele reage dentro da mesma Lista).

**Atenção arquitetural (não violar):** `packages/dominio` "não conhece ninguém" — esta operação nasce aqui porque é "o que a coisa é" (uma Solicitação aprovada TEM uma Conta correspondente), mas quem a CHAMA (a partir de quê evento) é decisão de `apps/api` — provavelmente disparada dentro da mesma transação que aprova a Solicitação, no mesmo padrão de `runListAutomations` sendo chamada dentro de `changeTaskStatus`.

---

### `packages/dominio/src/operations/automations.ts::runAction` (modificar — A1-A9, gaps de vocabulário)

**Analogia:** o próprio arquivo, `runAction` (linhas 127-218) e `execute` (linhas 220-274) — ambos já lidos por inteiro.

**Achado importante para o planner:** `AutomationAction.controlKind` (`packages/dominio/src/types/ai.ts`, linha ~409) **já inclui** `"ramificar" | "invocarAgente" | "solicitarAprovacao" | "aguardar" | "notificar" | "encerrar"` — não é preciso mudar o TYPE. O gap real é só no `runAction`: o `case "controle"` (linhas 135-141) só trata `invocarAgente`:
```typescript
if (action.kind === "controle") {
  if (action.controlKind === "invocarAgente" && action.agentId) {
    const r = runLancamentoAgent(state, owner, action.agentId, task.id, automation.id);
    return r.ok ? { ok: true, output: r.value } : { ok: false, output: r.error };
  }
  return { ok: false, output: `Controle não suportado: ${action.controlKind ?? "?"}` };
}
```
Copiar a forma exata deste `if` para acrescentar ramos `aguardar`/`notificar`/`solicitarAprovacao` dentro do mesmo `if (action.kind === "controle")`. `notificar` nesta fase é in-app (D3-05/deferred: por Canal é Phase 5) — o padrão mais próximo de "notificação in-app" já existe em `"tarefa.comentar"` (linhas 189-204, com `mentions`) — reusar a mesma forma de Comentário com Menção em vez de inventar um canal novo.

**Padrão de auditoria a preservar** (linhas 178-186, `tarefa.alterarStatus`) — a Automação reatribui a autoria do Registro de Atividade a si mesma:
```typescript
const registro = state.activity.find((a) => a.objectId === task.id && a.action === "Status alterado");
if (registro) {
  const indice = state.activity.indexOf(registro);
  state.activity[indice] = { ...registro, actor: { kind: "automation", id: automation.id }, delegate: memberActor(owner) };
}
```
Qualquer ação nova (`aguardar`/`notificar`/`solicitarAprovacao`) que gere um Registro de Atividade próprio deve seguir a mesma disciplina de `actor: { kind: "automation", id: automation.id }`.

---

### `packages/dominio/src/operations/financeiro.ts::buildResumoDePagamento` (modificar — PAG-03/04, D3-03)

**Analogia:** a própria função (linhas 146-182), já lida por inteiro.

**O que já está certo e não muda:** a função é pura (recebe `state`+`task`, devolve `{ texto, conta, categoria, codigo }`, sem I/O) — é exatamente a peça que D3-03 exige separada da execução. O formato do texto (linhas 159-180) é byte a byte o RESUMO de CON-CP-08 — não tocar.

**O que precisa mudar — assinatura, não lógica:**
```typescript
// Hoje (linhas 148-151) — lê módulo fixo:
const conta = CONTA_POR_TAG[tag] ?? (centro ? centro.toUpperCase() : "A DEFINIR");
const cat = CATEGORIA_OMIE[categoriaCampo] ?? { nome: categoriaCampo || "A classificar", codigo: "9.99.99" };

// Depois — de-para chega por parâmetro (resolvido em apps/api via HTTP ao automation/):
export function buildResumoDePagamento(
  state: DataState,
  task: Task,
  deParaConta: Readonly<Record<string, string>>,
  deParaCategoria: Readonly<Record<string, { readonly nome: string; readonly codigo: string }>>,
): { readonly texto: string; readonly conta: string; readonly categoria: string; readonly codigo: string } {
  // mesmo corpo, só troca CONTA_POR_TAG → deParaConta, CATEGORIA_OMIE → deParaCategoria
```
Todos os chamadores (`runLancamentoAgent`, linha 253) precisam do de-para real injetado — que só existe em `apps/api`/`automation/` (D3-02: não gerar segundo de-para; ler `conciliador_contas_pagar_tria` via HTTP).

**Campo `rehearsal` já existe e é o mecanismo de D3-03** (linha 224):
```typescript
rehearsal: false,   // ← D3-03 só precisa passar `true` e nunca chamar o Omie de verdade quando true
```
Não criar tipo novo para o Ensaio; usar este campo, hoje hardcoded.

---

### `apps/api/src/automacoes/scheduler-worker.ts` (novo, greenfield — AUTO-01)

**Analogia:** `apps/api/src/persistencia/outbox-worker.ts` (arquivo inteiro, 297 linhas) — mesmo processo `apps/api`, adaptar o "o quê" (chamar `runScheduledAutomations` por Lista, não entregar por HTTP).

**Cabeçalho a espelhar** (linhas 1-34 do outbox-worker) — a mesma disciplina de documentar lease, backoff, classificação de erro ANTES do código; para o scheduler, documentar em vez disso: "pelo menos 1x/dia por (workspace, Lista) — idempotência já mora no domínio, ver `automations.ts::runScheduledAutomations`".

**Padrão de `Relogio` injetável, nunca `new Date()`/`Date.now()` direto** (linha 40, `import { type Relogio, relogioDoSistema } from "../testes/relogio"`) — usar o MESMO módulo `apps/api/src/testes/relogio.ts`, não recriar. Sem isso, testar "processo caiu e retomou sem perder o dia" (RESEARCH.md, Sampling Rate) exigiria esperar tempo real.

**Padrão de laço `setInterval` com trava de concorrência única** (linhas 277-297) — copiar exatamente esta forma, troca de corpo:
```typescript
let temporizador: ReturnType<typeof setInterval> | undefined;
let emAndamento = false;

return {
  iniciar() {
    if (temporizador) return;
    temporizador = setInterval(() => {
      if (emAndamento) return;
      emAndamento = true;
      void processarUm().finally(() => { emAndamento = false; });
    }, intervaloMs);
  },
  parar() {
    if (temporizador) clearInterval(temporizador);
    temporizador = undefined;
  },
  processarUm,
};
```
Para o scheduler, `processarUm()` chama `runScheduledAutomations(state, actingMemberId, listId, relogio.agora())` dentro da MESMA Unidade de Trabalho que `POST /operacoes/:nome` usa (hidratar → função pura → gravar diff), com um Ator de sistema (mesmo padrão da credencial de serviço "Agente do pipeline", D-15 da Phase 2) — nunca uma sessão de usuário.

**`sanitizarErro()` — reusar, não recriar** (linhas 90-113 do outbox-worker):
```typescript
const PADROES_SENSIVEIS: readonly RegExp[] = [
  /bearer\s+\S+/gi,
  /token=[^\s&"']+/gi,
  /\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}/g,  // CNPJ
  /\d{3}\.?\d{3}\.?\d{3}-\d{2}/g,           // CPF
  /https?:\/\/\S+\?\S+/gi,
];
export function sanitizarErro(erro: unknown, code = "ERRO_DESCONHECIDO"): { readonly code: string; readonly summary: string } { /* ... */ }
```
Importar de `../persistencia/outbox-worker` (é exportada) em vez de duplicar — dado financeiro (CPF/CNPJ/chave Pix/valor) não pode vazar em log do novo componente (Security Domain, Known Threat Patterns).

**Lição da Phase 2 a repetir aqui:** o `Pool` do `pg` precisa de um ouvinte de `error` (RESEARCH.md, `code_context`) — o pooler da Supabase encerra conexão ociosa; sem o ouvinte, o processo cai. Verificar como `apps/api/src/persistencia/conexao.ts::pool()` já trata isso e reusar o mesmo `pool()`, nunca abrir um `Pool` novo dedicado ao scheduler.

---

### `apps/api/src/automacoes/invocar-agente.ts` (novo — ponte HTTP para A7/A8, PAG-03)

**Analogia:** `outbox-worker.ts::entregar` (linhas 225-262) — mesma forma de chamada HTTP com timeout e classificação de erro, adaptado de "entregar evento fire-and-forget" para "chamar e esperar resultado usável pela Automação":
```typescript
resposta = await fetchImpl(`${opcoes.destinoUrl}${caminho}`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${opcoes.token}`,
    "idempotency-key": linha.id,
    "x-request-id": randomUUID(),
  },
  body: JSON.stringify({ /* ... */ }),
  signal: AbortSignal.timeout(timeoutMs),
});
```
**Diferença arquitetural que este arquivo tem que respeitar (Common Pitfalls #3 do RESEARCH.md):** a chamada de rede mora em `apps/api`, nunca em `packages/dominio`. O domínio recebe o RESULTADO já resolvido (categoria/conta/código ou erro) — este arquivo é quem chama `../financeiro-tria/automation`'s novo endpoint e devolve um objeto simples para o chamador em `apps/api` compor a chamada a `buildResumoDePagamento`/`runLancamentoAgent`.

---

### `apps/api/migracoes/005-*.sql` (novo, próximo número após `004-outbox-indice-unico-por-workspace.sql`)

**Analogia:** `003-integracao-e-importacao.sql` (estilo de comentário-por-tabela, arquivo inteiro) e `004-outbox-indice-unico-por-workspace.sql` (estilo de ajuste incremental com comentário explicando o invariante que mudou e por quê).

**Convenções confirmadas no código real:**
- Comentário de bloco ANTES de cada `create table`, explicando o invariante que a tabela garante, nunca só "o que" a coluna é (ex.: linhas 7-24 de `003`, sobre por que o outbox nasce na MESMA transação).
- Schema sempre qualificado: `plataforma.<tabela>` (nunca tabela sem schema) — todas as 6 tabelas de `003` seguem isso.
- `create table if not exists` / `create index if not exists` — idempotência de migration por construção, nunca `drop`+`create` sem guarda (excepto `004`, que usa `drop index if exists` seguido de `create unique index if not exists` — só quando SUBSTITUINDO um índice, com o comentário explicando por quê).
- Nota de dado sensível explícita quando a tabela pode tocar dado financeiro (linha 22-24 de `003`: `payload` nunca guarda CPF/CNPJ, chave Pix, código de barras — aplicar a mesma nota a qualquer tabela nova do scheduler/importação que grave `payload`/`input`).

**Aplicar a esta fase:** a tabela equivalente a `importacao_ledger` (linhas 155-174 de `003`, PK composta `(origem, legacy_task_id)`) já existe e serve para PAG-01 sem migration nova — reusar. Uma migration nova só é necessária se o scheduler precisar de estado persistido além do que `AutomationExecution` já cobre (RESEARCH.md, Don't Hand-Roll: "não construir watermark novo — `jaRodou` já resolve") — o caso mais provável de migration nova aqui é uma tabela de lease do scheduler-worker SE ele precisar de `locked_by`/`locked_at` por Lista, no mesmo padrão de `integration_outbox`.

---

### `apps/api/src/importacao/clickup/contas-a-pagar.ts` (novo — CLI/orquestração de PAG-01)

**Analogia:** `apps/api/src/importacao/financeiro/solicitacoes.ts` (`lerSolicitacoesLegadas`, `classificarLinha`) — mesma família "ler export → classificar linha por linha → chamar operação de domínio uma vez por linha, sob uma transação, com ledger de idempotência".

**Padrão de CLI fino, só composição** — copiar a forma exata de `apps/api/src/bootstrap/gestao.cli.ts` / `apps/api/src/persistencia/migrar.cli.ts` (ambos lidos por inteiro no Fase 0 PATTERNS.md, reaproveitados aqui):
```typescript
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
carregarEnv();
const cliente = await pool().connect();
let resultado;
try {
  resultado = await importarContasAPagar(cliente, { workspaceId, caminhoDoExport });
} finally {
  cliente.release();
}
console.log(`importadas ${resultado.importadas} · rejeitadas ${resultado.rejeitadas} · avisadas ${resultado.avisadas}`);
await encerrar();
```

---

### `../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-launch-service.ts` (novo endpoint dedicado, PAG-03/04)

**Analogia:** `../financeiro-tria/automation/src/adapters/plataforma.ts::criarPlataformaAdapter` — o padrão de rota versionada com `zod` no corpo, erro classificado em `ErroPermanenteDaPlataforma`/`ErroTransitorioDaPlataforma` (linhas 52-65), e `validar<T>(schema, dado, nomeDoMetodo)` (linha 169) antes de qualquer uso do payload.

**Regra que este arquivo tem que obedecer, confirmada pela pesquisa e pelo D3-08:** NUNCA escrever status em Lista nenhuma — é exatamente o padrão morto de `payment-automation-service.ts::legacyClickUpRaw().updateTaskStatus` que este endpoint substitui. A rota "calcula e lança no Omie, devolve o resultado" — quem muda o Status de "lançado omie" é a própria Automação A8 dentro de `apps/api`, via `runAction`/`"tarefa.alterarStatus"` (já existe, linhas 173-188 de `automations.ts`).

**Teste — reusar `omie-falso.ts`, não recriar:**
```typescript
// ../financeiro-tria/automation/src/testing/omie-falso.ts (já existe, arquivo inteiro)
export function criarOmieFalso(): OmieFalso { /* consultar/incluir/incluirComConexaoCaida/chamadas */ }
```
Este falso já prova o invariante V02-CUT (Omie inclui e a conexão cai antes da resposta → consulta posterior encontra o mesmo código, sem reincluir) — o novo endpoint de lançamento de Contas a Pagar deve usar `ConsultarContaPagar` antes de `IncluirContaPagar`, com `codigo_lancamento_integracao` determinístico por Tarefa (`tria:contas-a-pagar:<taskId>`, mesmo padrão do Plan 02-27 para Solicitações) — testar contra este falso, não contra o Omie real.

---

### `apps/web/src/features/estrutura/financeiro/contas-view.tsx` (PAG-05 — wiring, não construção)

**O que já existe (confirmado por leitura direta, linhas 219-257 e 672-714):** `FinanceToolbar` já recebe `selecionando`/`onToggleSelecionar`; a tabela já tem checkbox por linha (linha 791-792) e "selecionar todas do grupo" via `onToggleMany` (linhas 672-691, 699-712). O gesto de lote JÁ EXISTE na UI — o que falta para PAG-05 é a ação de lote em si (disparar 61 fechamentos) chamar uma rota `apps/api` que processe o lote numa única Unidade de Trabalho (ou N transações — decisão de projeto, DEC-06), não construir seleção múltipla do zero.

**Não precisa de analogia externa para este arquivo** — o padrão a seguir é o do próprio arquivo, só acrescentando um item ao `ActionMenu`/toolbar que chame a nova rota de lote, no mesmo estilo de `onCreateInGroup`/`onToggleMany` já callback-injetados pelo componente-pai.

## Padrões Compartilhados

### Ator de sistema para operações fora de sessão de usuário
**Fonte:** `packages/dominio/src/operations/importacao.ts::importActor` (linhas 69-77)
```typescript
export function importActor(origem: string): ActorRef {
  return { kind: "system", id: `importacao:${origem}` };
}
```
**Aplicar a:** o scheduler-worker precisa de um Ator/Membro de sistema equivalente ("Agente do pipeline", D-15 da Phase 2) para chamar `runScheduledAutomations` — nunca uma sessão de usuário; o CLI de importação de Contas a Pagar reusa `importActor("clickup")` como está.

### `Relogio` injetável — nunca `new Date()` direto em código que precisa ser testado sem esperar tempo real
**Fonte:** `apps/api/src/persistencia/outbox-worker.ts`, linha 40 e uso em `marcarPendente` (linha 199); `apps/api/src/testes/relogio.ts` (módulo existente)
**Aplicar a:** `scheduler-worker.ts` inteiro — e não só ele: `runScheduledAutomations` (domínio) já recebe `today: Date` explícito (linha 320 de `automations.ts`), o que o scheduler deve honrar passando `relogio.agora()` em vez de chamar `new Date()` dentro do próprio arquivo novo.

### `sanitizarErro()` — nunca logar erro cru quando o domínio é financeiro
**Fonte:** `apps/api/src/persistencia/outbox-worker.ts`, linhas 90-113 (exportada)
**Aplicar a:** `scheduler-worker.ts` e `invocar-agente.ts` — qualquer `catch` que logue ou grave `last_error_summary`/campo equivalente passa primeiro por `sanitizarErro()`. CPF/CNPJ/chave Pix/valor não podem vazar (Security Domain, `Known Threat Patterns`).

### Idempotência determinística por Tarefa (nunca `Date.now()`/`random` na chave)
**Fonte:** RESEARCH.md, `Don't Hand-Roll`, citando o Plan 02-27 (Phase 2) — padrão `tria:payment-request:<origem>:<taskId>`
**Aplicar a:** `codigo_lancamento_integracao` do novo endpoint de lançamento (`tria:contas-a-pagar:<taskId>`) e a chave de idempotência HTTP entre `apps/api` e `automation/` (`plataforma.http_idempotency`, já existente em `003-integracao-e-importacao.sql`, linhas 56-79 do arquivo).

### Migration: schema qualificado + comentário de invariante antes da tabela
**Fonte:** `apps/api/migracoes/003-integracao-e-importacao.sql` (padrão em todas as 6 tabelas)
**Aplicar a:** qualquer tabela nova de `005-*.sql` — `plataforma.<nome>`, `if not exists`, comentário de bloco explicando o invariante ANTES do `create table`, nota explícita de dado sensível se a tabela guardar `payload`/`input`/`response_body`.

## Sem Analogia Encontrada

| Arquivo/Peça | Papel | Fluxo de dados | Motivo |
|---|---|---|---|
| Lógica de negócio do motor de Automações genérico em si (o "porquê" de evento vs. agenda serem peças distintas do outbox) | arquitetura | event-driven + batch | Não é um arquivo, é uma decisão de composição sobre peças já existentes (`runListAutomations` síncrono + `runScheduledAutomations` puro + `outbox-worker.ts` como molde de poller) — RESEARCH.md já resolveu isso por leitura direta de código; não há um único arquivo-analogia porque a resposta é "nenhum destes dois cruza processo, então nenhum precisa de fila nova". |
| Concessão DINÂMICA da Grant "Pessoa da conta" (PAG-06) — o mecanismo que cria/deriva a Grant quando o Campo Pessoa é preenchido | operation/derivação | event-driven | Não existe hoje nenhum código que crie uma Grant fora do seed (`gr_cp_pessoa_${i+1}` é escrito à mão em `seed-financeiro.ts:645`) — confirmado por leitura direta: nenhuma operação em `tasks.ts`/`automations.ts` cria uma linha em `state.grants` a partir de um valor de Campo. A opção (b) do RESEARCH.md (Pitfall 4) — derivar `memberSeesTask` diretamente do valor do Campo Pessoa, sem Grant persistida — não tem analogia no código porque nenhuma outra permissão hoje é derivada de um valor de Campo em vez de uma linha de Grant; usar o padrão de leitura de Campo de `runAction`/`"tarefa.adicionarObservadores"` (linhas 159-172) como referência de ESTILO de leitura de `fromFieldDefinitionId`, não como precedente de permissão. |

## Metadados

**Escopo da busca de analogias:** `packages/dominio/src/operations/{importacao,automations,financeiro,collaboration,tasks}.ts`, `packages/dominio/src/{derive,types/ai,seed-financeiro}.ts`, `apps/api/src/persistencia/{outbox,outbox-worker,conexao}.ts`, `apps/api/src/importacao/{clickup,financeiro}/`, `apps/api/migracoes/`, `apps/web/src/features/estrutura/financeiro/contas-view.tsx`, `../financeiro-tria/automation/src/{adapters/plataforma.ts,testing/omie-falso.ts,tenants/tria/payment-automation-service.ts}`.
**Arquivos lidos por inteiro:** `importacao.ts` (240 linhas), `outbox-worker.ts` (297 linhas), `automations.ts` (370 linhas); trechos extensos de `financeiro.ts`, `tasks.ts` (920-980), `derive.ts` (840-940), `types/ai.ts` (380-489), `003-integracao-e-importacao.sql` (171 linhas), `004-outbox-indice-unico-por-workspace.sql` (26 linhas), `contas-view.tsx` (190-310, 640-730).
**Data da extração:** 2026-09-22
