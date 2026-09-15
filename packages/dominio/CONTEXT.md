# Domínio — o contrato

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## O que entra

Nada. Esta camada não importa de ninguém — nem React, nem Next, nem driver de
banco, nem `fetch`. A única dependência é `zod`, para descrever formatos.

Se um `import` daqui precisar apontar para fora do pacote, a regra em questão
provavelmente não é de domínio, ou o que ela precisa deveria ter descido para cá.

## O que sai

Pela porta da frente, `@n1/dominio`:

| Subcaminho | O que entrega |
|---|---|
| `@n1/dominio` | Barril: tipos, estado, rótulos, mais `operations` e `derive` como espaços de nome |
| `@n1/dominio/types` | As entidades da ontologia |
| `@n1/dominio/state` | `DataState`, `OperationResult`, `Session` |
| `@n1/dominio/operations` | O que **grava**: uma função por caso de uso |
| `@n1/dominio/derive` | O que **recompõe**: leituras que nunca são armazenadas |
| `@n1/dominio/seed*` | Os dados fictícios do protótipo |

`operations` e `derive` são separados de propósito. `derive` recalcula a partir
do estado gravado toda vez, porque a ontologia exige (B36, B45, B100, RN-CRM-16):
nada derivado é persistido. Misturar os dois faria um valor derivado virar um
valor guardado sem ninguém perceber.

## O que não mora aqui

- **Estado reativo.** O store zustand é adaptador de interface e vive em `apps/web/src/dados/`.
- **Persistência.** Hoje não existe; quando existir, é de `apps/api/`.
- **Texto de tela.** Com uma exceção: `rotulos.ts`, que `derive` precisa para
  nomear o Ator de um Registro. A interface reexporta de lá, para haver uma
  fonte só.

## Quando mexer

Campo novo, regra nova, status novo, caso de uso novo. Toda mudança aqui é
sentida pelos dois consumidores — é o preço de ser o contrato, e a razão de os
testes (`npm run test -w @n1/dominio`) serem a rede de segurança mais importante
do repositório.
