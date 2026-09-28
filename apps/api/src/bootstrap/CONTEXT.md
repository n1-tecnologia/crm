# Bootstrap — o dado inicial de produção

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## O que é

`bootstrapGestao()` grava, num Espaço de Trabalho vazio, o `DataState` de
`@n1/dominio/bootstrap-gestao` (`buildGestaoBootstrap()`): o Espaço "Gestão"
› Pasta "Financeiro" › Listas "Contas a pagar" e "Contas a receber",
configuradas conforme os SPECs de processo — Status, Campos, Tags, Papéis,
Agente de lançamento, Automações — e a Maryane como única Membro,
Proprietária (D-07, D-08, D-09).

Não é seed de teste. `packages/dominio/src/seed.ts` (`buildSeed()`) é o
protótipo em memória do `apps/web`, com ~900 registros de CRM, IA e Tarefas
fictícias; este bootstrap é o oposto — só o que o Financeiro de verdade vai
usar, sem nenhuma Tarefa, Contato, Negócio ou Registro de Atividade
inventado.

## Quando rodar

Uma vez, depois de `npm run migrar -w @n1/api` (schema aplicado) e de
`npm run usuarios:seed -w @n1/api` (a conta `maryane@n1.teste` existe no
Supabase Auth):

```
npm run bootstrap:gestao -w @n1/api
```

## O que NÃO faz

Não reaplica configuração por cima de dado real, e não apaga nada.
`bootstrapGestao()` só grava em Espaço de Trabalho vazio (`0` registros em
`plataforma.registros`); a segunda execução encontra registros e devolve
`{ criado: false, motivo }` sem tocar o banco. Reaplicar configuração sobre
Tarefas reais (por exemplo, uma Automação nova) é trabalho futuro — o lugar
certo é filtrar `gravar()` por coleção, não este arquivo.

## Onde mora o conteúdo

`@n1/dominio/bootstrap-gestao` — `buildGestaoBootstrap()` é puro, sem banco,
e tem os próprios testes. Este módulo só grava o que ele monta, com
`semear()` (`../persistencia/repositorio.ts`), a mesma escrita que qualquer
importação usaria.

## Bootstrap × evolver (Plan 02-08)

Dois módulos deste diretório resolvem problemas diferentes, e nenhum dos dois
substitui o outro:

| | `gestao.ts` (Fase 1) | `solicitacoes.ts` (Fase 2) |
|---|---|---|
| Quando roda | uma vez, Espaço vazio | quantas vezes precisar, Espaço já vivo |
| Guarda | `count(*) > 0` recusa tudo | criar-ou-conferir por id; divergência recusa, nada é sobrescrito |
| Sobre o quê grava | o `DataState` inteiro (`semear()`) | só os elementos do catálogo que faltam (`executar()`/Unidade de Trabalho) |
| Toca Tarefa/Comentário? | Espaço está vazio — não há o que tocar | nunca — é a garantia central do evolver (V02-01A) |

`bootstrapGestao()` não serve para acrescentar a Lista "Solicitações de
pagamento" a um "Gestão" que já tem "Contas a pagar" em produção — a guarda
de Espaço vazio recusa. É para isso que o **evolver** existe:
`evoluirConfiguracaoDeSolicitacoes` (`@n1/dominio`) materializa o catálogo do
Plan 02-06 sobre o `DataState` já bootstrapado, e `configurarSolicitacoes()`
(`solicitacoes.ts`) é quem chama esse evolver contra o Postgres — em
`--dry-run` (hidrata, calcula o diff, faz `rollback`) ou `--apply` (grava de
verdade, dentro da mesma Unidade de Trabalho que qualquer operação usa).

**`--dry-run` é o padrão do CLI** (`npm run solicitacoes:configurar -w
@n1/api`): aplicar de verdade exige a flag `--apply` explícita — um acidente
de automação nunca grava sem essa intenção.

## O Membro de serviço "Agente do pipeline" (plano pós-auditoria, 2.2)

`solicitacoes:configurar` passa sempre `membroDeServico` ao evolver: quando
nenhum Membro ativo ocupa o Papel `rol_sp_agente_pipeline`, ele nasce por
`inviteMember` (e-mail de serviço `EMAIL_DO_AGENTE_DO_PIPELINE`, domínio
`.invalid`) e é ativado ali mesmo — sem `userId`, nenhum JWT resolve para
ele. Em seguida ganha, por `grantGovernanceAccess` (com motivo), `administrar`
nas Listas de Contas a pagar e a receber: é o que `runScheduledAutomations`
exige para o agendador rodar a agenda em nome dele, e o que a ponte do
lançamento precisa para ver a conta, publicar o Resumo e mover o Status. O
Papel continua Convidado. `--membro` precisa ser Administrador ou
Proprietário. Depois do `--apply`, tire `AUTOMACOES_ATOR_MEMBER_ID` do comando
da API: o agendador e a ponte passam a assinar pelo Membro de serviço
(`resolverMembroAgenteDoPipeline`, que só aceita Membro `ativo`).

## `contas-a-pagar:configurar` (plano pós-auditoria, 2.1 e 1.5)

`configurarContasAPagar()` (`contas-a-pagar.ts`) é o terceiro evolver do
mesmo molde, para a Lista "Contas a pagar" que já opera em `ws_n1`: aplica
`evoluirConfiguracaoDeContasAPagar` (`@n1/dominio/contas-a-pagar-evolver`),
que acrescenta à saída de "para pagar" o que o Omie exige (Categoria de
pagamento, Fornecedor, Nome do fornecedor) por `updateStatus`, e pausa a A7
legada por `pausarAutomacao` — as mesmas operações da tela. Só acrescenta:
um requisito que o catálogo não prevê é divergência, e nada é gravado.

```
npm run contas-a-pagar:configurar -w @n1/api            # dry-run (padrão)
npm run contas-a-pagar:configurar -w @n1/api -- --apply # grava
```
