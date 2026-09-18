# Phase 2: Solicitação de pagamento — o front substitui o ClickUp — Research

**Researched:** 2026-09-18  
**Domain:** processo financeiro entre dois serviços e dois Supabases; formulário público e Storage privado; aprovação humana; contrato HTTP tipado; transactional outbox; fila persistente no adapter; importação e cutover  
**Confidence:** HIGH para o estado do código e as decisões de produto; MEDIUM-HIGH para o desenho de integração (há dois pontos que só a execução real pode validar: latência da topologia e paridade com Omie)

## Research Question

O que precisamos saber para **planejar bem** a Fase 2, sem reabrir as decisões D-01..D-28 de `02-CONTEXT.md`?

A resposta curta é: esta não é principalmente uma fase de tela. É uma troca de sistema de registro em produção. O caminho crítico é criar uma fronteira confiável e testável entre a plataforma e o `automation/`, porque o formulário, a aprovação e a timeline já têm boa parte da ontologia e da UI, mas hoje funcionam apenas em memória ou estão acoplados a `AgentExecution`. O plano deve tornar atômicos os fatos internos, tornar repetíveis os efeitos externos e só então migrar dados e operar as duas coortes.

## Constraints Preserved

- A Lista é própria e tem **exatamente** `para fazer`, `em aprovação`, `não aprovado`, `aprovado`.
- O formulário é anônimo por segredo; o Ator é `sistema/Formulário`, nunca o dono humano do Formulário.
- Arquivos ficam em bucket privado da plataforma; o navegador recebe autorização de upload e o `automation/` recebe apenas URL assinada curta.
- A aprovação financeira é ligada a Tarefa/passo de processo, sem prazo, lembrete ou `AgentExecution` obrigatório.
- Roteamento é configuração da Lista por Centro de Custo e Valor, com corte atual em R$ 5.000; não é `if` de tela nem tabela hardcoded no `automation/`.
- Clique e comentário convergem na mesma operação de decisão e no mesmo tópico.
- Os sete métodos do adapter usam HTTP v1 e DTOs da plataforma. Nenhum serviço faz SQL no banco do outro.
- A plataforma usa outbox transacional; o `automation/` usa fila persistente e ordenada por Tarefa para mutações contra a plataforma.
- A fonte histórica é `public.solicitacoes_pagamentos` (1.110 linhas), não as 19 Tarefas da Lista atual.
- Paralelo por coortes de origem, sem double-write no Omie; rollback abre somente novas entradas no ClickUp.
- Não entram nesta fase: motor genérico de automações, Conta a pagar estruturada, telas operacionais da Fase 4, outros tenants ou mudança do `automation/` para este monorepo.

## Executive Findings

1. **O domínio atual não consegue representar a aprovação financeira sem ajuste estrutural.** `ApprovalRequest.executionId` e `deadline` são obrigatórios; `decideApproval` sempre procura uma `AgentExecution` e expira a solicitação. O tipo deve virar união discriminada entre origem `agentExecution` e origem `processTask`, mantendo o comportamento antigo intacto.
2. **`submitForm` não pode simplesmente ser registrado em `/operacoes/:nome`.** A rota genérica exige Membro autenticado, enquanto `/f/<segredo>` é pública. É preciso uma rota pública específica, com rate limit e schemas próprios, que execute a UoW usando o contexto do dono mas grave Ator `sistema/Formulário`.
3. **O formulário atual dispara automação cedo demais.** `submitForm` chama `createTask`, e `createTask` roda automações antes de os Campos serem preenchidos. Uma regra de aprovação que lê Centro de Custo/Valor veria uma Tarefa incompleta. O envio deve ser uma única operação atômica que cria Tarefa + respostas + anexos e só então emite o evento/avalia a ação mínima necessária.
4. **O rollback manual de `submitForm` é insuficiente quando houver automações.** Hoje ele remove Tarefa/atividade/contador, mas uma automação pode criar comentários, execuções e outros efeitos no mesmo `DataState`. A UoW já oferece rollback transacional; a operação do domínio deve validar primeiro e evitar compensações parciais internas.
5. **Os sete métodos não bastam, sozinhos, para fechar clique + fallback.** Eles cobrem a abstração do adapter. O fluxo também necessita eventos de saída `solicitacao.criada`, `comentario.criado` e `aprovacao.decidida`, além de um comando autenticado para devolver à plataforma a classificação de um comentário. Isso não amplia o adapter nem cria motor genérico; é o conjunto mínimo para o processo escolhido.
6. **O `financeiro-tria` não tem durabilidade suficiente hoje.** `inFlight` e deduplicação de comentários são `Map` em memória; `automation_workflow_runs` é telemetria tolerante a falha, não fila. A fase precisa de tabela própria de comandos do adapter e estado de continuação/retry do run.
7. **A importação de 1.110 Tarefas excede o limite atual de 500 Tarefas raiz por Lista.** `createTask` aplica `workspace.limits.tasksPerList`; o bootstrap fixa 500. O plano precisa elevar deliberadamente o limite antes do dry-run/import, além de testar desempenho da Lista.
8. **O projeto Supabase atual está em `us-west-2`; São Paulo (`sa-east-1`) está disponível, mas região não muda in-place.** A documentação oficial exige projeto novo + migração. Como Storage não é automaticamente copiado em todos os caminhos de clone, a mudança deve preceder uploads/import/cutover.
9. **O histórico não oferece autoria e datas completas.** A tabela legada não demonstra `created_at`/autor para todas as linhas. Não usar `identity`, vencimento ou ordem física como data histórica. Quando não houver prova, usar Ator de importação e registrar a lacuna.
10. **O código Omie já consulta por `codigo_lancamento_integracao`, mas ainda aceita fallback com `Date.now()`.** A coorte plataforma deve recusar ausência de código determinístico, por exemplo `plataforma:<taskId>`, e consultar antes de incluir/repetir.

## Requirements Coverage

| Req | O que o plano precisa entregar | Evidência/risco principal |
|---|---|---|
| SOL-01 | Lista idempotentemente configurada com quatro Status e 25 Campos da spec; limite suficiente para 1.110 históricos + crescimento | Bootstrap atual é write-once em Espaço vazio; limite é 500 |
| SOL-02 | GET público do formulário, tickets de upload, POST público de envio atômico, confirmação com ID legível | Provider atual é memória; `submitForm` atribui o ato ao dono e dispara automação antes dos Campos |
| SOL-03 | `ApprovalRequest` de processo, ação mínima `solicitarAprovacao`, fila + card, decisão atômica e idempotente | Tipo/operação/UI atuais assumem execução + deadline |
| SOL-04 | Tópico de comentários e atividade na Tarefa, incluindo Ator, timestamps, decisão e motivo manual | Página de Tarefa já tem base visual; falta garantir fatos persistentes e autoria correta |
| SOL-05 | contrato v1 + `plataforma.ts` + seletor por env + fila persistente por Tarefa | Adapter atual é classe concreta/singleton e o serviço importa diretamente |
| SOL-06 | mapper tipado único para a Tria, sem shapes do ClickUp ou credenciais por linha | Mapper atual tem ~400 linhas de parsing defensivo e ainda propaga `app_key/app_secret` |
| SOL-07 | outbox atômico e receptor idempotente `POST /webhooks/plataforma/solicitacao-criada` | Hoje não existe outbox e os webhooks Express não autenticam |
| SOL-08 | evento de comentário + classificador por 90 dias + callback para a mesma decisão de domínio + métrica | Dedup atual é volátil; desligamento precisa de data registrada no deploy |
| SOL-09 | importador dry-run/apply/reconcile, idempotência `(clickup, TaskID)`, rejects e anexos reconciliáveis | 1.110 linhas, dados incompletos, limite 500, apenas 1 anexo na exportação da Lista atual |

## Current-State Architecture and Gaps

### Plataforma (`crm-n1`)

- `apps/api` já tem Fastify, zod, autenticação humana, UoW transacional e rotas separadas de serviços/repositórios.
- `plataforma.registros` é o armazenamento canônico das entidades. Tabelas relacionais auxiliares para transporte — outbox, idempotência, credenciais de serviço e ledger de importação — podem viver no schema `plataforma` sem transformar esses conceitos em entidades da ontologia.
- `apps/web/src/app/(publico)/f/[segredo]/page.tsx` é Client Component, usa `use(params)` corretamente para Next 16, mas lê seed em memória e chama operação local.
- `apps/web/src/dados/publico-provider.tsx` documenta explicitamente essa dívida: `submitForm` não está registrado porque a autoria anônima ainda não foi resolvida.
- A página `/ia/aprovacoes` resolve tudo por `executionId`, exibe prazo e aponta para Execução. Não basta tornar dois campos opcionais; renderização, autorização e links precisam discriminar a origem.
- A página de Tarefa já tem superfícies de comentários/atividade que devem ser compostas numa timeline; não criar uma segunda tela de conversa.
- `WorkspaceFile` guarda apenas metadados visuais. Para Storage real precisa de referência opaca ao objeto, hash, MIME verificado e estado de upload, sem expor chave privilegiada.
- O bootstrap da Fase 1 recusa Espaço não vazio. A configuração da Fase 2 exige um **evolver idempotente de configuração**, com IDs literais estáveis, que não substitua dados vivos.

### `financeiro-tria`

- `adapters/clickup.ts` expõe os sete métodos, mas não uma interface injetável; há singleton importado diretamente pelo serviço.
- `payment-automation-service.ts` mistura leitura do ClickUp, persistência legada, regras, comentários e avanço do run. A troca segura começa por uma porta (`PaymentRequestAdapter`) e por seleção de fonte no composition root, não por condicionais espalhadas.
- `clickup-payment-mapper.ts` normaliza nomes/valores inconsistentes e gera a linha legada, inclusive credenciais. O mapper da plataforma deve receber valores canônicos e nunca ler `app_key`/`app_secret` de uma Solicitação.
- `payment-rules.ts` permanece. Regras de prazo, documento, Centro de Custo, categoria, conta e Omie não migram para a plataforma.
- Os webhooks atuais não têm autenticação e o `handleError` devolve detalhes internos. As rotas novas precisam verificar credencial antes de parse/processar e responder envelope sanitizado.
- `automation_workflow_runs` é histórico best-effort. Não garante recebimento, retry nem retomada de passo.
- O worktree irmão já está amplamente modificado. Cada plano deve declarar sua lista exata de arquivos e migrations, nunca formatar/limpar o repositório inteiro.

## Recommended Target Architecture

```text
Navegador anônimo
  ├─ GET /v1/public/forms/:secret
  ├─ POST /v1/public/forms/:secret/uploads     -> ticket assinado (bucket privado)
  └─ POST /v1/public/forms/:secret/submissions
         │  UoW: Tarefa + Campos + anexos + Atividade + outbox (um commit)
         ▼
Supabase plataforma (sa-east-1)
  ├─ plataforma.registros
  ├─ plataforma.integration_outbox
  ├─ plataforma.http_idempotency
  ├─ plataforma.service_credentials
  └─ storage privado
         │ worker outbox: TLS + service token + Idempotency-Key
         ▼
POST automation/webhooks/plataforma/solicitacao-criada
         │
         ▼
PaymentAutomationService
  ├─ PaymentRequestAdapter = clickup | plataforma (env)
  ├─ regras atuais (inalteradas)
  ├─ plataforma-payment-mapper (DTO tipado)
  ├─ Omie com codigo determinístico + consulta antes de incluir
  └─ platform_adapter_commands (fila persistente por task)
         │
         └─ sete operações HTTP v1 no apps/api

Decisão por clique:
  UI -> decideProcessApproval -> comentário canônico + atividade + status + outbox
                                                               └-> approval.decidida -> automation

Decisão por comentário (90 dias):
  comentário -> outbox comment.created -> classifier -> callback autenticado
  -> decideProcessApproval (a MESMA operação) -> comentário canônico + atividade + status + outbox
```

### Sequência de dependências para o planejador

1. Evolver configuração/dados do domínio e ajustar limite.
2. Modelar aprovação de processo e operação atômica de decisão, com testes de domínio.
3. Definir contrato v1 em artefato compartilhável/copiadamente versionado e contract tests nos dois repositórios.
4. Adicionar Storage + envio público persistente + outbox no mesmo commit transacional.
5. Extrair interface do adapter, criar DTO mapper e fila persistente no `financeiro-tria`.
6. Conectar eventos mínimos (created/comment/decision), fallback e retomada do run.
7. Importar histórico com outbox suprimido.
8. Migrar região/topologia, ensaiar coortes por duas semanas, reconciliar e cortar.

O plano não deve iniciar pelo layout: isso criaria uma UI convincente sobre autoria, anexos e entrega ainda incorretos.

## Domain and Persistence Design

### Lista, Campos e configuração

- Criar a Lista ao lado de `Contas a pagar`, com os 25 Campos de `solicitacao-de-pagamento.md` na ordem A..Z e os quatro Status exatos.
- `Centro de Custo` continua o único obrigatório por schema da Lista. Requisitos condicionais de documento e pagamento permanecem no pipeline; não transformar a amostra observada em novas obrigatoriedades de formulário.
- `Cartão` deve constar em Forma de pagamento porque D-08 da spec o resolveu, mesmo ausente nas 19 Tarefas.
- Materializar configuração de roteamento como dado versionado da Automação da Lista: faixas/condições por Centro de Custo + Valor, papel alvo e fallback explícito. A ação publicada é `solicitarAprovacao`.
- Materializar `Revisor do RESUMO` como papel/configuração do processo; não como array de IDs em TypeScript.
- A evolução deve ser reaplicável: criar o ausente, comparar o existente e falhar com diff legível diante de divergência; nunca substituir Tarefas/Comentários reais.
- Elevar `tasksPerList` acima de 1.110 com margem operacional. Recomendação inicial: 5.000, acompanhada de teste de hidratação/listagem; não contornar `createTask` via SQL.

### Aprovação como união discriminada

Forma recomendada conceitualmente:

```ts
type ApprovalOrigin =
  | { kind: "agentExecution"; executionId: Id; stepIndex: number; deadline: Instant }
  | { kind: "processTask"; taskId: Id; processStep: "pagamento"; threadCommentId: Id };

interface ApprovalRequest {
  id: Id;
  origin: ApprovalOrigin;
  approverId: Id;
  status: "pendente" | "aprovada" | "rejeitada" | "cancelada";
  decision?: { by: Id; at: Instant; source: "click" | "comment"; reason?: string };
}
```

Não usar apenas `executionId?: Id` e `deadline?: Instant` sem discriminante: isso permite estados inválidos e força `if` defensivo em toda a UI. O migrador/hidratador deve aceitar registros antigos e normalizá-los para `agentExecution`.

A operação de decisão de processo deve, na mesma UoW:

1. carregar a aprovação pendente e a Tarefa;
2. verificar que o Membro é o aprovador configurado ou administrador autorizado;
3. aceitar reexecução da mesma decisão como sucesso idempotente; recusar decisão oposta com conflito;
4. publicar `✅ Aprovado por <nome>` ou `❌ Reprovado por <nome>` como resposta ao comentário de roteamento;
5. gravar Atividade com fonte (`click`/`comment`) e motivo quando aplicável;
6. mudar para `aprovado` ou `não aprovado`;
7. emitir `solicitacao.aprovacao-decidida.v1` no outbox.

O fluxo de Agente conserva deadline/cancelamento atuais. O de processo não expira. O card da Tarefa e `/ia/aprovacoes` chamam a mesma operação.

### Ator público e proveniência

O domínio já tem `systemActor`. A assinatura de `submitForm` precisa separar:

- `authorizationContext`: dono do Formulário, usado apenas para provar que o Formulário pode criar naquela Lista e determinar propriedade/responsabilidade;
- `actor`: `sistema/Formulário`, gravado em Atividade/Comentário;
- `provenance`: `{ kind: "form", sourceId: form.id, sourceName: form.name }`;
- campos `Nome do solicitante` e `WhatsApp`: conteúdo informado, não identidade autenticada.

Não aceitar do browser `ownerId`, `actorId`, status, origem ou `taskId`.

### Storage e envio em duas fases

Como a automação só pode receber a Tarefa depois que os anexos existem, o envio precisa de sessão de upload antes do commit da Tarefa:

1. API cria `submissionId` opaco e caminhos aleatórios sob `workspace/forms/<formId>/<submissionId>/<uuid>`.
2. API devolve ticket de upload assinado, sem service role e com `upsert: false`.
3. Browser envia direto ao bucket privado.
4. POST final envia somente IDs/tokens dos objetos, nomes exibidos e respostas.
5. API verifica que os objetos pertencem à sessão/formulário, existem, não foram reutilizados e atendem tamanho/MIME; calcula/guarda hash quando viável.
6. UoW cria Tarefa e referências de arquivo e consome a sessão; só então o outbox fica elegível.

Recomendação: 25 MB por arquivo, no máximo 10 arquivos, allowlist inicial PDF, XML e imagens JPEG/PNG/WebP, TTL de upload de até 2 horas e URL de download para o `automation/` de 5 minutos. MIME declarado pelo cliente não basta; validar metadados e assinatura de arquivo para PDF/imagem. Objetos órfãos de sessões expiradas devem ser coletados posteriormente por job seguro.

Bucket privado é o padrão correto: a documentação da Supabase confirma que download exige JWT com RLS ou URL assinada temporária. `createSignedUploadUrl`/`uploadToSignedUrl` é o caminho nativo para upload direto autorizado.

### Outbox transacional na plataforma

Tabela mínima sugerida:

| Coluna | Uso |
|---|---|
| `id uuid pk` | também é `eventId`/idempotency key |
| `workspace_id`, `aggregate_type`, `aggregate_id` | rastreabilidade e ordenação |
| `event_type`, `event_version` | contrato explícito |
| `payload jsonb` | apenas IDs/metadados mínimos; sem arquivo/segredo |
| `status` | `pending`, `delivering`, `delivered`, `failed` |
| `attempts`, `available_at`, `locked_at`, `locked_by` | lease/retry concorrente |
| `last_error_code`, `last_error_summary` | erro sanitizado |
| `created_at`, `delivered_at` | auditoria/SLO |

A UoW deve aceitar eventos produzidos pela operação e persistir `registros` + outbox usando o mesmo `pg.Client` antes do `COMMIT`. Não deduzir eventos por diff: um diff não distingue importação, replay e criação operacional, e pode emitir eventos errados. Também não chamar HTTP dentro da transação.

Eventos mínimos da fase:

- `solicitacao.criada.v1` — SOL-07;
- `solicitacao.comentario-criado.v1` — somente respostas relevantes no tópico de aprovação durante os 90 dias;
- `solicitacao.aprovacao-decidida.v1` — retoma/conclui o run após clique ou comentário.

O worker pode viver inicialmente no processo `apps/api`, mas precisa de lease no banco para permitir duas instâncias sem duplicação. Política proposta: tentativa imediata; 5 s, 30 s, 2 min, 10 min e 30 min com jitter; depois 30 min até 10 tentativas; então `failed` visível e replay manual. Repetir rede, timeout, 408, 429 e 5xx. Tratar 400/401/403/404/422 como permanentes, exceto regra documentada. Um 2xx encerra; o consumidor também deduplica por `eventId`.

### Idempotência HTTP

Toda escrita serviço-a-serviço leva `Idempotency-Key`. A plataforma guarda `(service_id, route_template, key)`, hash do request, status e resposta:

- mesma chave + mesmo hash: devolver a resposta gravada;
- mesma chave + hash diferente: `409 IDEMPOTENCY_KEY_REUSED`;
- chamada ainda em andamento: `409 REQUEST_IN_PROGRESS` com `Retry-After`;
- retenção: pelo menos 90 dias para cobrir fallback/cutover; eventos e decisões mantêm sua própria unicidade permanente.

Comentários usam chave derivada do passo lógico, não timestamp (`run:<runId>:summary`, `approval:<id>:canonical-decision`). Tags são set-like. Mudança de status para o mesmo valor é sucesso. A decisão oposta à já persistida é conflito, nunca sobrescrita.

## HTTP v1 Contract for the Seven Adapter Methods

### Authentication and envelope

- Base: `https://<host>/v1/integrations/payment-requests` atrás do nginx.
- `Authorization: Bearer <service credential>` separado de JWT humano e de service role Supabase.
- Token com ID + segredo aleatório; persistir somente hash, aceitar duas versões durante rotação, escopos `payment-requests:read` e `payment-requests:write`.
- `X-Request-Id` para correlação; nunca logar Authorization, payload financeiro ou signed URL.
- Escritas exigem `Idempotency-Key`.
- Resposta de erro: `{ error: { code, message, requestId, retryable, details? } }`; `details` sem PII.
- Códigos: 400 schema; 401 credencial; 403 escopo; 404 entidade; 409 conflito/idempotência/ordem; 422 regra de domínio; 429 limite; 500/503 transitório.

### Canonical DTO

`PaymentRequestDto` deve ser explícito e versionado, não um `Record<string, unknown>` nem um espelho de `Task` inteiro:

```ts
interface PaymentRequestDtoV1 {
  id: string;
  readableId: string;
  origin: "plataforma" | "clickup";
  title: string;
  description: string | null;
  status: "para fazer" | "em aprovação" | "não aprovado" | "aprovado";
  dueDate: string | null;
  assigneeIds: string[];
  tagIds: string[];
  fields: {
    costCenter: string;
    businessUnit: string | null;
    company: string | null;
    paymentCategory: string | null;
    personId: string | null;
    supplierType: "CPF" | "CNPJ" | null;
    supplierDocument: string | null;
    supplierName: string | null;
    requesterName: string | null;
    requesterWhatsApp: string | null;
    issueDate: string | null;
    dueDate: string | null;
    amountCents: number | null;
    paymentMethod: "Chave Pix" | "Boleto" | "QRCode Pix" | "Cartão" | null;
    pixKey: string | null;
    barcode: string | null;
    pixCopyPaste: string | null;
    paymentLink: string | null;
    manual: boolean;
    manualReason: string | null;
    productIds: string[];
  };
  attachments: Array<{
    id: string;
    role: "invoice" | "boleto" | "qrCode" | "other";
    name: string;
    mediaType: string;
    size: number;
    downloadUrl: string;
    expiresAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

`amountCents` evita float no contrato. CPF/CNPJ ainda são necessários às regras, mas devem existir apenas no corpo autorizado; logs e erros usam valor mascarado.

### Endpoint map

| Método do adapter | HTTP v1 sugerido | Semântica |
|---|---|---|
| `getTask` | `GET /v1/integrations/payment-requests/:taskId` | devolve `PaymentRequestDtoV1`, com signed URLs novas |
| `listPaymentRequestTasks` | `GET /v1/integrations/payment-requests?cursor=&limit=100&updatedAfter=` | cursor opaco, ordem estável `(updatedAt,id)`, `nextCursor` |
| `createComment` | `POST /v1/integrations/payment-requests/:taskId/comments` | `{ text, parentCommentId?, mentionMemberIds? }`; resposta com `CommentDto` |
| `getCommentReplies` | `GET /v1/integrations/payment-requests/comments/:commentId/replies?cursor=&limit=100` | respostas canônicas, autor/timestamp tipados |
| `addTaskTag` | `PUT /v1/integrations/payment-requests/:taskId/tags/:tagId` | idempotente naturalmente; 200 tanto se criada quanto existente |
| `updateTaskDueDate` | `PUT /v1/integrations/payment-requests/:taskId/due-date` | `{ dueDate: "YYYY-MM-DD" | null }` |
| `updateTaskStatus` | `PUT /v1/integrations/payment-requests/:taskId/status` | `{ status: <enum>, reason? }`; transição validada pelo domínio |

Notas importantes:

- `assignee`/`notifyAll` do ClickUp não devem vazar como conceitos artificiais. O mapper do adapter pode traduzir a intenção antiga para `mentionMemberIds`.
- O selector por env ocorre uma vez no composition root: `PAYMENT_REQUEST_SOURCE=clickup|plataforma`. Não inserir `if (source)` no serviço.
- Os schemas v1 devem existir como fixtures JSON válidas/inválidas e testes de contrato duplicados nos dois repositórios; não criar pacote compartilhado entre repos nesta fase.
- `GET` pode repetir sem chave. Toda mutação exige chave e devolve recurso/estado final, permitindo replay.

### Comandos/eventos além dos sete métodos

Esses endpoints não pertencem ao adapter de Tarefa, mas são indispensáveis ao processo:

- `POST /webhooks/plataforma/solicitacao-criada` no `automation/`;
- `POST /webhooks/plataforma/comentario-criado` no `automation/`;
- `POST /webhooks/plataforma/aprovacao-decidida` no `automation/`;
- `POST /v1/integrations/payment-approvals/classifications` na plataforma, para o classifier devolver `{ eventId, commentId, decision, confidence }`.

No callback, a plataforma resolve autor, tópico e aprovação a partir de `commentId`; o serviço não pode declarar livremente `actorId`. Só decisões com autor autorizado e dentro da janela de fallback chamam a operação canônica.

## Adapter Queue and Run Durability (`financeiro-tria`)

Tabela sugerida `platform_adapter_commands` no Supabase da automação:

| Coluna | Uso |
|---|---|
| `id uuid`, `task_id`, `sequence bigint` | FIFO por Tarefa; unique `(task_id, sequence)` |
| `operation`, `request jsonb`, `idempotency_key` | comando reproduzível; unique na chave |
| `status` | `pending`, `running`, `succeeded`, `failed` |
| `attempts`, `available_at`, `lease_*` | retry concorrente |
| `response jsonb` | IDs/resultados necessários para retomar, acesso restrito |
| `last_error_*`, timestamps | intervenção/auditoria sanitizada |

Todas as mutações são persistidas **antes** da primeira tentativa. O worker só reivindica a cabeça pendente de cada `task_id`, portanto comentário → tag → vencimento → status não reordena. Uma resposta perdida é repetida com a mesma chave e recebe o mesmo resultado.

Quando `createComment` precisa devolver ID para o passo seguinte e a API está fora:

- a função não finge sucesso;
- o run entra em `waiting_retry`/equivalente com referência ao comando;
- o worker completa o comando, persiste a resposta e retoma o passo;
- falha permanente marca run e comando para intervenção/replay.

Leituras não entram na fila de mutações; uma falha em `getTask` agenda retry do run. A fila não pode depender do `Map inFlight`. A migration de runs deve ganhar chave única de evento/origem e estados de espera, ou uma tabela mínima equivalente. O receiver grava receipt + run antes de responder 2xx; só então o outbox pode considerar o evento entregue.

## Mapper and Existing Business Rules

`plataforma-payment-mapper.ts` deve fazer conversão estrutural curta:

- DTO enum/data/centavos → tipo interno do serviço;
- signed attachment DTO → documento temporariamente baixável;
- IDs de Membro/tag já canônicos;
- `origin` e `taskId` preservados;
- credenciais Omie obtidas da configuração do tenant, nunca da Tarefa/linha.

Não copiar os fallbacks de descrição, nomes alternativos de custom fields e formas heterogêneas do ClickUp. Eles continuam apenas no mapper ClickUp enquanto o rollback existir. Evitar “mapper genérico” para três tenants: SOL-06 é da Tria e os outros tenants não mudam.

A criação/atualização da linha `public.solicitacoes_pagamentos` precisa de `origem` e unicidade composta com `TaskID`; consultas existentes que filtram só `TaskID` devem passar a incluir origem. Para novas Solicitações, `origem='plataforma'`. Não persistir `app_key/app_secret` em linhas novas.

## Public Form and Existing UI

### Next.js 16 guidance verified locally

Foram lidos os guias locais instalados em `node_modules/next/dist/docs/` para Server/Client Components, data security, dynamic routes, Route Handlers, Vitest e Playwright. Pontos aplicáveis:

- `params` é `Promise`; o uso atual de `use(params)` é válido.
- O formulário interativo precisa de Client Component, mas a página/layout pode continuar Server Component e entregar somente o DTO público sanitizado.
- Vitest não suporta bem async Server Components; o fluxo completo deve ter E2E/integração, não teste unitário artificial da page async.
- Route Handlers existem, mas a arquitetura do projeto já decidiu browser → Fastify direto. Não introduzir BFF Next para esse fluxo.
- Variáveis sem prefixo público ficam no servidor; service role/chave de Storage nunca entram no bundle.

### UI reutilizável e mudança mínima

- Manter `/f/[segredo]`, hierarquia visual e componentes do editor/formulário.
- Trocar o provider em memória por um cliente público dedicado do Fastify; não colocar `submitForm` no registro de operações autenticadas.
- Estado da UI: carregar → formulário → uploads em progresso → enviando → confirmação com `readableId`; erro deve permitir repetir com a mesma chave de submissão.
- A confirmação não mostra link de acompanhamento, por D-05.
- `/ia/aprovacoes`: cards discriminam “Execução de Agente” de “Solicitação de pagamento”; processo mostra Tarefa, Centro de Custo, Valor, solicitante e anexos, sem contador/prazo.
- Página da Tarefa: card de aprovação próximo ao contexto financeiro e timeline única combinando Comentários + Atividades por timestamp; decisão também aparece no tópico.
- Fluxo Manual deve ser ação explícita para Financeiro, exigir motivo e registrar atividade; não é checkbox oculto para ignorar divergência.

## Historical Import (SOL-09)

### Source and mapping rules

- Ler `public.solicitacoes_pagamentos` no Supabase do `financeiro-tria` com credencial somente de leitura no importador.
- Nunca abrir conexão desse banco dentro do runtime normal da plataforma; a importação é CLI controlado.
- Chave de idempotência: `(origin='clickup', legacyTaskId)`. Linha sem `TaskID`, `TaskID` duplicado ou conflito entre duas linhas vai para rejects; não inventar chave.
- `Aprovado=true` → `aprovado`; `Aprovado=false` → `não aprovado`; nulo/valor fora do domínio → reject/lacuna para decisão, não inferência.
- `comentario` não vazio vira Comentário de RESUMO no formato preservado, com Ator de importação quando autoria não for demonstrável.
- Datas/autoria só usam fonte demonstrável. A tabela legada não oferece prova completa de criação/autoria; `id`, vencimento ou posição não substituem timestamp.
- Campos ausentes ficam ausentes e entram no relatório de lacunas. Não reconstruir documento ou valor de texto livre sem regra verificável e auditada.
- Descartar `app_key`, `app_secret`, embeddings/bancos vetoriais e qualquer outro segredo.

### Import mechanics

Usar uma operação de importação de domínio, não `INSERT` em `plataforma.registros` e não `submitForm`:

- aceita IDs/proveniência histórica controlados;
- preserva timestamps conhecidos;
- cria Tarefa fechada, comentário e atividades coerentes;
- **não emite outbox operacional**, para não processar 1.110 pagamentos antigos;
- registra ledger da linha importada e hash dos dados de origem;
- processa em lotes pequenos/reexecutáveis, com checkpoint.

CLI recomendado:

```text
solicitacoes:importar --dry-run --source-manifest <...>
solicitacoes:importar --apply --batch-size 50 --resume <run-id>
solicitacoes:reconciliar --run <run-id>
```

O dry-run gera somente contagens sanitizadas: lidas, válidas, aprovadas, rejeitadas, ambíguas, duplicadas, anexos vinculáveis/ausentes. O manifesto versionado não contém nome, CPF/CNPJ, banco, chave Pix, nome de arquivo sensível ou comentário.

### Historical attachments

- Usar exclusivamente arquivos preservados na Fase 0, com hash/manifesto local.
- Vincular somente se o caminho/metadado provar `TaskID` inequívoco.
- Enviar ao bucket privado antes de confirmar o lote da Tarefa; reaplicação reconhece o mesmo hash/path sem duplicar.
- Ausência gera warning reconciliável, não aborta lote.
- O manifesto mostra apenas **1 anexo** na Lista ClickUp de Solicitações; portanto não prometer cobertura documental das 1.110 linhas do Supabase legado.

## Parallel Run, Cutover and Rollback

### Before the two-week rehearsal

- Criar/migrar o projeto Supabase para São Paulo (`sa-east-1`) antes de dados finais e Storage. A Supabase documenta que projeto é preso à região e mudança exige novo projeto + migração; chaves/URLs e Storage exigem reconfiguração/cópia.
- Se o plano contratado não oferecer a região: manter temporariamente a região disponível mais próxima, medir p50/p95/p99 VPS→Postgres e VPS→Storage em horário real, registrar decisão e só então congelar topologia. Meta recomendada: p95 de transação comum abaixo de 300 ms e nenhuma taxa de erro de transporte; ajustar com dado, não palpite.
- Resolver/invitar aprovadores e pelo menos Maryane; ausência de Liliane só afeta a ocupação inicial do papel de revisor, como decidido.
- Congelar contrato v1, contract tests e chaves de serviço rotacionáveis.
- Importar histórico e reconciliar antes de abrir nova coorte plataforma.

### Cohort rule

Definir origem no momento da entrada e torná-la imutável:

- formulário/link CRM → `plataforma`;
- formulário/link ClickUp → `clickup`;
- nunca copiar uma Solicitação ativa de uma coorte para a outra durante o ensaio;
- dashboards/reconciliação agrupam por origem.

Para cada tentativa de Omie, gerar código determinístico, por exemplo `tria:payment-request:plataforma:<taskId>`. Antes de `IncluirContaPagar`, chamar `ConsultarContaPagar`; após timeout/erro ambíguo, consultar novamente antes de repetir. Remover `Date.now()` do caminho da plataforma.

### Cutover gates

- 14 dias completos com as duas coortes.
- contagens de entrada, aprovação, RESUMO, tentativa e resultado Omie reconciliadas por origem;
- zero outbox/command/run em falha não tratada;
- nenhuma duplicidade por código de integração;
- fallback por comentário medido;
- roteiro operacional aprovado e ensaio de replay/rollback executado;
- só então desabilitar webhooks Tria do ClickUp, retirar o link de entrada e arquivar a Lista.

Rollback não move Tarefas. Reabre o ClickUp apenas para novas solicitações; as já `plataforma` continuam em suas filas e são reprocessadas ali. O selector `PAYMENT_REQUEST_SOURCE=clickup` é ferramenta controlada por coorte/rota, não autorização para ler uma Tarefa plataforma como se fosse ClickUp.

## Risks and Mitigations

| Risco | Impacto | Mitigação de planejamento |
|---|---|---|
| automação observa Tarefa antes dos Campos/anexos | roteamento/classificação errados | operação de submissão atômica; evento após todos os dados |
| outbox derivado de diff emite durante import | 1.110 pagamentos antigos reprocessados | eventos explícitos produzidos pela operação; import não os produz |
| decisão repetida/oposta | comentário/status incoerente | idempotência por approval + conflict na decisão oposta |
| fila finge sucesso durante outage | run perdido | persist-before-send, estado `waiting_retry`, retomada após resposta |
| duas workers quebram FIFO | status passa à frente do comentário | sequence por task, lease e somente cabeça elegível |
| signed URL expira durante download | falso “anexo ausente” | `getTask` sempre gera URL nova; retry refaz GET, não reaproveita URL |
| credencial de serviço tratada como usuário | privilégio amplo/auditoria falsa | auth plugin separado, escopos e ator `servico:automation` |
| comentário classificado em nome de outro | spoofing de aprovador | callback envia commentId; plataforma resolve autor e autorização |
| import passa de 500 Tarefas | lote falha no meio | elevar limite antes; dry-run valida capacidade |
| memória/hidratação com >1.110 registros | UI/API lentas | medir estado/lista e paginar a view se necessário, sem mudar ontologia |
| histórico sem data/autor | auditoria falsa | Ator de importação + lacuna explícita; nunca inferir |
| `TaskID` colide entre origens | sobrescrita no legado | unique `(origem, TaskID)` e toda query filtrando ambos |
| `Date.now()` em código Omie | duplicidade financeira | código determinístico obrigatório + Consultar antes/depois de timeout |
| região migrada tarde | recópia de DB/Storage e novo downtime | migração regional antes do upload/import/cutover |
| worktree irmão sujo | perda de trabalho alheio | planos por arquivo; sem reset/clean/reformat global |

## Anti-Patterns to Avoid

- Não fazer fetch ao `automation/` dentro da transação da Tarefa.
- Não usar o banco como API entre os serviços.
- Não colocar campos financeiros em logs de retry ou `last_error`.
- Não tratar `202` como prova de processamento se o receiver não persistiu receipt/run.
- Não usar `Map` em memória como idempotência/durabilidade.
- Não ampliar `clickup-payment-mapper.ts` para aceitar dois formatos; criar mapper novo e pequeno.
- Não manter credenciais Omie por Solicitação “por compatibilidade”.
- Não usar prazo da aprovação de Agente no processo financeiro.
- Não criar `convertida`, `em revisão` ou Conta a pagar nesta fase.
- Não fazer importação histórica pela rota pública nem emitir eventos de criação nela.
- Não testar os dois caminhos lançando a mesma obrigação duas vezes.

## Validation Architecture

### Test Framework and Environments

| Repositório | Camada | Ferramenta atual/recomendada | Comando rápido |
|---|---|---|---|
| `crm-n1` | domínio/API/web unit/integration | Vitest 5 já instalado | `npm run test -w @n1/dominio -- <arquivo>` / `npm run test -w @n1/api -- <arquivo>` / `npm run test -w @n1/web -- <arquivo>` |
| `crm-n1` | gate completo | typecheck + lint + tokens + Vitest | `npm run check` |
| `crm-n1` | browser real | Playwright a adicionar apenas para jornadas públicas/aprovação | `npx playwright test` contra build de produção |
| `financeiro-tria/automation` | service/adapter/contracts | runner existente do pacote deve ser confirmado no primeiro plano; hoje só há `payment-rules.test.ts` e não há cobertura das integrações | script local do `automation/package.json` |
| ambos | Postgres/Supabase | integration tests condicionais por env + migrations reais em projeto de teste | pular explicitamente sem env; obrigatório no gate pré-cutover |

O guia local do Next recomenda E2E para async Server Components. Assim, page pública e navegação não devem ser validadas só por import/render unitário.

### Nyquist Strategy

O princípio desta fase é que cada fronteira com estado persistente tenha observação automatizada suficiente para detectar perda, duplicação ou reordenação. Unit tests sozinhos não cobrem o problema principal. A pirâmide necessária é:

1. **Domínio puro, em toda tarefa:** invariantes de Lista, formulário, aprovação, timeline e importação.
2. **API por `app.inject`, em toda tarefa de rota:** auth, schemas, idempotência, status codes, payload sanitizado.
3. **Persistência real, por onda:** transação Tarefa+outbox, leases, replay e constraints únicas.
4. **Contract tests nos dois repos, em todo merge do contrato:** mesmas fixtures v1 aceitas/rejeitadas.
5. **E2E entre processos, no gate de integração:** Fastify plataforma + Express automation + dois bancos de teste + Storage fake/real controlado.
6. **Smoke real antes do cutover:** uma Solicitação de valor baixo e conta sandbox/homologação, validada por consulta no Omie; nunca obrigação produtiva duplicada.

### Requirements → Test Map

| Req | Comportamento observável | Tipo | Arquivo/gap sugerido |
|---|---|---|---|
| SOL-01 | evolver cria Lista, quatro Status, 25 Campos e configuração; reaplicar não duplica nem toca Tarefa | domínio + integração DB | novo teste do evolver da Fase 2 |
| SOL-01 | Lista aceita >1.110 raízes após mudança consciente de limite | domínio/performance smoke | teste de capacidade + medição de hidratação |
| SOL-02 | segredo inválido/inativo não vaza formulário; submissão cria uma Tarefa completa com Ator sistema | API integration | `apps/api/src/rotas/formularios-publicos.test.ts` — gap |
| SOL-02 | falha antes do commit não deixa Tarefa, arquivo consumido ou outbox; falha do automation depois do commit mantém confirmação | DB integration/fault injection | teste Tarefa+outbox e worker indisponível |
| SOL-02 | upload recusado por MIME/tamanho/sessão alheia; objeto válido vira attachment privado | integration Storage | suite condicional com bucket de teste |
| SOL-02 | browser envia, faz upload e vê apenas ID legível | Playwright | jornada `/f/[segredo]` — gap |
| SOL-03 | approval de Agente antigo conserva prazo/cancelamento | domínio regression | ampliar testes de `operations/ai` |
| SOL-03 | approval de processo não exige execution/deadline; autorizado decide; não autorizado recusa | domínio + UI unit | novos casos em domínio/aprovações |
| SOL-03 | mesma decisão repetida não duplica; decisão oposta conflita | domínio + API idempotency | matriz de replay |
| SOL-03 | comentário, atividade, status e outbox gravam juntos ou nada grava | DB integration/fault injection | teste transacional obrigatório |
| SOL-04 | timeline intercala comentário/atividade por instante e mantém autoria/fonte | web unit + Playwright | teste do seletor + ficha da Tarefa |
| SOL-05 | sete operações do adapter produzem request/response v1 exatos | contract | fixtures compartilhadas por cópia nos dois repos — gap total |
| SOL-05 | API fora: mutações persistem e retomam em FIFO por task; tasks diferentes avançam em paralelo | DB integration/fake server | testes da command queue — gap total |
| SOL-05 | 400/401 vai a failed visível; 429/503 repete com backoff | unit + fake timers + integration | matriz de retry |
| SOL-06 | DTO válido mapeia centavos/datas/anexos; campo ausente tem erro claro e sanitizado | unit | `plataforma-payment-mapper.test.ts` — gap |
| SOL-06 | mapper plataforma não referencia shape ClickUp nem credenciais | type/static test | imports proibidos/fixture sem secrets |
| SOL-07 | commit da Tarefa sempre tem um e só um outbox; rollback não tem nenhum | DB integration | `outbox.test.ts` — gap |
| SOL-07 | receiver grava receipt/run antes de 202; mesmo eventId retorna aceito sem duplicar | integration entre serviços | receiver idempotency — gap |
| SOL-08 | comentário de aprovador é classificado e chama mesma decisão; autor não autorizado é ignorado | contract + domain integration | fluxo comment→callback |
| SOL-08 | após data final configurada, comentário não dispara classifier; métrica conta origem corretamente | unit/integration com relógio injetado | teste da janela de 90 dias |
| SOL-09 | dry-run não grava; apply/reapply mantém mesmas contagens/IDs | integration DB | importador + ledger |
| SOL-09 | nulo/ambíguo/duplicado vai a rejects; segredo nunca aparece em saída | fixture/property test | sanitização do relatório |
| SOL-09 | anexo inequívoco sobe uma vez; ausente gera warning e continua | integration Storage | fixture do manifesto/export |
| Cutover | duas coortes nunca compartilham `codigo_lancamento_integracao`; retry consulta antes de incluir | adapter Omie fake + smoke | teste de timeout ambíguo/duplicate |

### Contract Fixture Matrix

Cada um dos sete métodos deve ter pelo menos:

- fixture de sucesso mínima;
- fixture de sucesso completa;
- versão/enum desconhecido rejeitado;
- campo obrigatório ausente;
- 401, 403, 404, 409, 422, 429 e 503 conforme aplicável;
- replay com a mesma chave;
- replay com chave igual e payload diferente;
- response com campo extra permitido somente se a política do contrato for forward-compatible e explícita.

Os dois repositórios executam a mesma matriz. O produtor prova que emite; o consumidor prova que aceita. Um teste isolado só de zod num lado não impede deriva.

### Fault-Injection Matrix

| Falha injetada | Invariante esperada |
|---|---|
| crash após INSERT da Tarefa, antes do COMMIT | nem Tarefa nem outbox visíveis |
| crash após COMMIT, antes do HTTP | outbox `pending`, entrega posterior |
| receiver persiste e resposta se perde | replay eventId não cria segundo run |
| API recebe mutação, responde e resposta se perde | replay Idempotency-Key devolve mesmo resultado |
| duas workers pegam mesma fila | lease/constraint permite um efeito |
| comando 2 elegível enquanto comando 1 falha | comando 2 da mesma task não executa |
| signed URL expira | retry refaz `getTask` e obtém URL nova |
| Omie inclui e conexão cai antes da resposta | `ConsultarContaPagar` encontra o mesmo código; não reinclui |
| import cai no lote 7 | `--resume` continua do ledger; reaplicar tudo não duplica |

### Sampling Rate

- **Por commit de tarefa:** testes direcionados + typecheck do workspace tocado.
- **Por merge de onda no `crm-n1`:** `npm run check`.
- **Por merge de contrato:** contract tests nos dois repositórios e build do `automation/`.
- **Por mudança de migration/fila:** teste contra Postgres/Supabase de integração, não apenas mock.
- **Gate pré-paralelo:** E2E dos dois serviços com falhas injetadas principais.
- **Diariamente durante as duas semanas:** reconciliação automática de outbox, comandos, runs e códigos Omie; relatório humano curto.
- **Gate de cutover:** zero falha não tratada + replay drill + paridade Omie + aprovação operacional.

### Wave 0 Gaps

- [ ] Infra de Playwright e uma jornada pública mínima.
- [ ] Fixtures v1 canônicas e harness de contract test nos dois repos.
- [ ] Projeto/banco/bucket de integração seguros, separado de produção.
- [ ] Factory do Express router/serviço no `financeiro-tria` para testes sem abrir porta.
- [ ] Fake HTTP server controlável para timeout, resposta perdida, 429 e 503.
- [ ] Relógio injetável para fallback de 90 dias e backoff.
- [ ] Fixture sanitizada de `solicitacoes_pagamentos`, incluindo nulos, duplicados e `Aprovado` ambíguo.
- [ ] Teste de desempenho com 1.110+ Tarefas na Lista.
- [ ] Teste de Omie por adapter fake para `ConsultarContaPagar` após timeout ambíguo.

## Deployment and Operational Observability

Métricas mínimas:

- outbox pending/oldest age/failed/delivery attempts;
- adapter commands pending por task/oldest age/failed;
- receiver duplicates e idempotency conflicts;
- runs waiting/failed/succeeded por origem;
- aprovações click/comment e razão comentário/total;
- signed URL refresh/failure;
- Omie include/consult/reused/duplicate por origem;
- import read/imported/rejected/warned;
- latência p50/p95/p99 API↔DB e automation↔API.

Alertas não devem conter payload. Interfaces de replay usam IDs e resumo mascarado; replay registra quem/quando/motivo.

## Planning Recommendations

- Dividir em planos pequenos por fronteira, com um plano explícito de contrato antes de editar o adapter.
- Fazer mudanças coordenadas nos dois repos em ondas compatíveis: produtor aceita v1 antes de consumidor selecionar plataforma; adapter plataforma deployado desligado; depois coorte piloto.
- Dar uma tarefa própria a cada migration de durabilidade e ao teste de fault injection correspondente.
- Tratar região/migração Supabase como pré-requisito operacional do go-live, não como nota final.
- Tratar convite de aprovadores e configuração de papéis como checklist de dados, não hardcode.
- Exigir no plano de importação uma etapa que eleve/valide `tasksPerList` antes do primeiro apply.
- Exigir um runbook com comandos de replay, rotação de token, reconciliação e rollback por novas entradas.

## Sources

### Primary — repository (HIGH confidence)

- `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`.
- `docs/07-processos/solicitacao-de-pagamento.md`, `docs/07-processos/contas-a-pagar.md`, `docs/08-migracao-financeiro/{01-inventario-financeiro-tria,02-comparativo-com-a-plataforma,03-plano-de-migracao}.md`, `apps/api/exportacoes/MANIFESTO.md`.
- `packages/dominio/src/operations/{scale,ai,automations,tasks,activity}.ts`, `packages/dominio/src/types/{ai,workspace}.ts`.
- `apps/api/src/{app,rotas/operacoes,persistencia/unidade-de-trabalho,persistencia/repositorio}.ts` e migrations existentes.
- `apps/web/src/app/(publico)/f/[segredo]/page.tsx`, `apps/web/src/dados/publico-provider.tsx`, `apps/web/src/features/estrutura/forms-editor.tsx`, `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx`, página de Tarefa.
- `../financeiro-tria/automation/src/adapters/{clickup,omie,supabase}.ts`, `tenants/tria/{payment-automation-service,clickup-payment-mapper,payment-rules}.ts`, `http/routes.ts`, `workflows/workflow-store.ts`, migrations de observabilidade/workflows.
- Documentação Next 16.3.4 instalada: `server-and-client-components.md`, `data-security.md`, `dynamic-routes.md`, `route-handlers.md`, `testing/vitest.md`, `testing/playwright.md`.

### Primary — vendor docs (HIGH confidence)

- [Supabase Available regions](https://supabase.com/docs/guides/platform/regions) — São Paulo `sa-east-1` está disponível.
- [Supabase Change Project Region](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z) — região exige novo projeto e migração.
- [Supabase Migrating within Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase) — caminhos oficiais de migração.
- [Supabase Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) — bucket privado e signed downloads.
- [Supabase uploadToSignedUrl](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl) — upload direto com token assinado.

## Open Planning Checks (not product decisions)

1. Qual plano Supabase será usado e se São Paulo está habilitado nessa conta; a decisão de produto já é “Brasil se disponível”, resta executar/verificar.
2. Qual host/path nginx e mecanismo concreto de emissão/rotação do service token; o padrão (credencial própria, TLS, escopo mínimo) já está decidido.
3. Quais linhas históricas têm `TaskID` ausente/duplicado e `Aprovado` ambíguo; o dry-run deve quantificar antes do apply.
4. Qual latência e memória reais com 1.110+ Tarefas; medir antes de escolher se a view precisa paginação específica.
5. Em qual ponto exato do serviço atual o status passa a `em aprovação` após validação. Recomendação: a mutação de status dispara a ação mínima configurada `solicitarAprovacao`; isso preserva os sete métodos e mantém roteamento na plataforma.

## Metadata

- **Research date:** 2026-09-18
- **Valid until:** 2026-10-18 para disponibilidade/região/SDK Supabase; arquitetura e achados de código permanecem válidos até mudança nos repositórios.
- **Confidence:** HIGH nos gaps observados; MEDIUM-HIGH no sequenciamento proposto; MEDIUM nos limiares sugeridos de tamanho/TTL/backoff, que são discretion do planejador e devem ser validados em integração.

