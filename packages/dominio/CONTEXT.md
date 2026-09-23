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

## O de-para do lançamento: o domínio recebe, nunca busca (D3-02/D3-03)

O banco de categorias do Omie não precisa ser construído: ele já existe e está
em produção (`conciliador_contas_pagar_tria`, D3-02). Vive em outro projeto
Supabase (DEC-08/OQ-SYN-03), então é alcançado por HTTP e nunca por JOIN —
gerar um segundo de-para aqui criaria uma cópia que diverge no dia em que
alguém mexer no plano de contas do Omie.

Por isso `buildResumoDePagamento` e `runLancamentoAgent`
(`src/operations/financeiro.ts`) **recebem** um `DeParaDeLancamento` e jamais o
buscam: esta camada continua sem `fetch`, sem cliente de banco e sem variável
de ambiente. Essa é exatamente a forma que a rota nova do `automation/` (03-07)
devolve e que a ponte do `apps/api` (03-11) injeta. Um dicionário de uma
entrada é um dicionário válido — o caso normal é resolver só a Categoria da
Tarefa em questão, em vez de despejar o plano de contas inteiro a cada
lançamento.

`origem` é obrigatório porque `DE_PARA_DO_PROTOTIPO` existe e é o padrão de
quem não passa nada. As tabelas fictícias do protótipo continuam ali para o
seed funcionar; o que não pode acontecer é um lançamento real feito com elas
passar despercebido. Por isso a origem é gravada no passo de raciocínio da
`AgentExecution`: fica legível, não silenciosa.

`veredito: "revisar"` é como o de-para diz "não tenho confiança suficiente"
(abaixo de `CATEGORY_MIN_SIMILARITY`, no `automation/`). Quem formata tolera e
renderiza o melhor palpite — o RESUMO é documento para o humano ler; quem
executa recusa: `runLancamentoAgent` devolve `fail`, o laço de ações da
Automação para e a conta vai para revisão humana em vez de entrar no Omie com
a categoria errada. Uma chave que o de-para nem trouxe (`"ausente"`) recusa
pelo mesmo caminho: não é licença para lançar "A classificar".

`rehearsal` não é invenção desta fase — é campo antigo de `AgentExecution`
(B82), até aqui escrito como `false` fixo. Com ele ligado, nenhuma escrita
acontece na Tarefa: nenhum Comentário, nenhum Status, nenhum Registro de
Atividade, só a Execução de sombra. E o que ela guarda é a tripla
conta/categoria/código — nunca o texto do RESUMO, que carrega chave Pix e
código de barras, e é a tripla que o relatório compara com o que o humano
lançou.

Daí a linha que 03-11 precisa obedecer: **o Ensaio não deve encadear A8**. Uma
Tarefa em Ensaio não muda de Status, e INV-CP-01 não é violado porque nenhum
RESUMO foi publicado.

## Importação histórica de Contas a pagar (Fase 3)

`importarContaAPagarHistorica` (`src/operations/importacao-contas-a-pagar.ts`)
**não está em `OPERACOES`** e sai crua do barril, como
`importarSolicitacaoHistorica`: quem importa não é um Membro usando a
interface, é o CLI do `apps/api` (Plan 03-10), que a chama direto.

Importação histórica de uma Lista **com** Automações nunca pode passar por
`changeTaskStatus`. A Lista de Contas a pagar tem sete Automações ativas e a
própria Tarefa carrega a Regra de Recorrência A1: replayar o histórico por
mudança de Status faria A1 parir uma ocorrência fantasma por conta paga,
A5/A6 cobrarem nota fiscal em conta fechada há um ano e A2/A3/A4
reescreverem Responsável — em silêncio. Por isso a Tarefa nasce **já no
Status final**, dado a `createTask` com `runAutomations: false`. O precedente
de Solicitações pode usar `changeTaskStatus` porque aquela Lista não tem
Automação nenhuma; a autorização está escrita lá e não se estende a esta.

A costura que preserva a data original (D3-04) é `recordActivity`, que aceita
`at` (`src/operations/activity.ts`). Cada transição do `status_history` vira
um Registro "Status alterado" com o instante daquela transição — é dessa
trilha, e só dela, que "tempo em 'para pagar'" é calculável depois.
`changeTaskStatus` não aceita `at` nem `runAutomations`, então não serviria
nem com as Automações desligadas.

`ORIGEM_CONTAS_A_PAGAR` (`clickup:901107637383`) é o mesmo valor gravado em
`plataforma.importacao_ledger.origem` pelo Plan 03-10 — não há ledger novo, e
não há campo `origem` na entrada, para que os dois lados não possam divergir.

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

## Solicitação aprovada → Conta a pagar: conversão, não quinto Status (D3-08)

Hoje quem cria a Conta quando uma Solicitação é aprovada é o `automation/`,
escrevendo uma Tarefa nova na Lista ClickUp `901107637383`. O critério 1 da
Fase 3 arquiva aquela Lista. Sem um caminho próprio, a primeira Solicitação
aprovada depois do corte não viraria conta nenhuma, e o Financeiro reabriria o
ClickUp na mesma semana em que deveria ter parado. `importarContaAPagarHistorica`
resolve o **histórico** (PAG-01, as 2.861 Tarefas que já existiam);
`converterSolicitacaoEmContaAPagar` (`src/operations/conversao-de-solicitacao.ts`)
resolve o **fluxo dali para frente**. São as duas metades do mesmo critério.

**`convertida` nunca esteve no catálogo.** D-01 sobrepôs a enumeração
preliminar de CON-04 depois que PREP-03 leu a Lista real `901109104938`: os
quatro Status de `solicitacao-de-pagamento.ts` são os únicos que o processo
tem, e `convertida` aparece ali só em comentário. O que D-14 prometeu à Fase 3
foi, literalmente, *a Conta a pagar **e o Vínculo estruturado*** — e é
exatamente isso que nasce aqui: um `Link` `task→task` com
`role: "conta a pagar gerada"` mais `provenance.kind = "task"` na Conta. A
pergunta do Financeiro — "qual conta veio desta solicitação?" — é respondida
pelo Vínculo nos dois sentidos, e a inversa pela procedência. Um Status não
responderia nem uma nem outra.

O preço de um quinto Status, conferido e não estimado, para quem um dia quiser
revisitar a decisão: `solicitacao-de-pagamento.test.ts` asserta os quatro nomes
**e** varre a lista de proibidos, `convertida` incluído;
`solicitacao-de-pagamento-evolver.test.ts` asserta `definitions.length === 4` e
soma o total do catálogo; e `apps/api/src/servicos/dto-solicitacao.ts` é
exaustivo sobre a união `PaymentRequestDtoV1["status"]` — um Status novo é
mudança de **contrato versionado**, do outro lado da fronteira.

**A conversão é o espelho invertido da importação histórica.**
`importarContaAPagarHistorica` não pode acordar Automação nenhuma; esta
**precisa** acordar A9. Por isso a Conta nasce com `runAutomations: false` e o
evento `tarefaCriada` é disparado à mão no fim, depois dos Campos e das Tags:
A9 só alcança a Pessoa da conta por `fromFieldDefinitionId`, e disparar antes a
deixaria de fora dos Observadores da própria conta.

**O que a Lista destino não representa vira lacuna, não rollback.** Os 25
Campos da Solicitação são 21 pares + 3 sem equivalente + 1 vencimento nativo, e
a soma é travada por teste — um Campo novo na origem quebra o teste em vez de
sumir na conversão. Quando o valor não cabe no catálogo de destino (a Forma de
pagamento tem quatro opções na origem e três no destino), a Conta nasce com o
Campo vazio e um Registro `Lacuna de conversão` nomeando o **Campo**, nunca o
valor (D-25); RN-CP-02 então segura a conta em `para pagar` até alguém decidir.
Qualquer outra recusa — Campo arquivado, Campo fora da Lista — é rollback: não
fica meia Conta no estado.

A operação está registrada em `OPERACOES` e alcançável por
`POST /operacoes/converterSolicitacaoEmContaAPagar`, mas **nada a dispara
sozinha**. Ligar o gatilho ao `aprovado` mora em `operations/tasks.ts` ou num
tipo de ação novo de Automação, e é trabalho de quem for dono daqueles
arquivos.
