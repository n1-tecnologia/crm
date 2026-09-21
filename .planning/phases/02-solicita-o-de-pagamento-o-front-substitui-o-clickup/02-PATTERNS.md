# Phase 2: Solicitação de pagamento — o front substitui o ClickUp - Mapa de Padrões

**Mapeado:** 2026-09-21
**Arquivos analisados:** 32 (extraídos de 02-CONTEXT.md, 02-RESEARCH.md, 02-UI-SPEC.md)
**Analogs encontrados:** 27 / 32

Convenção: todo caminho sem prefixo pertence a `crm-n1` (este monorepo). Caminhos
prefixados com `../financeiro-tria/` pertencem ao repositório irmão.

---

## File Classification

| Novo/Modificado | Repo | Role | Data Flow | Analog mais próximo | Qualidade |
|---|---|---|---|---|---|
| `packages/dominio/src/types/ai.ts` (`ApprovalRequest` → união discriminada `ApprovalOrigin`) | crm-n1 | model | CRUD | mesmo arquivo, `AgentExecution`/`ExecutionStep` (union por `kind`) | exact (padrão de união já usado em `ExecutionStep.kind`, `Form.questions[].target`) |
| `packages/dominio/src/operations/ai.ts` (`decideApproval` → aceitar origem sem `executionId`; nova `decideProcessApproval` ou generalização) | crm-n1 | service (domínio puro) | CRUD | mesmo arquivo, `decideApproval` (linhas 28-115) | exact |
| `packages/dominio/src/operations/scale.ts` (`submitForm` → separar `actor`/`authorizationContext`/`provenance`; operação atômica) | crm-n1 | service (domínio puro) | CRUD | mesmo arquivo, `submitForm` (linhas 470-507) e `createTask`/`setTaskFieldValue` chamadas por ele | exact |
| `packages/dominio/src/operations/scale.ts` (`solicitarAprovacao`, ação mínima de roteamento) | crm-n1 | service (domínio puro) | event-driven | `decideApproval` + `createForm` (padrão de `recordActivity` + `ok/fail`) | role-match |
| `packages/dominio/src/operations/lists.ts` ou módulo de evolver (config idempotente da Lista/Campos/Status) | crm-n1 | service (domínio/bootstrap) | batch | `packages/dominio/src/seed-produto.ts` (bootstrap write-once) + `apps/api/src/persistencia/repositorio.ts::semear()` | role-match — não há hoje um "evolver reaplicável sobre Espaço não vazio"; adaptar do zero a partir do seed |
| `apps/api/src/rotas/formularios-publicos.ts` (`GET /v1/public/forms/:secret`, `POST /v1/public/forms/:secret/uploads`, `POST /v1/public/forms/:secret/submissions`) | crm-n1 | route (pública) | request-response | `apps/api/src/rotas/estado.ts` (GET simples) + `apps/api/src/rotas/operacoes.ts` (POST com schema Zod + `executar()`) | role-match — rota nova precisa ser pública (`config: { publica: true }`), as demais exigem `request.membro` |
| `apps/api/src/rotas/esquemas/formularios-publicos.ts` (schemas Zod dos 3 endpoints) | crm-n1 | config/validation | request-response | `apps/api/src/rotas/esquemas-de-argumentos.ts` + pasta `esquemas/` | exact |
| `apps/api/src/persistencia/outbox.ts` (gravação atômica Tarefa+evento) | crm-n1 | service (persistência) | event-driven | `apps/api/src/persistencia/unidade-de-trabalho.ts::executar()` | role-match — estende o mesmo `cliente.query` transacional, adiciona INSERT em `plataforma.integration_outbox` antes do commit |
| `apps/api/src/persistencia/outbox-worker.ts` (entrega HTTP + retry/backoff/lease) | crm-n1 | service (worker) | streaming/event-driven | nenhum análogo direto no repo | no analog — ver seção dedicada, usar RESEARCH.md §"Outbox transacional" como especificação |
| `apps/api/src/servicos/storage-uploads.ts` (ticket assinado, verificação pós-upload) | crm-n1 | service | file-I/O | `apps/api/src/servicos/convidar-membro.ts` (padrão de serviço com I/O externo antes/depois da UoW, chamado por `SERVICOS` em `operacoes.ts`) | role-match |
| `apps/api/src/rotas/webhooks-integracao.ts` (`POST /v1/integrations/payment-approvals/classifications` — callback do classifier) | crm-n1 | route (serviço-a-serviço) | request-response | `apps/api/src/rotas/operacoes.ts` (schema + tratamento de erro) + `apps/api/src/plugins/autenticacao.ts` (mas com credencial de serviço, não JWT humano) | role-match |
| `apps/api/src/plugins/autenticacao-servico.ts` (credencial de serviço p/ `automation/`) | crm-n1 | middleware | request-response | `apps/api/src/plugins/autenticacao.ts` (hook `onRequest`, decorate, `config.publica`) | exact — mesmo mecanismo de hook, escopo/credencial diferente |
| `apps/api/migracoes/00N-outbox-idempotencia-credenciais.sql` | crm-n1 | migration | batch | `apps/api/migracoes/001-plataforma.sql` e `002-registros-colunas-geradas.sql` | exact |
| `apps/api/src/importacao/financeiro/solicitacoes.ts` (leitura de `public.solicitacoes_pagamentos`) | crm-n1 | service (importador) | batch | `apps/api/src/importacao/clickup/exportar.ts` (paginação, retomada, gravação atômica) | exact |
| `apps/api/src/importacao/financeiro/importar.cli.ts` | crm-n1 | CLI | batch | `apps/api/src/importacao/clickup/exportar.cli.ts` e `usuarios.cli.ts` | exact |
| `apps/api/src/importacao/financeiro/manifesto.ts` (contagens, rejeitos, lacunas) | crm-n1 | utility | transform | `apps/api/src/importacao/clickup/manifesto.ts` | exact |
| `apps/api/src/importacao/financeiro/de-para.ts` (autoria/Ator de importação) | crm-n1 | utility | transform | `apps/api/src/importacao/clickup/de-para-usuarios.ts` | exact |
| `apps/web/src/app/(publico)/f/[segredo]/page.tsx` (reescrita: cliente HTTP público em vez de `submitForm` local) | crm-n1 | component (Server+Client) | request-response | mesmo arquivo atual (linhas 1-157) | exact — mudar só a fonte de dados/transporte, manter estrutura visual |
| `apps/web/src/dados/publico-provider.tsx` → substituído por `apps/web/src/dados/transporte-publico.ts` | crm-n1 | provider/utility | request-response | mesmo arquivo (35 linhas) + `apps/web/src/dados/store.ts`/`transporte.ts` (não lido, mas referenciado por CONTEXT como par existente) | role-match |
| `apps/web/src/features/formulario-publico/*` (upload de arquivos, campos condicionais) | crm-n1 | component | file-I/O | `apps/web/src/app/(publico)/f/[segredo]/page.tsx` (renderização de perguntas por `target.kind`) | role-match — não existe hoje um componente de upload; compor com `Field`/`Button`/primitivas do barril `@/features/shell/ui` |
| `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx` (discriminar `agentExecution` vs `processTask`) | crm-n1 | component | CRUD | mesmo arquivo (linhas 1-316) | exact |
| `apps/web/src/features/tarefa/painel-aprovacao.tsx` (card de aprovação na página da Tarefa) | crm-n1 | component | CRUD | `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx::renderCard` + `ConfirmDialog` (linhas 113-184, 197-258) | exact — mesma operação de decisão, layout adaptado ao card |
| `apps/web/src/features/tarefa/timeline.tsx` (fusão Comentários + Atividades) | crm-n1 | component | CRUD | `TaskComments` (citado no UI-SPEC, não lido — comportamento de fio/menções a reaproveitar) | role-match — não lido diretamente; localizar componente real antes de implementar |
| `apps/web/src/features/estrutura/forms-editor.tsx` (sem mudança funcional nesta fase, referência de estrutura de Formulário) | crm-n1 | component | CRUD | mesmo arquivo (209 linhas) | exact — não é alvo de escrita nesta fase, mas Contrato de Formulário é lido por ele |
| `../financeiro-tria/automation/src/adapters/plataforma.ts` | financeiro-tria | service (adapter) | request-response | `../financeiro-tria/automation/src/adapters/clickup.ts` (132 linhas, os 7 métodos) | exact |
| `../financeiro-tria/automation/src/tenants/tria/plataforma-payment-mapper.ts` | financeiro-tria | transform (mapper) | transform | `../financeiro-tria/automation/src/tenants/tria/clickup-payment-mapper.ts` | exact — usar como referência de forma, não copiar fallbacks defensivos |
| `../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts` (trocar import fixo de `clickUpAdapter` por `PaymentRequestAdapter` injetado) | financeiro-tria | service | request-response | mesmo arquivo (1928 linhas; usos do adapter mapeados nas linhas 2, 441-1851) | exact |
| `../financeiro-tria/automation/src/adapters/payment-request-adapter.ts` (interface/porta) | financeiro-tria | interface/type | request-response | `../financeiro-tria/automation/src/adapters/clickup.ts` (assinaturas dos 7 métodos públicos) | exact |
| `../financeiro-tria/automation/src/http/routes.ts` (`POST /webhooks/plataforma/solicitacao-criada`, `comentario-criado`, `aprovacao-decidida`) | financeiro-tria | route | event-driven | mesmo arquivo, `mountTenantWebhooks` (linhas 91-177) e `handleError` (linhas 66-78) | exact |
| `../financeiro-tria/automation/src/adapters/platform-adapter-queue.ts` (fila persistente `platform_adapter_commands`) | financeiro-tria | service (fila) | event-driven | nenhum análogo direto — `automation_workflow_runs` é telemetria, não fila (RESEARCH.md item 6) | no analog — desenhar a partir da spec de RESEARCH.md §"Adapter Queue and Run Durability" |
| `../financeiro-tria/automation/migrations/NNN-platform-adapter-commands.sql` | financeiro-tria | migration | batch | migrations existentes de `automation_workflow_runs` (não lidas — localizar pasta de migrations do automation antes de escrever) | role-match |
| contract fixtures (`contratos/payment-requests-v1/*.json`, duplicadas nos dois repos) | ambos | config/test | transform | nenhum análogo direto | no analog — RESEARCH.md especifica a matriz completa de fixtures |

---

## Pattern Assignments

### `packages/dominio/src/types/ai.ts` — `ApprovalRequest` vira união discriminada

**Analog:** mesmo arquivo, padrão de união já usado por `ExecutionStep.kind` (linhas 118-134) e por `Form.questions[].target` em `scale.ts`.

**Forma atual a substituir** (linhas 94-115):
```typescript
/** B80 — internal entity of the Execution, WITH identity. */
export interface ApprovalRequest {
  readonly id: Id;
  readonly executionId: Id;
  readonly stepIndex: number;
  readonly requestedBy: ActorRef;
  readonly reason: "autonomia" | "permissao" | "limite" | "acaoExplicita";
  readonly object: { ... };
  approverMemberId: Id;
  decision?: "aprovada" | "rejeitada" | "expirada" | "cancelada";
  decidedByMemberId?: Id;
  decidedAt?: Instant;
  readonly createdAt: Instant;
  readonly deadline: Instant;
}
```

**Padrão de união recomendado** (RESEARCH.md, seção "Aprovação como união discriminada"):
```typescript
type ApprovalOrigin =
  | { kind: "agentExecution"; executionId: Id; stepIndex: number; deadline: Instant }
  | { kind: "processTask"; taskId: Id; processStep: "pagamento"; threadCommentId: Id };
```
Migrar `ApprovalRequest` para conter `origin: ApprovalOrigin` no lugar de `executionId`/`stepIndex`/`deadline` soltos. O hidratador precisa normalizar registros antigos para `{ kind: "agentExecution", ... }` — usar o mesmo estilo de discriminação por `kind` já visto em `q.target.kind` (`scale.ts` linhas 341-500) e `item.kind` (`ExecutionStep`).

---

### `packages/dominio/src/operations/ai.ts` — `decideApproval`

**Analog:** mesmo arquivo (linhas 1-115+).

**Imports pattern** (linhas 6-19):
```typescript
import { fail, ok, type DataState, type OperationResult } from "../state";
import type {
  Agent,
  ApprovalRequest,
  Automation,
  AutomationVersion,
  ChatAnchor,
  ChatMessage,
  ChatSession,
  Id,
} from "../types";
import { contactDisplayName } from "../derive";
import { memberActor, nextId, recordActivity, systemActor } from "./activity";
```

**Core pattern — autorização + decisão + efeitos colaterais + atividade** (linhas 28-115):
```typescript
export function decideApproval(
  state: DataState,
  actingMemberId: Id,
  approvalId: Id,
  decision: "aprovada" | "rejeitada",
  reason?: string,
): OperationResult<ApprovalRequest> {
  const approval = state.approvals.find((a) => a.id === approvalId);
  if (!approval) return fail("Solicitação de Aprovação não encontrada.");
  if (approval.decision) {
    return fail(`Esta Solicitação já foi ${approval.decision}.`);
  }
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo decide uma Solicitação de Aprovação.");
  }
  // ... resolve autorização por approverMemberId / owner / role.base administrador|proprietario
  // ... checa deadline SÓ DEPOIS de autorizar (B80: expirar não é efeito de quem não tinha direito)
  approval.decision = decision;
  approval.decidedByMemberId = actingMemberId;
  approval.decidedAt = now();
  // ... efeitos colaterais na Execução/Tarefa conforme o tipo
  recordActivity(state, { actor: ..., action: "...", objectType: "approvalRequest", objectId: approval.id, ... });
  return ok(approval);
}
```

**Aplicar a `decideProcessApproval`:** repetir exatamente essa forma (resolver approval → checar já-decidido, idempotente → autorizar por `approverMemberId`/role administrador → decidir → publicar comentário canônico no tópico (`createComment`, ver `packages/dominio/src/operations/comments.ts`, não lido diretamente mas mesmo padrão de `recordActivity`) → mudar Status da Tarefa → `recordActivity` com `source: "click"|"comment"`). A idempotência de replay (mesma decisão = sucesso) e o conflito de decisão oposta seguem o mesmo `if (approval.decision) return fail(...)` — mas para replay da MESMA decisão, retornar `ok(approval)` em vez de `fail`, conforme D-09.

---

### `packages/dominio/src/operations/scale.ts` — `submitForm`

**Analog:** mesmo arquivo (linhas 359-507).

**Imports pattern** (implícito no módulo, ver topo do arquivo — não repetido aqui pois já mapeado): usa `fail`, `ok`, `nextId`, `now`, `recordActivity`, `memberActor`, `systemActor` de `./activity`, e helpers de `containerAdminRefusal`, `effectiveLifecycleOfList`, `memberReachesContainer`.

**Padrão "tudo ou nada" (rollback manual dentro da própria operação)** (linhas 480-503):
```typescript
const antes = { tasks: state.tasks.length, activity: state.activity.length, readable: state.workspace.taskReadableId.next };
const desfazer = (motivo: string, field: Id): OperationResult<Task> => {
  state.tasks.splice(antes.tasks);
  state.activity.splice(0, state.activity.length - antes.activity);
  state.workspace.taskReadableId.next = antes.readable;
  return fail(motivo, field);
};
const created = createTask(state, form.ownerMemberId, { listId: form.listId, title: ... });
if (!created.ok) return fail("...");
const task = created.value;
task.provenance = { kind: "form", sourceId: form.id, sourceName: form.name, at: now() };
for (const q of form.questions) {
  // ... setTaskFieldValue por resposta; erro chama desfazer()
}
form.submissions += 1;
recordActivity(state, { actor: memberActor(form.ownerMemberId), action: "Tarefa criada por Formulário", ... });
return ok(task);
```

**Mudança exigida por D-03/D-02 e RESEARCH.md item 3:** separar `actor` (`systemActor` com sub-tipo `sistema/Formulário`, ver `systemActor` importado de `./activity`) de `authorizationContext` (`form.ownerMemberId`, usado só para `createTask`/`setTaskFieldValue`/`containerAdminRefusal`). A `recordActivity` final deve usar `systemActor`-like actor distinto do dono, não `memberActor(form.ownerMemberId)` como hoje (linha 505) — esse é exatamente o bug que D-03 aponta. Verificar a assinatura de `systemActor` em `activity.ts` antes de implementar (não lido nesta passada — ler `packages/dominio/src/operations/activity.ts` no plano correspondente).

**Anexos e evento de saída:** a operação deve permanecer síncrona e pura (não chamar HTTP/outbox); a gravação do outbox acontece na mesma transação da UoW em `apps/api`, não dentro de `submitForm`. Ver padrão de `unidade-de-trabalho.ts` abaixo.

---

### `apps/api/src/rotas/operacoes.ts` e `apps/api/src/rotas/estado.ts` — rotas HTTP autenticadas

**Analog:** os dois arquivos completos (201 e 33 linhas).

**Padrão de rota pública vs autenticada** — hoje só `GET /saude` usa `config: { publica: true }` (citado em `autenticacao.ts` linha 15). A nova rota `formularios-publicos.ts` deve seguir o mesmo mecanismo:
```typescript
app.withTypeProvider<ZodTypeProvider>().get(
  "/v1/public/forms/:secret",
  { config: { publica: true }, schema: { params: PARAMS } },
  async (request, reply) => { ... },
);
```

**Padrão de schema Zod + erro 400 sanitizado** (operacoes.ts linhas 39-54, 87-90, 152-165):
```typescript
const PARAMS = z.object({ nome: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9]*$/, "...") });
// ...
function mensagemDeEntradaInvalida(nome: string, problema?: { readonly path: ReadonlyArray<PropertyKey> }): string {
  const caminho = problema && problema.path.length > 0 ? ` em ${problema.path.join(".")}` : "";
  return `Entrada inválida para "${nome}"${caminho}.`;
}
// no handler:
const validacao = esquemaDeArgumentos(nome).safeParse(revividos);
if (!validacao.success) {
  request.log.warn({ operacao: nome, ... }, "Entrada inválida para a operação");
  return reply.code(400).send({ ok: false, error: mensagemDeEntradaInvalida(nome, validacao.error.issues[0]) });
}
```
Nunca devolver `validacao.error.message` (zod) cru ao cliente — só a mensagem sanitizada; detalhe completo vai a `request.log.warn`.

**Padrão de serviço com I/O antes da UoW** (operacoes.ts linhas 92-118, `SERVICOS.inviteMember`):
```typescript
const SERVICOS: Partial<Record<NomeDeOperacao, (membro: MembroDaSessao, args: readonly unknown[]) => Promise<ResultadoTransacao<unknown>>>> = {
  inviteMember: (membro, args) => {
    const entrada = ENTRADA_INVITE_MEMBER.safeParse(args[0]);
    if (!entrada.success) throw new ErroDeEntrada(mensagemDeEntradaInvalida("inviteMember"));
    return convidarMembro({ workspaceId: membro.workspaceId, actingMemberId: membro.id, ... });
  },
};
```
Este é o padrão a seguir para `storage-uploads.ts` (resolver ticket assinado do Supabase Storage ANTES de entrar na UoW) e para o serviço que consome o classifier (I/O de resolução de autor/tópico antes de chamar a operação canônica).

**Padrão de resposta 200 mesmo em recusa de domínio, 409 em conflito** (linhas 191-198):
```typescript
if ("conflito" in resultado && resultado.conflito) {
  return reply.code(409).send(resultado);
}
return reply.code(200).send(resultado);
```

---

### `apps/api/src/persistencia/unidade-de-trabalho.ts` — outbox transacional

**Analog:** mesmo arquivo (88 linhas).

**Core pattern — hidratar → operação pura → revisão otimista → gravar** (linhas 34-88):
```typescript
export async function executar<T>(
  workspaceId: string,
  operacao: (state: DataState) => OperationResult<T>,
  opcoes: OpcoesExecucao = {},
): Promise<ResultadoTransacao<T>> {
  const tentativas = opcoes.tentativas ?? 3;
  for (let n = 0; n < tentativas; n += 1) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const antes = await hidratar(cliente, workspaceId);
      syncIdSequence(antes.state);
      const resultado = operacao(antes.state);
      if (!resultado.ok) {
        await cliente.query("rollback");
        return { ...resultado, diferenca: DIFERENCA_VAZIA, revisao: antes.revisao, revisaoAnterior: antes.revisao };
      }
      const travada = await cliente.query<{ revisao: string }>(
        "update plataforma.workspaces set revisao = revisao + 1, ... where workspace_id = $1 and revisao = $2 returning revisao",
        [workspaceId, antes.revisao],
      );
      if (travada.rowCount === 0) {
        await cliente.query("rollback");
        continue; // conflito, tenta de novo
      }
      const diferenca = await gravar(cliente, workspaceId, antes.state, antes);
      await cliente.query("commit");
      return { ...resultado, diferenca, revisao: Number(travada.rows[0]!.revisao), revisaoAnterior: antes.revisao };
    } catch (erro) {
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }
}
```

**Extensão para outbox (D-18):** inserir no MESMO `cliente` e ANTES de `cliente.query("commit")` uma gravação em `plataforma.integration_outbox` (evento explícito produzido pela operação de domínio, nunca deduzido por diff — RESEARCH.md "Anti-Patterns"). A operação de domínio (ex. `submitForm`) não sabe de outbox; a UoW/rota decide quais eventos gravar a partir do tipo de operação e do `resultado.value`, seguindo o mesmo princípio de "nada aqui reescreve regra de negócio" do cabeçalho do arquivo. Nunca chamar `fetch`/HTTP dentro deste bloco transacional — a entrega é responsabilidade do worker separado.

---

### `apps/api/src/plugins/autenticacao.ts` — credencial de serviço

**Analog:** mesmo arquivo completo.

**Core pattern — hook `onRequest`, decorate, isenção por config** (linhas 42-83, seção lida):
```typescript
export function registrarAutenticacao(app: FastifyInstance, opcoes: OpcoesDeAutenticacao): void {
  app.decorateRequest("membro", null, []);
  app.addHook("onRequest", async (request, reply) => {
    if (request.routeOptions.config.publica === true) return;
    const cabecalho = request.headers.authorization;
    const token = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : undefined;
    if (!token) {
      await reply.status(401).send({ ok: false, error: "Sem sessão." });
      return;
    }
    const claims = await opcoes.verificarToken(token);
    if (!claims) {
      await reply.status(401).send({ ok: false, error: "Sessão inválida ou expirada." });
      return;
    }
    const membro = await opcoes.resolverMembro(opcoes.workspaceId, claims.sub);
    if (!membro) {
      await reply.status(403).send({ ok: false, error: "Sua conta existe, mas não é Membro deste Espaço de Trabalho." });
      return;
    }
    // ... checa membro.state
    request.membro = { id: membro.id, workspaceId: opcoes.workspaceId, state: membro.state };
  });
}
```

**Para `autenticacao-servico.ts` (D-15):** registrar um segundo hook (ou plugin encapsulado nas rotas `/v1/integrations/*`) que verifica `Authorization: Bearer <service credential>` contra `plataforma.service_credentials` (hash, não texto puro), resolve para o Membro fixo `Agente do pipeline` — mesmo padrão de decorar `request.membro`, mas a fonte da identidade é a tabela de credenciais de serviço, não o Supabase Auth. Preservar exatamente a forma de erro `{ ok: false, error: "..." }` e os códigos 401/403.

---

### `apps/api/src/importacao/clickup/exportar.ts` + `exportar.cli.ts` + `manifesto.ts` + `de-para-usuarios.ts` — importador histórico

**Analog:** os 4 arquivos completos.

**Padrão de gravação atômica + retomada por filesystem/idempotência** (exportar.ts, cabeçalho + função `gravarAtomico`, não impressa mas referenciada nas linhas 1-13):
> "Antes de qualquer chamada de rede, `lerSeValido` confere se o arquivo já existe e é válido; se sim, a chamada nunca acontece. Toda gravação é atômica (`gravarAtomico`: escreve `<caminho>.tmp`, faz `rename`)."

Para `apps/api/src/importacao/financeiro/solicitacoes.ts`, replicar o mesmo princípio mas com idempotência por `(origin='clickup', legacyTaskId)` em vez de arquivo: checar existência antes de importar, processar em lotes pequenos com checkpoint em ledger (nova tabela `plataforma.importacao_ledger` ou equivalente), nunca reprocessar linha já confirmada.

**Padrão de CLI fino, só composição** (exportar.cli.ts linhas 1-50, comentário de cabeçalho):
```typescript
import { criarClienteClickUp } from "./cliente";
import { exportarClickUp, type PoliticaDeAnexos, type ResultadoDaExportacao } from "./exportar";
import { escreverManifesto, gerarManifesto, type Manifesto } from "./manifesto";
import { carregarEnv } from "../../persistencia/conexao";

carregarEnv();
const argv = process.argv.slice(2);
// parsing de flags --chave=valor sem biblioteca, ex.: --dry-run, --apply, --batch-size, --resume
```
Aplicar a mesma estrutura a `importar.cli.ts`: `solicitacoes:importar --dry-run`, `--apply --batch-size 50 --resume <run-id>`, `solicitacoes:reconciliar --run <run-id>` (RESEARCH.md "Import mechanics"). Nunca imprimir segredo/CPF/CNPJ/comentário — só ids, contagens e caminhos (mesma disciplina do cabeçalho de `exportar.cli.ts`).

**Padrão de manifesto sanitizado** — `manifesto.ts` (469 linhas, não lido em detalhe nesta passada, mas o par `exportar.ts`/`manifesto.ts` já demonstra a separação "coleta bruta" vs "relatório sanitizado agregado"). Replicar essa separação: `importar.ts` faz I/O e grava ledger; `manifesto.ts` novo lê o ledger e produz só contagens (lidas, válidas, rejeitadas, ambíguas, duplicadas, anexos vinculáveis/ausentes), nunca dado individual sensível.

---

### `../financeiro-tria/automation/src/adapters/clickup.ts` — os sete métodos do adapter

**Analog:** arquivo completo (132 linhas), já lido integralmente acima.

**Forma da interface a extrair para `payment-request-adapter.ts`:**
```typescript
export interface PaymentRequestAdapter {
  getTask(taskId: string): Promise<PaymentRequestDtoV1>;
  listPaymentRequestTasks(options?: { cursor?: string; limit?: number; updatedAfter?: string }): Promise<{ items: PaymentRequestDtoV1[]; nextCursor?: string }>;
  createComment(taskId: string, commentText: string, options?: { assignee?: string; notifyAll?: boolean; parentCommentId?: string; mentionMemberIds?: string[]; idempotencyKey: string }): Promise<CommentDto>;
  getCommentReplies(commentId: string, options?: { cursor?: string; limit?: number }): Promise<{ items: CommentDto[]; nextCursor?: string }>;
  addTaskTag(taskId: string, tagName: string, options?: { idempotencyKey: string }): Promise<void>;
  updateTaskDueDate(taskId: string, dueDateIso: string | null, options?: { idempotencyKey: string }): Promise<void>;
  updateTaskStatus(taskId: string, status: string, options?: { reason?: string; idempotencyKey: string }): Promise<void>;
}
```

**Padrão de erro por método** (repetido em cada um dos 7 métodos de `clickup.ts`, ex. linhas 15, 29, 60, 70, 82, 98, 128):
```typescript
if (!response.ok) throw new Error(`ClickUp <método> failed: ${response.status} ${await response.text()}`);
```
`plataforma.ts` deve seguir exatamente essa forma de erro por método (trocando "ClickUp" por "Plataforma"), mas envelopando com `Idempotency-Key` no header de toda escrita e tratando os códigos 400/401/403/404/409/422/429/503 do contrato v1 (RESEARCH.md, seção "Authentication and envelope") em vez de só `!response.ok`.

**Padrão de fallback quando token ausente (mock-friendly)** (linhas 8-10, 20, 45-47, 65):
```typescript
if (!this.token) {
  return { id: taskId, name: `Solicitacao ${taskId}`, custom_fields: [], attachments: [] };
}
```
Preservar esse estilo de "adapter noop sem credencial" em `plataforma.ts` para não quebrar ambiente local sem `.env` completo — mas usando a credencial de serviço (`optionalEnv("PLATAFORMA_SERVICE_TOKEN")`) no lugar do token do ClickUp.

---

### `../financeiro-tria/automation/src/http/routes.ts` — webhooks

**Analog:** mesmo arquivo completo (300 linhas).

**Padrão de handler de webhook: parse → chamar serviço → resposta 202 com envelope, erro sanitizado** (linhas 95-103, 105-121):
```typescript
router.post("/clickup/task-created", async (req, res) => {
  const taskId = getTaskId(req.body);
  if (!taskId) return res.status(400).json({ error: "task_id is required" });
  try {
    const solicitacao = await service.syncAndAssignResponsible(taskId);
    res.status(202).json({ accepted: true, event: "taskCreated", tenantId, taskId, solicitacao });
  } catch (e) { await handleError(res, e); }
});
```

**`handleError` atual — NÃO copiar a exposição de detalhe** (linhas 66-78):
```typescript
async function handleError(res: Response, error: unknown) {
  let message: string;
  if (error instanceof Error) { message = error.message; }
  else if (...) { message = `${pg.message}${pg.details ? ` — ${pg.details}` : ""}${pg.code ? ` (code: ${pg.code})` : ""}`; }
  else { message = JSON.stringify(error); }
  console.error("[error]", message);
  res.status(500).json({ error: message });
}
```
D-16 e RESEARCH.md exigem envelope sanitizado (`{ error: { code, message, requestId, retryable, details? } }`, sem detalhe interno de Postgres) e autenticação ANTES do parse — as novas rotas `/webhooks/plataforma/*` precisam de uma função de erro nova, não reaproveitar `handleError` como está. Reaproveitar apenas a estrutura de roteamento (`mountTenantWebhooks`-like: um router pequeno montado em `router.use("/webhooks/plataforma", ...)`) e o padrão de resposta 202 assíncrona.

---

### `../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts` — composição do adapter

**Analog:** mesmo arquivo, pontos de uso do `clickUpAdapter` (linha 2 e as ~20 chamadas mapeadas: `getTask`, `listPaymentRequestTasks`, `createComment`, `getCommentReplies`, `updateTaskStatus`, `updateTaskDueDate`, `addTaskTag`).

**Padrão a seguir:** trocar `import { clickUpAdapter } from "../../adapters/clickup";` por injeção de `PaymentRequestAdapter` no construtor da classe (`class PaymentAutomationService`, linha 431), selecionado uma única vez no composition root (`routes.ts` ou `index.ts` do automation) por `PAYMENT_REQUEST_SOURCE=clickup|plataforma`. Nenhuma das ~20 chamadas internas muda de forma — só a fonte do adapter. Isso preserva `payment-rules.ts` e o restante do pipeline intocados (D-17).

---

## Shared Patterns

### Autenticação humana (JWT Supabase → Membro)
**Fonte:** `apps/api/src/plugins/autenticacao.ts`
**Aplicar a:** todas as rotas autenticadas novas (`/v1/integrations/*` variante humana, se houver; fila e card de aprovação no frontend consomem via `useSession`/`useData` como hoje).
```typescript
app.addHook("onRequest", async (request, reply) => {
  if (request.routeOptions.config.publica === true) return;
  // ... Bearer → verificarToken → resolverMembro(workspaceId, sub) → request.membro
});
```

### Erro de domínio como valor, nunca exceção (`OperationResult`)
**Fonte:** `packages/dominio/src/operations/ai.ts`, `scale.ts` (padrão `fail(...)`/`ok(...)`)
**Aplicar a:** todas as novas operações de domínio (`decideProcessApproval`, `solicitarAprovacao`, evolver de configuração, operação de importação histórica).
```typescript
if (!condicaoValida) return fail("Mensagem em pt-BR para o usuário.", "campoOpcional");
// ...
return ok(valor);
```

### Transação UoW: hidratar → operação pura → revisão otimista → gravar
**Fonte:** `apps/api/src/persistencia/unidade-de-trabalho.ts`
**Aplicar a:** rota pública de submissão de Formulário (com outbox no mesmo commit), operação de decisão de aprovação, importação histórica (sem outbox — D-24/D-25 exigem "não emitir outbox operacional").

### Rota HTTP fina: schema Zod → `executar()`/serviço → mapear `OperationResult`/`Conflito` para HTTP
**Fonte:** `apps/api/src/rotas/operacoes.ts`
**Aplicar a:** `formularios-publicos.ts`, `webhooks-integracao.ts` (endpoint de classificações), qualquer rota nova de `apps/api`.

### CLI fino: só composição, sem regra
**Fonte:** `apps/api/src/importacao/clickup/exportar.cli.ts`, `usuarios.cli.ts`
**Aplicar a:** `importar.cli.ts` do histórico financeiro.

### Adapter com fallback mock quando credencial ausente + erro padronizado por método
**Fonte:** `../financeiro-tria/automation/src/adapters/clickup.ts`
**Aplicar a:** `../financeiro-tria/automation/src/adapters/plataforma.ts`.

### Handler de webhook: parse mínimo → chamar serviço → 202 assíncrono; NUNCA vazar detalhe de erro
**Fonte:** `../financeiro-tria/automation/src/http/routes.ts` (estrutura de roteamento sim, `handleError` não)
**Aplicar a:** `POST /webhooks/plataforma/solicitacao-criada|comentario-criado|aprovacao-decidida`.

### Primitivas visuais reutilizáveis, barril `@/features/shell/ui`
**Fonte:** `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx`, `apps/web/src/app/(publico)/f/[segredo]/page.tsx`
**Aplicar a:** todo componente novo de Fase 2 (`Painel`, `Field`, `Button`, `ConfirmDialog`, `Toast`, `EmptyState`, `Section`, `Pilula`) — nunca criar componente novo se composição resolver (regra explícita do UI-SPEC).

---

## No Analog Found

| Arquivo | Role | Data Flow | Razão |
|---|---|---|---|
| `apps/api/src/persistencia/outbox-worker.ts` | service (worker) | event-driven | Nenhum worker de entrega/retry existe hoje no `crm-n1`; desenhar a partir da tabela e política de backoff especificadas em RESEARCH.md ("Outbox transacional", "Idempotência HTTP") |
| `../financeiro-tria/automation/src/adapters/platform-adapter-queue.ts` | service (fila) | event-driven | `automation_workflow_runs` é telemetria best-effort, não fila FIFO por task; construir do zero conforme RESEARCH.md "Adapter Queue and Run Durability" |
| `apps/web/src/features/formulario-publico/upload-de-arquivo.tsx` | component | file-I/O | Não existe hoje upload de arquivo autorizado no app; compor com Supabase `createSignedUploadUrl`/`uploadToSignedUrl` (RESEARCH.md, fontes vendor) + primitivas visuais existentes (`Painel`, `Button`) |
| contract fixtures (`contratos/payment-requests-v1/*.json`) | config/test | transform | Não existe harness de contract test hoje entre os dois repos; especificação completa da matriz está em RESEARCH.md "Contract Fixture Matrix" |
| `packages/dominio` — evolver idempotente de Lista/Campos/Status sobre Espaço não vazio | service (bootstrap) | batch | O bootstrap atual (`buildProductSeed`/`semear()`) é write-once sobre Espaço vazio; RESEARCH.md exige "criar o ausente, comparar o existente, falhar com diff legível" — padrão novo, sem precedente direto no código |

---

## Metadata

**Escopo da busca de analogs:** `packages/dominio/src/{operations,types}`, `apps/api/src/{rotas,persistencia,plugins,importacao/clickup,servicos}`, `apps/web/src/{app,dados,features}`, `../financeiro-tria/automation/src/{adapters,tenants/tria,http}`.
**Arquivos lidos integralmente:** `apps/api/src/rotas/operacoes.ts`, `apps/api/src/rotas/estado.ts`, `apps/api/src/persistencia/unidade-de-trabalho.ts`, `apps/api/src/plugins/autenticacao.ts` (trecho), `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx`, `apps/web/src/dados/publico-provider.tsx`, `apps/web/src/app/(publico)/f/[segredo]/page.tsx`, `packages/dominio/src/operations/scale.ts` (trecho 340-548), `packages/dominio/src/types/ai.ts` (trecho 85-214), `packages/dominio/src/operations/ai.ts` (trecho 1-100), `../financeiro-tria/automation/src/adapters/clickup.ts`, `../financeiro-tria/automation/src/http/routes.ts`.
**Data da extração:** 2026-09-21.
