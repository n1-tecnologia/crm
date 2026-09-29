# automacoes

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

O RELÓGIO do motor de Automações (AUTO-01): quem chama
`runScheduledAutomations` (`packages/dominio/src/operations/automations.ts`)
pelo menos uma vez por (Espaço de Trabalho, Lista, dia civil). Nenhuma regra
de negócio mora aqui — o que uma Automação faz, quando ela dispara e a
idempotência de "isto já rodou" são de `@n1/dominio`. Esta pasta só garante
que a chamada acontece.

| Arquivo | O que faz |
|---|---|
| `scheduler-worker.ts` | `criarSchedulerWorker()` — o poller: lease por `for update skip locked` sobre `plataforma.automacao_agenda`, catch-up do dia perdido, Ator de sistema, e o gate da primeira volta em ensaio. |
| `scheduler-worker.test.ts` | Os 19 casos (item Wave 0 de `03-VALIDATION.md`) — puros (a)-(e) e (s), os demais contra Postgres real. |
| `liberar.cli.ts` | CLI fino de liberação da primeira volta em ensaio — só compõe `liberarLista()`. |
| `invocar-agente.ts` (Plan 03-11; plano pós-auditoria 1.4; Plan 06-03) | `criarPonteDoAgente()` — a ponte HTTP do Agente de lançamento em DOIS momentos (Fase 6): publica o Resumo para conferência (`/resolver`), lê o fio, e só lança (`/lancar`, com o código conferido e os anexos) com a Conferência aprovada; e entrega ao scheduler acima uma `rodarAgenda` que nunca lança. |
| `invocar-agente.test.ts` | Puros e HTTP contra `servidorFalso` — todos sem `DATABASE_URL`; o cabeçalho do arquivo diz onde cada caso de 06-03 é provado. |
| `anexos-da-conta.ts` (Plan 06-03) | `anexosDaConta()` — os arquivos dos Campos Anexo/Boleto/QR Code e da Tarefa como `{ url, nome }` (URL assinada de 5 min, gerada logo antes do `/lancar`, nunca em log). |
| `ponte-ativa.ts` (Plan 06-03) | `registrarPonte()`/`cutucarPonte()` — o registro da ponte no processo, para a rota de operações cutucá-la (D6-12). |
| `contrato-contas-a-pagar-ponte.test.ts` | A ponte em dois momentos contra os exemplos canônicos v1/v1.1 do produtor. |

## Por que não é fila, e por que a tabela existe

A Automação de agenda não cruza limite de processo: `runScheduledAutomations`
é uma função pura chamada dentro da MESMA transação da Unidade de Trabalho
(`executar()`, `../persistencia/unidade-de-trabalho.ts`). O outbox
(`../persistencia/outbox-worker.ts`) existe para o que SAI do processo depois
do commit — por isso `scheduler-worker.ts` copia a FORMA do outbox (lease,
trava de concorrência única, classificação de erro, `sanitizarErro()`) e não
o seu papel de negócio: não há fila nova e não há watermark novo.

`plataforma.automacao_agenda` (03-01, `005-agenda-de-automacoes.sql`) não é
fonte de idempotência — essa continua em `AutomationExecution`/`jaRodou`, no
domínio. A tabela existe para duas coisas que só o banco dá: exclusão mútua
entre instâncias do `apps/api` (a reivindicação é `for update skip locked`) e
auditoria de "o dia foi processado" (uma linha `falhou`, ou `processando` com
`locked_at` vencido, é o sinal de que o processo caiu antes de fechar o dia).

## O vocabulário de `last_error_code`

A coluna se chama `last_error_code` porque é a que 03-01 criou; aqui ela
carrega o "motivo do último evento não rotineiro daquele dia" — uma coluna
`motivo` dedicada seria o refinamento óbvio numa migração futura (as
migrações são numeradas e imutáveis, DEC-10, e `005` já está aplicada).
`CODIGOS_DA_AGENDA` (`scheduler-worker.ts`) é o vocabulário fechado:

| Código | Quem escreve | Significa |
|---|---|---|
| `MARCO_ZERO` | Plan 03-10, ao terminar a importação histórica | Fixa o dia em que a agenda desta Lista começa a contar — nenhum dia anterior nasce. |
| `ENSAIO_PRIMEIRA_VOLTA` | `scheduler-worker.ts` | A primeira volta REAL desta (Espaço, Lista) mediu e não gravou — ver seção abaixo. |
| `LEASE_EXPIRADO` | `scheduler-worker.ts` | Uma linha `processando` tinha `locked_at` mais velho que `leaseMs`: o processo caiu antes de fechar o dia. |
| `RECUSA_DO_DOMINIO` | `scheduler-worker.ts` | `runScheduledAutomations`/`executar()` devolveram `ok: false` sem conflito de revisão (ex.: falta a concessão de `administrar`). |
| `CONFLITO_DE_REVISAO` | `scheduler-worker.ts` | `executar()` devolveu `{ conflito: true }` — transitório, a próxima volta tenta de novo. |
| `ERRO_INESPERADO` | `scheduler-worker.ts` | Exceção não classificada durante o processamento da linha. |

Quem lê `last_error_code`/`last_error_summary` para qualquer fim — log, CLI,
tela futura — importa `CODIGOS_DA_AGENDA` em vez de repetir os literais.

## A primeira volta em ensaio (Task 2, D3-03)

As contas importadas por 03-09/03-10 que ficam em `para pagar` com
vencimento no passado satisfazem `hoje >= disparo` em qualquer dia civil
futuro. Sem gate, a primeira volta do agendador sobre a Lista de Contas a
pagar dispararia A5/A6 (Comentário de cobrança) e A7 (invocação do Agente)
em lote, no dia seguinte à importação — nenhuma das contas importadas
autorizou isso, e não é um comportamento que se desfaz depois.

A primeira volta REAL de cada (Espaço, Lista) — a que `primeiraVoltaPendente`
identifica pela ausência de qualquer linha `concluido` cujo `last_error_code`
não seja `MARCO_ZERO` nem `ENSAIO_PRIMEIRA_VOLTA` — roda em ENSAIO: `rodarAgenda`
é chamada dentro da transação (o cálculo acontece de verdade), as contagens
são capturadas, e o resultado é forçado a `ok: false` para que a Unidade de
Trabalho desfaça tudo (`unidade-de-trabalho.ts`, o mesmo caminho de rollback
de uma recusa legítima do domínio). A linha fecha `concluido` com
`last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'` e as contagens do que TERIA
acontecido — nunca `failures[].title`/`.reason` (T-3-04).

Enquanto existir uma linha de ensaio não liberada para um par, `semear()` não
cria dia novo para ele — a Lista fica parada, visível, esperando gente.
Liberar é ato explícito:

```
npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>
```

`liberarLista()` só apaga o `last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'` das
linhas daquele par — nunca toca `MARCO_ZERO` e nunca toca outro par. Depois de
liberada, a volta seguinte processa de verdade. `ensaioNaPrimeiraVolta: false`
(opção do worker) desativa o gate inteiro — a porta para uma Lista que nasce
sem backlog e não precisa do ritual.

## Onde a ponte pluga no agendador

A ponte do Agente (`invocar-agente.ts`) entra no worker por um caminho só: a
opção `rodarAgenda`, cuja assinatura é a de `runScheduledAutomations` (tipo
`RodarAgenda`, exportado). Lease, catch-up, contabilidade da linha,
saneamento e o gate da primeira volta continuam intocados. Em `../index.ts`,
o bloco da ponte vem ANTES do bloco do agendador, porque este usa a
`rodarAgenda` daquela.

## Os dois momentos da ponte (Fase 6)

`06-CONTEXT.md` (D6-01..D6-04, D6-11, D6-12) em código. A cada ciclo — o
relógio (`AGENTE_CONTAS_A_PAGAR_INTERVALO_MS`, 15 min) ou uma cutucada —, a
ponte hidrata o Espaço só para LER e olha as contas ativas da Lista em "para
pagar" e "em lançamento omie" (ou só nesta, D6-01). Para cada conta:

1. **Integração manual** (D6-04): `nao-encosta` ⇒ nada (nem Resumo, nem
   `/lancar`, nem Comentário); `sem-conferencia` ⇒ segue, e a Conferência é
   dispensada pelo Membro de serviço (`decideProcessApproval`, clique, motivo
   "Conferência dispensada (Integração manual)"; o próprio Membro de serviço é
   o aprovador, para ninguém ser chamado a conferir o dispensado).
2. **Faltando dado** (`erpMissingFields`): em "em lançamento omie", o pedido de
   sempre, uma vez; em "para pagar", silêncio (a conta está sendo preenchida).
3. **`conferenciaDoResumo`** do domínio diz onde a conta está.
4. **`pendente`** ⇒ a última resposta de um revisor no fio
   (`respostasDeConferenciaPendentes` → `classificarRespostaDeConferencia`) vira
   `decideProcessApproval(..., { source: "comment" })` em nome de quem
   respondeu: aprovação ⇒ aprovada; ajuste ⇒ rejeitada com o texto; pergunta
   ou "vou verificar" ⇒ nada. Com `CONFERENCIA_POR_COMENTARIO=false`, só o
   clique aprova — o fio continua pedindo ajuste (D6-02).
5. **`sem-resumo` | `desatualizada` | `ajuste-pedido`** ⇒ Momento 1: UM
   `/resolver` (com `pedidoDeRevisao` e, se o pedido citar um `d.dd.dd`,
   `codigoCategoriaConfirmado`) e UM `publicarResumoParaConferencia` (`motivo:
   "dados-mudaram"` quando desatualizada). Em `ensaio`, só o log.
6. **`conferida`, em "em lançamento omie", entrou por movimento** ⇒ Momento 2:
   em `lancar`, `/lancar` (prazo 60 s, `Idempotency-Key`
   `tria:contas-a-pagar:<taskId>`) com `codigoCategoriaConfirmado` = o código
   da Conferência, `dataDeEmissao` e `anexos` = `anexosDaConta()`; sucesso ⇒
   `registrarLancamentoNoOmie` ("lançado omie"); falha permanente ⇒
   `registrarFalhaDoLancamento` (volta a "para pagar", D6-03); transitória ⇒
   contagem, e na terceira um aviso. Um Resumo conferido com a Categoria
   `ausente` no de-para (o código `9.99.99` é preenchimento) não vai ao Omie.
7. **`conferida` em "para pagar"** ⇒ nada: espera o humano mover.

| `AGENTE_CONTAS_A_PAGAR_MODO` (D6-11) | O que a ponte faz |
|---|---|
| ausente, vazio, ou qualquer valor que não seja um dos literais abaixo | `"ensaio"` (padrão): só `/resolver` e o log do que publicaria/lançaria — nenhum Comentário, nenhuma decisão, nenhum Status. |
| `"conferencia"` (literal, exato) | Resumos, leitura do fio, revisões e dispensas — e **zero** requisições a `/lancar`: com a conta conferida em "em lançamento omie", comenta uma vez `Resumo conferido. Neste ambiente o lançamento no Omie está desligado (modo conferência)…`. |
| `"lancar"` (literal, exato) | Tudo, inclusive o `/lancar` — só com Conferência aprovada para os dados atuais. |

Os modos que gravam exigem `PLATAFORMA_LANCAMENTO_TOKEN` e
`AGENTE_CONTAS_A_PAGAR_URL`; sem eles, nenhuma requisição.

| Variável | Valores (padrão primeiro) | Decisão |
|---|---|---|
| `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE` | `para-pagar` \| `em-lancamento-omie` | D6-01 |
| `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` | `true` \| `false` | D6-02 |
| `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL` | `nao-encosta` \| `sem-conferencia` | D6-04 |
| `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` | vazio \| um texto | G2 (só teste) |
| `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` | vazio \| id de Membro | G3 (só teste) |

Valor desconhecido nas três primeiras ⇒ o padrão, com aviso que nomeia a
variável. A linha de partida do log diz `modo=…`, `resumoAPartirDe=…`,
`escopo=todas` ou `escopo=titulos-com:"…"`, e `avisar=financeiro|membro-indicado`.

**A cutucada (D6-12).** Depois de `setTaskFieldValue`, `updateTask`,
`changeTaskStatus`, `addTaskComment`, `setTaskTags`, `resolveTaskComment`,
`decideProcessApproval` ou `alterarStatusEmLote` com sucesso numa Tarefa do
par da ponte, `rotas/operacoes.ts` chama `cutucarPonte()` — DEPOIS do commit,
nunca dentro da transação, e sem lançar. A ponte roda um ciclo em até 2 s; N
cutucadas nesse intervalo viram um ciclo, e uma cutucada durante um ciclo em
voo vira exatamente um ciclo a mais, logo depois dele. `parar()` cancela a
cutucada pendente.

**A parada por chave.** A "uma vez só" de 1.4 continua, com uma chave mais
larga que a impressão de antes: `impressaoDeLancamento` do domínio (D6-10) +
Status + o Registro da última mudança de Status + a Conferência vigente e a
sua decisão. Uma recusa comentada para a conta até essa chave mudar.

**As guardas para ambiente de teste (desvios G1–G3 de 06-03, dirigidos pelo
orquestrador).** A prova de 06-06 roda esta ponte em `conferencia` contra
`ws_n1`, onde estão as contas reais importadas do ClickUp (03-09/03-10) e a
Maryane real:

- **G1 — o legado importado nunca é varrido.** Conta com `provenance.kind ===
  "import"` só entra na ponte depois de um movimento de Status feito AQUI,
  posterior a `provenance.at` (a régua de `entrouPorMovimento`,
  `movidaDepoisDaImportacao`). Sem isso, zero `/resolver` e zero Comentários
  (em qualquer modo); o ciclo só registra a CONTAGEM, quando ela muda. A
  única exceção é a de sempre: em `lancar`, a importada que está em "em
  lançamento omie" recebe, uma vez, o pedido de conferir no Omie
  (`TEXTO_NASCEU_EM_LANCAMENTO`).
- **G2 — `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM`.** Definida, os DOIS momentos
  (e a leitura do fio) só olham contas cujo título contém o texto —
  comparação exata, maiúsculas contam (ex.: `TESTE AUTOMATIZADO`). Vazia
  (produção): todas.
- **G3 — `AGENTE_CONTAS_A_PAGAR_AVISAR_ID`.** Definida e Membro ATIVO no
  ciclo: toda Menção da ponte vai a esse Membro no lugar do Financeiro — o
  Resumo (e o aprovador da Conferência, `OpcoesDaConferencia.avisarId`), o
  aviso de falha (`registrarFalhaDoLancamento`, opção `avisarId`) e os
  Comentários da própria ponte. Definida mas não Membro ativo: um aviso no
  log (uma vez) e a regra de sempre — nunca uma Menção a quem não é Membro.
  `revisoresDoResumo` NÃO muda: o Financeiro e os Administradores continuam
  revisores; com o aprovador trocado, decide por comentário quem for revisor
  E puder decidir (`mayDecideApproval`: o aprovador indicado ou um
  Administrador/Proprietário).

Produção deixa G2 e G3 vazias.

## A ponte do Agente (`invocar-agente.ts`) — o que vem de 03-11 e 1.4

O registro histórico de antes da Fase 6. Onde divergir de "Os dois momentos
da ponte (Fase 6)" — sobretudo em (1): a ponte não lança mais ao entrar em
"em lançamento omie" sem Conferência, e o Resumo sai ANTES, pelo domínio —,
vale a seção de cima.

**(1) O gatilho é o Status, não o calendário** (plano pós-auditoria,
`docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`, 1.4 e
1.5). A cada ciclo (`AGENTE_CONTAS_A_PAGAR_INTERVALO_MS`, padrão 15 min), a
ponte hidrata o Espaço só para LER e olha as contas ativas da Lista
configurada em "em lançamento omie". Para cada uma: confere o que o Omie
exige (`erpMissingFields`, a mesma regra da saída de "para pagar"), chama
`/resolver` (prazo 10 s) e `/lancar` (prazo 60 s, `Idempotency-Key`
determinística) e, com o lançamento confirmado, publica o Resumo e move a
conta para "lançado omie" numa Unidade de Trabalho só. Nenhuma chamada nasce
para conta em "para pagar": o antigo `aquecer()`, que chamava `/resolver`
para todas elas a cada ciclo por causa da A7, saiu junto com a A7.

**(2) Só o que entrou por movimento.** `entrouPorMovimento` exige que o
último Registro "Status alterado" da conta seja a entrada em "em lançamento
omie" feita na plataforma. A importação do ClickUp também escreve esses
Registros (a trilha do `status_history`), mas sempre com instante anterior
ao da importação (`provenance.at`) — é assim que a conta que NASCEU no Status
é reconhecida. Ela pode já ter sido lançada no Omie pelo processo antigo,
com outro código de integração; a ponte não a lança e pede, uma vez, que
alguém confira e a mova para "para pagar" e de volta. Conta com "Integração
manual" = Manual não é do Agente: nenhuma chamada, nenhum Comentário.

**(3) Uma vez só.** A ponte guarda em memória, por conta, a impressão digital
do que decide o lançamento (Campos, vencimento, Tags, Status e o id do
Registro da entrada). Depois de uma recusa comentada — dado faltando, erro
permanente do `automation/` (`Não consegui lançar no Omie: <details.motivo>
(<code>).`), categoria sem confiança, lançamento não confirmado, ou a
terceira falha transitória seguida (`O Omie não respondeu depois de 3
tentativas…`) — a conta não é mais processada até a impressão mudar: alguém
corrigir um Campo, ou a conta sair e voltar (a volta é um Registro novo).
Conta que sai do Status é esquecida. O `details.motivo` vai para o
Comentário, nunca para o log (T-3-04). A recusa menciona o Financeiro
(`avisadoDoLancamento`), não o Membro de serviço que assina.

**(4) Os modos.** Eram dois (D3-03); desde 06-03 são três — a tabela está
em "Os dois momentos da ponte (Fase 6)", acima. Um valor definido e
desconhecido (erro de digitação, `"true"`, `"Conferencia"`) cai em
`"ensaio"` COM aviso, nomeando só a variável — nunca o seu conteúdo.

**(5) `rodarAgenda` nunca lança.** Para o par configurado, passa ao motor
`lancamento: { rehearsal: false, tarefasLancadas: [], dePara: <vazio, origem
omie> }`: uma A7 legada que ainda esteja ativa falha "Lançamento não
confirmado" antes de invocar o Agente — nunca com o de-para do protótipo
(T-3-39) —, e as outras Automações por data (A5/A6) rodam normalmente, com
o CNPJ da Empresa injetado. Qualquer outro par (mesmo Espaço, outra Lista)
delega direto a `runScheduledAutomations`, sem opções.

**(6) PAG-04, a metade CNPJ, mora aqui.** `CNPJ_POR_EMPRESA` foi apagada de
`packages/dominio` (03-11, Task 1); o token `{{cnpjEmpresa}}` de A5 passa a
ler `AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA` (`lerCnpjPorEmpresa()`, que
derruba o mapa INTEIRO ao primeiro valor fora do formato de CNPJ — meia
tabela é pior que nenhuma). Sem a variável, ou com a Empresa da Tarefa
ausente do mapa, o texto de A5 diz `da Empresa <nome>` — nunca um número
inventado.

**(7) Quem assina.** O Membro de serviço do Papel "Agente do pipeline"
(`resolverMembroAgenteDoPipeline`, só Membro ativo), criado por
`npm run solicitacoes:configurar -w @n1/api -- --apply` (plano pós-auditoria,
2.2). `AUTOMACOES_ATOR_MEMBER_ID` ainda sobrescreve, para teste manual.
