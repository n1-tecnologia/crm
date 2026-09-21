# Contrato HTTP v1 — `apps/api` ↔ `automation/`

**Versão:** v1, congelada ao fim da Fase 2 (§9). **Decisão:** D-16 (`02-CONTEXT.md`) — este documento nasce **antes** de qualquer linha de `../financeiro-tria/automation/src/adapters/plataforma.ts`, fechando CON-13 do ROADMAP ("o contrato request/response dos 7 métodos precisa estar escrito antes de SOL-05"). Ele é o par escrito de `apps/api/src/contratos/v1.ts` (schemas zod) e `contratos/payment-requests-v1/` (fixtures) — os três nascem juntos neste plano e devem mudar juntos: um schema sem atualizar este documento, ou uma fixture sem os dois, é deriva, não detalhe de implementação.

Depende do [inventário](01-inventario-financeiro-tria.md) §3–§5 (o pipeline de 7 etapas e os 7 métodos reais de `adapters/clickup.ts`), do [plano de migração](03-plano-de-migracao.md) §2–§3 (arquitetura-alvo e fronteira) e de `docs/07-processos/solicitacao-de-pagamento.md` (o processo real, os quatro Status, os 25 Campos).

---

## §1 Escopo e não-escopo

Este contrato cobre exatamente os sete métodos que `../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts` chama hoje contra `adapters/clickup.ts` e que passam a chamar `adapters/plataforma.ts`:

`getTask` · `listPaymentRequestTasks` · `createComment` · `getCommentReplies` · `addTaskTag` · `updateTaskDueDate` · `updateTaskStatus`

Além dos sete, entram no escopo deste documento — porque são indispensáveis ao mesmo processo, ainda que não sejam métodos do adapter de Tarefa:

- `POST /v1/integrations/payment-approvals/classifications` — comando pelo qual o classificador de comentário do `automation/` devolve à plataforma a decisão que leu no tópico (fallback de 90 dias, D-10/D-07 da spec);
- os três webhooks que a plataforma dispara e o `automation/` recebe: `POST /webhooks/plataforma/solicitacao-criada`, `POST /webhooks/plataforma/comentario-criado`, `POST /webhooks/plataforma/aprovacao-decidida` (§8) — a forma de payload é normativa aqui; a rota em si e a fila de entrega nascem em planos posteriores desta fase.

**Não-escopo explícito:**

- Nenhum serviço faz SQL no banco do outro (DEC-08/D-17 de `PROJECT.md`): todo acesso é por HTTP, nos dois sentidos. `apps/api` não lê `public.solicitacoes_pagamentos`; `automation/` não lê `plataforma.registros`.
- Este é o mesmo caminho autenticado que a Fase 4 reutiliza para as leituras do `automation/` que hoje são `anon_read` (D-22, OQ-SYN-01) — mas nenhuma tela é portada agora. Definir o padrão de autenticação de serviço aqui (§2) não significa abrir novos endpoints de leitura fora dos sete métodos e dos três comandos acima.
- Criação ou movimentação de Tarefa entre a Lista "Solicitações de pagamento" e a Lista "Contas a pagar" — D-14 do `02-CONTEXT.md`: a Solicitação termina em `aprovado` com o RESUMO publicado; a conversão estruturada é Fase 3.
- Motor genérico de Automações, agenda, execuções auditáveis — Fase 3. O outbox de §8 é o mínimo desta fase, não o motor.

---

## §2 Autenticação e envelope

**Base:** `https://<host>/v1/integrations/payment-requests` atrás do nginx que já serve o `automation/` (D-15).

**Credencial:** `Authorization: Bearer <credencial de serviço>` — token de ID + segredo aleatório, distinto de JWT humano (Supabase Auth, `apps/api/src/plugins/autenticacao.ts`) e distinto de service role do Supabase. `apps/api` guarda só o hash do segredo, nunca o valor em claro; duas versões podem coexistir durante rotação. Essa credencial resolve para o Membro fixo `Agente do pipeline` (§9 de `solicitacao-de-pagamento.md`, D-15): toda escrita do `automation/` aparece na timeline com um Ator identificável — nunca anônima.

**Escopos:** `payment-requests:read` (GET) e `payment-requests:write` (POST/PUT em Tarefa, Comentário, Tag, vencimento, Status). Falta de escopo é 403 (§3), nunca 401.

**Correlação:** todo request leva `X-Request-Id`; a resposta o ecoa em `error.requestId` quando há erro.

**Idempotência:** toda escrita (`createComment`, `addTaskTag`, `updateTaskDueDate`, `updateTaskStatus`) exige o cabeçalho `Idempotency-Key`. `GET` nunca exige chave e pode ser repetido livremente. O mecanismo completo está em §7.

**Proibição de log:** `Authorization`, CPF/CNPJ completo, chave Pix, código de barras, Pix copia e cola e qualquer signed URL nunca entram em log, `last_error` ou payload de outbox — nem em claro nem parcialmente concatenados. Erros e retries registram apenas `taskId`, `requestId`, `code` e um resumo sem dado do negócio.

---

## §3 Códigos de erro

Envelope único de erro, o mesmo nos dois sentidos (plataforma → `automation/` e `automation/` → plataforma):

```json
{
  "error": {
    "code": "IDEMPOTENCY_KEY_REUSED",
    "message": "Mensagem curta em pt-BR, sem detalhe interno.",
    "requestId": "corr-abc123",
    "retryable": false,
    "details": { "campo": "opcional, nunca com PII" }
  }
}
```

| HTTP | `code` | Motivo | `retryable` |
|---|---|---|---|
| 400 | `SCHEMA_INVALIDO` | corpo/params não batem com o schema v1 | `false` |
| 401 | `CREDENCIAL_AUSENTE` | sem `Authorization: Bearer` | `false` |
| 401 | `CREDENCIAL_INVALIDA` | credencial malformada, inexistente, com segredo errado ou revogada — mesma resposta para os três, para não permitir enumeração | `false` |
| 403 | `ESCOPO_INSUFICIENTE` | credencial válida, sem o escopo do método | `false` |
| 404 | `ENTIDADE_NAO_ENCONTRADA` | `taskId`/`commentId` inexistente no Espaço configurado | `false` |
| 409 | `CONFLITO_DE_ORDEM` | transição de Status inválida para o estado atual | `false` |
| 409 | `CONFLITO_DE_REVISAO` | a revisão otimista do Espaço de Trabalho mudou entre a leitura e a gravação (`apps/api/src/persistencia/unidade-de-trabalho.ts`), mesmo depois das tentativas automáticas — quem chama repete a mesma requisição | `true` |
| 409 | `IDEMPOTENCY_KEY_REUSED` | mesma chave, hash de corpo diferente (§7) | `false` |
| 409 | `REQUEST_IN_PROGRESS` | mesma chave, chamada anterior ainda em voo — vem com `Retry-After` | `true` |
| 422 | `REGRA_DE_DOMINIO` | recusa do domínio (ex.: Status de destino não existe no Conjunto da Lista) | `false` |
| 429 | `LIMITE_EXCEDIDO` | limite de taxa por credencial | `true` |
| 500 | `ERRO_INTERNO` | falha não classificada do servidor | `true` |
| 503 | `INDISPONIVEL` | dependência fora do ar (banco, Storage) | `true` |

Rede, timeout e `408` seguem a mesma regra de `429`/`5xx`: `retryable: true`. Todo `retryable: false` é permanente — o consumidor não deve repetir automaticamente, só depois de correção humana (D-20). `details` nunca carrega CPF/CNPJ, chave Pix, código de barras ou conteúdo de anexo; quando o erro precisa apontar um campo, `details.campo` traz só o nome do campo, nunca o valor.

---

## §4 `PaymentRequestDtoV1`

Forma da **plataforma**, não do ClickUp: nenhuma forma nativa do ClickUp cruza esta fronteira — a lista exata do que fica para trás está em "Formas do ClickUp que não cruzam a fronteira" (§5). Valor monetário viaja como `amountCents: number` inteiro — nunca float. `status` é exatamente o Conjunto de Status oficial de `solicitacao-de-pagamento.md` §3 — os quatro Status hoje configurados na Lista, nenhum a mais.

```ts
interface PaymentRequestDtoV1 {
  id: string;
  readableId: string;
  origin: "plataforma" | "clickup";
  title: string;
  description: string | null;
  status: "para fazer" | "em aprovação" | "não aprovado" | "aprovado";
  dueDate: string | null; // YYYY-MM-DD — Data de vencimento nativa da Tarefa
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
    issueDate: string | null; // YYYY-MM-DD
    dueDate: string | null;   // YYYY-MM-DD — duplicação intencional com o campo nativo (spec L)
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
    expiresAt: string; // Instant ISO — URL assinada, sempre curta
  }>;
  createdAt: string; // Instant ISO
  updatedAt: string; // Instant ISO
}
```

`paymentMethod` inclui `"Cartão"` por decisão D-08 da spec (`solicitacao-de-pagamento.md` §4.4): o Campo `M-Forma de pagamento` na Lista real não tem essa opção configurada, mas o `automation/` já reconhece Cartão a partir de texto livre — o contrato antecipa a opção que a Lista da plataforma vai ter, para o mapper não precisar de um quarto caminho de leitura de texto.

### De-para — letra do Campo (`solicitacao-de-pagamento.md` §4) → chave de `fields`

| Letra | Rótulo na spec | Chave em `fields` | Observação |
|---|---|---|---|
| A | Centro de Custo | `costCenter` | único obrigatório (RN-SP-01) |
| B | BU | `businessUnit` | |
| C | Empresa | `company` | |
| D | Categoria de pagamento | `paymentCategory` | |
| E | Pessoa | `personId` | Membro/Convidado do Espaço, quando o fornecedor é interno |
| F | Fornecedor (CPF/CNPJ) | `supplierType` | seleciona qual de G/H é lido |
| G | CNPJ | `supplierDocument` | quando `supplierType = "CNPJ"` |
| H | CPF | `supplierDocument` | quando `supplierType = "CPF"` — G e H convergem numa única chave tipada |
| I | Nome do fornecedor | `supplierName` | quando a Pessoa não está no Espaço |
| X | Nome do solicitante | `requesterName` | |
| Z | WhatsApp | `requesterWhatsApp` | |
| J | Anexo | — | vira item de `attachments[]`, não uma chave de `fields` |
| K | Data de Emissão | `issueDate` | |
| L | Data Vencimento | `dueDate` (dentro de `fields`) | duplicado com o `dueDate` nativo do topo do DTO — mesma duplicação observada na Lista real |
| T | Valor | `amountCents` | inteiro, nunca float |
| M | Forma de pagamento | `paymentMethod` | inclui `"Cartão"` (D-08) |
| N | Chave pix | `pixKey` | |
| O | Código de barras | `barcode` | |
| P | Pix copia e cola | `pixCopyPaste` | |
| Q | Link de pagamento | `paymentLink` | |
| R | Boleto (arquivo) | — | vira item de `attachments[]` |
| S | QR Code (arquivo) | — | vira item de `attachments[]` |
| U | Integração manual | `manual` + `manualReason` | booleano derivado da seleção "Manual"; o motivo é texto livre exigido pelo Fluxo Manual (D-12 do `02-CONTEXT.md`) |
| Y | Produto | `productIds` | seleção múltipla |
| W | Equipe | — | Campo órfão sem uso observado (`solicitacao-de-pagamento.md` §4.5); não entra no DTO |

25 Campos da spec: 21 viram chaves de `fields` (G e H convergindo em `supplierDocument`, U virando duas chaves), 3 (J, R, S) viram `attachments[]`, 1 (W) fica de fora por não ter uso.

---

## §5 `CommentDtoV1`

```ts
interface CommentDtoV1 {
  id: string;
  taskId: string;
  parentCommentId: string | null;
  author: {
    kind: "member" | "agent" | "automation" | "integration" | "system"; // ActorKind — packages/dominio/src/types/primitives.ts
    id: string;
    displayName: string;
  };
  text: string;
  mentionMemberIds: string[];
  createdAt: string; // Instant ISO
}
```

`author.kind` é exatamente `ActorKind` do domínio (`packages/dominio/src/types/primitives.ts`) — o mesmo fragmento que `apps/api/src/rotas/esquemas/fragmentos.ts` já fecha em `ACTOR_REF` para as 132 operações internas. `assignee` e `notifyAll` do ClickUp **não existem** no lado da plataforma (ver seção seguinte): a intenção antiga de "atribuir e notificar todo mundo" é traduzida pelo adapter para `mentionMemberIds` — uma lista explícita de quem deve ser mencionado, sem efeito colateral de atribuição de Tarefa.

### Formas do ClickUp que não cruzam a fronteira

Esta é a única seção do documento que cita as formas do ClickUp que o DTO deliberadamente não reproduz — nenhuma delas aparece em nenhum schema de `apps/api/src/contratos/v1.ts`:

- `custom_fields` (array genérico de campo dinâmico do ClickUp) — vira o objeto tipado `fields` de `PaymentRequestDtoV1` (§4);
- `assignee`/`notify_all` de `POST /task/:id/comment` — viram `mentionMemberIds` em `CommentDtoV1` (§5), sem atribuição de Tarefa nem notificação em massa;
- `date_created`/`date_closed` (epoch-ms em string) do ClickUp — viram `createdAt`/`updatedAt` como Instant ISO 8601 em `PaymentRequestDtoV1`.

---

## §6 Mapa de endpoints

| Método do adapter | HTTP v1 | Semântica |
|---|---|---|
| `getTask` | `GET /v1/integrations/payment-requests/:taskId` | devolve `PaymentRequestDtoV1`; toda chamada gera URLs assinadas novas em `attachments[].downloadUrl` — nunca reaproveita uma anterior |
| `listPaymentRequestTasks` | `GET /v1/integrations/payment-requests?cursor=&limit=100&updatedAfter=` | cursor opaco em `nextCursor`; ordem estável `(updatedAt, id)`; página parcial (comprimento < `limit`) é sempre a última |
| `createComment` | `POST /v1/integrations/payment-requests/:taskId/comments` | corpo `{ text, parentCommentId?, mentionMemberIds? }`; exige `Idempotency-Key`; resposta `CommentDtoV1` |
| `getCommentReplies` | `GET /v1/integrations/payment-requests/comments/:commentId/replies?cursor=&limit=100` | mesma paginação por cursor de `listPaymentRequestTasks` |
| `addTaskTag` | `PUT /v1/integrations/payment-requests/:taskId/tags/:tagId` | idempotente por natureza: 200 tanto se a Tag foi criada quanto se já existia; exige `Idempotency-Key` |
| `updateTaskDueDate` | `PUT /v1/integrations/payment-requests/:taskId/due-date` | corpo `{ dueDate: "YYYY-MM-DD" \| null }`; exige `Idempotency-Key` |
| `updateTaskStatus` | `PUT /v1/integrations/payment-requests/:taskId/status` | corpo `{ status: <enum de §4>, reason? }`; transição validada pelo domínio (409 `CONFLITO_DE_ORDEM` se inválida); mudar para o mesmo Status já vigente é sucesso, não erro; exige `Idempotency-Key` |

`GET` nunca exige `Idempotency-Key` e pode repetir livremente. Toda mutação devolve o recurso ou estado final — nunca só um `{ ok: true }` — para permitir que um replay confirme o resultado sem uma segunda leitura.

### Comandos além dos sete métodos

| Rota | Direção | Papel |
|---|---|---|
| `POST /v1/integrations/payment-approvals/classifications` | `automation/` → plataforma | callback do classificador de comentário (fallback de 90 dias, D-10); corpo `{ eventId, commentId, decision: "aprovada" \| "rejeitada", confidence }` — a plataforma resolve autor e tópico a partir de `commentId`, nunca aceita `actorId` declarado livremente |
| `POST /webhooks/plataforma/solicitacao-criada` | plataforma → `automation/` | §8 |
| `POST /webhooks/plataforma/comentario-criado` | plataforma → `automation/` | §8 |
| `POST /webhooks/plataforma/aprovacao-decidida` | plataforma → `automation/` | §8 |

---

## §7 Idempotência

Chave composta por `(service_id, route_template, key)`, guardada com hash canônico do corpo da requisição e a resposta gravada:

- mesma chave + mesmo hash de corpo → devolve a resposta gravada, sem repetir o efeito;
- mesma chave + hash de corpo diferente → `409 IDEMPOTENCY_KEY_REUSED`;
- mesma chave, chamada anterior ainda em voo → `409 REQUEST_IN_PROGRESS` com `Retry-After`;
- retenção mínima de 90 dias — cobre o próprio fallback de 90 dias do classificador de comentário e a janela de cutover.

Chaves são derivadas do passo lógico do processo, **nunca de timestamp** — um `Date.now()` na chave torna cada retry uma nova chave e anula a proteção:

```text
run:<runId>:summary
approval:<approvalId>:canonical-decision
comment:<taskId>:routing
status:<taskId>:<statusAlvo>
```

Tags são set-like (adicionar a mesma Tag duas vezes é sucesso, não erro). Mudar o Status para o valor já vigente é sucesso idempotente. Uma decisão de aprovação oposta à já registrada é `409 CONFLITO_DE_ORDEM`, nunca uma sobrescrita silenciosa — D-09 do `02-CONTEXT.md`.

---

## §8 Eventos de saída da plataforma

Três eventos mínimos, cada um produzido explicitamente pela operação de domínio que o gera — **nunca deduzido por diff** do estado antes/depois: um diff não distingue criação operacional de replay ou de importação histórica, e a importação (SOL-09) precisa poder gravar Tarefas fechadas sem disparar nenhum destes três eventos.

| Evento | Payload mínimo | Dispara |
|---|---|---|
| `solicitacao.criada.v1` | `{ eventId, taskId, readableId, occurredAt }` | `POST /webhooks/plataforma/solicitacao-criada` |
| `solicitacao.comentario-criado.v1` | `{ eventId, taskId, commentId, occurredAt }` | `POST /webhooks/plataforma/comentario-criado` — só respostas relevantes no tópico de aprovação, durante os 90 dias do fallback (D-10) |
| `solicitacao.aprovacao-decidida.v1` | `{ eventId, taskId, approvalId, decision, occurredAt }` | `POST /webhooks/plataforma/aprovacao-decidida` |

`eventId` é a própria `Idempotency-Key` que o receptor usa para não criar um segundo `run`/efeito ao reprocessar a mesma entrega. Payload carrega só ids e metadados mínimos — nunca o corpo do documento, o valor monetário completo ou dado de fornecedor; quem precisa do detalhe chama de volta `getTask`/`getCommentReplies` com a credencial de serviço.

---

## §9 Versionamento e deriva

A v1 é **congelada ao fim da Fase 2**: qualquer mudança de forma depois disso exige uma nova versão de rota (`/v2/...`), nunca uma mutação retroativa do contrato v1. Até lá, o contrato pode evoluir dentro dos planos desta fase, sempre atualizando os três artefatos juntos (este documento, `apps/api/src/contratos/v1.ts`, `contratos/payment-requests-v1/`).

**Política fail-closed explícita:** um campo desconhecido numa resposta é rejeitado por padrão — todo objeto do contrato é `.strict()` em `apps/api/src/contratos/v1.ts`. Não há compatibilidade "campo extra ignorado silenciosamente" nesta fase; se um dia for necessária, é uma decisão de versão nova, documentada aqui antes de ser codificada.

As fixtures de `contratos/payment-requests-v1/` são **copiadas**, não compartilhadas por pacote npm entre os dois repositórios (`crm-n1` e `financeiro-tria`): o Plan 02-26 copia o diretório inteiro para `../financeiro-tria/automation/contratos/payment-requests-v1/`. O hash agregado do diretório — não um `import` de tipo — é o que prova que as duas cópias continuam sendo a mesma matriz depois de mudanças nos dois repositórios.
