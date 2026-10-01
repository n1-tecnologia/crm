# `contratos/payment-requests-v1/`

Fixtures canônicas do contrato HTTP v1 entre `apps/api` (`crm-n1`) e
`automation/` (`financeiro-tria`) — os sete métodos do adapter de
Solicitação de pagamento. Espelho executável de
[`docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`](../../docs/08-migracao-financeiro/04-contrato-plataforma-v1.md)
e de `apps/api/src/contratos/v1.ts`.

## Por que esta pasta vive na raiz do monorepo, fora de `apps/`

Porque ela é copiada, **verbatim**, para
`../financeiro-tria/automation/contratos/payment-requests-v1/` (Plan
02-26) — não é um pacote npm compartilhado entre os dois repositórios
(D-16, D-21 de `.planning/phases/02-.../02-CONTEXT.md`). O produtor
(`apps/api`) prova que emite exatamente essas formas; o consumidor
(`automation/`) prova que aceita as mesmas. Um teste de zod isolado só de
um lado não impede deriva — só a mesma matriz nos dois repositórios prova
isso. O **hash agregado do diretório** — não um `import` de tipo — é o que
prova que as duas cópias continuam sendo a mesma matriz depois de mudanças
em qualquer um dos dois repositórios.

## Convenção de nome de arquivo

`<metodo>.<categoria>.json`, um arquivo por caso:

| Categoria | O que prova |
|---|---|
| `sucesso-minimo` | resposta válida com o mínimo de campos preenchidos (nuláveis em `null`, listas vazias) |
| `sucesso-completo` | resposta válida com todos os campos preenchidos, inclusive anexo/menção quando aplicável |
| `sucesso-em-revisao` | só em `getTask` — resposta válida com `status: "em revisão"`, o 5º valor do enum (D5-06, Family Office, Phase 5 Plan 05-03); prova que o alargamento do enum não quebra o resto do DTO |
| `sucesso-pedindo-aprovacao` | só em `createComment` — o comentário de roteamento com `requestApprovalFromMemberId` (aditivo, 2026-10-01): a plataforma abre a Solicitação de Aprovação para esse Membro, com o comentário como fio, e a Solicitação vai para "em aprovação"; a resposta é o `CommentDtoV1` de sempre. Se a aprovação não abre, o comentário fica e a plataforma responde nele o motivo; com `parentCommentId` junto, 422 |
| `invalido-campo-obrigatorio-ausente` | resposta com um campo obrigatório removido — o schema correspondente de `EsquemasV1` deve rejeitar |
| `invalido-enum-desconhecido` | resposta com um valor fora do enum canônico (Status, Forma de pagamento ou `ActorKind`) — o schema deve rejeitar |
| `erro-401`, `erro-403`, `erro-404`, `erro-409`, `erro-422`, `erro-429`, `erro-503` | envelope de erro do §3 do contrato, presente quando aplicável ao método (GETs não têm `409` de idempotência, só os quatro métodos de escrita) |
| `replay-mesma-chave` | mesma `Idempotency-Key` e mesmo corpo devolvem a resposta já gravada, sem duplicar o efeito — só nos quatro métodos de escrita |
| `replay-chave-igual-payload-diferente` | mesma `Idempotency-Key` com corpo diferente é `409 IDEMPOTENCY_KEY_REUSED`, nunca uma segunda escrita — só nos quatro métodos de escrita |

Cada arquivo é um objeto `{ "descricao": "...", "requisicao": { ... }, "resposta": { "status": n, "corpo": { ... } } }`.

## Métodos e contagem esperada

Os três métodos de leitura (`getTask`, `listPaymentRequestTasks`,
`getCommentReplies`) não têm `erro-409`, `erro-422` nem os dois `replay-*`
— idempotência é um conceito de escrita. Contagem por método:

| Método | Categorias | Total |
|---|---|---|
| `getTask` | sucesso × 2, invalido × 2, erro-401/403/404/429/503, `sucesso-em-revisao` | 10 |
| `listPaymentRequestTasks` | idem | 9 |
| `getCommentReplies` | idem | 9 |
| `createComment` | sucesso × 2, invalido × 2, erro-401/403/404/409/422/429/503, replay × 2, `sucesso-pedindo-aprovacao` | 14 |
| `addTaskTag` | idem | 13 |
| `updateTaskDueDate` | idem | 13 |
| `updateTaskStatus` | idem | 13 |

`apps/api/src/contratos/v1.test.ts` prova a contagem exata por método —
um método que ganhar endpoint sem a fixture correspondente faz o teste
falhar, de propósito (a lista de métodos e a matriz de categorias vivem no
próprio teste, não deduzidas do que existe em disco).

## Dados das fixtures

Inventados e inofensivos, de propósito: CNPJ placeholder `00.000.000/0001-91`,
`amountCents: 123456`, nomes fictícios (`Fornecedor Fictício LTDA`,
`Solicitante Fictício`). Nenhum CPF/CNPJ real, chave Pix real, nome de
fornecedor real ou trecho de Comentário exportado do ClickUp entra aqui —
este diretório é versionado e fica no git para sempre.
