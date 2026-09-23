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
| `@n1/dominio` | Barril: tipos, estado, rótulos, `diferenca`, mais `operations` e `derive` como espaços de nome |
| `@n1/dominio/types` | As entidades da ontologia |
| `@n1/dominio/state` | `DataState`, `OperationResult`, `Session` |
| `@n1/dominio/operations` | O que **grava**: uma função por caso de uso |
| `@n1/dominio/operations/registro` | `OPERACOES` (a allowlist que `POST /operacoes/:nome` despacha) e o gravador de chamadas (`gravarChamadas`/`instrumentar`) que o `run()` do web usa para saber o que mandar ao servidor |
| `@n1/dominio/diferenca` | A forma do diff que a persistência devolve (`RegistroGravado`/`RegistroRemovido`) e `aplicarDiferenca`, que o cliente usa para aplicá-lo respeitando a `ordem` fracionária |
| `@n1/dominio/derive` | O que **recompõe**: leituras que nunca são armazenadas |
| `@n1/dominio/seed*` | Os dados fictícios do protótipo |
| `@n1/dominio/bootstrap-gestao` | `buildGestaoBootstrap()` — o estado inicial de produção do Espaço "Gestão": a configuração do Financeiro, sem fixtures |

`operations` e `derive` são separados de propósito. `derive` recalcula a partir
do estado gravado toda vez, porque a ontologia exige (B36, B45, B100, RN-CRM-16):
nada derivado é persistido. Misturar os dois faria um valor derivado virar um
valor guardado sem ninguém perceber.

`operations/index.ts` reexporta cada operação **instrumentada** (embrulhada por
`instrumentar`, não a versão crua do módulo): é o que faz `gravarChamadas`
observar nome e argumentos de uma chamada sem que `apps/web` precise mudar
como chama — o closure continua o mesmo, só a exportação por baixo mudou.

## O que não mora aqui

- **Estado reativo.** O store zustand é adaptador de interface e vive em `apps/web/src/dados/`.
- **Persistência.** Hoje não existe; quando existir, é de `apps/api/`.
- **Texto de tela.** Com uma exceção: `rotulos.ts`, que `derive` precisa para
  nomear o Ator de um Registro. A interface reexporta de lá, para haver uma
  fonte só.

`seed-financeiro.ts`/`seed-contas-a-receber.ts` aceitam `{ fixtures: false }`
(padrão `true`): monta só a configuração do processo, sem os Membros e as
Tarefas fictícias que reproduzem o histórico do ClickUp — é o que
`bootstrap-gestao.ts` usa.

## Quando mexer

Campo novo, regra nova, status novo, caso de uso novo. Toda mudança aqui é
sentida pelos dois consumidores — é o preço de ser o contrato, e a razão de os
testes (`npm run test -w @n1/dominio`) serem a rede de segurança mais importante
do repositório.

## Aprovação: duas origens, uma decisão por origem (D-06/D-09/D-11)

`ApprovalRequest.origin` (`types/ai.ts`) é uma união discriminada por `kind`,
o mesmo padrão de `ExecutionStep.kind`: `agentExecution` (o passo de uma
`AgentExecution`, com `deadline`) ou `processTask` (uma decisão de processo
ligada a uma Tarefa, sem `AgentExecution`). Cada origem tem a sua operação de
decisão — `decideApproval` só aceita `agentExecution`, `decideProcessApproval`
só aceita `processTask` — porque as regras não se misturam: uma expira, a
outra **não expira**; uma mexe numa `AgentExecution`, a outra publica
Comentário e muda o Status de uma Tarefa.

A aprovação de processo não tem `deadline` porque o campo não existe no ramo
`processTask` de `ApprovalOrigin` — não é uma checagem em tempo de execução,
é o tipo impedindo o estado inválido. O timeout de Execução de Agente nunca
alcança uma aprovação financeira.

## Recorrência de Contas a pagar: o que está travado (D3-05/D3-06/D3-07)

A regra é **por Tarefa** (`RecurrenceRule`, em `types/structure.ts`), não por
Lista: o Aluguel e uma assinatura podem divergir de frequência, de dia útil e
de Responsável padrão sem que ninguém precise abrir exceção no código.

O vencimento **satura no último dia do mês de destino** (D3-07): 31/01 + 1 mês
é 28/02, nunca 03/03. A consequência aceita, que vale saber antes de estranhar,
é que a série não volta ao dia original — ela é calculada a partir do vencimento
anterior, então 31 → 28 → 28. Com o dia útil anterior, que é a regra real do
Financeiro, o recuo acumula e uma conta "todo dia 31" chega ao dia 26 em cinco
meses. Reverter isso exigiria guardar o dia âncora da série; é mudança de
comportamento, não conserto de bug.

**Feriado é dia útil comum** (D3-06). A Recorrência desloca por sábado e
domingo e por mais nada. Nenhuma tabela de feriados e nenhuma dependência de
datas entra nesta camada — `dependencies` é `zod` e só.

A ocorrência nasce **uma vez por fechamento** (D3-05/RN-CP-06) porque a regra é
transferida à Tarefa nova e apagada da concluída: reabrir e fechar de novo não
tem o que gerar, e a série continua a partir da ocorrência, não da origem.

As quatro afirmações são provadas por
`src/operations/recorrencia-contas-a-pagar.test.ts`, em pares de data exatos —
quem mudar qualquer uma delas quebra aquele arquivo, e é ali que a decisão está
escrita por extenso.
