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

## A conferência do Ensaio: o humano responde antes de ver a resposta do Agente (D3-03)

O que conta como acerto é regra de negócio, e por isso mora aqui
(`compararEnsaio`, `src/operations/financeiro.ts`) e não em `apps/api`: os
dois lados da comparação — o Ensaio do Agente e o lançamento do Financeiro —
passam pela MESMA função, nunca por duas que possam divergir na primeira
mudança.

1. **Onde o lado humano mora, e por que não em outro lugar.** O Agente, em
   Ensaio, deixa rastro estruturado (a `AgentExecution` de sombra, acima). O
   humano lança à mão dentro do Omie e não deixa rastro nenhum — a menos que
   diga. Dois lugares óbvios foram recusados: os Campos da própria Tarefa são
   circulares (são a ENTRADA do Agente, não o resultado do de-para real); e
   ler o Omie de volta exigiria junção por (fornecedor, vencimento, valor),
   porque um lançamento manual não carrega `codigo_lancamento_integracao` — e
   um relatório que decide sobre dinheiro não se apoia numa junção
   aproximada. O que sobra, e o que foi escolhido, é o próprio Financeiro
   registrando no instante em que lança: um Comentário de prefixo fixo
   (`PREFIXO_LANCAMENTO_HUMANO`), no molde exato de
   `PREFIXO_MOTIVO_FLUXO_MANUAL` (`fluxo-manual-dialog.tsx`), lido de volta
   por `lancamentoHumanoDe` e escrito por `textoDoLancamentoHumano` — um
   escritor, um leitor, nenhuma string duplicada entre `apps/web` (escreve) e
   `apps/api` (lê). A junção com a Tarefa é sempre pelo id dela.
2. **A captura é no ato, por causa do viés de assentimento.** Se a pergunta
   viesse depois, mostrando o que o Agente teria lançado, a resposta do
   Financeiro viria contaminada — e o erro entraria na direção otimista,
   exatamente a direção em que esta medição não pode errar. É por isso que o
   diálogo que captura o registro (`apps/web`) não tem lista de categorias
   nem sugestão nenhuma: mostrar a resposta do Agente antes da do humano
   destruiria a independência da medição.
3. **`REVISAR` é recusa correta, nunca erro.** Um Ensaio que terminou
   `falhou` (o de-para abaixo do corte de confiança) vira
   `veredito: "recusa_correta"` em `compararEnsaio` — mesmo havendo registro
   humano, e antes de qualquer comparação. Sai do denominador das taxas de
   acerto e tem taxa própria: dobrá-la em "erros" subestimaria o Agente
   exatamente onde ele acertou ao se calar.
4. **`semTagDeConta` marca o palpite sem evidência.** Quando `buildResumoDePagamento`
   não encontra Tag `conta *`, ele resolve a conta de pagamento por palpite
   (o Centro de Custo, ou `"A DEFINIR"`) e segue adiante — é o modo de falha
   mais caro do processo, porque conta errada é dinheiro saindo do banco
   errado. `compararEnsaio` marca esses casos (`semTagDeConta: true`) em vez
   de escondê-los ou de inventar um veredito próprio: o palpite acertado é
   `confere`, o errado é `diverge_conta`, e o relatório de `apps/api` tem um
   portão duro só para eles.
5. **`LIMIAR_DA_CANETA` é anterior aos dados por desenho.** A constante — com
   os cinco números e o motivo de cada um comentado ao lado da declaração —
   existe para que o limiar da decisão seja declarado ANTES de a semana de
   Ensaio existir. Medir primeiro e decidir depois o que conta como bom é
   racionalizar; o `git blame` desta constante é o que torna um afrouxamento
   posterior visível.

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

## Mudança de Status em lote: uma transação por gesto, recusa por item (PAG-05)

`alterarStatusEmLote` (`src/operations/lote.ts`) existe porque CON-CP-11 é um
fato datado — em 2026-09-08 11:58:06, 61 Tarefas com vencimento 2026-09-04
foram fechadas no mesmo segundo — e não uma conveniência de tela. A origem
real desse "lote de 61" é uma recorrência mensal fechando junto, não uma
varredura arbitrária; por isso a operação recebe **ids**, nunca um filtro, e
o recorte (dia de vencimento, Tag, Status) é trabalho da tela, que já sabe
fazê-lo.

**Não reimplementa permissão nem regra de Status.** A operação chama
`changeTaskStatus` item a item, e é de lá que vêm RN-CP-02 (requisitos de
saída), RN-CP-04 (`entryAllowedMemberIds`), a visibilidade (`memberSeesTask`)
e A1 (`spawnNextOccurrence`, a Regra de Recorrência da própria Tarefa — não
um dos nove `Automation` da Lista). Quem "otimizar" isso para uma checagem
única por conjunto abre exatamente o furo de permissão que um endpoint de
lote costuma abrir (T-3-45): uma checagem feita uma vez para o conjunto deixa
passar o que uma checagem por item pega.

**A forma da transação, em duas linhas.** Uma hidratação (~19 mil linhas no
Espaço depois da importação de 03-10) atende 61 fechamentos em memória, contra
61 hidratações se cada fechamento abrisse sua própria transação — 61 < 250, a
constante que 03-10 justificou para a importação histórica, não é uma segunda
decisão, é a mesma regra aplicada a um N menor. `LIMITE_DO_LOTE = 200` é o que
mantém "uma transação" uma decisão e não um acidente: acima dele, o argumento
de 03-10 (picotar) volta a valer, e quem pica é quem chama, não esta função.

**Falha parcial é valor, não exceção.** Cada item volta um de quatro
resultados (`alterada`, `jaEstava`, `recusada`, `parcial`), com a aritmética
`solicitadas === alteradas + jaEstavam + recusadas + parciais` sempre
verificável — porque os 61 fatos são independentes (ao contrário da Tarefa e
da sua linha de ledger em 03-10, onde a atomicidade é entre duas metades do
MESMO fato). Uma conta que se recusa a fechar não derruba as outras 60.

**`jaEstava` é curto-circuitado ANTES de `changeTaskStatus` (T-3-46).** Uma
Tarefa já no Status alvo não é reprocessada: com `before.id === target.id`,
`changeTaskStatus` pula as guardas de saída/entrada mas ainda regrava
`statusId`, escreve um Registro com `before === after` e **redispara**
`runListAutomations` — sem o curto-circuito, reexecutar o mesmo lote
(duplo clique, F5, retry de rede) rodaria as Automações de entrada em Status
de novo a cada tentativa.

A operação está registrada em `OPERACOES` e alcançável por
`POST /operacoes/alterarStatusEmLote`, devolvendo `RelatorioDeLote` dentro do
envelope de sempre — **nenhuma rota nova foi criada e `app.ts` não foi
tocado**.

## Conferência do Resumo (Fase 6): o Resumo antes do lançamento, conferido por dado

Os Fluxos 5, 6 e 7 do módulo TRIA, como o `financeiro-tria/automation` faz no
ClickUp (`.planning/phases/06-conferencia-do-resumo-e-anexos/06-CONTEXT.md`).
Tudo em `operations/financeiro.ts` (e a decisão em `operations/ai.ts`), puro.
O plano 06-11 fechou no domínio os achados do review (`06-REVIEW.md`:
crm:CR-03, WR-03, WR-04, WR-08, WR-10, WR-12, IN-02, IN-03):

| Símbolo | O que faz |
|---|---|
| `operations/financeiro-base.ts` (06-11) | O módulo-folha: `CP`, `fieldValue`, `ConferenciaDoResumo`, `conferenciaVigente`, `impressaoDeLancamento`, `revisoresDoResumo`, `FORMA_DO_CODIGO_DE_CATEGORIA` e `lancamentoSemCodigo`. Só `import type`, e por isso `./ai` (a decisão) e `./tasks` (resolver o fio) o importam sem o ciclo com `./financeiro`, que reexporta o que já era público lá (crm:WR-08). |
| `publicarResumoParaConferencia(state, ator, taskId, { dePara, pedidoDeRevisao?, pedidoPor?, motivo?, impressaoEsperada?, conferenciaRejeitadaId? })` | O Agente publica o `📋 RESUMO DE PAGAMENTO` (byte a byte, CON-CP-08) seguido da chamada ao Financeiro — raiz na primeira vez, resposta no MESMO fio nas seguintes —, SEM resolver o fio, e abre a Conferência (`solicitarConferenciaDoResumo`, que cancela a pendente anterior: "Conferência superada"). Idempotente para a mesma impressão; tudo ou nada. 06-11 (crm:WR-12): `impressaoEsperada` diferente da atual e `conferenciaRejeitadaId` que não é a vigente `rejeitada` recusam SEM efeito — o Resumo não sai sobre dados que mudaram, nem em dobro. |
| `decideProcessApproval` (ramo `processStep: "resumo"`) | Clique e resposta no fio convergem: resposta canônica no fio, decisão/fonte/motivo gravados, fio resolvido na aprovação; `rejeitada` exige motivo. **Nunca muda o Status.** 06-11: duas recusas SEM efeito — a impressão atual não é a da Conferência (`recusaDesatualizada`, as duas decisões, crm:WR-08) e APROVAR um Resumo sem código de Categoria (`lancamentoSemCodigo`: `ausente` ou fora de `d.dd.dd`/`d.dd.dd.dd` ⇒ `recusaSemCodigo`, crm:WR-03). Pedir ajuste continua aberto. |
| `registrarLancamentoNoOmie(state, ator, taskId, { payableId, reaproveitado, anexos, anexosPedidos? })` | Só com a conta em "em lançamento omie" e Conferência `conferida` para a impressão ATUAL: confirma no fio, resolve o fio, grava a `AgentExecution` com o título real e move para "lançado omie" — tudo ou nada. `anexosPedidos` (06-11) vai ao texto da confirmação. |
| `registrarFalhaDoLancamento(state, ator, taskId, { motivo, code }, { avisarId?, superarConferencia? })` | Comenta o motivo no fio com Menção ao Financeiro e volta a conta para "para pagar" (a partir de "em lançamento omie"). O Registro guarda só o `code`. 06-11 (crm:WR-10): tudo ou nada, com `guardasDoAgente` — o aviso sai ANTES do Status; se a volta for recusada, o aviso é trocado pelo que diz que a conta NÃO voltou; uma recusa não deixa Comentário, Status nem Registro. 06-12 (crm:WR-09): `superarConferencia: true` cancela a Conferência vigente `aprovada` ("Conferência superada", `before: "aprovada"`, `after: "cancelada"`, com o `code`) antes do Registro da falha — a saída depois do 422 `CONTA_DIVERGENTE`: a Conferência afirmou uma conta corrente que o Omie não usaria mais, e só um Resumo novo pode ser conferido. O 422 `TITULO_EXISTENTE_DIVERGENTE` NÃO supera: a Conferência continua certa; o título no Omie é que se corrige ou se exclui. |
| `conferenciaDoResumo(state, task)` | `sem-resumo` \| `pendente` \| `conferida` \| `ajuste-pedido` \| `desatualizada`, mais a Conferência vigente e a impressão atual. `desatualizada` vence qualquer decisão. A vigente (`conferenciaVigente`, 06-12) é a Conferência MAIS RECENTE da Tarefa; se ela está `cancelada` ou `expirada`, nenhuma (`sem-resumo`) — uma Conferência antiga, rejeitada ou aprovada, nunca volta a valer. Antes de 06-12 era "a mais recente não cancelada"; como o único cancelamento de antes era o das pendentes mais antigas, todo fluxo anterior dá o mesmo resultado. |
| `respostasDeConferenciaPendentes` / `classificarRespostaDeConferencia` | As respostas de revisores ainda não decididas — excluídas as do processo pela autoria (Agente) e pela forma exata (`FORMAS_CANONICAS_DO_FIO`), nunca pelo emoji inicial (06-11, crm:WR-04) — e o que cada uma quer dizer (`aprovacao` \| `ajuste` \| `ignorar`), sem IA. Classificador **estrito: só a mensagem inteira aprova** (06-11, crm:CR-03): toda palavra no conjunto de aprovação, no máximo 6, sem dígito/símbolo/emoji além de 👍/✅, com um sinal de aprovação; "nada casou" é `ajuste` (Fluxo 6). |
| `decisaoDasRespostasPendentes(state, task, { aprovacaoPorComentario })` | 06-11 (crm:WR-04): percorre TODAS as respostas pendentes em ordem; o primeiro `ajuste` vence qualquer `aprovacao` do lote; sem ajuste, a primeira `aprovacao` só com `aprovacaoPorComentario` (D6-02). Devolve a resposta que decide e `ultimaLida`. Não decide nada: quem chama `decideProcessApproval` é a ponte. |
| `impressaoDeLancamento(state, task)` | JSON canônico (chaves ordenadas) de tudo o que vai ao Omie: Centro, Empresa, Categoria, fornecedor (tipo, documento, nome), forma, dado de pagamento, Valor, vencimento, Data de Emissão, Tag `conta *`, título e descrição. Anexo, Boleto, QR Code e Comentários NÃO entram. |
| `revisoresDoResumo(state)` | O Financeiro (quando Membro ativo) e os Membros ativos Administrador/Proprietário (D6-09). |
| `movidaDepoisDaImportacao(state, task)` | G1: a conta entra na ponte do Agente — nasceu na plataforma, ou foi importada do ClickUp e o último movimento de Status é posterior a `provenance.at`. A ponte (`apps/api`) não varre a importada parada, e a tela não mostra "Aguardando Resumo" para ela: a mesma régua nos dois lados. |
| `avisadoDaConferencia(state, ator, avisarId?)` | Quem os atos da Conferência mencionam: `avisarId` quando é Membro ativo, senão `avisadoDoLancamento`. É a opção aditiva `avisarId` de `publicarResumoParaConferencia` (Menção, chamada e aprovador) e de `registrarFalhaDoLancamento` (5º parâmetro) — a porta G3 da ponte para ambiente de teste (06-03). Não muda `revisoresDoResumo`. |
| `TEXTOS_DA_CONFERENCIA` | Os textos canônicos, em `operations/financeiro-textos.ts` (fora de `financeiro.ts` para não criar o ciclo `ai` ↔ `financeiro`) e reexportados por `financeiro.ts`: domínio, ponte e tela usam as mesmas strings. 06-11: `lancado` descreve os anexos pelo status real (`anexos n de m`, `k já estavam no título`, `anexos do primeiro envio`; nunca `sem anexos` com anexos pedidos, crm:IN-03); `recusaDesatualizada` e `recusaSemCodigo`; `tituloDivergente(payableId, campos)` e `contaDivergente(conferida, resolvida)`, o `motivo` de `registrarFalhaDoLancamento` para os 422 da v1.2 — só id do título, nomes de campo e rótulos de conta, nenhum valor. |

As três regras com dono (`06-CONTEXT.md`):

- **D6-10 — a tripla é DADO.** Conta · categoria · código e a impressão ficam
  em `ApprovalRequest.origin` (ramo `resumo`: `resumoCommentId`, `impressao`,
  `lancamento`). Nenhuma função lê a tripla do TEXTO de um Comentário — o
  texto do RESUMO é saída, e reparseá-lo é a fragilidade do legado. O
  `/lancar` recebe o código confirmado da Conferência.
- **D6-02 — "ok" no fio vale como conferência**, em nome de quem respondeu;
  qualquer outra resposta de revisor é pedido de ajuste; pergunta,
  "aguardando" e "vou verificar" são ignoradas. Quem transforma a resposta em
  decisão é a ponte (06-03), com `classificarRespostaDeConferencia` e
  `decideProcessApproval(..., { source: "comment" })`.
- **D6-03 — falha permanente volta para "para pagar"**, com o motivo no fio.
  A alternativa (ficar em "em lançamento omie") é tirar uma chamada a
  `changeTaskStatus` em `registrarFalhaDoLancamento`.

`runLancamentoAgent` não muda: continua sendo o caminho do Ensaio (D3-03) e da
A7 legada. O fio do Resumo pode ser resolvido à mão por quem o confere:
`resolveTaskComment` aceita, além do autor e do Administrador, o aprovador da
Conferência VIGENTE daquele fio ou um Membro de `revisoresDoResumo` — só para
RESOLVER (06-11, crm:IN-02). O aprovador de uma Conferência cancelada não
resolve, e ninguém reabre pela exceção: reabrir o fio não reabre a
Conferência, cuja decisão fica.
