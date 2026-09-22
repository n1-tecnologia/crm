# contratos

Ler primeiro: [`../../../CONTEXT.md`](../../../CONTEXT.md)

Esta pasta é o contrato HTTP v1 entre `apps/api` e `automation/`
(`financeiro-tria`) — **e só isso**. Nada aqui conhece banco, Fastify ou o
`DataState` mutável do domínio: `v1.ts` e `erros.ts` são schemas zod e
funções puras, sem I/O.

## O que vive aqui

| Arquivo | Conteúdo |
|---|---|
| `v1.ts` | Schemas zod dos DTOs (`PaymentRequestDtoV1`, `CommentDtoV1`, `AnexoDtoV1`) e das requests/responses dos sete métodos do adapter (`EsquemasV1`) |
| `erros.ts` | Catálogo de códigos de erro (`CODIGOS_DE_ERRO`) e o construtor do envelope canônico (`erroDoContrato`) |
| `v1.test.ts` | Prova, lendo as fixtures de `contratos/payment-requests-v1/` (raiz do monorepo), que os schemas aceitam o que devem aceitar e rejeitam o que devem rejeitar |

## Regra de mudança

Mudar um schema aqui é mudar um contrato entre **dois repositórios**
(`crm-n1` e `financeiro-tria`), não um detalhe interno. Toda mudança nesta
pasta exige, no mesmo commit:

1. atualizar `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` —
   o documento canônico e legível que este arquivo espelha em código;
2. atualizar as fixtures em `contratos/payment-requests-v1/` (raiz do
   monorepo, fora de `apps/`) que provam a forma aceita/rejeitada;
3. se o `financeiro-tria` já tiver copiado as fixtures antigas (Plan
   02-26), replicar a cópia — o hash agregado do diretório é o que prova
   que as duas cópias continuam sendo a mesma matriz.

## O que este contrato NÃO é

- Não é o lugar de regra de negócio — quem decide se uma transição de
  Status é válida é o domínio (`@n1/dominio`), nunca um schema desta pasta;
  aqui só se valida a FORMA de transporte.
- Não é um pacote npm compartilhado entre os dois repositórios (D-16, D-21
  de `02-CONTEXT.md`): a duplicação por cópia de fixtures é deliberada, não
  dívida a pagar depois.
- Não substitui `../rotas/esquemas/` — aquela pasta valida os `args` de
  `POST /operacoes/:nome` (as 200 operações internas do domínio); esta
  pasta valida as rotas `/v1/integrations/payment-requests/*` que o
  `automation/` chama de fora, com credencial de serviço, não JWT humano.

## Enums sem domínio para fechar contra

`fragmentos.ts` (`../rotas/esquemas/`) fecha `PRIORITY`/`STATUS_CATEGORY`
contra tipos reais de `@n1/dominio` pelo portão `Igual<>`/`Confere<>`.
`StatusSolicitacaoV1` e `FormaDePagamentoV1`, aqui, não têm hoje um tipo
TypeScript equivalente no domínio — a Lista "Solicitações de pagamento"
ainda não existe como entidade nesta onda do plano; Status e Forma de
pagamento nascerão como DADO configurado (Conjunto de Status, opções de
Campo), não como union literal hardcoded em `@n1/dominio`. Por isso os dois
enums deste arquivo são a fonte canônica em si mesmos, travada por D-01 e
D-08 de `02-CONTEXT.md` — não um espelho de algo que já existe em outro
lugar. `CommentDtoV1.author.kind`, que tem um tipo real (`ActorKind`), já
passa pelo mesmo portão que `fragmentos.ts` usa.
